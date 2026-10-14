import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SalesForecastResponse } from "@shared/api";

interface SalesForecastChartProps {
  data: SalesForecastResponse;
}

interface ChartPoint {
  date: string;
  actual?: number;
  forecast?: number;
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const formatPeso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

export function SalesForecastChart({ data }: SalesForecastChartProps) {
  const points: ChartPoint[] = [
    ...data.history.map((p, index) => ({
      date: p.date,
      actual: p.total,
      // Starts the dashed forecast line from the last actual point
      forecast: index === data.history.length - 1 ? p.total : undefined,
    })),
    ...data.forecast.map((p) => ({ date: p.date, forecast: p.total })),
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis tickFormatter={formatPeso} tick={{ fontSize: 11 }} width={64} />
        <Tooltip
          labelFormatter={(label) => formatDate(String(label))}
          formatter={(value: number, name: string) => [formatPeso(value), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Estimate"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
