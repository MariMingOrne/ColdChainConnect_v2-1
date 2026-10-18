import { ArrowLeft } from "lucide-react";
import { Booking, Customer, Pallet, formatCustomerAddress, totalDiscountRate } from "@shared/api";
import { Card } from "@/components/ui/card";
import { formatMoney, palletItemTotal, palletTotal, palletStatusOptions } from "./palletUtils";
import { PalletStatusBadge } from "./PalletTable";

interface PalletDetailProps {
  pallet: Pallet;
  order: Booking | null;
  customer: Customer | null;
  getProductName: (productId: string) => string;
  onStatusChange: (status: Pallet["status"]) => void;
  isUpdatingStatus: boolean;
  onBack: () => void;
}

export function PalletDetail({
  pallet,
  order,
  customer,
  getProductName,
  onStatusChange,
  isUpdatingStatus,
  onBack,
}: PalletDetailProps) {
  const items = pallet.items ?? [];
  const units = items.reduce((sum, item) => sum + item.qty_units, 0);
  const discountRate = totalDiscountRate(order?.customer?.discounts);
  const totalValue = palletTotal(pallet);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold text-accent-2 hover:text-accent-1"
      >
        <ArrowLeft size={16} />
        Back to deliveries
      </button>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pallet</p>
            <h2 className="mt-1 font-mono text-lg font-bold text-navy">{pallet.id}</h2>
          </div>
          <div className="flex items-center gap-3">
            <PalletStatusBadge status={pallet.status} />
            <select
              aria-label="Pallet status"
              value={pallet.status}
              disabled={isUpdatingStatus}
              onChange={(e) => onStatusChange(e.target.value as Pallet["status"])}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-sm font-semibold text-navy focus:border-accent-2 focus:outline-none disabled:opacity-50"
            >
              {palletStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Customer</p>
            <p className="mt-1 font-medium text-navy">{customer?.store_name ?? "Unknown customer"}</p>
          </div>
          <div className="md:col-span-1 xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Delivery address</p>
            <p className="mt-1 text-sm text-navy">{customer ? formatCustomerAddress(customer) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Order</p>
            <p className="mt-1 font-mono text-sm text-navy">{order?.id ?? pallet.order_id}</p>
            <p className="mt-1 text-xs text-muted">Created {new Date(pallet.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-off-white text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 text-left font-semibold">Product</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Unit cost</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-navy">{getProductName(item.product_id)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qty_units}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{formatMoney(Number(item.unit_cost))}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                    {formatMoney(palletItemTotal(item))}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No items in this pallet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="flex flex-col justify-center gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total value</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-navy">{formatMoney(totalValue)}</p>
          </div>
          {discountRate > 0 && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Customer discount ({Number((discountRate * 100).toFixed(2))}%)</span>
                <span className="tabular-nums text-red">-{formatMoney(totalValue * discountRate)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="font-semibold text-navy">Net after discount</span>
                <span className="font-bold tabular-nums text-navy">{formatMoney(totalValue * (1 - discountRate))}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Products</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-navy">{items.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Units</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-navy">{units}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
