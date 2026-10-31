import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuditLog, Booking, Delivery, Product } from "@shared/api";
import {
  Activity,
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  LoaderCircle,
  Truck,
  TriangleAlert,
} from "lucide-react";

type DashboardData = {
  pendingBookings: number;
  availableUnits: number;
  lowStockProducts: number;
  activeDeliveries: number;
  activity: AuditLog[];
};

function MetricCard({ label, value, detail, icon: Icon, accent }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ClipboardList;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-navy">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${accent}`}><Icon size={19} aria-hidden="true" /></span>
      </div>
    </div>
  );
}

function activityDescription(log: AuditLog) {
  const actor = log.user_name || "A user";
  const action = log.action.replace(/_/g, " ");
  const resource = log.resource_type.replace(/_/g, " ");
  return `${actor} ${action} ${resource}`;
}

function DashboardActivity({ logs, isLoading, error }: { logs: AuditLog[]; isLoading: boolean; error: string | null }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-navy"><Activity size={18} aria-hidden="true" /><h2 className="text-lg font-bold">Recent activity</h2></div>
          <p className="mt-1 text-sm text-gray-500">Latest recorded system actions</p>
        </div>
        <Link to="/audit" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-accent-2 hover:bg-accent-2/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
          View audit log <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />Loading activity…</div>
      ) : error ? (
        <p role="status" className="py-8 text-sm text-gray-500">Recent activity is unavailable right now.</p>
      ) : logs.length === 0 ? (
        <p className="py-8 text-sm text-gray-500">No activity has been recorded yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-border">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium capitalize text-navy">{activityDescription(log)}</p>
                <p className="mt-0.5 text-xs text-gray-500">{log.resource_id ? `Reference ${log.resource_id}` : "System activity"}</p>
              </div>
              <time dateTime={log.created_at} className="shrink-0 text-xs text-gray-500">
                {new Date(log.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function Dashboard() {
  const finishPostLoginLoading = useAuth((state) => state.finishPostLoginLoading);
  const token = useAuth((state) => state.token);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    finishPostLoginLoading();
  }, [finishPostLoginLoading]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const responses = await Promise.all([
          fetch("/api/bookings", { headers }),
          fetch("/api/products/inventory", { headers }),
          fetch("/api/products", { headers }),
          fetch("/api/deliveries", { headers }),
          fetch("/api/audit-logs?limit=5", { headers }),
        ]);
        if (responses.some((response) => !response.ok)) throw new Error("Dashboard data request failed");

        const [bookings, inventory, products, deliveries, activity] = await Promise.all(responses.map((response) => response.json())) as [Booking[], Record<string, number>, Product[], Delivery[], AuditLog[]];
        if (!active) return;

        const productById = new Map(products.map((product) => [product.id, product]));
        const lowStockProducts = Object.entries(inventory).filter(([productId, units]) => {
          const reorderPoint = productById.get(productId)?.reorder_point;
          return reorderPoint !== undefined && units <= reorderPoint;
        }).length;

        setData({
          pendingBookings: bookings.filter((booking) => booking.status === "pending").length,
          availableUnits: Object.values(inventory).reduce((total, units) => total + Number(units), 0),
          lowStockProducts,
          activeDeliveries: deliveries.filter((delivery) => delivery.status !== "completed").length,
          activity: activity.slice(0, 5),
        });
      } catch {
        if (active) setError("Dashboard data is unavailable.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadDashboard();
    return () => { active = false; };
  }, [token]);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-2">Admin overview</p>
            <h1 className="mt-1 text-3xl font-bold text-navy md:text-4xl">Cold Chain Connect</h1>
            <p className="mt-1 text-sm text-gray-600">A quick view of orders, stock, deliveries, and system activity.</p>
          </div>
          <Link to="/reports" className="inline-flex items-center gap-2 rounded-lg bg-accent-2 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2">
            <ChartNoAxesCombined size={17} aria-hidden="true" /> View reports <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </header>

        {error && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Some dashboard metrics could not be loaded. Please refresh to try again.</p>}

        <section aria-label="Operations at a glance" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Pending orders" value={isLoading || !data ? "—" : String(data.pendingBookings)} detail="Awaiting review" icon={ClipboardList} accent="bg-blue-50 text-blue-700" />
          <MetricCard label="Available inventory" value={isLoading || !data ? "—" : data.availableUnits.toLocaleString()} detail="Units available across products" icon={Boxes} accent="bg-sky-50 text-sky-700" />
          <MetricCard label="Low-stock products" value={isLoading || !data ? "—" : String(data.lowStockProducts)} detail="At or below reorder point" icon={TriangleAlert} accent="bg-amber-50 text-amber-700" />
          <MetricCard label="Active deliveries" value={isLoading || !data ? "—" : String(data.activeDeliveries)} detail="Pending or in transit" icon={Truck} accent="bg-green-50 text-green-700" />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <DashboardActivity logs={data?.activity ?? []} isLoading={isLoading} error={error} />
          <aside className="rounded-2xl border border-border bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-navy">Quick access</h2>
            <p className="mt-1 text-sm text-gray-500">Go straight to a key workspace.</p>
            <div className="mt-4 space-y-2">
              <Link to="/booking-dispatch/order-summary" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Orders <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/reports" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Reports <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/audit" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Audit Log <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
