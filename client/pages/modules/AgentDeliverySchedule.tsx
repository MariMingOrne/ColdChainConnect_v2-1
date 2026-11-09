import { useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AgentStopRow } from "@/components/AgentStopRow";
import { CalendarDays, Clock3, History, RefreshCw, Search, Truck as TruckIcon, UserRound } from "lucide-react";
import type { AgentScheduleDelivery, AgentScheduleResponse, AgentScheduleStop } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { optimizeRouteOrder } from "@/lib/routeOrder";
import { localScheduleDate, statusClasses } from "@/lib/agentSchedule";
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

function formatScheduleTime(value?: string | null) {
  if (!value) return "Time not set";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function filterRuns(deliveries: AgentScheduleDelivery[], dateFilter: string, fromTime: string, search: string) {
  const query = search.trim().toLowerCase();
  return deliveries.flatMap((delivery) => {
    const date = delivery.scheduled_date ?? localScheduleDate(new Date(delivery.created_at));
    if (dateFilter && date !== dateFilter) return [];
    if (fromTime && (!delivery.scheduled_time || delivery.scheduled_time < fromTime)) return [];

    const runDetails = [date, formatScheduleDate(date), delivery.scheduled_time, formatScheduleTime(delivery.scheduled_time), delivery.truck?.license_plate, delivery.truck?.district, delivery.agent?.full_name, delivery.driver?.full_name, delivery.status].join(" ").toLowerCase();
    if (!query || runDetails.includes(query)) return [delivery];

    const matchingStops = (delivery.delivery_items ?? []).filter((stop) => [
      stop.destination_customer?.store_name,
      stop.invoice?.receipt_number,
      stop.invoice_id,
      stop.status,
    ].join(" ").toLowerCase().includes(query));
    return matchingStops.length ? [{ ...delivery, delivery_items: matchingStops }] : [];
  });
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
  const [view, setView] = useState<"today" | "history">("today");
  const [search, setSearch] = useState("");
  const [scheduleDate, setScheduleDate] = useState(() => localScheduleDate(new Date()));
  const [scheduleTime, setScheduleTime] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyTime, setHistoryTime] = useState("");
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

  const today = localScheduleDate(new Date());
  const currentDeliveries = deliveries.filter((delivery) => delivery.status !== "completed");
  const todayDeliveries = currentDeliveries.filter((delivery) =>
    (delivery.scheduled_date ?? localScheduleDate(new Date(delivery.created_at))) === today
  );
  const historyDeliveries = deliveries.filter((delivery) => delivery.status === "completed");
  const filteredTodayDeliveries = useMemo(
    () => filterRuns(currentDeliveries, scheduleDate, scheduleTime, search),
    [deliveries, scheduleDate, scheduleTime, search],
  );
  const filteredHistoryDeliveries = useMemo(
    () => filterRuns(historyDeliveries, historyDate, historyTime, search),
    [deliveries, historyDate, historyTime, search],
  );
  const visibleDeliveries = view === "today" ? filteredTodayDeliveries : filteredHistoryDeliveries;
  const scheduledDays = useMemo(() => {
    const groups = new Map<string, AgentScheduleDelivery[]>();
    for (const delivery of visibleDeliveries) {
      const date = delivery.scheduled_date ?? localScheduleDate(new Date(delivery.created_at));
      groups.set(date, [...(groups.get(date) ?? []), delivery]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => view === "today" ? a.localeCompare(b) : b.localeCompare(a))
      .map(([date, runs]) => [date, [...runs].sort((a, b) => (a.scheduled_time ?? "99:99").localeCompare(b.scheduled_time ?? "99:99"))] as const);
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

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-pressed={view === "today"}
          onClick={() => setView("today")}
          className={`rounded-xl border p-3 text-left transition ${view === "today" ? "border-accent-2 bg-accent-2/5 shadow-sm" : "border-border bg-white hover:border-accent-2/50"}`}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-navy"><CalendarDays size={17} /> Today</span>
          <span className="mt-1 block text-xs text-muted">{todayDeliveries.length} scheduled runs</span>
        </button>
        <button
          type="button"
          aria-pressed={view === "history"}
          onClick={() => setView("history")}
          className={`rounded-xl border p-3 text-left transition ${view === "history" ? "border-accent-2 bg-accent-2/5 shadow-sm" : "border-border bg-white hover:border-accent-2/50"}`}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-navy"><History size={17} /> History</span>
          <span className="mt-1 block text-xs text-muted">{historyDeliveries.length} completed runs</span>
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{error}</div>}

      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
          <Search size={15} /> Search and filter {view === "today" ? "schedule" : "history"}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,auto)_minmax(130px,auto)]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-muted focus-within:border-accent-2">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Truck, agent, store, or invoice"
              aria-label={`Search delivery ${view}`}
              className="w-full bg-transparent text-sm text-navy outline-none placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col justify-center rounded-lg border border-border px-3 py-1 text-[10px] font-semibold text-muted focus-within:border-accent-2">
            {view === "today" ? "Schedule date" : "History date"}
            <input
              type="date"
              value={view === "today" ? scheduleDate : historyDate}
              onChange={(event) => view === "today" ? setScheduleDate(event.target.value || today) : setHistoryDate(event.target.value)}
              aria-label={view === "today" ? "Filter schedule by date" : "Filter history by scheduled date"}
              className="w-full bg-transparent text-sm font-normal text-navy outline-none"
            />
          </label>
          <label className="flex flex-col justify-center rounded-lg border border-border px-3 py-1 text-[10px] font-semibold text-muted focus-within:border-accent-2">
            <span className="flex items-center gap-1"><Clock3 size={12} /> From time</span>
            <input
              type="time"
              value={view === "today" ? scheduleTime : historyTime}
              onChange={(event) => view === "today" ? setScheduleTime(event.target.value) : setHistoryTime(event.target.value)}
              aria-label={`Filter delivery ${view} from time`}
              className="w-full bg-transparent text-sm font-normal text-navy outline-none"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
          <span>{view === "history" && !historyDate ? "History date is optional; time filters show runs scheduled at or after that time." : "Time filters show runs scheduled at or after the selected time."} Runs without a saved time will not match a time filter.</span>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              if (view === "today") { setScheduleDate(today); setScheduleTime(""); }
              else { setHistoryDate(""); setHistoryTime(""); }
            }}
            className="shrink-0 font-semibold text-accent-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      </div>

      {visibleDeliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
          <CalendarDays size={32} className="mx-auto mb-3 text-muted opacity-50" />
          <h2 className="font-semibold text-navy">{view === "today" ? "No matching runs" : historyDeliveries.length ? "No matching history" : "No delivery history yet"}</h2>
          <p className="mt-1 text-sm text-muted">{view === "today" ? "Adjust the date, time, or search to find scheduled runs." : historyDeliveries.length ? "Adjust the date, time, or search to find completed runs." : "Completed delivery runs will be saved here."}</p>
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
                        <span className="inline-flex items-center gap-1 text-muted"><Clock3 size={14} /> {formatScheduleTime(delivery.scheduled_time)}</span>
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

                    {view === "today" && (
                      <DeliveryRouteMap
                        key={delivery.id}
                        deliveryId={delivery.id}
                        stops={stops}
                        focus={mapFocus}
                      />
                    )}

                    <ol className="divide-y divide-border">
                      {stops.map((stop, index) => (
                        <AgentStopRow
                          key={stop.id}
                          index={index}
                          stop={stop}
                          showMapAction={view === "today"}
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
