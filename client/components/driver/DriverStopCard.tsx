import { DriverScheduleStop } from "@shared/api";

const statusBadge: Record<DriverScheduleStop["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "badge-red" },
  in_transit: { label: "In transit", className: "badge-green" },
  completed: { label: "Completed", className: "badge-green" },
};

function formatPeso(value: string | null) {
  return `₱${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function DriverStopCard({ stop, index }: { stop: DriverScheduleStop; index: number }) {
  const customer = stop.destination_customer;
  const badge = statusBadge[stop.status];

  return (
    <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-navy-mid flex items-center justify-center shrink-0">
          <span className="font-rajdhani font-bold text-sm text-white">{index}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-navy text-sm truncate">{customer.store_name}</div>
          <div className="text-xs text-muted">
            {[customer.street_address, customer.location].filter(Boolean).join(", ") || "No address"}
          </div>
          {customer.contact_person && (
            <div className="text-xs text-muted">
              {customer.contact_person}
              {customer.contact_info ? ` · ${customer.contact_info}` : ""}
            </div>
          )}
        </div>
        <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-bold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <ul className="text-sm text-navy divide-y divide-border border-y border-border">
        {stop.invoice.invoice_items.map((item) => (
          <li key={item.id} className="flex justify-between py-1.5">
            <span className="truncate pr-3">{item.product_name}</span>
            <span className="font-semibold shrink-0">× {item.qty_ordered}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between text-xs text-muted">
        <span>{stop.invoice.receipt_number ? `Invoice ${stop.invoice.receipt_number}` : "Invoice"} · {stop.invoice.payment_status}</span>
        <span className="font-semibold text-navy">{formatPeso(stop.invoice.total_amount)}</span>
      </div>
    </div>
  );
}
