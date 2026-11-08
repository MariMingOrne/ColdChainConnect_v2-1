import { useEffect, useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, X } from "lucide-react";
import type { Booking, InventoryBatch, Pallet } from "@shared/api";

interface DeliverySheetProps {
  order: Booking;
  pallets: Pallet[];
  batches: InventoryBatch[];
  onClose: () => void;
}

interface PickLine {
  key: string;
  productName: string;
  batchName: string;
  qty: number;
}

export function DeliverySheet({ order, pallets, batches, onClose }: DeliverySheetProps) {
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});

  const pickLines = useMemo<PickLine[]>(() => {
    const batchNameByItemId = new Map(
      batches.flatMap((batch) => (batch.items ?? []).map((item) => [item.id, batch.name] as const)),
    );
    const productNameById = new Map(
      (order.booking_items ?? []).map((item) => [item.product_id, item.product?.name ?? item.product_id] as const),
    );
    const lines = new Map<string, PickLine>();

    for (const pallet of pallets) {
      for (const item of pallet.items ?? []) {
        const batchName = batchNameByItemId.get(item.batch_item_id) ?? "Unknown batch";
        const productName = productNameById.get(item.product_id) ?? item.product_id;
        const key = `${item.product_id}|${item.batch_item_id}`;
        const line = lines.get(key) ?? { key, productName, batchName, qty: 0 };
        line.qty += item.qty_units;
        lines.set(key, line);
      }
    }

    return [...lines.values()].sort((a, b) => a.productName.localeCompare(b.productName));
  }, [batches, order, pallets]);

  useEffect(() => {
    const entries = pallets.map((pallet) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, pallet.id, { format: "CODE128", displayValue: false, margin: 0, height: 40, width: 1.5 });
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      return [pallet.id, dataUrl] as const;
    });
    setBarcodes(Object.fromEntries(entries));
  }, [pallets]);

  const deliveryDate = order.prepared_delivery_date
    ? new Date(order.prepared_delivery_date).toLocaleDateString()
    : "Not scheduled";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="no-print flex items-center justify-between bg-navy-mid px-6 py-4">
          <h2 className="font-rajdhani text-lg font-bold text-white">Delivery Sheet</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-accent-2 px-4 py-2 text-sm font-semibold text-white hover:opacity-80"
            >
              <Printer size={16} /> Print
            </button>
            <button type="button" onClick={onClose} aria-label="Close delivery sheet" className="text-white hover:opacity-70">
              <X size={20} />
            </button>
          </div>
        </div>

        <div id="delivery-sheet" className="overflow-y-auto p-5 font-sans text-black">
          <style>{`
            @media print {
              @page { size: letter; margin: 0.35in; }
              body * { visibility: hidden; }
              #delivery-sheet, #delivery-sheet * { visibility: visible; }
              #delivery-sheet { position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
              .no-print { display: none !important; }
              .label-grid { break-inside: auto; }
              .label-card { break-inside: avoid; }
            }
          `}</style>

          <header className="border-b border-black pb-2">
            <h1 className="text-lg font-bold">Delivery Sheet</h1>
            <p className="text-xs">Order {order.id.slice(0, 8)} · {order.customer?.store_name ?? "Customer"}{order.customer?.location ? ` · ${order.customer.location}` : ""}</p>
            <p className="text-xs">Delivery date: {deliveryDate} · Pallets: {pallets.length}</p>
          </header>

          <section className="mt-3">
            <h2 className="mb-1 text-sm font-bold">Pick List</h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-0.5">Product</th>
                  <th className="py-0.5">Take from batch</th>
                  <th className="py-0.5 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {pickLines.map((line) => (
                  <tr key={line.key} className="border-b border-gray-300">
                    <td className="py-0.5">{line.productName}</td>
                    <td className="py-0.5">{line.batchName}</td>
                    <td className="py-0.5 text-right">{line.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-4">
            <h2 className="mb-1 text-sm font-bold">Pallet Labels</h2>
            <div className="label-grid grid grid-cols-3 gap-2">
              {pallets.map((pallet, index) => {
                const units = (pallet.items ?? []).reduce((sum, item) => sum + item.qty_units, 0);
                return (
                  <div key={pallet.id} className="label-card flex flex-col gap-1 border border-black p-2">
                    {barcodes[pallet.id] && <img src={barcodes[pallet.id]} alt={`Barcode for pallet ${index + 1}`} className="h-10 w-full" />}
                    <div className="text-xs">
                      <p className="font-bold">Pallet {index + 1} of {pallets.length} · {units} units</p>
                      <p className="font-mono text-[10px]">{pallet.id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
