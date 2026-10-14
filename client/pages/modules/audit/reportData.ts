export const salesReports = [
  { label: "Today", period: "2024-01-15 (Today)", totalRevenue: 4250, totalTransactions: 12, averageTransaction: 354.17, topProduct: "Premium Chicken Breast", topProductSales: 1200 },
  { label: "This Week", period: "2024-01-08 - 2024-01-14 (This Week)", totalRevenue: 28450, totalTransactions: 82, averageTransaction: 346.95, topProduct: "Frozen Fish", topProductSales: 8200 },
  { label: "This Month", period: "January 2024 (This Month)", totalRevenue: 125680, totalTransactions: 356, averageTransaction: 353.06, topProduct: "Ice Cream Varieties", topProductSales: 35400 },
];

export const inventoryReports = [
  { sku: "SKU-2301", productName: "Premium Chicken Breast", currentStock: 45, reorderLevel: 50, expiryDate: "2024-01-25", status: "low-stock", value: 2700 },
  { sku: "SKU-3405", productName: "Frozen Fish", currentStock: 120, reorderLevel: 80, expiryDate: "2024-01-22", status: "expiring", value: 7200 },
  { sku: "SKU-5102", productName: "Ice Cream Varieties", currentStock: 300, reorderLevel: 100, expiryDate: "2024-03-15", status: "in-stock", value: 9000 },
  { sku: "SKU-1450", productName: "Beef Cuts", currentStock: 75, reorderLevel: 60, expiryDate: "2024-01-28", status: "in-stock", value: 4500 },
];

export const customerReports = [
  { customerId: "CUST-001", customerName: "Restaurant ABC", totalPurchases: 45, totalSpent: 15750, lastPurchaseDate: "2024-01-15", frequency: "Daily" },
  { customerId: "CUST-002", customerName: "Cafe XYZ", totalPurchases: 32, totalSpent: 11200, lastPurchaseDate: "2024-01-14", frequency: "3x/Week" },
  { customerId: "CUST-003", customerName: "Supermarket DEF", totalPurchases: 28, totalSpent: 18900, lastPurchaseDate: "2024-01-13", frequency: "2x/Week" },
];

export const performanceMetrics = [
  { productName: "Ice Cream Varieties", unitsSold: 1250, revenue: 35400, growth: 12.5, ranking: 1 },
  { productName: "Frozen Fish", unitsSold: 890, revenue: 28900, growth: 8.3, ranking: 2 },
  { productName: "Premium Chicken Breast", unitsSold: 750, revenue: 25200, growth: 5.8, ranking: 3 },
  { productName: "Beef Cuts", unitsSold: 620, revenue: 18600, growth: 3.2, ranking: 4 },
];

export const profitData = [
  { productName: "Ice Cream Varieties", unitPrice: 28.32, costPrice: 15.5, profitMargin: 45.3, quantitySold: 1250, totalProfit: 16004.64 },
  { productName: "Frozen Fish", unitPrice: 32.48, costPrice: 19.2, profitMargin: 40.9, quantitySold: 890, totalProfit: 11807.04 },
  { productName: "Premium Chicken Breast", unitPrice: 33.6, costPrice: 19.5, profitMargin: 42.1, quantitySold: 750, totalProfit: 10626 },
  { productName: "Beef Cuts", unitPrice: 30, costPrice: 17.8, profitMargin: 40.7, quantitySold: 620, totalProfit: 7597.6 },
];

export const CHART_COLORS = {
  navy: "#0A1A5C",
  blue: "#2563EB",
  green: "#16A34A",
  gold: "#CA8A04",
  red: "#DC2626",
  purple: "#9333EA",
  muted: "#94A3B8",
};

export const PIE_COLORS = [CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.red, CHART_COLORS.gold, CHART_COLORS.purple];
