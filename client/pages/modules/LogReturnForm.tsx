import { useState } from "react";
import { Package, Trash2 } from "lucide-react";
import { Invoice, Customer, Product } from "@shared/api";

type ReturnType = "good" | "damaged";

function customerIdForInvoice(invoice: Invoice | undefined, customers: Customer[]) {
  if (!invoice) return "";
  if (invoice.booking?.customer_id) return invoice.booking.customer_id;
  return customers.find((c) => c.store_name === invoice.customer_name)?.id ?? "";
}

const selectClass =
  "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-accent-2";

export function LogReturnForm({
  invoices, customers, products, token, onSaved, onCancel,
}: {
  invoices: Invoice[]; customers: Customer[]; products: Product[];
  token: string; onSaved: () => void; onCancel: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [returnType, setReturnType] = useState<ReturnType>("good");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const invoiceProducts = invoiceId
    ? (invoices.find((i) => i.id === invoiceId)?.invoice_items ?? []).map((item) => ({
        id: item.product_id,
        name: item.product_name,
      }))
    : [];

  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id);
    setProductId("");
    setCustomerId(customerIdForInvoice(invoices.find((i) => i.id === id), customers));
  };

  const reset = () => {
    setInvoiceId("");
    setCustomerId("");
    setProductId("");
    setQty(1);
    setReturnType("good");
    setReason("");
  };

  const handleSave = async () => {
    if (!invoiceId || !customerId || !productId || qty < 1) {
      alert("Fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/agent-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          invoice_id: invoiceId,
          customer_id: customerId,
          product_id: productId,
          qty_returned: qty,
          return_type: returnType,
          reason,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      reset();
      onSaved();
    } catch (err) {
      alert("Failed to create return: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const returnTypeOptions = [
    { value: "good", label: "Good Condition", desc: "Stock restored to inventory", Icon: Package, iconClass: "text-green" },
    { value: "damaged", label: "Damaged / Spoiled", desc: "Written off — no restock", Icon: Trash2, iconClass: "text-red" },
  ] as const;

  return (
    <>
      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Order / Invoice *</label>
          <select value={invoiceId} onChange={(e) => handleInvoiceChange(e.target.value)} className={selectClass}>
            <option value="">Select order…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.customer_name || inv.id.slice(0, 8)} · {inv.receipt_number || inv.id.slice(0, 8).toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Customer *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClass}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.store_name}{c.contact_person ? ` — ${c.contact_person}` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Product *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={selectClass}>
            <option value="">Select product…</option>
            {(invoiceProducts.length > 0 ? invoiceProducts : products.map((p) => ({ id: p.id, name: p.name }))).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {invoiceId && invoiceProducts.length === 0 && (
            <p className="page-subtitle">No items found on invoice — showing all products.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Quantity Returned *</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-accent-2" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-2">Return Type *</label>
          <div className="grid grid-cols-2 gap-2">
            {returnTypeOptions.map((opt) => (
              <label key={opt.value}
                className={`flex flex-col gap-1 p-3 border-2 rounded-lg cursor-pointer transition-all bg-white ${
                  returnType === opt.value ? "border-accent-2 bg-accent-2/5" : "border-border"
                }`}>
                <input type="radio" className="sr-only" checked={returnType === opt.value} onChange={() => setReturnType(opt.value)} />
                <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                  <opt.Icon size={14} className={opt.iconClass} /> {opt.label}
                </span>
                <span className="text-xs text-muted">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Reason / Notes</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder="Describe why the goods are being returned…"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-accent-2 resize-none" />
        </div>
      </div>

      <div className="flex justify-end gap-2 p-5 border-t border-border flex-shrink-0">
        <button onClick={() => { reset(); onCancel(); }} className="btn-ghost">Cancel</button>
        <button onClick={handleSave} disabled={!invoiceId || !customerId || !productId || qty < 1 || saving}
          className="btn-primary">
          {saving ? "Saving…" : "Log Return"}
        </button>
      </div>
    </>
  );
}
