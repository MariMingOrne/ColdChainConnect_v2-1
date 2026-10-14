import { RequestHandler } from "express";
import { and, gte, ne } from "drizzle-orm";
import { db } from "../db";
import { invoices } from "../db/schema";
import { SalesForecastPoint, SalesForecastResponse } from "@shared/api";

const HISTORY_DAYS = 30;
const FORECAST_DAYS = 14;
const WEEK_DAYS = 7;
const MIN_DAYS_WITH_SALES = 7;
const TREND_THRESHOLD_PERCENT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

function buildHistory(
  rows: Array<{ total: string | null; created_at: Date }>,
  today: Date
): { history: SalesForecastPoint[]; daysWithSales: number } {
  const totalsByDate = new Map<string, number>();
  const start = today.getTime() - (HISTORY_DAYS - 1) * DAY_MS;

  for (const row of rows) {
    const key = toIsoDate(row.created_at);
    totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + parseFloat(row.total ?? "0"));
  }

  const history: SalesForecastPoint[] = [];
  let daysWithSales = 0;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = toIsoDate(new Date(start + i * DAY_MS));
    const total = totalsByDate.get(date);
    if (total !== undefined) daysWithSales++;
    history.push({ date, total: roundCurrency(total ?? 0) });
  }

  return { history, daysWithSales };
}

function fitLinearTrend(values: number[]): { slope: number; intercept: number; mean: number } {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  values.forEach((y, x) => {
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  return { slope, intercept: yMean - slope * xMean, mean: yMean };
}

// ─── Sales Forecast ──────────────────────────────────────────────────────────

export const getSalesForecast: RequestHandler = async (_req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const windowStart = new Date(today.getTime() - (HISTORY_DAYS - 1) * DAY_MS);

    const rows = await db
      .select({ total: invoices.total_amount, created_at: invoices.created_at })
      .from(invoices)
      .where(and(gte(invoices.created_at, windowStart), ne(invoices.status, "draft")));

    const { history, daysWithSales } = buildHistory(rows, today);

    if (daysWithSales < MIN_DAYS_WITH_SALES) {
      const response: SalesForecastResponse = {
        history,
        forecast: [],
        projected_7_day_total: 0,
        trend: "flat",
        trend_percent: 0,
        has_enough_data: false,
        history_days_with_sales: daysWithSales,
        note: `Need sales on at least ${MIN_DAYS_WITH_SALES} days to estimate a trend. Found ${daysWithSales}.`,
      };
      return res.json(response);
    }

    const { slope, intercept, mean } = fitLinearTrend(history.map((p) => p.total));

    const forecast: SalesForecastPoint[] = [];
    for (let i = 1; i <= FORECAST_DAYS; i++) {
      const x = HISTORY_DAYS - 1 + i;
      const date = toIsoDate(new Date(today.getTime() + i * DAY_MS));
      forecast.push({ date, total: roundCurrency(Math.max(0, intercept + slope * x)) });
    }

    const projected7DayTotal = roundCurrency(
      forecast.slice(0, WEEK_DAYS).reduce((sum, p) => sum + p.total, 0)
    );

    const weeklyChange = slope * WEEK_DAYS;
    const weeklyBase = mean * WEEK_DAYS;
    const trendPercent = weeklyBase > 0 ? Math.round((weeklyChange / weeklyBase) * 1000) / 10 : 0;
    const trend =
      trendPercent > TREND_THRESHOLD_PERCENT ? "up" : trendPercent < -TREND_THRESHOLD_PERCENT ? "down" : "flat";

    const response: SalesForecastResponse = {
      history,
      forecast,
      projected_7_day_total: projected7DayTotal,
      trend,
      trend_percent: trendPercent,
      has_enough_data: true,
      history_days_with_sales: daysWithSales,
      note: `Linear trend over the last ${HISTORY_DAYS} days (${daysWithSales} with sales). An estimate, not a guaranteed figure.`,
    };
    res.json(response);
  } catch (error) {
    console.error("Error computing sales forecast:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
