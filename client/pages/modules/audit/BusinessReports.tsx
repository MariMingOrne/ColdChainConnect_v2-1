import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ReportCustomerRow, ReportSalesResponse, ReportStockRow } from "@shared/api";
import { Card } from "@/components/ui/card";
import { ReportView } from "./ReportView";
import { CHART_COLORS } from "./reportData";
import { useReportData } from "./useReportData";

const peso = (value: number) => `₱${value.toLocaleString()}`;

const STATUS_STYLES: Record<string, string> = {
  "in-stock": "bg-green-100 text-green-800",
  "low-stock": "bg-yellow-100 text-yellow-800",
  expiring: "bg-orange-100 text-orange-800",
};

const statusLabel = (status: string) =>
  status.replace("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function ReportStatus({ title, subtitle, message }: { title: string; subtitle: string; message: string }) {
  return (
    <Card className="space-y-2 p-6">
      <h2 className="text-xl font-bold text-navy">{title}</h2>
      <p className="text-sm text-gray-500">{subtitle}</p>
      <p role="status" className="text-sm text-gray-600">{message}</p>
    </Card>
  );
}

export function SalesReport() {
  const { data, error } = useReportData<ReportSalesResponse>("/api/reports/sales");
  const title = "Sales Reports";
  const subtitle = "Revenue and transactions by period";

  if (!data) return <ReportStatus title={title} subtitle={subtitle} message={error ?? "Loading report…"} />;

  return (
    <ReportView
      title={title}
      subtitle={subtitle}
      rows={data.periods}
      chart={
        <ChartFrame>
          <BarChart data={data.periods}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" />
            <YAxis tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => peso(Number(value))} />
            <Legend />
            <Bar dataKey="totalRevenue" name="Revenue" fill={CHART_COLORS.navy} radius={[6, 6, 0, 0]} />
            <Bar dataKey="topProductSales" name="Top product sales" fill={CHART_COLORS.blue} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartFrame>
      }
      columns={[
        { header: "Period", value: (r) => r.period },
        { header: "Revenue", value: (r) => r.totalRevenue, cell: (r) => peso(r.totalRevenue), align: "right" },
        { header: "Transactions", value: (r) => r.totalTransactions, align: "right" },
        { header: "Avg Transaction", value: (r) => r.averageTransaction.toFixed(2), cell: (r) => `₱${r.averageTransaction.toFixed(2)}`, align: "right" },
        { header: "Top Product", value: (r) => r.topProduct },
      ]}
    />
  );
}

export function InventoryReport() {
  const { data, error } = useReportData<ReportStockRow[]>("/api/reports/stock");
  const title = "Inventory Reports";
  const subtitle = "Current stock against reorder levels";

  if (!data) return <ReportStatus title={title} subtitle={subtitle} message={error ?? "Loading report…"} />;

  return (
    <ReportView
      title={title}
      subtitle={subtitle}
      rows={data}
      chart={
        <ChartFrame>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="productName" interval={0} tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="currentStock" name="Current stock" fill={CHART_COLORS.navy} radius={[6, 6, 0, 0]} />
            <Bar dataKey="reorderLevel" name="Reorder level" fill={CHART_COLORS.gold} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartFrame>
      }
      columns={[
        { header: "SKU", value: (r) => r.sku },
        { header: "Product", value: (r) => r.productName },
        { header: "Stock", value: (r) => r.currentStock, align: "right" },
        { header: "Reorder", value: (r) => r.reorderLevel, align: "right" },
        { header: "Expiry", value: (r) => r.expiryDate },
        { header: "Value", value: (r) => r.value, cell: (r) => peso(r.value), align: "right" },
        {
          header: "Status",
          value: (r) => statusLabel(r.status),
          cell: (r) => (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
              {statusLabel(r.status)}
            </span>
          ),
        },
      ]}
    />
  );
}

export function CustomerReport() {
  const { data, error } = useReportData<ReportCustomerRow[]>("/api/reports/customers");
  const title = "Customer Purchase History";
  const subtitle = "Total spend and purchase count per customer";

  if (!data) return <ReportStatus title={title} subtitle={subtitle} message={error ?? "Loading report…"} />;

  return (
    <ReportView
      title={title}
      subtitle={subtitle}
      rows={data}
      chart={
        <ChartFrame>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="customerName" />
            <YAxis tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => peso(Number(value))} />
            <Bar dataKey="totalSpent" name="Total spent" fill={CHART_COLORS.blue} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartFrame>
      }
      columns={[
        { header: "Customer ID", value: (r) => r.customerId },
        { header: "Name", value: (r) => r.customerName },
        { header: "Purchases", value: (r) => r.totalPurchases, align: "right" },
        { header: "Total Spent", value: (r) => r.totalSpent, cell: (r) => peso(r.totalSpent), align: "right" },
        { header: "Last Purchase", value: (r) => r.lastPurchaseDate },
        { header: "Purchases / Week", value: (r) => r.purchasesPerWeek, align: "right" },
      ]}
    />
  );
}

export function PerformanceReport() {
  const { data, error } = useReportData<ReportSalesResponse>("/api/reports/sales");
  const title = "Sales Performance Metrics";
  const subtitle = "Revenue and units sold by product, ranked";

  if (!data) return <ReportStatus title={title} subtitle={subtitle} message={error ?? "Loading report…"} />;

  return (
    <ReportView
      title={title}
      subtitle={subtitle}
      rows={data.products}
      chart={
        <ChartFrame>
          <BarChart data={data.products}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="productName" interval={0} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="revenue" tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="units" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill={CHART_COLORS.navy} radius={[6, 6, 0, 0]} />
            <Bar yAxisId="units" dataKey="unitsSold" name="Units sold" fill={CHART_COLORS.green} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartFrame>
      }
      columns={[
        { header: "Rank", value: (r) => r.ranking, cell: (r) => `#${r.ranking}`, align: "right" },
        { header: "Product", value: (r) => r.productName },
        { header: "Units Sold", value: (r) => r.unitsSold, align: "right" },
        { header: "Revenue", value: (r) => r.revenue, cell: (r) => peso(r.revenue), align: "right" },
        { header: "Growth %", value: (r) => r.growth, cell: (r) => `${r.growth >= 0 ? "↑" : "↓"} ${r.growth}%`, align: "right" },
      ]}
    />
  );
}

export function ProfitReport() {
  return (
    <ReportStatus
      title="Profit Tracking & Margins"
      subtitle="Profit per product"
      message="Profit cannot be calculated yet because products do not have recorded cost prices."
    />
  );
}
