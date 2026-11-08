import { RequestHandler } from "express";
import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "../db";
import { bookings, customers, inventory_batches, invoice_items, invoices, products } from "../db/schema";
import { getReservedUnitsBySource } from "../services/inventory-reservations";
import type {
  ReportCustomerRow,
  ReportProductPerformance,
  ReportSalesPeriod,
  ReportSalesResponse,
  ReportStockRow,
} from "@shared/api";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const EXPIRY_WARNING_DAYS = 7;
const TOP_PRODUCTS = 10;

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const startOfUtcMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const roundTo = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
const toNumber = (value: string | null | undefined) => parseFloat(value ?? "0") || 0;

function startOfPreviousMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

async function fetchSalesRows(since: Date) {
  const billable = and(gte(invoices.created_at, since), ne(invoices.status, "draft"));

  const [invoiceRows, itemRows] = await Promise.all([
    db
      .select({ total: invoices.total_amount, createdAt: invoices.created_at })
      .from(invoices)
      .where(billable),
    db
      .select({
        productId: invoice_items.product_id,
        productName: invoice_items.product_name,
        qty: invoice_items.qty_ordered,
        amount: invoice_items.amount,
        createdAt: invoices.created_at,
      })
      .from(invoice_items)
      .innerJoin(invoices, eq(invoice_items.invoice_id, invoices.id))
      .where(billable),
  ]);

  return { invoiceRows, itemRows };
}

type SalesRows = Awaited<ReturnType<typeof fetchSalesRows>>;

function buildPeriods(rows: SalesRows, now: Date): ReportSalesPeriod[] {
  const periods = [
    { period: "Today", start: startOfUtcDay(now).getTime() },
    { period: "Last 7 days", start: startOfUtcDay(now).getTime() - (WEEK_DAYS - 1) * DAY_MS },
    { period: "Month to date", start: startOfUtcMonth(now).getTime() },
  ];

  return periods.map(({ period, start }) => {
    const invoicesInPeriod = rows.invoiceRows.filter((row) => row.createdAt.getTime() >= start);
    const itemsInPeriod = rows.itemRows.filter((row) => row.createdAt.getTime() >= start);

    const revenue = invoicesInPeriod.reduce((sum, row) => sum + toNumber(row.total), 0);
    const revenueByProduct = new Map<string, number>();
    for (const item of itemsInPeriod) {
      revenueByProduct.set(item.productName, (revenueByProduct.get(item.productName) ?? 0) + toNumber(item.amount));
    }
    const [topProduct, topProductRevenue] = [...revenueByProduct.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["No sales", 0];

    return {
      period,
      totalRevenue: roundTo(revenue, 2),
      totalTransactions: invoicesInPeriod.length,
      averageTransaction: invoicesInPeriod.length > 0 ? roundTo(revenue / invoicesInPeriod.length, 2) : 0,
      topProduct,
      topProductSales: roundTo(topProductRevenue, 2),
    };
  });
}

function buildProductPerformance(rows: SalesRows, now: Date): ReportProductPerformance[] {
  const monthStart = startOfUtcMonth(now).getTime();
  const previousMonthStart = startOfPreviousMonth(now).getTime();

  const current = new Map<string, { name: string; units: number; revenue: number }>();
  const previousRevenue = new Map<string, number>();

  for (const item of rows.itemRows) {
    const time = item.createdAt.getTime();
    const amount = toNumber(item.amount);
    if (time >= monthStart) {
      const entry = current.get(item.productId) ?? { name: item.productName, units: 0, revenue: 0 };
      entry.units += item.qty;
      entry.revenue += amount;
      current.set(item.productId, entry);
    } else if (time >= previousMonthStart) {
      previousRevenue.set(item.productId, (previousRevenue.get(item.productId) ?? 0) + amount);
    }
  }

  return [...current.entries()]
    .map(([productId, entry]) => {
      const previous = previousRevenue.get(productId) ?? 0;
      return {
        productName: entry.name,
        unitsSold: entry.units,
        revenue: roundTo(entry.revenue, 2),
        growth: previous > 0 ? roundTo(((entry.revenue - previous) / previous) * 100, 1) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS)
    .map((row, index) => ({ ...row, ranking: index + 1 }));
}

export const getSalesReport: RequestHandler = async (_req, res) => {
  try {
    const now = new Date();
    const rows = await fetchSalesRows(startOfPreviousMonth(now));
    const response: ReportSalesResponse = {
      periods: buildPeriods(rows, now),
      products: buildProductPerformance(rows, now),
    };
    res.json(response);
  } catch (error) {
    console.error("Error building sales report:", error);
    res.status(500).json({ error: "Failed to build sales report" });
  }
};

export const getStockReport: RequestHandler = async (_req, res) => {
  try {
    const now = new Date();
    const warningDate = toIsoDate(new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS));

    const batches = await db.query.inventory_batches.findMany({
      where: eq(inventory_batches.is_archived, false),
      with: { pallets: { with: { items: true } } },
    });
    const stockItems = batches.flatMap((batch) => batch.pallets.flatMap((pallet) => pallet.items));
    const [reservedBySource, productList] = await Promise.all([
      getReservedUnitsBySource(stockItems.map((item) => item.id)),
      db.select().from(products),
    ]);

    const stockByProduct = new Map<string, { units: number; earliestExpiry: string | null }>();
    for (const item of stockItems) {
      const available = Math.max(0, item.qty_units - (reservedBySource.get(item.id) ?? 0));
      if (available === 0) continue;

      const entry = stockByProduct.get(item.product_id) ?? { units: 0, earliestExpiry: null };
      entry.units += available;
      if (item.expiration_date && (!entry.earliestExpiry || item.expiration_date < entry.earliestExpiry)) {
        entry.earliestExpiry = item.expiration_date;
      }
      stockByProduct.set(item.product_id, entry);
    }

    const rows: ReportStockRow[] = productList.flatMap((product) => {
      const entry = stockByProduct.get(product.id);
      if (!entry) return [];

      const expiringSoon = entry.earliestExpiry !== null && entry.earliestExpiry <= warningDate;
      const belowReorder = product.reorder_point !== null && entry.units < product.reorder_point;
      return [{
        sku: product.sku ?? "N/A",
        productName: product.name,
        currentStock: entry.units,
        reorderLevel: product.reorder_point ?? 0,
        expiryDate: entry.earliestExpiry ?? "N/A",
        status: expiringSoon ? "expiring" : belowReorder ? "low-stock" : "in-stock",
        value: roundTo(entry.units * toNumber(product.price), 2),
      }];
    });

    res.json(rows.sort((a, b) => a.productName.localeCompare(b.productName)));
  } catch (error) {
    console.error("Error building stock report:", error);
    res.status(500).json({ error: "Failed to build stock report" });
  }
};

export const getCustomerReport: RequestHandler = async (_req, res) => {
  try {
    const rows = await db
      .select({
        customerId: customers.id,
        customerName: customers.store_name,
        total: invoices.total_amount,
        createdAt: invoices.created_at,
      })
      .from(invoices)
      .innerJoin(bookings, eq(invoices.booking_id, bookings.id))
      .innerJoin(customers, eq(bookings.customer_id, customers.id))
      .where(ne(invoices.status, "draft"));

    const byCustomer = new Map<string, { name: string; purchases: Date[]; spent: number }>();
    for (const row of rows) {
      const entry = byCustomer.get(row.customerId) ?? { name: row.customerName, purchases: [], spent: 0 };
      entry.purchases.push(row.createdAt);
      entry.spent += toNumber(row.total);
      byCustomer.set(row.customerId, entry);
    }

    const report: ReportCustomerRow[] = [...byCustomer.entries()]
      .map(([customerId, entry]) => {
        const times = entry.purchases.map((date) => date.getTime());
        const first = Math.min(...times);
        const last = Math.max(...times);
        const spanWeeks = Math.max(1, (last - first) / (WEEK_DAYS * DAY_MS));
        return {
          customerId,
          customerName: entry.name,
          totalPurchases: entry.purchases.length,
          totalSpent: roundTo(entry.spent, 2),
          lastPurchaseDate: toIsoDate(new Date(last)),
          purchasesPerWeek: roundTo(entry.purchases.length / spanWeeks, 1),
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);

    res.json(report);
  } catch (error) {
    console.error("Error building customer report:", error);
    res.status(500).json({ error: "Failed to build customer report" });
  }
};
