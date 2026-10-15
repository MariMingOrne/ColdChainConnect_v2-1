import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pallet, Booking, Customer, Product, formatCustomerAddress } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { PalletStats } from "@/components/pallets/PalletStats";
import { PalletToolbar, PalletStatusFilter } from "@/components/pallets/PalletToolbar";
import { PalletTable, PalletEntry } from "@/components/pallets/PalletTable";
import { PalletDetail } from "@/components/pallets/PalletDetail";

export function BookingInventory() {
  const [searchParams] = useSearchParams();
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("order") ?? "");
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PalletStatusFilter>("all");
  const { token } = useAuth();

  const fetchAll = async () => {
    try {
      const [pRes, bRes, cRes, prRes] = await Promise.all([
        fetch("/api/pallets", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (pRes.ok) setPallets(await pRes.json());
      if (bRes.ok) setBookings(await bRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (prRes.ok) setProducts(await prRes.json());
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAll();
  }, [token]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchAll();
  };

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name || productId;

  const entries: PalletEntry[] = pallets.map((pallet) => {
    const order = bookings.find((b) => b.id === pallet.order_id);
    const customer = order ? customers.find((c) => c.id === order.customer_id) ?? null : null;
    return { pallet, customer };
  });

  const filteredEntries = entries.filter(({ pallet, customer }) => {
    if (statusFilter !== "all" && pallet.status !== statusFilter) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      pallet.id,
      pallet.order_id,
      customer?.store_name,
      customer ? formatCustomerAddress(customer) : undefined,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  const selected = entries.find((entry) => entry.pallet.id === selectedPalletId) ?? null;

  if (isLoading) return <div className="p-6 text-gray-500">Loading deliveries…</div>;

  return (
    <div className="flex-1 flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">Order pallets from Preparation, with product cost and value</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      <PalletStats pallets={pallets} />

      {selected ? (
        <PalletDetail
          pallet={selected.pallet}
          order={bookings.find((b) => b.id === selected.pallet.order_id) ?? null}
          customer={selected.customer}
          getProductName={getProductName}
          onBack={() => setSelectedPalletId(null)}
        />
      ) : (
        <>
          <PalletToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />

          {filteredEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-muted">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p>
                {pallets.length === 0
                  ? "No pallets created yet. Create pallets in the Preparation module."
                  : "No pallets match your search or filter."}
              </p>
            </div>
          ) : (
            <PalletTable entries={filteredEntries} onSelect={setSelectedPalletId} />
          )}
        </>
      )}
    </div>
  );
}
