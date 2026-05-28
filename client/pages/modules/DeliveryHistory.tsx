import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { Customer, Truck, Invoice } from "@shared/api";

interface Receipt {
  id: string;
  receipt_number: string;
  customer_id: string;
  truck_id: string;
  invoice_id: string;
  confirmed_at: string;
  notes?: string;
  confirmed_by?: string;
}

interface ReceiptExt extends Receipt {
  customer?: Customer;
  truck?: Truck;
  invoice?: Invoice;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function DeliveryHistory() {
  const { token } = useAuth();

  const [receipts,  setReceipts]  = useState<ReceiptExt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trucks,    setTrucks]    = useState<Truck[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);
  const [viewReceipt, setViewReceipt] = useState<ReceiptExt | null>(null);

  const PER_PAGE = 15;

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [rRes, cRes, tRes, iRes] = await Promise.all([
        fetch("/api/receipts",  { headers: authHeaders(token) }),
        fetch("/api/customers", { headers: authHeaders(token) }),
        fetch("/api/trucks",    { headers: authHeaders(token) }),
        fetch("/api/invoices",  { headers: authHeaders(token) }),
      ]);

      const [receiptsData, customersData, trucksData, invoicesData] = await Promise.all([
        rRes.ok ? rRes.json() : [],
        cRes.ok ? cRes.json() : [],
        tRes.ok ? tRes.json() : [],
        iRes.ok ? iRes.json() : [],
      ]);

      setCustomers(customersData);
      setTrucks(trucksData);
      setInvoices(invoicesData);

      const joined: ReceiptExt[] = (receiptsData as Receipt[]).map((r) => ({
        ...r,
        customer: (customersData as Customer[]).find((c) => c.id === r.customer_id),
        truck:    (trucksData    as Truck[]).find((t)   => t.id === r.truck_id),
        invoice:  (invoicesData  as Invoice[]).find((i) => i.id === r.invoice_id),
      }));

      setReceipts(joined);
      setError(null);
    } catch {
      setError("Failed to load delivery history.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(q) ||
      (r.customer?.store_name ?? "").toLowerCase().includes(q) ||
      (r.truck?.name ?? "").toLowerCase().includes(q) ||
      r.invoice_id.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totalReceipts = receipts.length;
  const todayReceipts = receipts.filter((r) => {
    const today = new Date().toDateString();
    return new Date(r.confirmed_at).toDateString() === today;
  }).length;

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
            Delivery History
          </h1>
          <p className="text-xs text-muted mt-1">
            All completed deliveries with Original Receipts
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
          title="Refresh data"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-2 text-xs text-red">⚠️ {error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Deliveries" value={totalReceipts.toString()} icon="📦" color="blue" />
        <SummaryCard label="Today"             value={todayReceipts.toString()} icon="📅" color="green" />
        <SummaryCard label="Unique Customers"  value={new Set(receipts.map((r) => r.customer_id)).size.toString()} icon="🏪" color="gold" />
        <SummaryCard label="Paid Invoices"     value={receipts.length.toString()} icon="✅" color="green" />
      </div>

      {/* Search */}
      <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2 max-w-md">
        <span className="text-muted">🔍</span>
        <input
          type="text"
          placeholder="Search by receipt #, customer, truck, or invoice…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm"
        />
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
                  {["Receipt #", "Customer", "Truck", "Invoice", "Confirmed At", "Notes", "Action"].map((h) => (
                    <th key={h} className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold uppercase tracking-wider px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted">
                      {receipts.length === 0 ? "No completed deliveries yet." : "No results matching your search."}
                    </td>
                  </tr>
                ) : (
                  paginated.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-off-white/50 transition-colors">
                      <td className="px-3 py-3 font-mono font-semibold text-accent-2">{r.receipt_number}</td>
                      <td className="px-3 py-3 text-navy font-semibold">
                        {r.customer?.store_name ?? <span className="text-muted font-normal">{r.customer_id.slice(0, 8)}…</span>}
                        {r.customer?.location && <p className="text-muted font-normal text-xs">{r.customer.location}</p>}
                      </td>
                      <td className="px-3 py-3 text-navy">
                        {r.truck?.name ?? <span className="text-muted">{r.truck_id.slice(0, 8)}…</span>}
                      </td>
                      <td className="px-3 py-3 font-mono text-muted">{r.invoice_id.slice(0, 8)}…</td>
                      <td className="px-3 py-3 text-navy whitespace-nowrap">
                        {new Date(r.confirmed_at).toLocaleString("en-PH")}
                      </td>
                      <td className="px-3 py-3 text-muted">{r.notes ?? "—"}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setViewReceipt(r)}
                          className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-off-white transition-colors"
                        >
                          🧾 View OR
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-off-white/50">
            <span className="text-xs text-muted">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded text-xs font-semibold disabled:opacity-40 hover:bg-white"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-xs font-semibold text-navy">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-border rounded text-xs font-semibold disabled:opacity-40 hover:bg-white"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Original Receipt Modal */}
      {viewReceipt && (
        <OriginalReceiptModal receipt={viewReceipt} onClose={() => setViewReceipt(null)} />
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted font-semibold uppercase tracking-tight">{label}</div>
          <div className={`font-rajdhani text-2xl font-bold mt-2 text-${color}`}>{value}</div>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

// ─── Original Receipt Modal ───────────────────────────────────────────────────

function OriginalReceiptModal({ receipt, onClose }: { receipt: ReceiptExt; onClose: () => void }) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Original Receipt</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-white/20 text-white rounded text-xs font-semibold hover:bg-white/30"
            >
              🖨 Print
            </button>
            <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Receipt body */}
        <div className="p-8 space-y-6 font-mono text-sm" id="receipt-print-area">
          {/* Company header */}
          <div className="text-center border-b-2 border-dashed border-border pb-4">
            <p className="font-rajdhani text-2xl font-bold text-navy tracking-tight">COLDCHAIN CONNECT</p>
            <p className="text-xs text-muted mt-1">ACDP Warehouse, Pampanga</p>
            <p className="text-xs text-muted">Cold Chain Logistics & Distribution</p>
          </div>

          {/* Receipt info */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Receipt No.:</span>
              <span className="font-bold text-accent-2">{receipt.receipt_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Date:</span>
              <span>{new Date(receipt.confirmed_at).toLocaleString("en-PH")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Invoice ID:</span>
              <span>{receipt.invoice_id.slice(0, 8)}…</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Truck:</span>
              <span>{receipt.truck?.name ?? receipt.truck_id.slice(0, 8)}</span>
            </div>
            {receipt.confirmed_by && (
              <div className="flex justify-between">
                <span className="text-muted">Confirmed by:</span>
                <span>{receipt.confirmed_by}</span>
              </div>
            )}
          </div>

          {/* Customer info */}
          <div className="border-t border-dashed border-border pt-4 space-y-1 text-xs">
            <p className="font-semibold text-navy mb-1">Delivered to:</p>
            <p className="font-bold">{receipt.customer?.store_name ?? receipt.customer_id}</p>
            {receipt.customer?.location && <p className="text-muted">{receipt.customer.location}</p>}
            {receipt.customer?.contact_info && <p className="text-muted">{receipt.customer.contact_info}</p>}
          </div>

          {/* Invoice status */}
          <div className="border-t border-dashed border-border pt-4 space-y-1 text-xs">
            <div className="flex justify-between font-semibold">
              <span>Invoice Status:</span>
              <span className="text-green">PAID ✓</span>
            </div>
            {receipt.invoice?.payment_status && (
              <div className="flex justify-between">
                <span className="text-muted">Payment Status:</span>
                <span>{receipt.invoice.payment_status.toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {receipt.notes && (
            <div className="border-t border-dashed border-border pt-4 text-xs">
              <p className="text-muted">Notes:</p>
              <p>{receipt.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-dashed border-border pt-4 text-center text-xs text-muted space-y-1">
            <p>This is an official Original Receipt.</p>
            <p>Thank you for your business!</p>
            <p className="mt-2 font-semibold text-navy">ColdChain Connect</p>
          </div>
        </div>
      </div>
    </div>
  );
}
