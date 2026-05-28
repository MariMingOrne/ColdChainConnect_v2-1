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
import { Eye, RefreshCw } from "lucide-react";
import { Booking } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function BookingSummary() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading bookings");
      // Set mock data if API fails
      setBookings([
        {
          id: "1",
          customer_id: "cust-1",
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ] as Booking[]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBookings();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchBookings();
    }
  }, [token]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      prep: "bg-purple-100 text-purple-800",
      ready: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Order Summary</h1>
          <p className="text-gray-600">View and manage customer bookings</p>
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

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-sm">{booking.id.slice(0, 8)}</TableCell>
                  <TableCell>{booking.customer_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(booking.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
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
