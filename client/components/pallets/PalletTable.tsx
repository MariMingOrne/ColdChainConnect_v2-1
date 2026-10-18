import { ChevronRight } from "lucide-react";
import { Customer, Pallet, formatCustomerAddress } from "@shared/api";
import { cn } from "@/lib/utils";
import { formatMoney, palletStatusStyles, palletTotal } from "./palletUtils";

export interface PalletEntry {
  pallet: Pallet;
  customer: Customer | null;
}

interface PalletTableProps {
  entries: PalletEntry[];
  onSelect: (palletId: string) => void;
}

export function PalletStatusBadge({ status }: { status: Pallet["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        palletStatusStyles[status]
      )}
    >
      {status}
    </span>
  );
}

export function PalletTable({ entries, onSelect }: PalletTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-off-white text-left text-xs uppercase tracking-wide text-muted">
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Pallet</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Customer &amp; delivery address</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Contents</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Total value</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {entries.map(({ pallet, customer }) => {
            const items = pallet.items ?? [];
            const units = items.reduce((sum, item) => sum + item.qty_units, 0);

            return (
              <tr
                key={pallet.id}
                onClick={() => onSelect(pallet.id)}
                className="cursor-pointer border-b border-border last:border-0 transition hover:bg-off-white/60"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy">Pallet {pallet.id.substring(0, 8)}</p>
                  <p className="text-xs text-muted">Order {pallet.order_id.substring(0, 8)}</p>
                </td>
                <td className="px-4 py-3">
                  {customer ? (
                    <>
                      <p className="font-medium text-navy">{customer.store_name}</p>
                      <p className="text-xs text-muted">{formatCustomerAddress(customer)}</p>
                    </>
                  ) : (
                    <p className="text-muted">Unknown customer</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-medium tabular-nums text-navy">{items.length} product{items.length === 1 ? "" : "s"}</p>
                  <p className="text-xs text-muted tabular-nums">{units} units</p>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                  {formatMoney(palletTotal(pallet))}
                </td>
                <td className="px-4 py-3">
                  <PalletStatusBadge status={pallet.status} />
                </td>
                <td className="px-4 py-3 text-muted">
                  <ChevronRight size={18} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
