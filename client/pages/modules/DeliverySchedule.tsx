import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { Booking } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status: Booking["status"]) {
  return {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    rejected: "bg-red-100 text-red-800",
    prep: "bg-purple-100 text-purple-800",
    ready: "bg-green-100 text-green-800",
  }[status];
}

export function DeliverySchedule() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = async () => {
    try {
      const response = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load delivery schedule");
      setBookings(await response.json());
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load delivery schedule");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchSchedule();
  }, [token]);

  const scheduledBookings = bookings
    .filter((booking) => booking.prepared_delivery_date)
    .sort((a, b) =>
      (a.prepared_delivery_date ?? "").localeCompare(b.prepared_delivery_date ?? "")
    );

  const bookingsByDate = scheduledBookings.reduce<Record<string, Booking[]>>(
    (groups, booking) => {
      const date = booking.prepared_delivery_date!;
      groups[date] = [...(groups[date] ?? []), booking];
      return groups;
    },
    {}
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSchedule();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return <div className="flex-1 px-6 py-8 text-sm text-muted">Loading delivery schedule…</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Delivery Schedule</h1>
          <p className="page-subtitle">Prepared delivery dates from customer orders</p>
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} className="btn-ghost w-fit">
          <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {scheduledBookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <CalendarDays className="mx-auto mb-3 text-muted" size={28} />
          <p className="font-semibold text-navy">No delivery dates scheduled</p>
          <p className="mt-1 text-sm text-muted">Add a prepared delivery date when creating an order.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(bookingsByDate).map(([date, dateBookings]) => (
            <section key={date} className="overflow-hidden rounded-xl border border-border bg-white">
              <div className="flex items-center gap-2 border-b border-border bg-off-white px-5 py-3">
                <CalendarDays size={18} className="text-accent-2" />
                <h2 className="font-semibold text-navy">{formatDate(date)}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted">
                  {dateBookings.length} {dateBookings.length === 1 ? "order" : "orders"}
                </span>
              </div>
              <div className="divide-y divide-border">
                {dateBookings.map((booking) => (
                  <div key={booking.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-navy">
                        {booking.customer?.store_name ?? "Unknown customer"}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Order #{booking.id.slice(0, 8)} · {booking.booking_items?.length ?? 0} items
                      </p>
                    </div>
                    <span className={`w-fit rounded px-2 py-1 text-sm capitalize ${statusClass(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
