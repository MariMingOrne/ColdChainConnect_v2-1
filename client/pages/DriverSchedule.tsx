import { DriverScheduleView } from "@/components/driver/DriverScheduleView";

export function DriverSchedule() {
  return (
    <div className="max-w-2xl w-full mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="font-rajdhani text-2xl font-bold text-navy">My Deliveries</h1>
        <p className="text-sm text-muted">What to deliver on the selected day.</p>
      </div>
      <DriverScheduleView />
    </div>
  );
}
