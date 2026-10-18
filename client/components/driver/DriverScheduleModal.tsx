import { Driver } from "@shared/api";
import { DriverScheduleView } from "./DriverScheduleView";

export function DriverScheduleModal({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-off-white rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">
            Delivery Schedule · {driver.full_name || "Driver"}
          </h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>
        <div className="p-6">
          <DriverScheduleView driverId={driver.id} />
        </div>
      </div>
    </div>
  );
}
