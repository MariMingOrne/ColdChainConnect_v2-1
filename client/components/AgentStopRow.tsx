import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MapPin, PackageCheck } from "lucide-react";
import type { AgentScheduleStop } from "@shared/api";
import { formatCustomerAddress } from "@shared/api";
import { AgentStopDetailDialog } from "@/components/AgentStopDetailDialog";
import { palletTotals, statusClasses } from "@/lib/agentSchedule";

interface AgentStopRowProps {
  index: number;
  stop: AgentScheduleStop;
  showMapAction: boolean;
  isConfirming: boolean;
  onShowOnMap: (stopId: string) => void;
  onConfirmPayment: () => void;
  onRecordPayment: () => void;
}

export function AgentStopRow({ index, stop, showMapAction, isConfirming, onShowOnMap, onConfirmPayment, onRecordPayment }: AgentStopRowProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const customer = stop.destination_customer;
  const address = customer ? formatCustomerAddress(customer) : "Address unavailable";
  const hasMapLocation = customer?.latitude != null && customer.longitude != null;
  const invoiceLabel = stop.invoice?.receipt_number ?? stop.invoice_id.slice(0, 8);
  const totals = palletTotals(stop.pallets);
  const allShipped = stop.pallets.length > 0 && stop.pallets.every((pallet) => pallet.status === "shipped");

  return (
    <li className="p-4">
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="flex w-full min-w-0 items-start gap-3 text-left sm:gap-4"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-navy">{customer?.store_name ?? "Destination unavailable"}</h3>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span className="truncate">{address}</span>
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(stop.status)}`}>
              {stop.status.replace("_", " ")}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><PackageCheck size={14} /> Invoice {invoiceLabel}</span>
            <span>Pallets · {stop.pallets.length}</span>
            {totals.units > 0 && <span>{totals.products} product{totals.products === 1 ? "" : "s"} · {totals.units} units</span>}
            <span className="inline-flex items-center gap-0.5 font-semibold text-accent-2">
              View details <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-11">
        {stop.invoice && (
          <Link
            to={`/booking-dispatch/preparation?order=${stop.invoice.booking_id}`}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Track pallets
          </Link>
        )}
        {stop.status === "completed" && stop.is_paid ? (
          <p className="text-xs font-semibold text-green">Paid</p>
        ) : stop.status === "completed" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-amber-700">Not paid · recorded in Accounts Receivable</p>
            <button
              type="button"
              onClick={onRecordPayment}
              disabled={isConfirming}
              className="min-h-10 rounded-lg bg-green px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              Record payment
            </button>
          </div>
        ) : allShipped ? (
          <button
            type="button"
            onClick={onConfirmPayment}
            disabled={isConfirming}
            className="min-h-10 rounded-lg bg-green px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            Confirm delivery & payment
          </button>
        ) : (
          <p className="text-xs text-muted">Delivery confirmation is available once all pallets are shipped.</p>
        )}
      </div>

      <AgentStopDetailDialog
        stop={stop}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onShowOnMap={showMapAction && hasMapLocation
          ? () => {
              setDetailsOpen(false);
              onShowOnMap(stop.id);
            }
          : undefined}
      />
    </li>
  );
}
