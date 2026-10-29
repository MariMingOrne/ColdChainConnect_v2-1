import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pallet, Booking, Customer, Product, Truck, Invoice, Delivery, DeliveryItem, formatCustomerAddress } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { PalletStats } from "@/components/pallets/PalletStats";
import { PalletToolbar, PalletStatusFilter } from "@/components/pallets/PalletToolbar";
import { PalletTable, PalletEntry } from "@/components/pallets/PalletTable";
import { PalletDetail } from "@/components/pallets/PalletDetail";
import { DatePresetFilter, isInDatePreset } from "@/components/pallets/palletUtils";

type DeliveryWithItems = Delivery & { delivery_items?: DeliveryItem[] };

export function BookingInventory() {
  const [searchParams] = useSearchParams();
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryWithItems[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("order") ?? "");
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PalletStatusFilter>("all");
  const [truckFilter, setTruckFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePresetFilter>("all");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { token } = useAuth();

  const fetchAll = async () => {
    try {
      const [pRes, bRes, cRes, prRes, tRes, dRes, iRes] = await Promise.all([
        fetch("/api/pallets", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/trucks", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/deliveries", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/invoices", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (pRes.ok) setPallets(await pRes.json());
      if (bRes.ok) setBookings(await bRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (prRes.ok) setProducts(await prRes.json());
      if (tRes.ok) setTrucks(await tRes.json());
      if (dRes.ok) setDeliveries(await dRes.json());
      if (iRes.ok) setInvoices(await iRes.json());
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

  const handleStatusChange = async (palletId: string, status: Pallet["status"]) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/pallets/${palletId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update pallet status");
      }
      const updated: Pallet & { invoice_pending_reason?: string } = await res.json();
      if (updated.invoice_pending_reason) alert(updated.invoice_pending_reason);
      setPallets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update pallet status");
    } finally {
      setIsUpdatingStatus(false);
    }
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
    if (!isInDatePreset(pallet.created_at, datePreset)) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      pallet.id,
      pallet.order_id,
      customer?.store_name,
      customer ? formatCustomerAddress(customer) : undefined,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  const truckByBookingId = new Map<string, string>();
  for (const delivery of deliveries) {
    for (const item of delivery.delivery_items ?? []) {
      const invoice = invoices.find((inv) => inv.id === item.invoice_id);
      if (invoice && !truckByBookingId.has(invoice.booking_id)) {
        truckByBookingId.set(invoice.booking_id, delivery.truck_id);
      }
    }
  }

  const truckIdFor = (pallet: Pallet) => pallet.truck_id ?? truckByBookingId.get(pallet.order_id);

  const palletGroups: { truck: Truck | null; entries: PalletEntry[] }[] = [
    ...[...trucks]
      .sort((a, b) => a.license_plate.localeCompare(b.license_plate))
      .map((truck) => ({
        truck,
        entries: filteredEntries.filter(({ pallet }) => truckIdFor(pallet) === truck.id),
      })),
    { truck: null, entries: filteredEntries.filter(({ pallet }) => !truckIdFor(pallet)) },
  ].filter((group) => group.entries.length > 0);

  const truckOptions = [
    { value: "all", label: "All trucks" },
    ...[...trucks]
      .sort((a, b) => a.license_plate.localeCompare(b.license_plate))
      .map((truck) => ({ value: truck.id, label: `${truck.license_plate} · ${truck.district}` })),
    { value: "unassigned", label: "Unassigned" },
  ];

  const visiblePalletGroups = palletGroups.filter(
    (group) => truckFilter === "all" || (group.truck?.id ?? "unassigned") === truckFilter
  );

  const visiblePallets = visiblePalletGroups.flatMap((group) => group.entries.map(({ pallet }) => pallet));

  const selected = entries.find((entry) => entry.pallet.id === selectedPalletId) ?? null;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex-1 flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Pallet Tracking</h1>
          <p className="page-subtitle">Track the status, contents, and value of every pallet</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      <PalletStats pallets={visiblePallets} />

      {selected ? (
        <PalletDetail
          pallet={selected.pallet}
          order={bookings.find((b) => b.id === selected.pallet.order_id) ?? null}
          customer={selected.customer}
          getProductName={getProductName}
          onStatusChange={(status) => handleStatusChange(selected.pallet.id, status)}
          isUpdatingStatus={isUpdatingStatus}
          onBack={() => setSelectedPalletId(null)}
        />
      ) : (
        <>
          <PalletToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            truckOptions={truckOptions}
            truckFilter={truckFilter}
            onTruckChange={setTruckFilter}
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
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
            <div className="flex flex-col gap-6">
              {visiblePalletGroups.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-muted">
                  No pallets for this truck.
                </div>
              )}
              {visiblePalletGroups.map((group) => (
                <section key={group.truck?.id ?? "unassigned"} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-navy">{group.truck?.license_plate ?? "Unassigned"}</h2>
                      <p className="text-xs text-muted">{group.truck?.district ?? "Pallets not yet on a truck"}</p>
                    </div>
                    <span className="text-sm text-muted">
                      {group.entries.length} pallet{group.entries.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <PalletTable entries={group.entries} onSelect={setSelectedPalletId} />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
