import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer, RefreshCw, Calendar } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Invoice, InvoiceItem, BookingItem } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

// ─── Printable Receipt Modal ───────────────────────────────────────────────

interface ReceiptModalProps {
  invoice: Invoice;
  onClose: () => void;
}

function ReceiptModal({ invoice, onClose }: ReceiptModalProps) {
  // Use snapshotted invoice_items; fall back to booking_items for legacy invoices
  const items: InvoiceItem[] = invoice.invoice_items && invoice.invoice_items.length > 0
    ? invoice.invoice_items
    : (invoice.booking?.booking_items || []).map((bi, idx) => ({
        id: `legacy-${idx}`,
        invoice_id: invoice.id,
        product_id: bi.product_id,
        product_name: bi.product?.name || bi.product_id,
        product_sku: bi.product?.sku || null,
        qty_ordered: bi.qty_ordered,
        unit_price: bi.product?.price || "0",
        amount: String(parseFloat(bi.product?.price || "0") * bi.qty_ordered),
        created_at: invoice.created_at,
      }));

  // Resolve customer fields — prefer snapshot, fall back to booking.customer
  const customerName    = invoice.customer_name    || invoice.booking?.customer?.store_name  || "—";
  const customerAddress = invoice.customer_address || invoice.booking?.customer?.location    || "—";
  const customerTerms   = invoice.customer_payment_type || invoice.booking?.customer?.payment_type || "COD";

  // Recompute totals from items if snapshot amounts are zero/missing
  const snapshotGross = parseFloat(invoice.gross_amount || "0");
  const computedGross = items.reduce((s, i) => s + parseFloat(i.amount), 0);
  const gross    = snapshotGross > 0 ? snapshotGross : computedGross;
  const DISCOUNT = parseFloat(invoice.discount_rate || "0.02");
  const discount = parseFloat(invoice.discount_amount || "0") || gross * DISCOUNT;
  const total    = parseFloat(invoice.total_amount    || "0") || gross - discount;
  const totalKg  = items.reduce((s, i) => s + i.qty_ordered, 0);

  const date = new Date(invoice.created_at).toLocaleDateString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
  });

  const fmt = (n: number) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-3xl w-full max-h-[95vh] overflow-y-auto">

        {/* Modal toolbar – hidden on print */}
        <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl no-print">
          <h2 className="font-rajdhani text-lg font-bold text-white">Delivery Receipt</h2>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-accent-2 text-white text-sm font-semibold rounded-lg hover:opacity-80 flex items-center gap-2"
            >
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Receipt body */}
        <div id="receipt-print-area" className="p-6 font-sans text-black">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #receipt-print-area, #receipt-print-area * { visibility: visible; }
              #receipt-print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
              .no-print { display: none !important; }
            }
          `}</style>

          {/* ── Company Header ── */}
          <div className="flex items-start justify-between mb-0.5">
            <div>
              <div className="text-2xl font-black tracking-wide uppercase leading-tight">
                ACDP CONSUMER GOODS TRADING
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                Seniorita St. Saguin 2000 City of San Fernando (Capital) Pampanga Philippines
              </div>
            </div>
            {/* Logo placeholder matching reference */}
            <div className="ml-4 shrink-0 border border-gray-300 px-3 py-1 text-center">
              <div className="text-sm font-black tracking-widest text-gray-800">ACDP</div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wide">Consumer Goods Trading</div>
            </div>
          </div>

          {/* ── Receipt number / title ── */}
          <div className="flex justify-end mt-1 mb-2">
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wide">DELIVERY RECEIPT</div>
              <div className="text-sm font-bold text-red-600">
                No. {invoice.receipt_number || invoice.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          {/* ── Sold To / Date block ── */}
          <div className="border border-black text-xs">
            <div className="flex border-b border-black">
              <div className="w-24 shrink-0 border-r border-black px-2 py-1.5 font-bold">SOLD TO:</div>
              <div className="flex-1 border-r border-black px-2 py-1.5 font-bold text-center uppercase">
                {customerName}
              </div>
              <div className="flex items-center px-3 py-1.5 gap-6">
                <span className="font-bold">DATE:</span>
                <span>{date}</span>
              </div>
            </div>
            <div className="flex">
              <div className="w-24 shrink-0 border-r border-black px-2 py-1.5 font-bold">ADDRESS:</div>
              <div className="flex-1 border-r border-black px-2 py-1.5">
                {customerAddress}
              </div>
              <div className="flex items-center px-3 py-1.5 gap-6">
                <span className="font-bold">TERMS:</span>
                <span>{customerTerms.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* ── Line Items Table ── */}
          <table className="w-full border-collapse text-xs border-l border-r border-b border-black">
            <thead>
              <tr className="border-b border-black">
                <th className="border-r border-black px-2 py-1 text-center font-bold w-12">QTY</th>
                <th className="border-r border-black px-2 py-1 text-center font-bold w-12">kg</th>
                <th className="border-r border-black px-2 py-1 text-center font-bold w-12">UNIT</th>
                <th className="border-r border-black px-2 py-1 text-left font-bold">DESCRIPTION</th>
                <th className="border-r border-black px-2 py-1 text-center font-bold w-24">SKU CODE</th>
                <th className="border-r border-black px-2 py-1 text-right font-bold w-24">UNIT PRICE</th>
                <th className="px-2 py-1 text-right font-bold w-28">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-black">
                  <td className="border-r border-black px-2 py-1 text-center">{item.qty_ordered}</td>
                  <td className="border-r border-black px-2 py-1 text-center">{item.qty_ordered}</td>
                  <td className="border-r border-black px-2 py-1 text-center">PK</td>
                  <td className="border-r border-black px-2 py-1">{item.product_name}</td>
                  <td className="border-r border-black px-2 py-1 text-center">{item.product_sku || "—"}</td>
                  <td className="border-r border-black px-2 py-1 text-right">
                    ₱ {fmt(parseFloat(item.unit_price))}
                  </td>
                  <td className="px-2 py-1 text-right">
                    ₱ {fmt(parseFloat(item.amount))}
                  </td>
                </tr>
              ))}
              {/* Padding rows to match receipt style */}
              {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
                <tr key={`pad-${i}`} className="border-b border-black">
                  <td className="border-r border-black px-2 py-2">&nbsp;</td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                </tr>
              ))}
              {/* Gross row */}
              <tr className="border-b border-black">
                <td className="border-r border-black px-2 py-1" colSpan={5}></td>
                <td className="border-r border-black px-2 py-1 text-right font-bold">GROSS</td>
                <td className="px-2 py-1 text-right">₱ {fmt(gross)}</td>
              </tr>
              {/* Less 2% row */}
              <tr>
                <td className="border-r border-black px-2 py-1" colSpan={5}></td>
                <td className="border-r border-black px-2 py-1 text-right font-bold">
                  LESS {Number((parseFloat(invoice.discount_rate || "0.02") * 100).toFixed(2))}%
                </td>
                <td className="px-2 py-1 text-right">{fmt(discount)}</td>
              </tr>
            </tbody>
          </table>

          {/* ── Total Footer ── */}
          <div className="border-l border-r border-b border-black flex items-stretch text-sm">
            <div className="border-r border-black px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-bold">TOTAL kg</span>
              <span className="text-base font-extrabold">{totalKg}</span>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <span className="font-extrabold uppercase tracking-wide">TOTAL AMOUNT DUE</span>
            </div>
            <div className="px-4 py-2 flex items-center">
              <span className="text-base font-extrabold">₱ {fmt(total)}</span>
            </div>
          </div>

          {/* ── Signatures ── */}
          <div className="border-l border-r border-b border-black flex text-xs">
            <div className="flex-1 border-r border-black px-3 py-4">
              <span className="font-bold">PREPARED BY:</span>
              {invoice.prepared_by && (
                <span className="ml-2">{invoice.prepared_by}</span>
              )}
            </div>
            <div className="flex-1 px-3 py-4 text-right">
              <span className="font-bold">RECEIVED BY:</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Invoicing Component ──────────────────────────────────────────────

export function Invoicing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "issued" | "paid">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "week" | "month" | "custom">("today");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    try {
      const res = await fetch("/api/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch invoices");
      setInvoices(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchInvoices();
    setIsRefreshing(false);
  };

  useEffect(() => { if (token) fetchInvoices(); }, [token]);

  const getStatusColor = (status: string) => ({
    draft:  "bg-gray-100 text-gray-800",
    issued: "bg-blue-100 text-blue-800",
    paid:   "bg-green-100 text-green-800",
  }[status] || "bg-gray-100 text-gray-800");

  const isDateInRange = (dateStr: string): boolean => {
    if (dateRangeFilter === "all") return true;
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dateRangeFilter === "today") return dOnly.getTime() === today.getTime();
    if (dateRangeFilter === "week") {
      const ws = new Date(today); ws.setDate(today.getDate() - today.getDay());
      const we = new Date(ws);    we.setDate(ws.getDate() + 6);
      return dOnly >= ws && dOnly <= we;
    }
    if (dateRangeFilter === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (dateRangeFilter === "custom") {
      if (!customDateStart || !customDateEnd) return true;
      const end = new Date(customDateEnd); end.setHours(23, 59, 59, 999);
      return d >= new Date(customDateStart) && d <= end;
    }
    return true;
  };

  if (isLoading && !isRefreshing) return <LoadingSpinner />;

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.booking_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (paymentFilter !== "all" && inv.payment_status !== paymentFilter) return false;
    if (!isDateInRange(inv.created_at)) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Receipts</h1>
          <p className="text-gray-600">Print and review delivery receipts</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-off-white disabled:opacity-50 flex items-center gap-2 w-fit"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by invoice ID, booking ID, or customer…"
        filters={[
          {
            name: "statusFilter", value: statusFilter,
            onChange: (v) => setStatusFilter(v as any),
            options: [
              { label: "All Status", value: "all" },
              { label: "Draft",      value: "draft" },
              { label: "Issued",     value: "issued" },
              { label: "Paid",       value: "paid" },
            ],
          },
          {
            name: "paymentFilter", value: paymentFilter,
            onChange: (v) => setPaymentFilter(v as any),
            options: [
              { label: "All Payments", value: "all" },
              { label: "Paid",         value: "paid" },
              { label: "Unpaid",       value: "unpaid" },
            ],
          },
          {
            name: "dateRangeFilter", value: dateRangeFilter,
            onChange: (v) => setDateRangeFilter(v as any),
            options: [
              { label: "All Dates",   value: "all" },
              { label: "This Day",    value: "today" },
              { label: "This Week",   value: "week" },
              { label: "This Month",  value: "month" },
              { label: "Custom",      value: "custom" },
            ],
          },
        ]}
      />

      {dateRangeFilter === "custom" && (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
              <Calendar size={16} className="text-muted" />
              <input type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)}
                className="flex-1 bg-transparent border-none text-white py-2 outline-none text-sm" />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
              <Calendar size={16} className="text-muted" />
              <input type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)}
                className="flex-1 bg-transparent border-none text-white py-2 outline-none text-sm" />
            </div>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt No.</TableHead>
              <TableHead>Order / Booking</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Total Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  {invoices.length === 0 ? "No invoices found" : "No invoices match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const itemCount = inv.invoice_items?.length ?? 0;
                const legacyItems = inv.booking?.booking_items ?? [];
                const snapshotGross = parseFloat(inv.gross_amount || "0");
                const computedGross = itemCount > 0
                  ? snapshotGross
                  : legacyItems.reduce((s, bi) => s + parseFloat(bi.product?.price || "0") * bi.qty_ordered, 0);
                const gross = snapshotGross > 0 ? snapshotGross : computedGross;
                const DISCOUNT = parseFloat(inv.discount_rate || "0.02");
                const snapshotTotal = parseFloat(inv.total_amount || "0");
                const total = snapshotTotal > 0 ? snapshotTotal : gross * (1 - DISCOUNT);
                const fmt = (n: number) =>
                  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm font-semibold text-accent-2">
                      {inv.receipt_number || inv.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-semibold text-navy bg-off-white px-1.5 py-0.5 rounded w-fit">
                          {inv.booking_id.slice(0, 8).toUpperCase()}
                        </span>
                        {inv.booking?.customer?.store_name && !inv.customer_name && (
                          <span className="text-xs text-muted">{inv.booking.customer.store_name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-navy">
                          {inv.customer_name || inv.booking?.customer?.store_name || "—"}
                        </span>
                        {(inv.customer_address || inv.booking?.customer?.location) && (
                          <span className="text-xs text-muted">
                            {inv.customer_address || inv.booking?.customer?.location}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {(() => {
                        const count = itemCount > 0 ? itemCount : legacyItems.length;
                        return <>{count} item{count !== 1 ? "s" : ""}</>;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">₱ {fmt(gross)}</TableCell>
                    <TableCell className="text-sm font-semibold text-navy">₱ {fmt(total)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        inv.payment_status === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-orange-100 text-orange-800"
                      }`}>
                        {inv.payment_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => setReceiptInvoice(inv)}
                        className="px-3 py-1.5 bg-accent-2 text-white text-xs font-semibold rounded-lg hover:opacity-80 flex items-center gap-1.5 ml-auto whitespace-nowrap"
                      >
                        <Printer size={14} /> Print
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {receiptInvoice && (
        <ReceiptModal invoice={receiptInvoice} onClose={() => setReceiptInvoice(null)} />
      )}
    </div>
  );
}
