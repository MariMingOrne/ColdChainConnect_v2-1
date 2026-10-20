import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { Booking, Customer, Invoice, InventoryBatch, Product, Truck } from "@shared/api";
import { useAuth } from "../hooks/useAuth";
import { EMPTY_SEARCH_DATA, SearchData, searchAll } from "../lib/globalSearch";
import { SearchResultGroup } from "../components/SearchResultGroup";

export function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const { token, user } = useAuth();
  const isAgent = user?.role === "agent";
  const [data, setData] = useState<SearchData>(EMPTY_SEARCH_DATA);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const fetchList = async <T,>(path: string): Promise<T[]> => {
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? res.json() : [];
    };
    const adminOnly = <T,>(path: string): Promise<T[]> =>
      isAgent ? Promise.resolve([]) : fetchList<T>(path);

    setIsLoading(true);
    Promise.all([
      fetchList<Booking>("/api/bookings"),
      adminOnly<Customer>("/api/customers"),
      adminOnly<Product>("/api/products"),
      adminOnly<InventoryBatch>("/api/inventory-batches"),
      adminOnly<Invoice>("/api/invoices"),
      adminOnly<Truck>("/api/trucks"),
    ])
      .then(([bookings, customers, products, inventoryBatches, invoices, trucks]) =>
        setData({ bookings, customers, products, inventoryBatches, invoices, trucks })
      )
      .catch(() => setData(EMPTY_SEARCH_DATA))
      .finally(() => setIsLoading(false));
  }, [token, isAgent]);

  const groups = useMemo(() => searchAll(data, query), [data, query]);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-3xl w-full mx-auto">
      <h1 className="text-2xl font-bold text-navy">
        {query.trim() ? `Results for “${query.trim()}”` : "Search"}
      </h1>

      {!query.trim() && (
        <p className="text-navy/60">Type a term in the search bar above to search all modules.</p>
      )}

      {query.trim() && isLoading && <LoadingSpinner className="min-h-24" />}

      {query.trim() && !isLoading && groups.length === 0 && (
        <p className="text-navy/60">No results found.</p>
      )}

      {!isLoading && groups.map((group) => <SearchResultGroup key={group.label} group={group} />)}
    </div>
  );
}
