import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { Delivery, DeliveryItem, Truck, Invoice, Customer, Driver } from "@shared/api";

// ─── Extended types ────────────────────────────────────────────────────────────

interface DeliveryItemExt extends DeliveryItem {
  completed_at?: string;
  receipt_number?: string;
  // joined
  invoice?: Invoice;
  customer?: Customer;
}

interface DeliveryExt extends Delivery {
  delivery_items: DeliveryItemExt[];
  // joined
  truck?: Truck;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function statusBadgeClass(status: string) {
  return (
    status === "completed" ? "badge-green" :
    status === "in_transit" ? "badge-gold" :
    "badge-blue"
  );
}

function statusLabel(status: string) {
  return status === "in_transit" ? "In Transit" :
         status === "completed"  ? "Completed"  : "Pending";
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function DeliveryDispatch() {
  const { token } = useAuth();

  const [trucks,    setTrucks]    = useState<Truck[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryExt[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedTruck,    setSelectedTruck]    = useState<Truck | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryExt | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showAddDeliveryModal, setShowAddDeliveryModal] = useState(false);
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null); // itemId being confirmed

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [truckRes, driverRes, deliveryRes, invoiceRes, customerRes] = await Promise.all([
        fetch("/api/trucks",    { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/drivers",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/deliveries",{ headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/invoices",  { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [trucksData, driversData, deliveriesData, invoicesData, customersData] = await Promise.all([
        truckRes.ok    ? truckRes.json()    : [],
        driverRes.ok   ? driverRes.json()   : [],
        deliveryRes.ok ? deliveryRes.json() : [],
        invoiceRes.ok  ? invoiceRes.json()  : [],
        customerRes.ok ? customerRes.json() : [],
      ]);

      setTrucks(trucksData);
      setDrivers(driversData);
      setInvoices(invoicesData);
      setCustomers(customersData);

      // Join delivery_items with invoice + customer data
      const joined: DeliveryExt[] = (deliveriesData as DeliveryExt[]).map((d) => ({
        ...d,
        truck: (trucksData as Truck[]).find((t) => t.id === d.truck_id),
        delivery_items: (d.delivery_items ?? []).map((item) => ({
          ...item,
          invoice:  (invoicesData  as Invoice[]).find((inv) => inv.id === item.invoice_id),
          customer: (customersData as Customer[]).find((c)   => c.id === item.destination_customer_id),
        })),
      }));

      setDeliveries(joined);

      // Re-sync selected views
      if (selectedTruck) {
        const refreshedTruck = (trucksData as Truck[]).find((t) => t.id === selectedTruck.id);
        setSelectedTruck(refreshedTruck ?? null);
      }
      if (selectedDelivery) {
        const refreshed = joined.find((d) => d.id === selectedDelivery.id);
        setSelectedDelivery(refreshed ?? null);
      }

      setError(null);
    } catch (err) {
      setError("Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Deliveries for the selected truck ──────────────────────────────────────
  const truckDeliveries = selectedTruck
    ? deliveries.filter((d) => d.truck_id === selectedTruck.id)
    : [];

  // ── Confirm delivery item (admin side — mobile will hit same endpoint) ──────
  const handleConfirm = async (delivery: DeliveryExt, item: DeliveryItemExt) => {
    if (!token) return;
    setConfirmingItem(item.id);
    try {
      const res = await fetch(
        `/api/deliveries/${delivery.id}/items/${item.id}/confirm`,
        { method: "POST", headers: authHeaders(token), body: JSON.stringify({}) }
      );
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (err) {
      alert("Failed to confirm delivery: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setConfirmingItem(null);
    }
  };

  // ── Create new delivery for selected truck ─────────────────────────────────
  const handleCreateDelivery = async (destinations: { invoice_id: string; destination_customer_id: string }[]) => {
    if (!token || !selectedTruck) return;
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ truck_id: selectedTruck.id, destinations }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
      setShowAddDeliveryModal(false);
    } catch (err) {
      alert("Failed to create delivery: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // ── Eligible invoices: issued + unpaid, not already in an active delivery ──
  const assignedInvoiceIds = new Set(
    deliveries
      .filter((d) => d.status !== "completed")
      .flatMap((d) => d.delivery_items.map((i) => i.invoice_id))
  );
  const eligibleInvoices = invoices.filter(
    (inv) => inv.status === "issued" && inv.payment_status === "unpaid" && !assignedInvoiceIds.has(inv.id)
  );

  if (loading) {
    return (
      <div className="flex-1 px-6 py-8 text-sm text-muted">Loading deliveries…</div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
            Delivery & Dispatch
          </h1>
          <p className="text-xs text-muted mt-1">
            Assign invoices to trucks and track deliveries stop-by-stop
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => { setSelectedTruck(null); setSelectedDelivery(null); setShowDispatchModal(true); }}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            ＋ Dispatch New Truck
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-2 text-xs text-red">
          ⚠️ {error}
        </div>
      )}

      {/* Two-column layout: truck list + delivery detail */}
      <div className="flex gap-4 min-h-[500px]">

        {/* Left: Truck list */}
        <div className="w-72 flex-shrink-0 space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider px-1">Trucks</p>
          {trucks.length === 0 ? (
            <p className="text-xs text-muted px-1">No trucks registered yet.</p>
          ) : (
            trucks.map((truck) => {
              const td = deliveries.filter((d) => d.truck_id === truck.id);
              const active = td.filter((d) => d.status !== "completed").length;
              const isSelected = selectedTruck?.id === truck.id;
              return (
                <div
                  key={truck.id}
                  onClick={() => { setSelectedTruck(truck); setSelectedDelivery(null); }}
                  className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? "border-accent-2 shadow-md" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-rajdhani font-bold text-navy text-base leading-tight">{truck.name}</p>
                      <p className="text-xs text-muted mt-0.5">{truck.district}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(truck.status)}`}>
                      {truck.status === "in_transit" ? "In Transit" : truck.status === "maintenance" ? "Maintenance" : "Available"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-2">
                    {active} active deliver{active === 1 ? "y" : "ies"} · {td.length} total
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Delivery list for selected truck */}
        <div className="flex-1 space-y-4">
          {!selectedTruck ? (
            <div className="flex items-center justify-center h-full text-sm text-muted">
              ← Select a truck to view its deliveries
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Deliveries for {selectedTruck.name}
                  </p>
                  {selectedTruck.driver_id && (
                    <p className="text-xs text-muted mt-1">
                      Driver: <span className="font-semibold text-navy">{drivers.find((d) => d.id === selectedTruck.driver_id)?.id.slice(0, 8) || "—"}</span>
                      {drivers.find((d) => d.id === selectedTruck.driver_id)?.contact_info && (
                        <span className="text-muted"> ({drivers.find((d) => d.id === selectedTruck.driver_id)?.contact_info})</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowAddDeliveryModal(true)}
                  className="px-3 py-1.5 bg-navy text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  ＋ Add Delivery
                </button>
              </div>

              {truckDeliveries.length === 0 ? (
                <div className="bg-white rounded-xl border border-border p-6 text-center text-sm text-muted">
                  No deliveries for this truck yet.
                </div>
              ) : (
                truckDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                      selectedDelivery?.id === delivery.id ? "border-accent-2" : "border-border"
                    }`}
                  >
                    {/* Delivery header — click to expand */}
                    <div
                      className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-off-white/50 transition-colors"
                      onClick={() => setSelectedDelivery(
                        selectedDelivery?.id === delivery.id ? null : delivery
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${statusBadgeClass(delivery.status)}`}>
                          {statusLabel(delivery.status)}
                        </span>
                        <span className="font-mono text-xs text-muted">{delivery.id.slice(0, 8)}…</span>
                        <span className="text-xs text-muted">
                          {delivery.delivery_items.length} stop{delivery.delivery_items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{new Date(delivery.created_at).toLocaleDateString("en-PH")}</span>
                        <span>{selectedDelivery?.id === delivery.id ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Delivery stops table */}
                    {selectedDelivery?.id === delivery.id && (
                      <div className="border-t border-border">
                        {delivery.delivery_items.length === 0 ? (
                          <p className="px-5 py-4 text-xs text-muted">No stops assigned yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  {["Invoice", "Customer", "Status", "Receipt #", "Confirmed At", "Action"].map((h) => (
                                    <th key={h} className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold uppercase tracking-wider px-3 py-2.5 text-left border-b border-border whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {delivery.delivery_items.map((item) => (
                                  <tr key={item.id} className="border-b border-border hover:bg-off-white/40 transition-colors">
                                    <td className="px-3 py-3 font-mono text-navy">
                                      {item.invoice_id.slice(0, 8)}…
                                      {item.invoice && (
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-semibold ${
                                          item.invoice.status === "paid" ? "badge-green" : "badge-gold"
                                        }`}>
                                          {item.invoice.status}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-3 text-navy font-semibold">
                                      {item.customer?.store_name ?? item.destination_customer_id.slice(0, 8)}
                                      {item.customer?.location && (
                                        <p className="text-muted font-normal">{item.customer.location}</p>
                                      )}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                                        {statusLabel(item.status)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 font-mono text-navy">
                                      {item.receipt_number ?? <span className="text-muted">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-muted">
                                      {item.completed_at
                                        ? new Date(item.completed_at).toLocaleString("en-PH")
                                        : <span className="text-muted">—</span>
                                      }
                                    </td>
                                    <td className="px-3 py-3">
                                      {item.status === "completed" ? (
                                        <span className="text-xs text-green font-semibold">✅ Done</span>
                                      ) : (
                                        <button
                                          disabled={confirmingItem === item.id}
                                          onClick={() => handleConfirm(delivery, item)}
                                          className="px-3 py-1 bg-green text-white rounded text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                                        >
                                          {confirmingItem === item.id ? "Confirming…" : "✓ Confirm Delivery"}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Dispatch new truck modal (first delivery) */}
      {showDispatchModal && (
        <DispatchTruckModal
          trucks={trucks}
          drivers={drivers}
          eligibleInvoices={eligibleInvoices}
          customers={customers}
          token={token!}
          onClose={() => setShowDispatchModal(false)}
          onCreated={async (truckId, driverId, destinations) => {
            if (!token) return;
            try {
              const res = await fetch("/api/deliveries", {
                method: "POST",
                headers: authHeaders(token),
                body: JSON.stringify({ truck_id: truckId, driver_id: driverId, destinations }),
              });
              if (!res.ok) throw new Error(await res.text());
              await fetchAll();
              setShowDispatchModal(false);
            } catch (err) {
              alert("Failed to dispatch: " + (err instanceof Error ? err.message : String(err)));
            }
          }}
        />
      )}

      {/* Add another delivery to selected truck */}
      {showAddDeliveryModal && selectedTruck && (
        <AddDeliveryModal
          truck={selectedTruck}
          eligibleInvoices={eligibleInvoices}
          customers={customers}
          onClose={() => setShowAddDeliveryModal(false)}
          onSave={handleCreateDelivery}
        />
      )}
    </div>
  );
}

// ─── Dispatch New Truck Modal ──────────────────────────────────────────────────

function DispatchTruckModal({
  trucks, drivers, eligibleInvoices, customers, token, onClose, onCreated,
}: {
  trucks: Truck[];
  drivers: Driver[];
  eligibleInvoices: Invoice[];
  customers: Customer[];
  token: string;
  onClose: () => void;
  onCreated: (truckId: string, driverId: string, destinations: { invoice_id: string; destination_customer_id: string }[]) => Promise<void>;
}) {
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [stops, setStops] = useState<{ invoice_id: string; destination_customer_id: string }[]>([
    { invoice_id: "", destination_customer_id: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const addStop = () => setStops((s) => [...s, { invoice_id: "", destination_customer_id: "" }]);
  const removeStop = (i: number) => setStops((s) => s.filter((_, idx) => idx !== i));
  const updateStop = (i: number, field: "invoice_id" | "destination_customer_id", val: string) => {
    setStops((s) => s.map((stop, idx) => idx === i ? { ...stop, [field]: val } : stop));
  };

  // Auto-fill customer from invoice's booking
  const handleInvoiceChange = (i: number, invoiceId: string) => {
    updateStop(i, "invoice_id", invoiceId);
  };

  const valid = selectedTruckId && selectedDriverId;

  const handleSave = async () => {
    if (!valid) { alert("Please select a truck and driver."); return; }
    const filledStops = stops.filter((s) => s.invoice_id && s.destination_customer_id);
    setSaving(true);
    try { await onCreated(selectedTruckId, selectedDriverId, filledStops); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title="Dispatch New Truck" onClose={onClose}>
      <div className="space-y-5">
        {/* Truck picker */}
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Truck *</label>
          <select
            value={selectedTruckId}
            onChange={(e) => setSelectedTruckId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          >
            <option value="">Select a truck…</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.district} ({t.status})</option>
            ))}
          </select>
        </div>

        {/* Driver picker */}
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Driver *</label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          >
            <option value="">Select a driver…</option>
            {drivers
              .filter((d) => d.is_active)
              .map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.id.slice(0, 8)} {driver.contact_info && `— ${driver.contact_info}`}
                </option>
              ))}
          </select>
        </div>

        {/* Stops */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-navy">Delivery Stops</label>
            <button onClick={addStop} className="text-xs text-accent-2 font-semibold hover:opacity-80">＋ Add Stop</button>
          </div>
          <div className="space-y-3">
            {stops.map((stop, i) => (
              <StopRow
                key={i}
                index={i}
                stop={stop}
                invoices={eligibleInvoices}
                customers={customers}
                onInvoiceChange={(v) => handleInvoiceChange(i, v)}
                onCustomerChange={(v) => updateStop(i, "destination_customer_id", v)}
                onRemove={stops.length > 1 ? () => removeStop(i) : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-off-white">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="px-4 py-2 bg-accent-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Dispatching…" : "Dispatch Truck"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Add Delivery Modal ────────────────────────────────────────────────────────

function AddDeliveryModal({
  truck, eligibleInvoices, customers, onClose, onSave,
}: {
  truck: Truck;
  eligibleInvoices: Invoice[];
  customers: Customer[];
  onClose: () => void;
  onSave: (destinations: { invoice_id: string; destination_customer_id: string }[]) => Promise<void>;
}) {
  const [stops, setStops] = useState([{ invoice_id: "", destination_customer_id: "" }]);
  const [saving, setSaving] = useState(false);

  const addStop = () => setStops((s) => [...s, { invoice_id: "", destination_customer_id: "" }]);
  const removeStop = (i: number) => setStops((s) => s.filter((_, idx) => idx !== i));
  const updateStop = (i: number, field: "invoice_id" | "destination_customer_id", val: string) =>
    setStops((s) => s.map((stop, idx) => idx === i ? { ...stop, [field]: val } : stop));

  const valid = stops.every((s) => s.invoice_id && s.destination_customer_id);

  const handleSave = async () => {
    if (!valid) { alert("Fill in all stops."); return; }
    setSaving(true);
    try { await onSave(stops); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Add Delivery — ${truck.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-navy">Delivery Stops *</label>
          <button onClick={addStop} className="text-xs text-accent-2 font-semibold hover:opacity-80">＋ Add Stop</button>
        </div>
        {stops.map((stop, i) => (
          <StopRow
            key={i}
            index={i}
            stop={stop}
            invoices={eligibleInvoices}
            customers={customers}
            onInvoiceChange={(v) => updateStop(i, "invoice_id", v)}
            onCustomerChange={(v) => updateStop(i, "destination_customer_id", v)}
            onRemove={stops.length > 1 ? () => removeStop(i) : undefined}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-off-white">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="px-4 py-2 bg-accent-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add Delivery"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Stop Row ─────────────────────────────────────────────────────────────────

function StopRow({
  index, stop, invoices, customers, onInvoiceChange, onCustomerChange, onRemove,
}: {
  index: number;
  stop: { invoice_id: string; destination_customer_id: string };
  invoices: Invoice[];
  customers: Customer[];
  onInvoiceChange: (v: string) => void;
  onCustomerChange: (v: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="bg-off-white rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-navy">Stop {index + 1}</p>
        {onRemove && (
          <button onClick={onRemove} className="text-xs text-red hover:opacity-70">✕ Remove</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Invoice (issued & unpaid)</label>
          <select
            value={stop.invoice_id}
            onChange={(e) => onInvoiceChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-accent-2 bg-white"
          >
            <option value="">Select invoice…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.id.slice(0, 8)}… — {inv.status} / {inv.payment_status}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Destination Customer</label>
          <select
            value={stop.destination_customer_id}
            onChange={(e) => onCustomerChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-accent-2 bg-white"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.store_name} — {c.location}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({
  title, onClose, children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 flex-1">{children}</div>
      </div>
    </div>
  );
}
