import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  ChartNoAxesCombined,
  Download,
  FileBarChart,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExcelColumn, exportExcelFile } from "@/lib/excel";
import type {
  ReportCustomerRow,
  ReportProductPerformance,
  ReportSalesPeriod,
  ReportSalesResponse,
  ReportStockRow,
} from "@shared/api";

type ReportTab = "overview" | "sales" | "inventory" | "customers" | "products" | "profit";
type ReportRow = ReportSalesPeriod | ReportStockRow | ReportCustomerRow | ReportProductPerformance;
type ReportData = {
  sales: ReportSalesResponse;
  stock: ReportStockRow[];
  customers: ReportCustomerRow[];
};

const getValue = (row: ReportRow, key: string) => (row as unknown as Record<string, string | number>)[key];

const tabs: { id: ReportTab; label: string; icon: typeof FileBarChart }[] = [
  { id: "overview", label: "Executive summary", icon: ChartNoAxesCombined },
  { id: "sales", label: "Sales", icon: FileBarChart },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "customers", label: "Customers", icon: Users },
  { id: "products", label: "Product performance", icon: ChartNoAxesCombined },
  { id: "profit", label: "Profit & margins", icon: FileBarChart },
];

const tableTitles: Record<ReportTab, string> = {
  overview: "Sales snapshot data",
  sales: "Sales by period",
  inventory: "Stock and expiry details",
  customers: "Customer purchase details",
  products: "Product performance details",
  profit: "Product margin details",
};

const descriptions: Record<ReportTab, string> = {
  overview: "A quick read of sales, stock value, and items needing attention.",
  sales: "Revenue, order volume, and average transaction by period.",
  inventory: "Available stock compared with reorder levels and earliest expiry.",
  customers: "Customer purchase frequency and spend patterns.",
  products: "Units sold, revenue, and growth versus last month by product.",
  profit: "Gross profit and margin by product.",
};

const peso = (value: number) => `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
const currencyKeys = new Set(["totalRevenue", "averageTransaction", "topProductSales", "value", "totalSpent", "revenue", "unitPrice", "costPrice", "totalProfit"]);
const percentKeys = new Set(["growth", "profitMargin"]);
const formatHeader = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

function formatValue(key: string, value: string | number) {
  if (typeof value === "number" && currencyKeys.has(key)) return peso(value);
  if (typeof value === "number" && percentKeys.has(key)) return `${value}%`;
  if (key === "status" && typeof value === "string") return value.replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  return value;
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof FileBarChart }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-navy md:text-3xl">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className="rounded-xl bg-accent-2/10 p-2.5 text-accent-2"><Icon size={19} aria-hidden="true" /></span>
      </div>
    </div>
  );
}

function ReportDataTable({ rows }: { rows: ReportRow[] }) {
  const columns = Object.keys(rows[0] ?? {});
  if (columns.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-gray-500">No rows match your search.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Raw report data</caption>
        <thead>
          <tr className="border-b border-border bg-off-white">
            {columns.map((key) => (
              <th key={key} scope="col" className={`px-4 py-3 font-semibold text-navy ${typeof getValue(rows[0], key) === "number" ? "text-right" : "text-left"}`}>
                {formatHeader(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-0 hover:bg-off-white/70">
              {columns.map((key) => (
                <td key={key} className={`px-4 py-3 text-gray-700 ${typeof getValue(row, key) === "number" ? "text-right tabular-nums" : "text-left"}`}>
                  {formatValue(key, getValue(row, key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("auth_token") || "";
    const load = async <T,>(path: string): Promise<T> => {
      const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return response.json() as Promise<T>;
    };

    Promise.all([
      load<ReportSalesResponse>("/api/reports/sales"),
      load<ReportStockRow[]>("/api/reports/stock"),
      load<ReportCustomerRow[]>("/api/reports/customers"),
    ])
      .then(([sales, stock, customers]) => setData({ sales, stock, customers }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Reports could not be loaded.");
      });

    return () => controller.abort();
  }, []);

  if (!data) {
    return (
      <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-7">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-navy">Reports</h1>
          <p className="mt-4 text-sm text-gray-600" role="status">
            {loadError ?? "Loading reports…"}
          </p>
        </div>
      </main>
    );
  }

  const salesReports = data.sales.periods;
  const performanceMetrics = data.sales.products;
  const inventoryReports = data.stock;
  const customerReports = data.customers;
  const monthToDate = salesReports[2];
  const profitRows: ReportRow[] = [];

  const tableRows: Record<ReportTab, ReportRow[]> = {
    overview: salesReports,
    sales: salesReports,
    inventory: inventoryReports,
    customers: customerReports,
    products: performanceMetrics,
    profit: profitRows,
  };

  const rows = tableRows[activeTab];
  const filteredRows = rows.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(search.trim().toLowerCase())),
  );
  const attentionCount = inventoryReports.filter((item) => item.status !== "in-stock").length;
  const stockValue = inventoryReports.reduce((total, item) => total + item.value, 0);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleExport = async () => {
    if (filteredRows.length === 0) return;
    setIsExporting(true);
    try {
      const columns: ExcelColumn[] = Object.keys(filteredRows[0]).map((key) => ({ key, header: formatHeader(key), width: 22 }));
      await exportExcelFile(
        `${tabs.find((tab) => tab.id === activeTab)?.label.replace(/ /g, "_")}.xlsx`,
        tabs.find((tab) => tab.id === activeTab)?.label.slice(0, 31) ?? "Report",
        columns,
        filteredRows as unknown as Record<string, unknown>[],
      );
      toast({ title: "Export complete", description: "The visible report rows were exported to Excel." });
    } catch {
      toast({ title: "Export failed", description: "The report could not be exported.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const chartData = activeTab === "overview" || activeTab === "sales"
    ? salesReports
    : activeTab === "inventory"
      ? inventoryReports
      : activeTab === "customers"
        ? customerReports
        : performanceMetrics;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-2">Analytics</p>
            <h1 className="mt-1 text-3xl font-bold text-navy">Reports</h1>
            <p className="mt-1 text-sm text-gray-600">A clear snapshot of sales, customers, and inventory.</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            Live data
          </span>
        </header>

        <section aria-label="Key report metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Month-to-date revenue" value={peso(monthToDate.totalRevenue)} detail={`${monthToDate.totalTransactions} transactions`} icon={ChartNoAxesCombined} />
          <MetricCard label="Average transaction" value={peso(monthToDate.averageTransaction)} detail="Month to date" icon={FileBarChart} />
          <MetricCard label="Stock value" value={peso(stockValue)} detail={`${inventoryReports.length} products in stock`} icon={Boxes} />
          <MetricCard label="Needs attention" value={String(attentionCount)} detail="Low-stock or expiry flags" icon={TriangleAlert} />
        </section>

        <section aria-label="Report sections" className="space-y-4">
          <div role="tablist" aria-label="Report sections" className="flex gap-2 overflow-x-auto border-b border-border pb-2 scrollbar-visible">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`report-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls="report-panel"
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2 ${activeTab === tab.id ? "border-accent-2 text-navy" : "border-transparent text-gray-500 hover:text-navy"}`}
                >
                  <Icon size={16} aria-hidden="true" />{tab.label}
                </button>
              );
            })}
          </div>

          <div id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${activeTab}`} tabIndex={0} className="space-y-4 outline-none">
            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-navy">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
                  <p className="mt-1 text-sm text-gray-600">{descriptions[activeTab]}</p>
                </div>
                <Button onClick={handleExport} disabled={isExporting || filteredRows.length === 0} className="gap-2 bg-accent text-white hover:bg-accent-dark">
                  <Download size={16} aria-hidden="true" />{isExporting ? "Exporting…" : "Export Excel"}
                </Button>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(250px,0.8fr)]">
                <div className="min-w-0 rounded-xl bg-off-white/70 p-3 md:p-4">
                  {activeTab === "profit" ? (
                    <p className="p-4 text-sm text-gray-600">
                      Profit cannot be calculated yet because products do not have recorded cost prices.
                    </p>
                  ) : (
                    <>
                      <h3 className="mb-2 text-sm font-semibold text-navy">{activeTab === "inventory" ? "Stock vs. reorder level" : activeTab === "customers" ? "Spend by customer" : activeTab === "products" ? "Units sold by product" : "Revenue by period"}</h3>
                      <div role="img" aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label} chart; use the data table below for exact values`} className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 22, right: 12, left: 4, bottom: 8 }}>
                            <CartesianGrid stroke="#dce3ec" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey={activeTab === "overview" || activeTab === "sales" ? "period" : activeTab === "inventory" ? "productName" : activeTab === "customers" ? "customerName" : "productName"} tick={{ fontSize: 11, fill: "#536174" }} interval={0} angle={-12} textAnchor="end" height={54} />
                            <YAxis width={70} tick={{ fontSize: 11, fill: "#536174" }} tickFormatter={(value) => activeTab === "overview" || activeTab === "sales" || activeTab === "customers" ? `₱${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : value}` : String(value)} />
                            <Tooltip formatter={(value) => activeTab === "inventory" || activeTab === "products" ? Number(value).toLocaleString() : peso(Number(value))} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {(activeTab === "overview" || activeTab === "sales") && <Bar dataKey="totalRevenue" name="Revenue (₱)" fill="#142955" radius={[5, 5, 0, 0]}><LabelList dataKey="totalRevenue" position="top" formatter={(value) => `₱${(Number(value) / 1000).toFixed(0)}k`} style={{ fill: "#142955", fontSize: 10 }} /></Bar>}
                            {activeTab === "inventory" && <>
                              <Bar dataKey="currentStock" name="Available stock" fill="#1c6b8f" radius={[5, 5, 0, 0]}><LabelList dataKey="currentStock" position="top" style={{ fill: "#142955", fontSize: 10 }} /></Bar>
                              <Bar dataKey="reorderLevel" name="Reorder level" fill="#e3a72f" radius={[5, 5, 0, 0]} />
                            </>}
                            {activeTab === "customers" && <Bar dataKey="totalSpent" name="Total spent (₱)" fill="#1c6b8f" radius={[5, 5, 0, 0]}><LabelList dataKey="totalSpent" position="top" formatter={(value) => `₱${(Number(value) / 1000).toFixed(0)}k`} style={{ fill: "#142955", fontSize: 10 }} /></Bar>}
                            {activeTab === "products" && <Bar dataKey="unitsSold" name="Units sold" fill="#1c6b8f" radius={[5, 5, 0, 0]}><LabelList dataKey="unitsSold" position="top" style={{ fill: "#142955", fontSize: 10 }} /></Bar>}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>

                <aside className="rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-navy">Highlights</h3>
                  {activeTab === "overview" || activeTab === "inventory" ? (
                    <div className="mt-3 space-y-3">
                      {inventoryReports.filter((item) => item.status !== "in-stock").map((item) => (
                        <div key={item.sku} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                          <div><p className="text-sm font-medium text-navy">{item.productName}</p><p className="mt-0.5 text-xs text-gray-500">{item.currentStock} units · reorder at {item.reorderLevel}</p></div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.status === "low-stock" ? "bg-amber-100 text-amber-800" : "bg-orange-100 text-orange-800"}`}>{item.status === "low-stock" ? "Low stock" : "Expiry flag"}</span>
                        </div>
                      ))}
                      {attentionCount === 0 && <p className="text-sm text-gray-500">No items need attention.</p>}
                    </div>
                  ) : activeTab === "sales" ? (
                    <div className="mt-3 space-y-3"><p className="text-xs uppercase tracking-wide text-gray-500">Top item by period</p>{salesReports.map((report) => <div key={report.period} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0"><span className="text-sm text-gray-600">{report.period}</span><span className="text-right text-sm font-semibold text-navy">{report.topProduct}<br />{peso(report.topProductSales)}</span></div>)}</div>
                  ) : activeTab === "customers" ? (
                    <div className="mt-3 space-y-3">{customerReports.map((customer, index) => <div key={customer.customerId} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"><span className="text-sm text-gray-700">{index + 1}. {customer.customerName}</span><span className="text-sm font-semibold text-navy">{peso(customer.totalSpent)}</span></div>)}</div>
                  ) : activeTab === "products" ? (
                    <div className="mt-3 space-y-3">{performanceMetrics.map((product) => <div key={product.productName} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0"><span className="text-sm text-gray-700">#{product.ranking} {product.productName}</span><span className="text-sm font-semibold text-navy">{product.growth}% growth</span></div>)}</div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">Cost prices are not recorded yet, so margins are unavailable.</p>
                  )}
                </aside>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-navy">{tableTitles[activeTab]}</h3>
                  <p className="mt-1 text-xs text-gray-500">Underlying figures for the chart · {filteredRows.length} of {rows.length} rows</p>
                </div>
                <label className="relative block w-full sm:w-72">
                  <span className="sr-only">Search report rows</span>
                  <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter these report rows…" className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-navy outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/20" />
                </label>
              </div>
              <div className="mt-4"><ReportDataTable rows={filteredRows} /></div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
