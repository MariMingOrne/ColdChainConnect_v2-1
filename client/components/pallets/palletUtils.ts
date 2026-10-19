import { Pallet, PalletItem } from "@shared/api";

export function palletItemTotal(item: PalletItem): number {
  return item.qty_units * Number(item.unit_cost);
}

export function palletTotal(pallet: Pallet): number {
  return (pallet.items ?? []).reduce((sum, item) => sum + palletItemTotal(item), 0);
}

export function formatMoney(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const palletStatusOptions: { value: Pallet["status"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "prepared", label: "Prepared" },
  { value: "approved", label: "Approved" },
  { value: "shipped", label: "Shipped" },
];

export type DatePresetFilter = "all" | "today" | "yesterday" | "thisWeek" | "last7" | "thisMonth" | "last30";

export const datePresetOptions: { value: DatePresetFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This week" },
  { value: "last7", label: "Last 7 days" },
  { value: "thisMonth", label: "This month" },
  { value: "last30", label: "Last 30 days" },
];

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function datePresetRange(preset: Exclude<DatePresetFilter, "all">, now: Date): { start: Date; end: Date } {
  const today = addDays(now, 0);
  const tomorrow = addDays(today, 1);
  switch (preset) {
    case "today":
      return { start: today, end: tomorrow };
    case "yesterday":
      return { start: addDays(today, -1), end: today };
    case "thisWeek": {
      const mondayOffset = (today.getDay() + 6) % 7;
      return { start: addDays(today, -mondayOffset), end: addDays(today, 7 - mondayOffset) };
    }
    case "last7":
      return { start: addDays(today, -6), end: tomorrow };
    case "thisMonth":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    case "last30":
      return { start: addDays(today, -29), end: tomorrow };
  }
}

export function isInDatePreset(isoDate: string, preset: DatePresetFilter, now = new Date()): boolean {
  if (preset === "all") return true;
  const date = new Date(isoDate);
  const { start, end } = datePresetRange(preset, now);
  return date >= start && date < end;
}

export const palletStatusStyles: Record<Pallet["status"], string> = {
  draft: "bg-orange-50 text-orange-700 border-orange-200",
  prepared: "bg-yellow-50 text-yellow-800 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  shipped: "bg-blue-50 text-blue-700 border-blue-200",
};
