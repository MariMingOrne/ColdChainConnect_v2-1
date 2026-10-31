import { useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { Invoice, Customer, Product } from "@shared/api";

type ReturnType = "good" | "damaged";

function invoiceCustomerId(invoice: Invoice, customers: Customer[]) {
  if (invoice.booking?.customer_id) return invoice.booking.customer_id;
  return customers.find((c) => c.store_name === invoice.customer_name)?.id ?? "";
}

const selectClass =
  "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-accent-2 disabled:opacity-50";

export function LogReturnForm({
  invoices, customers, products, token, onSaved, onCancel,
}: {
  invoices: Invoice[]; customers: Customer[]; products: Product[];
  token: string; onSaved: () => void; onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [items, setItems] = useState([{ product_id: "", qty_returned: 1 }]);
  const [returnType, setReturnType] = useState<ReturnType>("good");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const customerInvoices = customerId
    ? invoices.filter((inv) => invoiceCustomerId(inv, customers) === customerId)
    : [];

  const invoiceProducts = invoiceId
    ? Array.from(new Map((invoices.find((i) => i.id === invoiceId)?.invoice_items ?? []).map((item) => [
        item.product_id,
        { id: item.product_id, name: item.product_name },
      ])).values())
    : [];

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    setInvoiceId("");
    setItems([{ product_id: "", qty_returned: 1 }]);
  };

  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id);
    setItems([{ product_id: "", qty_returned: 1 }]);
  };

  const reset = () => {
    setCustomerId("");
    setInvoiceId("");
    setItems([{ product_id: "", qty_returned: 1 }]);
    setReturnType("good");
    setReason("");
  };

  const handleSave = async () => {
    if (!customerId || !invoiceId || items.some((item) => !item.product_id || !Number.isInteger(item.qty_returned) || item.qty_returned < 1)) {
      alert("Select a product and enter a valid quantity for every item.");
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
          items,
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
          <label className="block text-xs font-semibold text-navy mb-1">Customer *</label>
          <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)} className={selectClass}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.store_name}{c.contact_person ? ` — ${c.contact_person}` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Order / Invoice *</label>
          <select value={invoiceId} onChange={(e) => handleInvoiceChange(e.target.value)}
            disabled={!customerId} className={selectClass}>
            <option value="">{customerId ? "Select order…" : "Select a customer first"}</option>
            {customerInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.receipt_number || inv.id.slice(0, 8).toUpperCase()}
              </option>
            ))}
          </select>
          {customerId && customerInvoices.length === 0 && (
            <p className="page-subtitle">No orders found for this customer.</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-navy">Returned Items *</label>
            <button
              type="button"
              onClick={() => setItems((current) => [...current, { product_id: "", qty_returned: 1 }])}
              disabled={!invoiceId || items.length >= invoiceProducts.length}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-2 disabled:opacity-50"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
          {items.map((item, index) => {
            const selectedElsewhere = new Set(items.filter((_, itemIndex) => itemIndex !== index).map((entry) => entry.product_id));
            return (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2 items-end">
                <div>
                  <label className="block text-xs text-muted mb-1">Product</label>
                  <select
                    value={item.product_id}
                    onChange={(e) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, product_id: e.target.value } : entry))}
                    disabled={!invoiceId}
                    className={selectClass}
                  >
                    <option value="">{invoiceId ? "Select product…" : "Select an order first"}</option>
                    {invoiceProducts.filter((product) => !selectedElsewhere.has(product.id) || product.id === item.product_id).map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.qty_returned}
                    onChange={(e) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, qty_returned: Number(e.target.value) } : entry))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-accent-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={items.length === 1}
                  aria-label="Remove item"
                  className="h-[42px] px-2 text-muted hover:text-red disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
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
        <button onClick={handleSave} disabled={!customerId || !invoiceId || items.some((item) => !item.product_id || !Number.isInteger(item.qty_returned) || item.qty_returned < 1) || saving}
          className="btn-primary">
          {saving ? "Saving…" : "Log Return"}
        </button>
      </div>
    </>
  );
}
