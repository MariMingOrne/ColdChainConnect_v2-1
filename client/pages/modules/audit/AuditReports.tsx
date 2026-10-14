import { useState } from "react";
import { AuditLog } from "@shared/api";
import { ActivityReport } from "./ActivityReport";
import {
  CustomerReport, InventoryReport, PerformanceReport, ProfitReport, SalesReport,
} from "./BusinessReports";

type ReportTab = "activity" | "sales" | "inventory" | "customer" | "performance" | "profit";

const REPORT_TABS: { id: ReportTab; label: string; icon: string }[] = [
  { id: "activity", label: "Activity", icon: "🕐" },
  { id: "sales", label: "Sales", icon: "📊" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "customer", label: "Customer", icon: "👥" },
  { id: "performance", label: "Performance", icon: "📈" },
  { id: "profit", label: "Profit", icon: "💰" },
];

export function AuditReports({ logs }: { logs: AuditLog[] }) {
  const [activeTab, setActiveTab] = useState<ReportTab>("activity");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
              activeTab === tab.id ? "bg-accent text-white" : "bg-off-white text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "activity" && <ActivityReport logs={logs} />}
      {activeTab === "sales" && <SalesReport />}
      {activeTab === "inventory" && <InventoryReport />}
      {activeTab === "customer" && <CustomerReport />}
      {activeTab === "performance" && <PerformanceReport />}
      {activeTab === "profit" && <ProfitReport />}
    </div>
  );
}
