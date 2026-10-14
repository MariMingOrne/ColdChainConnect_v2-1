import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ReportView } from "./ReportView";
import {
  CHART_COLORS, customerReports, inventoryReports, performanceMetrics, profitData, salesReports,
} from "./reportData";

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

export function SalesReport() {
  return (
    <ReportView
      title="Sales Reports"
      subtitle="Revenue and transactions by period"
      rows={salesReports}
      chart={
        <ChartFrame>
          <BarChart data={salesReports}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
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
  return (
    <ReportView
      title="Inventory Reports"
      subtitle="Current stock against reorder levels"
      rows={inventoryReports}
      chart={
        <ChartFrame>
          <BarChart data={inventoryReports}>
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
  return (
    <ReportView
      title="Customer Purchase History"
      subtitle="Total spend and purchase count per customer"
      rows={customerReports}
      chart={
        <ChartFrame>
          <BarChart data={customerReports}>
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
        { header: "Frequency", value: (r) => r.frequency },
      ]}
    />
  );
}

export function PerformanceReport() {
  return (
    <ReportView
      title="Sales Performance Metrics"
      subtitle="Revenue and units sold by product, ranked"
      rows={performanceMetrics}
      chart={
        <ChartFrame>
          <BarChart data={performanceMetrics}>
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
        { header: "Growth %", value: (r) => r.growth, cell: (r) => `↑ ${r.growth}%`, align: "right" },
      ]}
    />
  );
}

export function ProfitReport() {
  const totalProfit = profitData.reduce((sum, row) => sum + row.totalProfit, 0);

  return (
    <ReportView
      title="Profit Tracking & Margins"
      subtitle={`Total profit across products: ₱${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
      rows={profitData}
      chart={
        <ChartFrame>
          <BarChart data={profitData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="productName" interval={0} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => peso(Number(value))} />
            <Bar dataKey="totalProfit" name="Total profit" fill={CHART_COLORS.green} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartFrame>
      }
      columns={[
        { header: "Product", value: (r) => r.productName },
        { header: "Unit Price", value: (r) => r.unitPrice.toFixed(2), cell: (r) => `₱${r.unitPrice.toFixed(2)}`, align: "right" },
        { header: "Cost Price", value: (r) => r.costPrice.toFixed(2), cell: (r) => `₱${r.costPrice.toFixed(2)}`, align: "right" },
        { header: "Margin", value: (r) => `${r.profitMargin.toFixed(1)}%`, align: "right" },
        { header: "Qty Sold", value: (r) => r.quantitySold, align: "right" },
        { header: "Total Profit", value: (r) => r.totalProfit.toFixed(2), cell: (r) => peso(r.totalProfit), align: "right" },
      ]}
    />
  );
}
