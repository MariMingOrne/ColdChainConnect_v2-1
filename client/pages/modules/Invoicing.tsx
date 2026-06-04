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
import { Plus, Eye, Download, RefreshCw, Calendar } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Invoice, Booking } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function Invoicing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "issued" | "paid">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "approved" | "unapproved">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");

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
      setInvoices([
        {
          id: "INV-001",
          booking_id: "booking-1",
          status: "draft",
          payment_status: "unpaid",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agent_id: "agent-1",
        },
      ] as Invoice[]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBookingData = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch {
      return null;
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

  useEffect(() => {
    const loadBookingData = async () => {
      const bookingMap: Record<string, Booking> = {};
      for (const invoice of invoices) {
        if (!bookings[invoice.booking_id]) {
          const booking = await fetchBookingData(invoice.booking_id);
          if (booking) {
            bookingMap[invoice.booking_id] = booking;
          }
        }
      }
      if (Object.keys(bookingMap).length > 0) {
        setBookings((prev) => ({ ...prev, ...bookingMap }));
      }
    };
    if (invoices.length > 0) {
      loadBookingData();
    }
  }, [invoices]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      issued: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const isDateInRange = (dateStr: string): boolean => {
    if (dateRangeFilter === "all") return true;

    const invoiceDate = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const invoiceDateOnly = new Date(
      invoiceDate.getFullYear(),
      invoiceDate.getMonth(),
      invoiceDate.getDate()
    );

    if (dateRangeFilter === "today") {
      return invoiceDateOnly.getTime() === today.getTime();
    }

    if (dateRangeFilter === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return invoiceDateOnly >= weekStart && invoiceDateOnly <= weekEnd;
    }

    if (dateRangeFilter === "month") {
      return (
        invoiceDate.getFullYear() === now.getFullYear() &&
        invoiceDate.getMonth() === now.getMonth()
      );
    }

    if (dateRangeFilter === "custom") {
      if (!customDateStart || !customDateEnd) return true;
      const start = new Date(customDateStart);
      const end = new Date(customDateEnd);
      end.setHours(23, 59, 59, 999);
      return invoiceDate >= start && invoiceDate <= end;
    }

    return true;
  };

  if (isLoading && !isRefreshing) return <div className="p-6">Loading...</div>;

  const filtered = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.booking_id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
    if (paymentFilter !== "all" && invoice.payment_status !== paymentFilter) return false;

    // Check approval status based on booking
    if (approvalFilter !== "all") {
      const booking = bookings[invoice.booking_id];
      const isApproved = booking?.status === "approved";
      if (approvalFilter === "approved" && !isApproved) return false;
      if (approvalFilter === "unapproved" && isApproved) return false;
    }

    // Check date range filter
    if (!isDateInRange(invoice.created_at)) return false;

    return true;
  });

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

      {/* Search and Filters */}
      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by invoice ID or booking ID…"
        filters={[
          {
            name: "statusFilter",
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as any),
            options: [
              { label: "All Status", value: "all" },
              { label: "Draft", value: "draft" },
              { label: "Issued", value: "issued" },
              { label: "Paid", value: "paid" },
            ],
          },
          {
            name: "paymentFilter",
            value: paymentFilter,
            onChange: (value) => setPaymentFilter(value as any),
            options: [
              { label: "All Payments", value: "all" },
              { label: "Paid", value: "paid" },
              { label: "Unpaid", value: "unpaid" },
            ],
          },
          {
            name: "approvalFilter",
            value: approvalFilter,
            onChange: (value) => setApprovalFilter(value as any),
            options: [
              { label: "All Orders", value: "all" },
              { label: "Approved", value: "approved" },
              { label: "Unapproved", value: "unapproved" },
            ],
          },
          {
            name: "dateRangeFilter",
            value: dateRangeFilter,
            onChange: (value) => setDateRangeFilter(value as any),
            options: [
              { label: "All Dates", value: "all" },
              { label: "This Day", value: "today" },
              { label: "This Week", value: "week" },
              { label: "This Month", value: "month" },
              { label: "Custom", value: "custom" },
            ],
          },
        ]}
      />

      {/* Custom Date Picker */}
      {dateRangeFilter === "custom" && (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
              <Calendar size={16} className="text-muted" />
              <input
                type="date"
                value={customDateStart}
                onChange={(e) => setCustomDateStart(e.target.value)}
                className="flex-1 bg-transparent border-none text-white py-2 outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
              <Calendar size={16} className="text-muted" />
              <input
                type="date"
                value={customDateEnd}
                onChange={(e) => setCustomDateEnd(e.target.value)}
                className="flex-1 bg-transparent border-none text-white py-2 outline-none text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Booking ID</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {invoices.length === 0 ? "No invoices found" : "No invoices match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => {
                const booking = bookings[invoice.booking_id];
                const isApproved = booking?.status === "approved";
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">{invoice.booking_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${
                        isApproved
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {isApproved ? "Approved" : "Pending"}
                      </span>
                    </TableCell>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
