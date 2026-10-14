import { Pallet, PalletItem } from "@shared/api";

export function palletItemTotal(item: PalletItem): number {
  return item.qty_units * Number(item.unit_cost);
}

export function palletTotal(pallet: Pallet): number {
  return (pallet.items ?? []).reduce((sum, item) => sum + palletItemTotal(item), 0);
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const palletStatusStyles: Record<Pallet["status"], string> = {
  draft: "bg-orange-50 text-orange-700 border-orange-200",
  prepared: "bg-yellow-50 text-yellow-800 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  shipped: "bg-blue-50 text-blue-700 border-blue-200",
};
