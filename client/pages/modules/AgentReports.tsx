import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { RefreshCw, RotateCcw, CheckCircle, XCircle, PackageX } from "lucide-react";
import { AgentReturn, Invoice, Customer, Product } from "@shared/api";

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function statusBadge(status: string) {
  if (status === "accepted") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function returnTypeBadge(type: string) {
  return type === "damaged"
    ? "bg-orange-100 text-orange-800"
    : "bg-blue-100 text-blue-800";
}

// ─── Create Return Modal ───────────────────────────────────────────────────────
function CreateReturnModal({
  invoices, customers, products, token, onClose, onCreated,
}: {
  invoices: Invoice[]; customers: Customer[]; products: Product[];
  token: string; onClose: () => void; onCreated: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [returnType, setReturnType] = useState<"good" | "damaged">("good");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // When invoice changes, auto-fill customer from snapshot
  useEffect(() => {
    if (!invoiceId) { setCustomerId(""); return; }
    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv?.customer_name) {
      const matched = customers.find((c) => c.store_name === inv.customer_name);
      if (matched) setCustomerId(matched.id);
    }
  }, [invoiceId]);

  // Products available in this invoice
  const invoiceProducts = invoiceId
    ? (invoices.find((i) => i.id === invoiceId)?.invoice_items ?? []).map((item) => ({
        id: item.product_id,
        name: item.product_name,
      }))
    : [];

  const handleSave = async () => {
    if (!invoiceId || !customerId || !productId || qty < 1) {
      alert("Fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/agent-returns", {
        method: "POST",
        headers: authHeaders(token),
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
      onCreated();
      onClose();
    } catch (err) {
      alert("Failed to create return: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-navy-mid px-5 py-4 flex items-center justify-between border-b border-border rounded-t-2xl flex-shrink-0">
          <h2 className="font-rajdhani text-base font-bold text-white">Log Return</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Invoice */}
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Order / Invoice *</label>
            <select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setProductId(""); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
              <option value="">Select order…</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.customer_name || inv.id.slice(0, 8)} · {inv.receipt_number || inv.id.slice(0, 8).toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Customer (auto-filled, editable) */}
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.store_name}{c.contact_person ? ` — ${c.contact_person}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Product *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
              <option value="">Select product…</option>
              {(invoiceProducts.length > 0 ? invoiceProducts : products.map((p) => ({ id: p.id, name: p.name }))).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {invoiceId && invoiceProducts.length === 0 && (
              <p className="page-subtitle">No items found on invoice — showing all products.</p>
            )}
          </div>

          {/* Qty */}
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Quantity Returned *</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
          </div>

          {/* Return type */}
          <div>
            <label className="block text-xs font-semibold text-navy mb-2">Return Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "good", label: "✅ Good Condition", desc: "Stock restored to inventory" },
                { value: "damaged", label: "🗑 Damaged / Spoiled", desc: "Written off — no restock" },
              ] as const).map((opt) => (
                <label key={opt.value}
                  className={`flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    returnType === opt.value ? "border-accent-2 bg-accent-2/5" : "border-border"
                  }`}>
                  <input type="radio" className="sr-only" checked={returnType === opt.value} onChange={() => setReturnType(opt.value)} />
                  <span className="text-sm font-semibold text-navy">{opt.label}</span>
                  <span className="text-xs text-muted mt-0.5">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Reason / Notes</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="Describe why the goods are being returned…"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={!invoiceId || !customerId || !productId || qty < 1 || saving}
            className="btn-primary">
            {saving ? "Saving…" : "Log Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main AgentReports Component ───────────────────────────────────────────────
export function AgentReports() {
  const { token, user } = useAuth();
  const role = user?.role;

  const [returns,   setReturns]   = useState<AgentReturn[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [rRes, iRes, cRes, pRes] = await Promise.all([
        fetch("/api/agent-returns",  { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/invoices",       { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers",      { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products",       { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [returnsData, invoicesData, customersData, productsData] = await Promise.all([
        rRes.ok ? rRes.json() : [],
        iRes.ok ? iRes.json() : [],
        cRes.ok ? cRes.json() : [],
        pRes.ok ? pRes.json() : [],
      ]);
      setReturns(returnsData);
      setInvoices(invoicesData);
      setCustomers(customersData);
      setProducts(productsData);
      setError(null);
    } catch {
      setError("Failed to load returns.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleRefresh = async () => { setIsRefreshing(true); await fetchAll(); setIsRefreshing(false); };
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAccept = async (id: string) => {
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/agent-returns/${id}/accept`, {
        method: "POST", headers: authHeaders(token),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return; // cancelled
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/agent-returns/${id}/reject`, {
        method: "POST", headers: authHeaders(token),
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(null);
    }
  };

  const filtered = returns.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  const pendingCount  = returns.filter((r) => r.status === "pending").length;
  const acceptedCount = returns.filter((r) => r.status === "accepted").length;
  const rejectedCount = returns.filter((r) => r.status === "rejected").length;

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Agent Returns</h1>
          <p className="page-subtitle">Manage returned goods — restock or write off</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={isRefreshing}
            className="btn-ghost">
            <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 flex items-center gap-2">
            <RotateCcw size={15} /> Log Return
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-2 text-xs text-red">⚠️ {error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-2xl p-4">
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          <div className="text-xs text-muted font-semibold uppercase tracking-tight mt-1">Pending Review</div>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <div className="text-2xl font-bold text-green">{acceptedCount}</div>
          <div className="text-xs text-muted font-semibold uppercase tracking-tight mt-1">Accepted</div>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <div className="text-2xl font-bold text-red">{rejectedCount}</div>
          <div className="text-xs text-muted font-semibold uppercase tracking-tight mt-1">Rejected</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-off-white rounded-lg p-1 w-fit">
        {(["all", "pending", "accepted", "rejected"] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-semibold capitalize transition-all ${
              statusFilter === s ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <p className="px-6 py-8 text-sm text-muted">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr>
                  {["Date", "Order", "Customer", "Product", "Qty", "Type", "Reason", "Status", "Actions"].map((h) => (
                    <th key={h} className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold uppercase tracking-wider px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted">
                      {returns.length === 0 ? "No returns logged yet." : "No records match this filter."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((ret) => {
                    const inv = invoices.find((i) => i.id === ret.invoice_id);
                    const cust = customers.find((c) => c.id === ret.customer_id);
                    return (
                      <tr key={ret.id} className="border-b border-border hover:bg-off-white/40 transition-colors">
                        <td className="px-3 py-3 text-muted whitespace-nowrap">
                          {new Date(ret.created_at).toLocaleDateString("en-PH")}
                        </td>
                        <td className="px-3 py-3 font-mono text-navy">
                          {inv?.receipt_number || ret.invoice_id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-3 py-3 text-navy font-semibold">
                          {cust?.store_name || ret.customer_id.slice(0, 8)}
                          {cust?.contact_person && (
                            <p className="text-xs text-muted font-normal">{cust.contact_person}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-navy">{ret.product_name}</td>
                        <td className="px-3 py-3 font-semibold text-navy">{ret.qty_returned}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${returnTypeBadge(ret.return_type)}`}>
                            {ret.return_type === "damaged" ? "🗑 Damaged" : "✅ Good"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted max-w-[160px] truncate" title={ret.reason ?? ""}>
                          {ret.reason || "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${statusBadge(ret.status)}`}>
                            {ret.status}
                          </span>
                          {ret.status === "accepted" && ret.return_type === "good" && (
                            <p className="text-xs text-muted mt-0.5">
                              {ret.restored_to_pallet_id ? "Restocked ✓" : "Written off"}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {ret.status === "pending" && role === "admin" ? (
                            <div className="flex gap-1">
                              <button
                                disabled={processing === ret.id}
                                onClick={() => handleAccept(ret.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-green text-white text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50"
                              >
                                <CheckCircle size={12} /> Accept
                              </button>
                              <button
                                disabled={processing === ret.id}
                                onClick={() => handleReject(ret.id)}
                                className="flex items-center gap-1 px-2 py-1 border border-red text-red text-xs font-semibold rounded hover:bg-red/10 disabled:opacity-50"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">
                              {ret.reviewed_at ? new Date(ret.reviewed_at).toLocaleDateString("en-PH") : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateReturnModal
          invoices={invoices}
          customers={customers}
          products={products}
          token={token!}
          onClose={() => setShowCreate(false)}
          onCreated={fetchAll}
        />
      )}
    </div>
  );
}
