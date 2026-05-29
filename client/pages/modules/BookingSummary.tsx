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
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Booking, Driver, Truck } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function BookingSummary() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "prep" | "ready">("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedTruck, setSelectedTruck] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

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

  const fetchDrivers = async () => {
    try {
      const response = await fetch("/api/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch drivers");
      const data = await response.json();
      setDrivers(data);
    } catch (err) {
      console.error("Failed to fetch drivers", err);
    }
  };

  const fetchTrucks = async () => {
    try {
      const response = await fetch("/api/trucks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch trucks");
      const data = await response.json();
      setTrucks(data);
    } catch (err) {
      console.error("Failed to fetch trucks", err);
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
      fetchDrivers();
      fetchTrucks();
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

  const openAssignModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setSelectedDriver(booking.driver_id || "");
    setSelectedTruck("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBooking(null);
    setSelectedDriver("");
    setSelectedTruck("");
  };

  const handleAssignDriver = async () => {
    if (!selectedBooking || !selectedDriver) {
      alert("Please select a driver");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ driver_id: selectedDriver }),
      });
      if (!response.ok) throw new Error("Failed to assign driver");
      setBookings((prev) =>
        prev.map((b) => (b.id === selectedBooking.id ? { ...b, driver_id: selectedDriver } : b))
      );
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign driver");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  const filtered = bookings.filter((booking) => {
    const matchesSearch =
      booking.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customer_id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && booking.status !== statusFilter) return false;
    return true;
  });

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

      {/* Search and Filters */}
      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by order ID or customer ID…"
        filters={[
          {
            name: "statusFilter",
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as any),
            options: [
              { label: "All Status", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Prep", value: "prep" },
              { label: "Ready", value: "ready" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  {bookings.length === 0 ? "No bookings found" : "No bookings match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((booking) => {
                const customer = booking.customer;
                const driver = booking.driver;
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-sm">{booking.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">
                      {customer ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-navy">{customer.store_name}</span>
                          {customer.contact_info && (
                            <span className="text-xs text-muted">{customer.contact_info}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">Unknown customer</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {driver ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-navy">{driver.user?.username || driver.id.slice(0, 8)}</span>
                          {driver.contact_info && (
                            <span className="text-xs text-muted">{driver.contact_info}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => openAssignModal(booking)}
                        className="px-3 py-1 text-sm bg-accent-2 text-white rounded hover:opacity-90 transition"
                      >
                        Assign Driver
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border max-w-lg w-full">
            <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
              <h2 className="font-rajdhani text-lg font-bold text-white">Assign Driver to Order</h2>
              <button onClick={closeModal} className="text-white hover:opacity-70 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Order ID</label>
                <div className="px-3 py-2 bg-off-white rounded-lg text-sm font-mono text-navy">
                  {selectedBooking.id.slice(0, 8)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Customer</label>
                <div className="flex flex-col px-3 py-2 bg-off-white rounded-lg text-sm text-navy">
                  <span className="font-semibold">{selectedBooking.customer?.store_name || "Unknown"}</span>
                  {selectedBooking.customer?.contact_info && (
                    <span className="text-xs text-muted">{selectedBooking.customer.contact_info}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Select Driver *</label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                >
                  <option value="">Choose a driver…</option>
                  {drivers
                    .filter((d) => d.is_active)
                    .map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.user?.username || driver.id.slice(0, 8)} {driver.contact_info && `— ${driver.contact_info}`}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Associated Truck (Optional)</label>
                <select
                  value={selectedTruck}
                  onChange={(e) => setSelectedTruck(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                >
                  <option value="">No truck assigned</option>
                  {trucks
                    .filter((t) => t.status === "available")
                    .map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.name} — {truck.district}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDriver}
                disabled={!selectedDriver || isSaving}
                className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? "Assigning…" : "Assign Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
