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
import { Plus, Eye, Download, RefreshCw } from "lucide-react";
import { Invoice } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function Invoicing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch invoices");
      const data = await response.json();
      setInvoices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading invoices");
      // Set mock data if API fails
      setInvoices([
        {
          id: "INV-001",
          booking_id: "booking-1",
          status: "draft",
          payment_status: "unpaid",
        },
      ] as Invoice[]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchInvoices();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchInvoices();
    }
  }, [token]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      issued: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading && !isRefreshing) return <div className="p-6">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Invoicing</h1>
          <p className="text-gray-600">Create and manage sales invoices</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-fit">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Booking ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-sm">{invoice.booking_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-sm ${
                      invoice.payment_status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800"
                    }`}>
                      {invoice.payment_status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
