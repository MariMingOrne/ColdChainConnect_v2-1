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
import { RefreshCw, CheckCircle } from "lucide-react";
import { AccountsReceivable as ARType, Customer } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

type Tab = "outstanding" | "paid" | "credits" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "outstanding", label: "Outstanding" },
  { key: "paid",        label: "Paid" },
  { key: "credits",     label: "Credits" },
  { key: "all",         label: "All" },
];

export function AccountsReceivable() {
  const [arRecords, setARRecords] = useState<ARType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("outstanding");
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [arRes, custRes] = await Promise.all([
        fetch("/api/accounts-receivable", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/customers", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!arRes.ok) throw new Error("Failed to fetch AR records");
      const arData = await arRes.json();
      setARRecords(arData);

      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
      setARRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    if (!confirm("Mark this AR record as paid?")) return;
    setMarkingPaid(id);
    try {
      const res = await fetch(`/api/accounts-receivable/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "paid" }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Switch to Paid tab so user can immediately see the record
      setActiveTab("paid");
      await fetchData();
    } catch (err) {
      alert("Failed to mark as paid: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const getCustomerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.store_name || customerId.slice(0, 8);

  const daysCreated = (createdAt: string) => {
    const days = Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const getAgeColor = (days: number) => {
    if (days <= 7)  return "bg-green-100 text-green-800";
    if (days <= 30) return "bg-yellow-100 text-yellow-800";
    if (days <= 60) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusColor = (status: string) => {
    if (status === "paid")    return "badge-green";
    if (status === "partial") return "badge-gold";
    return "badge-blue";
  };

  // ── Derived counts ──────────────────────────────────────────────────────────
  const outstandingRecords = arRecords.filter(
    (ar) => ar.status === "outstanding" && parseFloat(ar.amount_due) >= 0
  );
  const paidRecords = arRecords.filter((ar) => ar.status === "paid");
  const creditRecords = arRecords.filter((ar) => parseFloat(ar.amount_due) < 0);

  const tabCounts: Record<Tab, number> = {
    outstanding: outstandingRecords.length,
    paid:        paidRecords.length,
    credits:     creditRecords.length,
    all:         arRecords.length,
  };

  const totalOutstanding = outstandingRecords.reduce(
    (sum, ar) => sum + parseFloat(ar.amount_due || "0"), 0
  );

  // ── Filter by active tab + search ───────────────────────────────────────────
  const tabFiltered = arRecords.filter((ar) => {
    const amountNum = parseFloat(ar.amount_due);
    if (activeTab === "outstanding") return ar.status === "outstanding" && amountNum >= 0;
    if (activeTab === "paid")        return ar.status === "paid";
    if (activeTab === "credits")     return amountNum < 0;
    return true; // "all"
  });

  const filtered = tabFiltered.filter((ar) => {
    const q = searchTerm.toLowerCase();
    return (
      ar.id.toLowerCase().includes(q) ||
      getCustomerName(ar.customer_id).toLowerCase().includes(q)
    );
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Accounts Receivable</h1>
          <p className="page-subtitle">Track customer balances and unpaid deliveries</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-ghost"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700 text-sm">{error}</p>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-navy">{outstandingRecords.length}</div>
          <p className="text-xs text-muted font-semibold uppercase tracking-tight mt-1">Outstanding</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green">{paidRecords.length}</div>
          <p className="text-xs text-muted font-semibold uppercase tracking-tight mt-1">Paid</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-accent-2">{creditRecords.length}</div>
          <p className="text-xs text-muted font-semibold uppercase tracking-tight mt-1">Credits</p>
        </Card>
        <Card className="p-4 bg-blue-50">
          <div className="text-xs text-muted mb-1">Total Outstanding</div>
          <div className="text-xl font-bold text-navy">₱{totalOutstanding.toFixed(2)}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-off-white rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearchTerm(""); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-white text-navy shadow-sm"
                : "text-muted hover:text-navy"
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
              activeTab === tab.key ? "bg-navy text-white" : "bg-border text-muted"
            }`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-sm">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer or AR ID…"
          className="w-full pl-4 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2 bg-white"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>AR ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Created</TableHead>
              {activeTab !== "paid" && <TableHead>Age</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted text-sm">
                  {activeTab === "outstanding" && "No outstanding balances — great job! 🎉"}
                  {activeTab === "paid"        && "No paid records yet."}
                  {activeTab === "credits"     && "No return credits yet."}
                  {activeTab === "all"         && (arRecords.length === 0 ? "No AR records yet." : "No records match your search.")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ar) => {
                const days = daysCreated(ar.created_at);
                const amountNum = parseFloat(ar.amount_due);
                const isCredit = amountNum < 0;
                return (
                  <TableRow key={ar.id} className="hover:bg-off-white/40 transition-colors">
                    <TableCell className="font-mono text-xs text-muted">{ar.id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-sm font-semibold text-navy">
                      {getCustomerName(ar.customer_id)}
                    </TableCell>
                    <TableCell className={`text-sm font-bold ${isCredit ? "text-green-600" : ""}`}>
                      {isCredit
                        ? <span>−₱{Math.abs(amountNum).toFixed(2)} <span className="text-xs font-normal text-green-600">(credit)</span></span>
                        : `₱${amountNum.toFixed(2)}`
                      }
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(ar.status)}`}>
                        {ar.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted max-w-[180px] truncate" title={ar.notes ?? ""}>
                      {ar.notes || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted whitespace-nowrap">
                      {new Date(ar.created_at).toLocaleDateString("en-PH")}
                    </TableCell>
                    {activeTab !== "paid" && (
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getAgeColor(days)}`}>
                          {days}d
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {ar.status !== "paid" && !isCredit ? (
                        <button
                          onClick={() => handleMarkPaid(ar.id)}
                          disabled={markingPaid === ar.id}
                          className="flex items-center gap-1.5 ml-auto whitespace-nowrap px-3 py-1.5 bg-green text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          <CheckCircle size={13} />
                          {markingPaid === ar.id ? "Saving…" : "Mark Paid"}
                        </button>
                      ) : ar.status === "paid" ? (
                        <span className="text-xs text-green font-semibold">✅ Paid</span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
