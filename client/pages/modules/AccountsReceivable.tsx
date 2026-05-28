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
import { Invoice } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function AccountsReceivable() {
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUnpaid = async () => {
    try {
      const response = await fetch("/api/invoices?unpaid=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch unpaid invoices");
      const data = await response.json();
      setUnpaidInvoices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading invoices");
      // Set mock data if API fails
      setUnpaidInvoices([
        {
          id: "INV-001",
          booking_id: "booking-1",
          status: "issued",
          payment_status: "unpaid",
        },
      ] as Invoice[]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUnpaid();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchUnpaid();
    }
  }, [token]);

  const daysOverdue = (createdAt: string) => {
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

  if (isLoading) return <div className="p-6">Loading...</div>;

  const totalUnpaid = unpaidInvoices.length;
  const overdue30 = unpaidInvoices.filter(
    (inv) => daysOverdue(inv.created_at) > 30
  ).length;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Accounts Receivable</h1>
          <p className="text-gray-600">Track unpaid invoices and customer balances</p>
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
          <div className="text-3xl font-bold text-navy">{totalUnpaid}</div>
          <p className="text-sm text-gray-600">Total Unpaid</p>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-orange-600">{overdue30}</div>
          <p className="text-sm text-gray-600">Overdue 30+ Days</p>
        </Card>
        <Card className="p-4 bg-blue-50">
          <div className="text-sm text-gray-600 mb-1">Total Amount Due</div>
          <div className="text-2xl font-bold text-navy">₱0.00</div>
        </Card>
      </div>

      {/* Unpaid Invoices Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Booking ID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unpaidInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No unpaid invoices - Great job!
                </TableCell>
              </TableRow>
            ) : (
              unpaidInvoices.map((invoice) => {
                const days = daysOverdue(invoice.created_at);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {invoice.booking_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getAgeColor(days)}`}>
                        {days} days
                      </span>
                    </TableCell>
                    <TableCell>₱0.00</TableCell>
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
