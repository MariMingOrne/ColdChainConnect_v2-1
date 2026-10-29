import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { CalendarDays, Clock3, MapPin, PackageCheck, Phone, RefreshCw, Truck as TruckIcon, UserRound } from "lucide-react";
import type { AgentScheduleDelivery, AgentScheduleResponse, AgentScheduleStop, DeliveryItem } from "@shared/api";
import { formatCustomerAddress } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";

function formatScheduleDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function statusClasses(status: DeliveryItem["status"]) {
  if (status === "completed") return "border-green/20 bg-green/10 text-green";
  if (status === "in_transit") return "border-gold/30 bg-gold/10 text-navy";
  return "border-blue-200 bg-blue-50 text-navy";
}

export function AgentDeliverySchedule() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<AgentScheduleDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"current" | "history">("current");
  const [paymentStop, setPaymentStop] = useState<{ delivery: AgentScheduleDelivery; stop: AgentScheduleStop } | null>(null);
  const [confirmingStopId, setConfirmingStopId] = useState<string | null>(null);

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

  const confirmDelivery = async (isPaid: boolean, paymentMethod?: string, paymentReference?: string) => {
    if (!token || !paymentStop) return;
    setConfirmingStopId(paymentStop.stop.id);
    try {
      const response = await fetch(`/api/deliveries/${paymentStop.delivery.id}/items/${paymentStop.stop.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_paid: isPaid, payment_method: paymentMethod, payment_reference: paymentReference }),
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Assigned runs", currentDeliveries.length],
          ["Stops", stopCount],
          ["Completed", completedCount],
          ["Remaining", stopCount - completedCount],
        ].map(([label, count], index) => (
          <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2.5">
            <span className="text-xs font-medium text-muted">{label}</span>
            <span className={`font-rajdhani text-xl font-bold ${index === 2 ? "text-green" : index === 3 ? "text-accent-2" : "text-navy"}`}>{count}</span>
          </div>
        ))}
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
              {dayDeliveries.map((delivery) => (
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
                    {(delivery.delivery_items ?? []).map((stop, index) => {
                      const customer = stop.destination_customer;
                      const address = customer ? formatCustomerAddress(customer) : "Address unavailable";
                      const destination = customer?.latitude != null && customer.longitude != null
                        ? `${customer.latitude},${customer.longitude}`
                        : [customer?.store_name, address].filter(Boolean).join(", ");
                      const mapQuery = encodeURIComponent(destination);
                      const invoiceLabel = stop.invoice?.receipt_number ?? stop.invoice_id.slice(0, 8);

                      return (
                        <li key={stop.id} className="flex gap-3 p-4 sm:gap-4">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-navy">{customer?.store_name ?? "Destination unavailable"}</h3>
                                <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                                  <MapPin size={15} className="mt-0.5 shrink-0" />
                                  <span>{address}</span>
                                </p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(stop.status)}`}>
                                {stop.status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                              <span className="inline-flex items-center gap-1"><PackageCheck size={14} /> Invoice {invoiceLabel}</span>
                              {stop.sale_agent && <span>Sale by {stop.sale_agent.username}</span>}
                              {customer?.contact_info && <a href={`tel:${customer.contact_info}`} className="inline-flex items-center gap-1 text-navy hover:underline"><Phone size={14} />{customer.contact_info}</a>}
                              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" className="mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-accent-2 px-5 py-4 text-base font-bold text-white shadow-md transition hover:bg-accent active:scale-[0.99]">
                                <MapPin size={20} /> Open in Maps
                              </a>
                              {delivery.scheduled_date && <span className="inline-flex items-center gap-1"><Clock3 size={14} /> Scheduled run</span>}
                            </div>
                            <div className="mt-3 rounded-lg bg-off-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-navy">Pallets · {stop.pallets.length}</span>
                                {stop.invoice && (
                                  <Link
                                    to={`/booking-dispatch/preparation?order=${stop.invoice.booking_id}`}
                                    className="text-xs font-semibold text-accent hover:underline"
                                  >
                                    Track pallets
                                  </Link>
                                )}
                              </div>
                              {stop.pallets.length ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {stop.pallets.map((pallet) => (
                                    <span key={pallet.id} className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-muted">
                                      {pallet.id.slice(0, 8)} · {pallet.status === "draft" ? "Preparing" : pallet.status === "prepared" ? "Prepared" : pallet.status === "approved" ? "Ready" : "Shipped"}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-xs text-muted">No pallets created for this order yet.</p>
                              )}
                              {stop.status === "completed" ? (
                                <p className={`mt-3 text-xs font-semibold ${stop.is_paid ? "text-green" : "text-amber-700"}`}>
                                  {stop.is_paid ? `Paid${stop.payment_method ? ` · ${stop.payment_method.replace("_", " ")}` : ""}` : "Not paid · recorded in Accounts Receivable"}
                                </p>
                              ) : stop.pallets.length > 0 && stop.pallets.every((pallet) => pallet.status === "shipped") ? (
                                <button
                                  type="button"
                                  onClick={() => setPaymentStop({ delivery, stop })}
                                  disabled={confirmingStopId === stop.id}
                                  className="mt-3 min-h-12 w-full rounded-lg bg-green px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                                >
                                  Confirm delivery & payment
                                </button>
                              ) : (
                                <p className="mt-3 text-xs text-muted">Delivery confirmation is available once all pallets are shipped.</p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
      {paymentStop && (
        <DeliveryPaymentPrompt
          stop={paymentStop.stop}
          isConfirming={confirmingStopId === paymentStop.stop.id}
          onClose={() => setPaymentStop(null)}
          onConfirm={confirmDelivery}
        />
      )}
    </div>
  );
}

function DeliveryPaymentPrompt({ stop, isConfirming, onClose, onConfirm }: {
  stop: AgentScheduleStop;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: (isPaid: boolean, paymentMethod?: string, paymentReference?: string) => Promise<void>;
}) {
  const [isPaid, setIsPaid] = useState(false);
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
        <h2 id="delivery-payment-title" className="font-rajdhani text-xl font-bold text-navy">Confirm delivery</h2>
        <p className="mt-2 text-sm text-muted">Was payment received from {stop.destination_customer.store_name}?</p>
        {stop.invoice && (
          <p className="mt-2 text-sm font-semibold text-navy">
            Invoice {stop.invoice.receipt_number || stop.invoice.id.slice(0, 8)} · Amount due ₱{Number(stop.invoice.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setIsPaid(true)} className={`min-h-12 rounded-lg border-2 font-semibold ${isPaid ? "border-green bg-green/10 text-green" : "border-border text-navy"}`}>Paid</button>
          <button type="button" onClick={() => setIsPaid(false)} className={`min-h-12 rounded-lg border-2 font-semibold ${!isPaid ? "border-accent-2 bg-blue-50 text-accent-2" : "border-border text-navy"}`}>Not paid</button>
        </div>
        {isPaid ? (
          <div className="mt-4 space-y-3 rounded-lg bg-green-50 p-4">
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
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">This unpaid amount will be recorded in Accounts Receivable.</p>
        )}
        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} disabled={isConfirming} className="min-h-11 flex-1 rounded-lg border border-border px-4 text-sm font-semibold text-navy disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void onConfirm(isPaid, isPaid ? paymentMethod : undefined, isPaid ? paymentReference : undefined)} disabled={isConfirming} className="min-h-11 flex-1 rounded-lg bg-green px-4 text-sm font-bold text-white disabled:opacity-50">{isConfirming ? "Saving…" : "Confirm delivery"}</button>
        </div>
      </section>
    </div>
  );
}
