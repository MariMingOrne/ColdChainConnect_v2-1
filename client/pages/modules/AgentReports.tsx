import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RefreshCw, RotateCcw, CheckCircle, XCircle } from "lucide-react";
import { AgentReturn, Invoice, Customer, Product } from "@shared/api";
import { LogReturnForm } from "./LogReturnForm";

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

// ─── Agent: full-screen Log Return ────────────────────────────────────────────
function AgentLogReturnScreen({
  invoices, customers, products, token,
}: {
  invoices: Invoice[]; customers: Customer[]; products: Product[]; token: string;
}) {
  const [logged, setLogged] = useState(false);

  return (
    <div className="px-4 md:px-6 lg:px-7 py-4 md:py-6 space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="page-title">Logging Returns</h1>
        <p className="page-subtitle">Record returned items and their condition</p>
      </div>

      {logged && (
        <div className="rounded-lg border border-green/30 bg-green/10 px-4 py-2 text-xs text-green">
          Return logged.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border flex flex-col">
        <LogReturnForm
          invoices={invoices}
          customers={customers}
          products={products}
          token={token}
          onSaved={() => setLogged(true)}
          onCancel={() => setLogged(false)}
        />
      </div>
    </div>
  );
}

// ─── Admin: Create Return Modal ───────────────────────────────────────────────
function CreateReturnModal({
  invoices, customers, products, token, onClose, onCreated,
}: {
  invoices: Invoice[]; customers: Customer[]; products: Product[];
  token: string; onClose: () => void; onCreated: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-navy-mid px-5 py-4 flex items-center justify-between border-b border-border rounded-t-2xl flex-shrink-0">
          <h2 className="font-rajdhani text-base font-bold text-white">Log Return</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <LogReturnForm
          invoices={invoices}
          customers={customers}
          products={products}
          token={token}
          onSaved={() => { onCreated(); onClose(); }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

// ─── Main Returns Component ───────────────────────────────────────────────────
export function AgentReports() {
  const { token, user } = useAuth();
  const role = user?.role;
  const isAgent = role === "agent";

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
    if (reason === null) return;
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

  if (isAgent) {
    return (
      <AgentLogReturnScreen
        invoices={invoices}
        customers={customers}
        products={products}
        token={token!}
      />
    );
  }

  const filtered = returns.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  const pendingCount  = returns.filter((r) => r.status === "pending").length;
  const acceptedCount = returns.filter((r) => r.status === "accepted").length;
  const rejectedCount = returns.filter((r) => r.status === "rejected").length;

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto space-y-6">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Returns</h1>
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

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <LoadingSpinner className="min-h-32" />
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
                          {ret.status === "pending" ? (
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
