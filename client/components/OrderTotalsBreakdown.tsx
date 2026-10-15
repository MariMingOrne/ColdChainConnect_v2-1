import { Booking, Product } from "@shared/api";

interface OrderTotalsBreakdownProps {
  booking: Booking;
  products: Product[];
}

const formatPeso = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatRate = (rate: number | string) => `${Number((Number(rate) * 100).toFixed(2))}%`;

export function OrderTotalsBreakdown({ booking, products }: OrderTotalsBreakdownProps) {
  const gross = (booking.booking_items ?? []).reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    return sum + parseFloat(product?.price || "0") * item.qty_ordered;
  }, 0);

  const discounts = booking.customer?.discounts ?? [];
  const discountTotal = discounts.reduce((sum, d) => sum + gross * Number(d.rate), 0);
  const net = gross - discountTotal;

  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-navy mb-3">Order Totals</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Gross</span>
          <span className="tabular-nums text-navy">{formatPeso(gross)}</span>
        </div>
        {discounts.length === 0 && (
          <p className="text-xs text-muted italic">No customer discounts</p>
        )}
        {discounts.map((d, idx) => (
          <div key={d.id ?? idx} className="flex justify-between">
            <span className="text-muted">
              {d.label} ({formatRate(d.rate)})
            </span>
            <span className="tabular-nums text-red">-{formatPeso(gross * Number(d.rate))}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-2">
          <span className="font-semibold text-navy">Net total</span>
          <span className="font-bold tabular-nums text-navy">{formatPeso(net)}</span>
        </div>
      </div>
    </div>
  );
}
