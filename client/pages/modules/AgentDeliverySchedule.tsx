import { useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AgentStopRow } from "@/components/AgentStopRow";
import { CalendarDays, RefreshCw, Truck as TruckIcon, UserRound } from "lucide-react";
import type { AgentScheduleDelivery, AgentScheduleResponse, AgentScheduleStop } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { optimizeRouteOrder } from "@/lib/routeOrder";
import { statusClasses } from "@/lib/agentSchedule";
import { DeliveryRouteMap, type MapFocus } from "@/components/DeliveryRouteMap";

function formatScheduleDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function orderRunStops(stops: AgentScheduleStop[]) {
  const points = stops.map((stop) => ({
    id: stop.id,
    latitude: stop.destination_customer?.latitude,
    longitude: stop.destination_customer?.longitude,
    stop,
  }));
  const completed = points.filter((point) => point.stop.status === "completed");
  const pending = points.filter((point) => point.stop.status !== "completed");
  return [...completed, ...optimizeRouteOrder(pending)].map((point) => point.stop);
}

export function AgentDeliverySchedule() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<AgentScheduleDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"current" | "history">("current");
  const [paymentStop, setPaymentStop] = useState<{ delivery: AgentScheduleDelivery; stop: AgentScheduleStop; mode: "confirm" | "payment" } | null>(null);
  const [confirmingStopId, setConfirmingStopId] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);

  const fetchSchedule = async () => {
    if (!token) return;
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/agent-schedule", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not load your delivery schedule.");

      const schedule = await response.json() as AgentScheduleResponse;
      setDeliveries(schedule.deliveries);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load your delivery schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSchedule();
  }, [token]);

  const currentDeliveries = deliveries.filter((delivery) => delivery.status !== "completed");
  const mapDeliveries = currentDeliveries.filter((delivery) =>
    delivery.delivery_items.some((stop) => stop.destination_customer?.latitude != null && stop.destination_customer.longitude != null)
  );
  const historyDeliveries = deliveries.filter((delivery) => delivery.status === "completed");
  const visibleDeliveries = view === "current" ? currentDeliveries : historyDeliveries;
  const scheduledDays = useMemo(() => {
    const groups = new Map<string, AgentScheduleDelivery[]>();
    for (const delivery of visibleDeliveries) {
      const date = delivery.scheduled_date ?? delivery.created_at.slice(0, 10);
      groups.set(date, [...(groups.get(date) ?? []), delivery]);
    }
    return [...groups.entries()].sort(([a], [b]) => view === "current" ? a.localeCompare(b) : b.localeCompare(a));
  }, [view, visibleDeliveries]);

  const stopCount = currentDeliveries.reduce((total, delivery) => total + (delivery.delivery_items?.length ?? 0), 0);
  const completedCount = currentDeliveries.reduce(
    (total, delivery) => total + (delivery.delivery_items ?? []).filter((stop) => stop.status === "completed").length,
    0,
  );

  const confirmDelivery = async (isPaid: boolean, paymentAmount?: number, paymentMethod?: string, paymentReference?: string) => {
    if (!token || !paymentStop) return;
    const { delivery, stop, mode } = paymentStop;
    setConfirmingStopId(stop.id);
    try {
      const response = await fetch(`/api/deliveries/${delivery.id}/items/${stop.id}/${mode === "payment" ? "payment" : "confirm"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(mode === "payment"
          ? { payment_amount: paymentAmount, payment_method: paymentMethod, payment_reference: paymentReference }
          : { is_paid: isPaid, payment_amount: paymentAmount, payment_method: paymentMethod, payment_reference: paymentReference }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not confirm delivery.");
      }
      setPaymentStop(null);
      await fetchSchedule();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not confirm delivery.");
    } finally {
      setConfirmingStopId(null);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const showStopOnMap = (deliveryId: string, stopId: string) => {
    setMapFocus({ stopId, requestedAt: Date.now() });
    document.getElementById(`run-map-${deliveryId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex-1 flex flex-col gap-5 p-4 pb-24 md:p-6 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">My Delivery Schedule</h1>
          <p className="page-subtitle">Your assigned delivery runs, destinations, and stop details</p>
        </div>
        <Button onClick={() => void fetchSchedule()} variant="outline" className="flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {view === "current" && mapDeliveries.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-rajdhani text-xl font-bold text-navy">Delivery routes</h2>
          {mapDeliveries.map((delivery) => (
            <article key={delivery.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-off-white px-4 py-2.5 text-sm">
                <span className="font-semibold text-navy">{delivery.truck?.license_plate ?? "Truck not assigned"}</span>
                {delivery.truck?.district && <span className="text-muted">{delivery.truck.district}</span>}
                <span className="text-muted">{delivery.delivery_items.length} stop{delivery.delivery_items.length === 1 ? "" : "s"}</span>
              </div>
              <DeliveryRouteMap
                deliveryId={delivery.id}
                stops={orderRunStops(delivery.delivery_items ?? [])}
                focus={mapFocus}
              />
            </article>
          ))}
        </section>
      )}

      <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
        <div className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-4">
          {[
            ["Assigned runs", currentDeliveries.length, "text-navy"],
            ["Stops", stopCount, "text-navy"],
            ["Completed", completedCount, "text-green"],
            ["Remaining", stopCount - completedCount, "text-accent-2"],
          ].map(([label, count, color]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">{label}</span>
              <span className={`font-rajdhani text-lg font-bold ${color}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {([ ["current", `Current schedule (${currentDeliveries.length})`], ["history", `History (${historyDeliveries.length})`] ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${view === value ? "border-accent-2 text-accent-2" : "border-transparent text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{error}</div>}

      {visibleDeliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
          <CalendarDays size={32} className="mx-auto mb-3 text-muted opacity-50" />
          <h2 className="font-semibold text-navy">{view === "current" ? "No current deliveries" : "No delivery history yet"}</h2>
          <p className="mt-1 text-sm text-muted">{view === "current" ? "Your active assigned runs will appear here." : "Completed delivery runs will be saved here."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {scheduledDays.map(([date, dayDeliveries]) => (
            <section key={date} className="space-y-3">
              <div className="flex items-center gap-2 text-navy">
                <CalendarDays size={18} />
                <h2 className="font-rajdhani text-xl font-bold">{formatScheduleDate(date)}</h2>
              </div>
              {dayDeliveries.map((delivery) => {
                const stops = orderRunStops(delivery.delivery_items ?? []);
                return (
                  <article key={delivery.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-off-white px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className="inline-flex items-center gap-2 font-semibold text-navy">
                          <TruckIcon size={17} />
                          {delivery.truck?.license_plate ?? "Truck not assigned"}
                        </span>
                        {delivery.truck?.district && <span className="text-muted">{delivery.truck.district}</span>}
                        {delivery.agent && (
                          <span className="inline-flex items-center gap-1 text-muted">
                            <UserRound size={14} /> Agent: {delivery.agent.full_name || "Assigned"}
                          </span>
                        )}
                        {delivery.driver && (
                          <span className="inline-flex items-center gap-1 text-muted">
                            <UserRound size={14} /> Driver: {delivery.driver.full_name || "Assigned"}
                          </span>
                        )}
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(delivery.status)}`}>
                        {delivery.status.replace("_", " ")}
                      </span>
                    </div>

                    <ol className="divide-y divide-border">
                      {stops.map((stop, index) => (
                        <AgentStopRow
                          key={stop.id}
                          index={index}
                          stop={stop}
                          showMapAction={view === "current"}
                          isConfirming={confirmingStopId === stop.id}
                          onShowOnMap={(stopId) => showStopOnMap(delivery.id, stopId)}
                          onConfirmPayment={() => setPaymentStop({ delivery, stop, mode: "confirm" })}
                          onRecordPayment={() => setPaymentStop({ delivery, stop, mode: "payment" })}
                        />
                      ))}
                    </ol>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {paymentStop && (
        <DeliveryPaymentPrompt
          stop={paymentStop.stop}
          mode={paymentStop.mode}
          isConfirming={confirmingStopId === paymentStop.stop.id}
          onClose={() => setPaymentStop(null)}
          onConfirm={confirmDelivery}
        />
      )}
    </div>
  );
}

function DeliveryPaymentPrompt({ stop, mode, isConfirming, onClose, onConfirm }: {
  stop: AgentScheduleStop;
  mode: "confirm" | "payment";
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: (isPaid: boolean, paymentAmount?: number, paymentMethod?: string, paymentReference?: string) => Promise<void>;
}) {
  const isRecordingPayment = mode === "payment";
  const invoiceAmount = Number(stop.invoice?.total_amount ?? 0);
  const amountDue = isRecordingPayment ? Number(stop.outstanding_amount ?? invoiceAmount) : invoiceAmount;
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "unpaid">(isRecordingPayment ? "paid" : "unpaid");
  const [paymentAmount, setPaymentAmount] = useState(amountDue.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const paymentMethods = [
    ["cash", "Cash"],
    ["check", "Check"],
    ["bank_transfer", "Bank transfer"],
    ["online", "Online payment"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="delivery-payment-title" className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl">
        <h2 id="delivery-payment-title" className="font-rajdhani text-xl font-bold text-navy">{isRecordingPayment ? "Record payment" : "Confirm delivery"}</h2>
        <p className="mt-2 text-sm text-muted">
          {isRecordingPayment
            ? `Record payment collected from ${stop.destination_customer.store_name}.`
            : `How much payment was received from ${stop.destination_customer.store_name}?`}
        </p>
        {stop.invoice && (
          <p className="mt-2 text-sm font-semibold text-navy">
            Invoice {stop.invoice.receipt_number || stop.invoice.id.slice(0, 8)} · {isRecordingPayment ? "Outstanding balance" : "Amount due"} ₱{amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        )}
        {!isRecordingPayment && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {([ ["paid", "Paid"], ["partial", "Partial"], ["unpaid", "Not paid"] ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => { setPaymentStatus(value); setPaymentAmount(value === "paid" ? amountDue.toFixed(2) : value === "partial" ? "" : "0.00"); }} className={`min-h-12 rounded-lg border-2 px-2 text-sm font-semibold ${paymentStatus === value ? value === "unpaid" ? "border-accent-2 bg-blue-50 text-accent-2" : "border-green bg-green/10 text-green" : "border-border text-navy"}`}>{label}</button>
            ))}
          </div>
        )}
        {(isRecordingPayment || paymentStatus !== "unpaid") ? (
          <div className="mt-4 space-y-3 rounded-lg bg-green-50 p-4">
            {(isRecordingPayment || paymentStatus === "partial") && (
              <p className="text-xs text-muted">Remaining after payment: ₱{Math.max(0, amountDue - (Number(paymentAmount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            )}
            <label className="block text-xs font-semibold text-navy">
              Amount collected (₱)
              <input type="number" min="0.01" max={amountDue} step="0.01" value={paymentAmount} onChange={(event) => { const value = event.target.value; setPaymentAmount(value); if (!isRecordingPayment) setPaymentStatus(Number(value) >= amountDue ? "paid" : "partial"); }} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal" />
            </label>
            <label className="block text-xs font-semibold text-navy">
              Payment method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal">
                {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-navy">
              Reference / receipt number (optional)
              <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal" />
            </label>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The outstanding balance will be recorded in Accounts Receivable.</p>
        )}
        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} disabled={isConfirming} className="min-h-11 flex-1 rounded-lg border border-border px-4 text-sm font-semibold text-navy disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void onConfirm(paymentStatus === "paid", paymentStatus === "unpaid" ? 0 : Number(paymentAmount), paymentStatus === "unpaid" ? undefined : paymentMethod, paymentStatus === "unpaid" ? undefined : paymentReference)} disabled={isConfirming || (paymentStatus !== "unpaid" && (!Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) <= 0 || Number(paymentAmount) > amountDue || (!isRecordingPayment && paymentStatus === "partial" && Number(paymentAmount) >= amountDue)))} className="min-h-11 flex-1 rounded-lg bg-green px-4 text-sm font-bold text-white disabled:opacity-50">{isConfirming ? "Saving…" : isRecordingPayment ? "Save payment" : "Confirm delivery"}</button>
        </div>
      </section>
    </div>
  );
}
