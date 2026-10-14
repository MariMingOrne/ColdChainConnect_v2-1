import { Search } from "lucide-react";
import { Pallet } from "@shared/api";
import { cn } from "@/lib/utils";

export type PalletStatusFilter = "all" | Pallet["status"];

const statusTabs: { value: PalletStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "prepared", label: "Prepared" },
  { value: "approved", label: "Approved" },
  { value: "shipped", label: "Shipped" },
];

interface PalletToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: PalletStatusFilter;
  onStatusChange: (value: PalletStatusFilter) => void;
}

export function PalletToolbar({ searchQuery, onSearchChange, statusFilter, onStatusChange }: PalletToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full border border-border bg-white p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onStatusChange(tab.value)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition",
              statusFilter === tab.value ? "bg-navy text-white" : "text-muted hover:text-navy"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative w-full sm:w-72">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search order, pallet, customer…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm focus:border-accent-2 focus:outline-none"
        />
      </div>
    </div>
  );
}
