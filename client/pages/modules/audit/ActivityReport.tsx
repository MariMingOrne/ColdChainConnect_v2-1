import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AuditLog } from "@shared/api";
import { CHART_COLORS, PIE_COLORS } from "./reportData";

interface ActivityReportProps {
  logs: AuditLog[];
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return Array.from(counts, ([name, value]) => ({ name, value }));
}

export function ActivityReport({ logs }: ActivityReportProps) {
  const dailyActivity = useMemo(
    () =>
      countBy(logs, (log) =>
        new Date(log.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      )
        .reverse(),
    [logs]
  );

  const actionBreakdown = useMemo(() => countBy(logs, (log) => log.action), [logs]);
  const resourceBreakdown = useMemo(
    () =>
      countBy(logs, (log) => log.resource_type.replace(/_/g, " "))
        .sort((a, b) => b.value - a.value),
    [logs]
  );

  const count = (action: string) => logs.filter((log) => log.action === action).length;

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-gray-500">
        No activity recorded yet. Charts will appear once changes are made in the system.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total events", value: logs.length, color: "text-navy" },
          { label: "Created", value: count("create"), color: "text-green-700" },
          { label: "Updated", value: count("update"), color: "text-blue-700" },
          { label: "Deleted", value: count("delete"), color: "text-red-700" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
            <p className={`mt-1 font-rajdhani text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-6 xl:col-span-2">
          <h2 className="text-lg font-bold text-navy">Activity by day</h2>
          <p className="mb-4 text-sm text-gray-500">Number of recorded changes per day</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Events" fill={CHART_COLORS.navy} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-bold text-navy">Actions</h2>
          <p className="mb-4 text-sm text-gray-500">Share of each action type</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={actionBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {actionBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <h2 className="text-lg font-bold text-navy">Changes by resource</h2>
        <p className="mb-4 text-sm text-gray-500">Which parts of the system change most often</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={resourceBreakdown} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" name="Events" fill={CHART_COLORS.blue} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
