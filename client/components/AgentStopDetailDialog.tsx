import type { ReactNode } from "react";
import { MapPin, Phone, UserRound } from "lucide-react";
import type { AgentScheduleStop } from "@shared/api";
import { formatCustomerAddress } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { palletStatusLabel, palletTotals } from "@/lib/agentSchedule";

interface AgentStopDetailDialogProps {
  stop: AgentScheduleStop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowOnMap?: () => void;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="rounded-lg bg-off-white p-3 text-sm">{children}</div>
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-navy">{children}</span>
    </div>
  );
}

export function AgentStopDetailDialog({ stop, open, onOpenChange, onShowOnMap }: AgentStopDetailDialogProps) {
  const customer = stop.destination_customer;
  const totals = palletTotals(stop.pallets);
  const invoiceLabel = stop.invoice?.receipt_number ?? stop.invoice_id.slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-rajdhani text-xl text-navy">{customer.store_name}</DialogTitle>
          <DialogDescription className="flex items-start gap-1.5">
            <MapPin size={15} className="mt-0.5 shrink-0" />
            <span>{formatCustomerAddress(customer)}</span>
          </DialogDescription>
        </DialogHeader>

        <DetailSection title="Contact">
          <DetailRow label="Contact person">{customer.contact_person || "Not provided"}</DetailRow>
          <DetailRow label="Phone">
            {customer.contact_info ? (
              <a href={`tel:${customer.contact_info}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone size={14} />
                {customer.contact_info}
              </a>
            ) : (
              "Not provided"
            )}
          </DetailRow>
          <DetailRow label="Sale by">
            <span className="inline-flex items-center gap-1">
              <UserRound size={14} />
              {stop.sale_agent?.username ?? "Unknown"}
            </span>
          </DetailRow>
        </DetailSection>

        <DetailSection title="Pallets">
          {stop.pallets.length === 0 ? (
            <p className="text-muted">No pallets created for this order yet.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">
                {stop.pallets.length} pallet{stop.pallets.length === 1 ? "" : "s"} · {totals.products} product{totals.products === 1 ? "" : "s"} · {totals.units} units
              </p>
              <ul className="space-y-2">
                {stop.pallets.map((pallet, palletIndex) => (
                  <li key={pallet.id} className="rounded-lg border border-border bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-navy">Pallet {palletIndex + 1}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">{palletStatusLabel(pallet.status)}</span>
                    </div>
                    <ul className="mt-2 divide-y divide-border">
                      {pallet.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="min-w-0 truncate text-navy">
                            {item.product?.name ?? "Unknown product"}
                            {item.product?.sku && <span className="text-xs text-muted"> · {item.product.sku}</span>}
                          </span>
                          <span className="shrink-0 font-semibold text-navy">{item.qty_units} units</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DetailSection>

        <DetailSection title="Invoice & payment">
          <DetailRow label="Invoice">{invoiceLabel}</DetailRow>
          <DetailRow label="Invoice total">₱{Number(stop.invoice?.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</DetailRow>
          {stop.status === "completed" && stop.outstanding_amount != null && stop.outstanding_amount > 0 && stop.outstanding_amount < Number(stop.invoice?.total_amount ?? 0) && (
            <DetailRow label="Remaining balance">₱{stop.outstanding_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</DetailRow>
          )}
          <DetailRow label="Payment">
            {stop.status === "completed"
              ? stop.is_paid
                ? `Paid${stop.payment_method ? ` · ${stop.payment_method.replace("_", " ")}` : ""}`
                : stop.outstanding_amount != null && stop.invoice && stop.outstanding_amount < Number(stop.invoice.total_amount ?? 0)
                  ? `Partially paid${stop.payment_method ? ` · ${stop.payment_method.replace("_", " ")}` : ""}`
                  : "Not paid · recorded in Accounts Receivable"
              : "Collect on delivery"}
          </DetailRow>
        </DetailSection>

        {onShowOnMap && (
          <Button onClick={onShowOnMap} className="flex items-center gap-2">
            <MapPin size={16} /> Show on map
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
