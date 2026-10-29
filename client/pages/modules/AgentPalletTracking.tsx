import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ChevronDown, ChevronUp, Package, RefreshCw, Search } from "lucide-react";
import { Booking, Pallet, Product } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

interface TrackingPallet extends Pallet {
  order?: Booking;
}

type PalletFilter = "all" | Pallet["status"];

const statusLabels: Record<Pallet["status"], string> = {
  draft: "In preparation",
  prepared: "Prepared",
  approved: "Ready to dispatch",
  shipped: "Shipped",
};

function statusClasses(status: Pallet["status"]) {
  if (status === "shipped") return "bg-green/10 text-green";
  if (status === "approved") return "bg-blue-50 text-accent-2";
  if (status === "prepared") return "bg-gold/15 text-navy";
  return "bg-off-white text-muted";
}

export function AgentPalletTracking() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [pallets, setPallets] = useState<TrackingPallet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(searchParams.get("order") ?? "");
  const [filter, setFilter] = useState<PalletFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingPalletId, setUpdatingPalletId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchTracking = async () => {
    if (!token) return;
    setIsLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [bookingRes, palletRes, productRes] = await Promise.all([
        fetch("/api/bookings", { headers }),
        fetch("/api/pallets", { headers }),
        fetch("/api/products", { headers }),
      ]);

      if (!bookingRes.ok || !palletRes.ok || !productRes.ok) {
        throw new Error("Could not load pallet tracking.");
      }

      const [bookings, allPallets, productList] = await Promise.all([
        bookingRes.json() as Promise<Booking[]>,
        palletRes.json() as Promise<Pallet[]>,
        productRes.json() as Promise<Product[]>,
      ]);
      const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));

      setProducts(productList);
      setPallets(allPallets
        .filter((pallet) => bookingsById.has(pallet.order_id))
        .map((pallet) => ({ ...pallet, order: bookingsById.get(pallet.order_id) })));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load pallet tracking.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchTracking();
  }, [token]);

  const filteredPallets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pallets.filter((pallet) => {
      if (filter !== "all" && pallet.status !== filter) return false;
      if (!query) return true;
      return [
        pallet.id,
        pallet.order_id,
        pallet.order?.customer?.store_name,
        pallet.order?.customer?.location,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [filter, pallets, search]);

  const totalUnits = (pallet: Pallet) =>
    (pallet.items ?? []).reduce((sum, item) => sum + item.qty_units, 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchTracking();
  };

  const handleAdvancePallet = async (pallet: TrackingPallet) => {
    if (!token) return;
    if (pallet.status === "approved" && !window.confirm("Mark this pallet as shipped?")) return;

    setUpdatingPalletId(pallet.id);
    setError("");
    try {
      const isApproval = pallet.status === "prepared";
      const nextStatus = pallet.status === "draft" ? "prepared" : "shipped";
      const response = await fetch(
        isApproval ? `/api/pallets/${pallet.id}/approve` : `/api/pallets/${pallet.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          ...(!isApproval && { body: JSON.stringify({ status: nextStatus }) }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update pallet status.");

      if (data.invoice_pending_reason) setError(data.invoice_pending_reason);
      setPallets((current) => current.map((item) =>
        item.id === pallet.id ? { ...data, order: item.order } : item,
      ));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update pallet status.");
    } finally {
      setUpdatingPalletId(null);
    }
  };

  if (isLoading) return <LoadingSpinner className="fixed inset-0 z-0 min-h-0 bg-off-white" slow />;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 px-0 pb-24 pt-5 sm:px-4">
      <header className="flex items-start justify-between gap-3 px-4 sm:px-0">
        <div>
          <h1 className="font-rajdhani text-2xl font-bold text-navy">Pallet Tracking</h1>
          <p className="mt-0.5 text-sm text-muted">Track preparation and dispatch progress for your orders.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh pallets"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-navy transition hover:bg-off-white disabled:opacity-50"
        >
          <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {([
          ["Total", pallets.length],
          ["Preparing", pallets.filter((pallet) => pallet.status === "draft" || pallet.status === "prepared").length],
          ["Ready", pallets.filter((pallet) => pallet.status === "approved").length],
          ["Dispatched", pallets.filter((pallet) => pallet.status === "shipped").length],
        ] as const).map(([label, count]) => (
          <div key={label} className="rounded-2xl border border-border bg-white px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 font-rajdhani text-2xl font-bold text-navy">{count}</p>
          </div>
        ))}
      </div>

      <label className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-white px-3 text-muted focus-within:border-accent-2">
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search pallet, order, or customer"
          className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none placeholder:text-muted"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-4">
        {([
          ["all", "All"],
          ["draft", "Preparing"],
          ["prepared", "Prepared"],
          ["approved", "Ready"],
          ["shipped", "Shipped"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${filter === value ? "bg-navy text-white" : "border border-border bg-white text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl border border-red/20 bg-red/5 p-3 text-sm text-red">{error}</p>}

      {filteredPallets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-10 text-center">
          <Package size={30} className="mx-auto mb-3 text-muted" />
          <p className="font-semibold text-navy">{pallets.length ? "No matching pallets" : "No pallets yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {pallets.length ? "Try another search or status filter." : "Pallets for your orders will appear here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPallets.map((pallet) => {
            const isExpanded = expandedId === pallet.id;
            const customer = pallet.order?.customer;
            const items = pallet.items ?? [];

            return (
              <article key={pallet.id} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : pallet.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full flex-col gap-3 p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted">Pallet {pallet.id.slice(0, 8)}</p>
                      <h2 className="mt-0.5 truncate font-semibold text-navy">{customer?.store_name ?? "Customer order"}</h2>
                      <p className="mt-0.5 text-xs text-muted">Order {pallet.order_id.slice(0, 8)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(pallet.status)}`}>
                      {statusLabels[pallet.status]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span>{items.length} product{items.length === 1 ? "" : "s"} · {totalUnits(pallet)} units</span>
                    <span className="flex items-center gap-1 font-semibold text-accent-2">
                      {isExpanded ? "Hide items" : "View items"}
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-off-white/60 px-4 py-3">
                    {customer?.location && <p className="mb-2 text-xs text-muted">{customer.location}</p>}
                    {items.length ? (
                      <ul className="divide-y divide-border">
                        {items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="text-navy">{products.find((product) => product.id === item.product_id)?.name ?? item.product_id}</span>
                            <span className="shrink-0 font-semibold text-navy">× {item.qty_units}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">No pallet items recorded.</p>
                    )}
                    <p className="mt-2 text-[11px] text-muted">Updated {new Date(pallet.updated_at).toLocaleDateString()}</p>
                  </div>
                )}

                {pallet.status !== "shipped" && (
                  <div className="border-t border-border p-3">
                    <button
                      type="button"
                      onClick={() => void handleAdvancePallet(pallet)}
                      disabled={updatingPalletId !== null}
                      className="min-h-11 w-full rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-mid active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                    >
                      {updatingPalletId === pallet.id
                        ? "Updating…"
                        : pallet.status === "draft"
                          ? "Mark prepared"
                          : pallet.status === "prepared"
                            ? "Mark ready"
                            : "Mark shipped"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
