import { SalesProductInsight } from "@shared/api";

export function SalesForecastProducts({ insights }: { insights: SalesProductInsight[] }) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">Consistently sold products</h3>
        <p className="text-xs text-gray-500">Sold on most days in the last 30 days. Stock up on these.</p>
      </div>
      {insights.length === 0 ? (
        <p className="rounded-md border p-3 text-xs text-gray-500">
          No product has sold on most days yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {insights.map((insight) => (
            <li key={insight.product_name} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{insight.product_name}</p>
                <p className="text-xs text-gray-500">
                  Sold {insight.days_sold} of 30 days · about {insight.avg_daily_qty} units/day
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-500">Stock up</p>
                <p className="text-sm font-semibold">{insight.suggested_restock_qty} units</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
