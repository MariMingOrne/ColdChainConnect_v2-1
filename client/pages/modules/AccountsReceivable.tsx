import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Send, RefreshCw } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { AccountsReceivable as ARType, Customer } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function AccountsReceivable() {
  const [arRecords, setARRecords] = useState<ARType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "outstanding" | "paid" | "partial">("outstanding");

  const fetchData = async () => {
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const getCustomerName = (customerId: string) => {
    return customers.find((c) => c.id === customerId)?.store_name || customerId.slice(0, 8);
  };

  const daysCreated = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getAgeColor = (days: number) => {
    if (days <= 7) return "bg-green-100 text-green-800";
    if (days <= 30) return "bg-yellow-100 text-yellow-800";
    if (days <= 60) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusColor = (status: string) => {
    if (status === "paid") return "badge-green";
    if (status === "partial") return "badge-gold";
    return "badge-blue";
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  const totalDue = arRecords.reduce((sum, ar) => sum + parseFloat(ar.amount_due || "0"), 0);
  const outstandingCount = arRecords.filter((ar) => ar.status === "outstanding").length;

  const filtered = arRecords.filter((ar) => {
    const matchesSearch =
      ar.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(ar.customer_id).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    return ar.status === statusFilter;
  });

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Accounts Receivable</h1>
          <p className="text-gray-600">Track customer balances and unpaid deliveries</p>
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
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-3xl font-bold text-navy">{outstandingCount}</div>
          <p className="text-sm text-gray-600">Outstanding</p>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-orange-600">{arRecords.length}</div>
          <p className="text-sm text-gray-600">Total Records</p>
        </Card>
        <Card className="p-4 bg-blue-50">
          <div className="text-sm text-gray-600 mb-1">Total Amount Due</div>
          <div className="text-2xl font-bold text-navy">₱{totalDue.toFixed(2)}</div>
        </Card>
      </div>

      {/* Search and Filters */}
      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by AR ID or customer…"
        filters={[
          {
            name: "statusFilter",
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as any),
            options: [
              { label: "All Status", value: "all" },
              { label: "Outstanding", value: "outstanding" },
              { label: "Paid", value: "paid" },
              { label: "Partial", value: "partial" },
            ],
          },
        ]}
      />

      {/* AR Records Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>AR ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Days Old</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {arRecords.length === 0 ? "No outstanding balances - Great job!" : "No records match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ar) => {
                const days = daysCreated(ar.created_at);
                return (
                  <TableRow key={ar.id}>
                    <TableCell className="font-mono text-sm">{ar.id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-sm font-semibold text-navy">
                      {getCustomerName(ar.customer_id)}
                    </TableCell>
                    <TableCell className="text-sm font-bold">₱{ar.amount_due}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(ar.status)}`}>
                        {ar.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(ar.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getAgeColor(days)}`}>
                        {days} days
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
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
