import JsBarcode from "jsbarcode";
import { Printer, X } from "lucide-react";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { PalletEntry } from "./PalletTable";

function barcodeDataUrl(value: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, { format: "CODE128", displayValue: false, margin: 0, height: 36, width: 1.4 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
}

export function PalletPrintAllDialog({ entries, date, onClose }: {
  entries: PalletEntry[];
  date: string;
  onClose: () => void;
}) {
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString();
  const barcodes = useMemo(() => Object.fromEntries(entries.map(({ pallet }) => [pallet.id, barcodeDataUrl(pallet.id)])), [entries]);

  return createPortal(
    <div className="bulk-pallet-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="bulk-pallet-print-title" className="bulk-pallet-print-dialog flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="no-print flex items-center justify-between bg-navy-mid px-5 py-4 text-white">
          <div>
            <h2 id="bulk-pallet-print-title" className="font-rajdhani text-lg font-bold">Print all pallets</h2>
            <p className="text-xs text-white/75">{formattedDate} · {entries.length} pallet{entries.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} disabled={entries.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-accent-2 px-4 py-2 text-sm font-semibold disabled:opacity-50">
              <Printer size={16} /> Print all
            </button>
            <button type="button" onClick={onClose} aria-label="Close print preview" className="rounded p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="no-print overflow-y-auto p-5">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No pallets were created on this date.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map(({ pallet, customer }) => (
                <article key={pallet.id} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs font-semibold text-navy">{customer?.store_name ?? "Unknown customer"}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted">{pallet.id}</p>
                  <img src={barcodes[pallet.id]} alt={`Barcode for pallet ${pallet.id}`} className="mx-auto mt-2 h-10 w-full object-contain" />
                </article>
              ))}
            </div>
          )}
        </div>

        <div id="bulk-pallet-print" className="bulk-pallet-print-content">
          <h1 className="mb-3 text-lg font-bold">Pallet Labels · {formattedDate}</h1>
          <div className="bulk-pallet-print-grid grid grid-cols-2 gap-3">
            {entries.map(({ pallet, customer }) => {
              const units = (pallet.items ?? []).reduce((sum, item) => sum + item.qty_units, 0);
              return (
                <article key={pallet.id} className="bulk-pallet-label flex flex-col items-center justify-center gap-1 rounded border border-black p-3 text-center">
                  <p className="text-xs font-bold">{customer?.store_name ?? "Unknown customer"} · {units} units</p>
                  <p className="break-all font-mono text-[9px]">{pallet.id}</p>
                  <img src={barcodes[pallet.id]} alt={`Barcode for pallet ${pallet.id}`} className="h-10 w-full object-contain" />
                </article>
              );
            })}
          </div>
        </div>

        <style>{`
          #bulk-pallet-print { display: none; }
          @media print {
            @page { size: letter; margin: 0.35in; }
            html, body { height: auto !important; overflow: visible !important; }
            body > *:not(.bulk-pallet-print-overlay) { display: none !important; }
            .bulk-pallet-print-overlay { position: static !important; display: block !important; width: 100% !important; padding: 0 !important; background: transparent !important; }
            .bulk-pallet-print-dialog { display: block !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
            .bulk-pallet-print-content { display: block !important; }
            .bulk-pallet-print-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.15in; }
            .bulk-pallet-label { break-inside: avoid; min-height: 1.55in; }
            .no-print { display: none !important; }
          }
        `}</style>
      </section>
    </div>,
    document.body,
  );
}
