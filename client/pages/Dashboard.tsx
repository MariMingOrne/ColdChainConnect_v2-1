import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuditLog, Booking, Delivery, Product } from "@shared/api";
import { describeLog, getActionBadgeClass, getActionLabel } from "./modules/audit/auditDescribe";
import { SalesForecastWidget } from "@/components/SalesForecastWidget";
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

function MetricCard({ label, value, detail, icon: Icon, accent, to, healthy = false }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ClipboardList;
  accent: string;
  to: string;
  healthy?: boolean;
}) {
  return (
    <Link to={to} className={`group block rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2 md:p-5 ${healthy ? "border-green-200 bg-green-50/70" : "border-border bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${healthy ? "text-green-800" : "text-navy"}`}>{value}</p>
          <p className={`mt-1 text-xs ${healthy ? "text-green-700" : "text-gray-500"}`}>{detail}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${accent}`}><Icon size={19} aria-hidden="true" /></span>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">View details <ArrowRight size={13} /></span>
    </Link>
  );
}

function AuditActionBadge({ action }: { action: string }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${getActionBadgeClass(action)}`}>{getActionLabel(action)}</span>;
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
              <div className="flex min-w-0 items-center gap-2">
                <AuditActionBadge action={log.action} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{log.user_name || "A user"} {describeLog(log).charAt(0).toLowerCase() + describeLog(log).slice(1)}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-gray-500">{log.resource_id ? `#${log.resource_id.slice(0, 6).toUpperCase()}` : "System activity"}</p>
                </div>
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
          <div className="relative flex flex-wrap items-center gap-2">
            <Link to="/booking-dispatch/order-summary?action=new" className="inline-flex items-center gap-2 rounded-lg bg-accent-2 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2">
              <ClipboardList size={16} aria-hidden="true" /> New booking
            </Link>
            <SalesForecastWidget />
            <Link to="/reports" className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2">
              <ChartNoAxesCombined size={16} aria-hidden="true" /> Reports
            </Link>
          </div>
        </header>

        {error && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Some dashboard metrics could not be loaded. Please refresh to try again.</p>}

        <section aria-label="Operations at a glance" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard to="/booking-dispatch/order-summary?status=pending" label="Pending orders" value={isLoading || !data ? "—" : String(data.pendingBookings)} detail="Awaiting review · open filtered list" icon={ClipboardList} accent="bg-blue-50 text-blue-700" />
          <MetricCard to="/information-management/inventory" label="Available inventory" value={isLoading || !data ? "—" : data.availableUnits.toLocaleString()} detail="Units available · open inventory" icon={Boxes} accent="bg-sky-50 text-sky-700" />
          <MetricCard to="/information-management/inventory" label="Low-stock products" value={isLoading || !data ? "—" : String(data.lowStockProducts)} detail={data?.lowStockProducts === 0 ? "All products above reorder point" : "At or below reorder point"} icon={TriangleAlert} accent={data?.lowStockProducts === 0 ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-700"} healthy={!isLoading && data?.lowStockProducts === 0} />
          <MetricCard to="/booking-dispatch/delivery" label="Active deliveries" value={isLoading || !data ? "—" : String(data.activeDeliveries)} detail="Pending or in transit · view dispatch" icon={Truck} accent="bg-green-50 text-green-700" />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <DashboardActivity logs={data?.activity ?? []} isLoading={isLoading} error={error} />
          <aside className="rounded-2xl border border-border bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-navy">Quick access</h2>
            <p className="mt-1 text-sm text-gray-500">Go straight to a key workspace.</p>
            <div className="mt-4 space-y-2">
              <Link to="/information-management/inventory?action=receive" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Receive stock <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/booking-dispatch/order-summary?status=pending" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Pending orders <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{isLoading ? "—" : data?.pendingBookings ?? 0}</span>
              </Link>
              <Link to="/booking-dispatch/delivery" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Active deliveries <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{isLoading ? "—" : data?.activeDeliveries ?? 0}</span>
              </Link>
              <Link to="/audit" className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-semibold text-navy hover:border-accent-2 hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-2">
                Administration · Audit Log <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
