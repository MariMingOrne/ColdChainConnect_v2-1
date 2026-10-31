import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useQuery } from "@tanstack/react-query";
import { Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { SalesForecastResponse } from "@shared/api";
import { useAuth } from "@/hooks/useAuth";
import { SalesForecastChart } from "./SalesForecastChart";
import { SalesForecastProducts } from "./SalesForecastProducts";

const fetchSalesForecast = async (token: string): Promise<SalesForecastResponse> => {
  const response = await fetch("/api/sales/forecast", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to load forecast");
  }
  return response.json();
};

const formatPeso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const TREND_STYLES = {
  up: { icon: TrendingUp, className: "text-green-600", label: "Upward" },
  down: { icon: TrendingDown, className: "text-red-600", label: "Downward" },
  flat: { icon: Minus, className: "text-gray-500", label: "Flat" },
} as const;

function ForecastSummary({ data }: { data: SalesForecastResponse }) {
  const trend = TREND_STYLES[data.trend];
  const TrendIcon = trend.icon;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border p-3">
        <p className="text-xs text-gray-500">Projected next 7 days</p>
        <p className="text-lg font-semibold">{formatPeso(data.projected_7_day_total)}</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-xs text-gray-500">Weekly trend</p>
        <p className={`flex items-center gap-1 text-lg font-semibold ${trend.className}`}>
          <TrendIcon className="h-4 w-4" />
          {trend.label} {data.trend_percent > 0 ? "+" : ""}
          {data.trend_percent}%
        </p>
      </div>
    </div>
  );
}

function ForecastBody({ isLoading, isError, data }: {
  isLoading: boolean;
  isError: boolean;
  data: SalesForecastResponse | undefined;
}) {
  if (isLoading) {
    return <LoadingSpinner className="py-10" />;
  }
  if (isError || !data) {
    return <p className="py-10 text-center text-sm text-red-600">Could not load the forecast.</p>;
  }
  if (!data.has_enough_data) {
    return (
      <div className="space-y-4">
        <p className="py-6 text-center text-sm text-gray-500">{data.note}</p>
        <SalesForecastProducts insights={data.product_insights} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SalesForecastChart data={data} />
      <ForecastSummary data={data} />
      <p className="text-xs text-gray-500">{data.note}</p>
      {data.ai_summary && (
        <div className="rounded-md border bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-500">AI summary</p>
          <p className="text-sm">{data.ai_summary}</p>
        </div>
      )}
      <SalesForecastProducts insights={data.product_insights} />
    </div>
  );
}

export function SalesForecastWidget() {
  const token = useAuth((state) => state.token);
  const role = useAuth((state) => state.user?.role);
  const [isOpen, setIsOpen] = useState(false);
  const [hasPopup, setHasPopup] = useState(false);

  useEffect(() => {
    const updatePopupVisibility = () => {
      const popupIsOpen = Boolean(document.querySelector(
        '[data-popup-open="true"], [role="dialog"][aria-modal="true"], [role="alertdialog"], [class~="fixed"][class~="inset-0"]'
      ));
      setHasPopup(popupIsOpen);
    };

    updatePopupVisibility();
    const observer = new MutationObserver(updatePopupVisibility);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-popup-open", "role", "aria-modal"],
    });
    return () => observer.disconnect();
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["sales-forecast", token],
    queryFn: () => fetchSalesForecast(token as string),
    enabled: Boolean(token) && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  if (!token || role !== "admin" || hasPopup) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-off-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2"
        aria-label="Open sales forecast"
      >
        <TrendingUp className="h-4 w-4" />
        <span>Sales Forecast</span>
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(75vh,640px)] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-white p-4 shadow-xl animate-fade-in-up">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Sales Forecast</h2>
          <p className="text-xs text-gray-500">Estimate based on recent invoices</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1 text-gray-500 hover:bg-muted"
          aria-label="Close sales forecast"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ForecastBody isLoading={isLoading} isError={isError} data={data} />
    </div>
  );
}
