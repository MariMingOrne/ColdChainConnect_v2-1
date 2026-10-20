import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DriverSchedule, DriverScheduleStop } from "@shared/api";
import { DriverStopCard } from "./DriverStopCard";

function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return toIsoDate(new Date(year, month - 1, day + days));
}

export function DriverScheduleView({ driverId }: { driverId?: string }) {
  const token = useAuth((state) => state.token);
  const finishPostLoginLoading = useAuth((state) => state.finishPostLoginLoading);
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [schedule, setSchedule] = useState<DriverSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ date });
    if (driverId) params.set("driver_id", driverId);

    setIsLoading(true);
    fetch(`/api/driver-schedule?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not load schedule");
        }
        return response.json() as Promise<DriverSchedule>;
      })
      .then((data) => {
        setSchedule(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setIsLoading(false);
        finishPostLoginLoading();
      });
  }, [token, date, driverId]);

  const stops: DriverScheduleStop[] = schedule?.deliveries.flatMap((run) => run.delivery_items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDate((current) => shiftDate(current, -1))}
          className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy"
        >
          ‹ Prev
        </button>
        <input
          type="date"
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
          className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
        />
        <button
          type="button"
          onClick={() => setDate((current) => shiftDate(current, 1))}
          className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy"
        >
          Next ›
        </button>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}
      {isLoading && !schedule && <LoadingSpinner className="min-h-24" />}

      {schedule && !error && (
        <>
          <p className="text-xs text-muted">
            {stops.length} {stops.length === 1 ? "stop" : "stops"} scheduled for {schedule.date}
          </p>
          {stops.length === 0 ? (
            <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-muted">
              No deliveries scheduled for this day.
            </div>
          ) : (
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <DriverStopCard key={stop.id} stop={stop} index={index + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
