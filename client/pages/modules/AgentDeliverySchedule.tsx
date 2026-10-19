import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, PackageCheck, Phone, RefreshCw, Truck as TruckIcon } from "lucide-react";
import { Agent, Customer, Delivery, DeliveryItem, Invoice, Pallet, Truck, formatCustomerAddress } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";

interface ScheduleStop extends DeliveryItem {
  customer: Customer | null;
  invoice: Invoice | null;
  pallets: Pallet[];
}

interface ScheduleDelivery extends Delivery {
  scheduled_date?: string | null;
  truck?: Truck | null;
  delivery_items?: ScheduleStop[];
}

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
  const { token, user } = useAuth();
  const [deliveries, setDeliveries] = useState<ScheduleDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSchedule = async () => {
    if (!token || !user) return;
    setIsLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [agentRes, deliveryRes, truckRes, customerRes, invoiceRes, palletRes] = await Promise.all([
        fetch("/api/agents", { headers }),
        fetch("/api/deliveries", { headers }),
        fetch("/api/trucks", { headers }),
        fetch("/api/customers", { headers }),
        fetch("/api/invoices", { headers }),
        fetch("/api/pallets", { headers }),
      ]);

      if ([agentRes, deliveryRes, truckRes, customerRes, invoiceRes, palletRes].some((response) => !response.ok)) {
        throw new Error("Could not load your delivery schedule.");
      }

      const [agents, allDeliveries, trucks, customers, invoices, pallets] = await Promise.all([
        agentRes.json() as Promise<Agent[]>,
        deliveryRes.json() as Promise<ScheduleDelivery[]>,
        truckRes.json() as Promise<Truck[]>,
        customerRes.json() as Promise<Customer[]>,
        invoiceRes.json() as Promise<Invoice[]>,
        palletRes.json() as Promise<Pallet[]>,
      ]);

      const agent = agents.find((item) => item.user_id === user.id);
      const assigned = agent
        ? allDeliveries.filter((delivery) => delivery.agent_id === agent.id)
        : [];

      setDeliveries(assigned.map((delivery) => ({
        ...delivery,
        truck: trucks.find((truck) => truck.id === delivery.truck_id) ?? null,
        delivery_items: (delivery.delivery_items ?? []).map((stop) => ({
          ...stop,
          customer: customers.find((customer) => customer.id === stop.destination_customer_id) ?? null,
          invoice: invoices.find((invoice) => invoice.id === stop.invoice_id) ?? null,
          pallets: pallets.filter((pallet) =>
            pallet.order_id === invoices.find((invoice) => invoice.id === stop.invoice_id)?.booking_id,
          ),
        })),
      })));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load your delivery schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSchedule();
  }, [token, user?.id]);

  const scheduledDays = useMemo(() => {
    const groups = new Map<string, ScheduleDelivery[]>();
    for (const delivery of deliveries) {
      const date = delivery.scheduled_date ?? delivery.created_at.slice(0, 10);
      groups.set(date, [...(groups.get(date) ?? []), delivery]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [deliveries]);

  const stopCount = deliveries.reduce((total, delivery) => total + (delivery.delivery_items?.length ?? 0), 0);
  const completedCount = deliveries.reduce(
    (total, delivery) => total + (delivery.delivery_items ?? []).filter((stop) => stop.status === "completed").length,
    0,
  );

  if (isLoading) return <div className="p-6 text-gray-500">Loading your delivery schedule…</div>;

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Assigned runs</p>
          <p className="mt-1 font-rajdhani text-3xl font-bold text-navy">{deliveries.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total stops</p>
          <p className="mt-1 font-rajdhani text-3xl font-bold text-navy">{stopCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Completed</p>
          <p className="mt-1 font-rajdhani text-3xl font-bold text-green">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Remaining</p>
          <p className="mt-1 font-rajdhani text-3xl font-bold text-accent-2">{stopCount - completedCount}</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{error}</div>}

      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
          <CalendarDays size={32} className="mx-auto mb-3 text-muted opacity-50" />
          <h2 className="font-semibold text-navy">No deliveries assigned yet</h2>
          <p className="mt-1 text-sm text-muted">Your dispatcher’s assigned delivery runs will appear here.</p>
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
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(delivery.status)}`}>
                      {delivery.status.replace("_", " ")}
                    </span>
                  </div>

                  <ol className="divide-y divide-border">
                    {(delivery.delivery_items ?? []).map((stop, index) => {
                      const customer = stop.customer;
                      const address = customer ? formatCustomerAddress(customer) : "Address unavailable";
                      const mapQuery = encodeURIComponent([customer?.store_name, address].filter(Boolean).join(", "));
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
                              {customer?.contact_info && <a href={`tel:${customer.contact_info}`} className="inline-flex items-center gap-1 text-navy hover:underline"><Phone size={14} />{customer.contact_info}</a>}
                              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                                <MapPin size={14} /> Open in Maps
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
    </div>
  );
}
