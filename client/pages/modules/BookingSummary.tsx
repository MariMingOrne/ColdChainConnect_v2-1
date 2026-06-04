import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, Plus } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Booking, Truck, Customer, Product } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function BookingSummary() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "prep" | "ready">("all");

  // Approve booking modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  // Add order modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [orderItems, setOrderItems] = useState<{ product_id: string; qty_ordered: number }[]>([
    { product_id: "", qty_ordered: 1 },
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchAll = async () => {
    try {
      const [bRes, tRes, cRes, pRes] = await Promise.all([
        fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/trucks", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bRes.ok) setBookings(await bRes.json());
      if (tRes.ok) setTrucks(await tRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (pRes.ok) setProducts(await pRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  };

  useEffect(() => { if (token) fetchAll(); }, [token]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      prep: "bg-purple-100 text-purple-800",
      ready: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // ── Add Order ──────────────────────────────────────────────
  const handleAddItem = () =>
    setOrderItems((prev) => [...prev, { product_id: "", qty_ordered: 1 }]);

  const handleRemoveItem = (idx: number) =>
    setOrderItems((prev) => prev.filter((_, i) => i !== idx));

  const handleItemChange = (idx: number, field: "product_id" | "qty_ordered", value: string | number) =>
    setOrderItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleCreateOrder = async () => {
    if (!newCustomerId) return alert("Please select a customer");
    if (orderItems.some((i) => !i.product_id)) return alert("Please select a product for every item");
    setIsCreating(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customer_id: newCustomerId, items: orderItems }),
      });
      if (!res.ok) throw new Error("Failed to create order");
      const created = await res.json();
      setBookings((prev) => [created, ...prev]);
      setShowAddModal(false);
      setNewCustomerId("");
      setOrderItems([{ product_id: "", qty_ordered: 1 }]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Approve Booking ───────────────────────────────────────────
  const openApproveModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setApproveSuccess(null);
    setShowApproveModal(true);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
    setSelectedBooking(null);
    setApproveSuccess(null);
  };

  const handleApproveBooking = async () => {
    if (!selectedBooking) return alert("No booking selected");
    setIsApproving(true);
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to approve booking");
      }
      const { booking: updated, invoice } = await res.json();
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
      setApproveSuccess(invoice ? `Invoice #${invoice.id.slice(0, 8)} created successfully.` : "Order approved and truck assigned.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve booking");
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  const filtered = bookings.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_id.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Order Summary</h1>
          <p className="text-gray-600">View and manage customer bookings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-accent-2 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={16} /> Add Order
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-off-white disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by order ID or customer ID…"
        filters={[{
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
        }]}
      />

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Assigned Truck</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {bookings.length === 0 ? "No orders found" : "No orders match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((booking) => {
                const customer = booking.customer;
                const assignedTruck = trucks.find((t) => t.id === (booking as any).driver_id);
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
                      {assignedTruck ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-navy">{assignedTruck.name}</span>
                          <span className="text-xs text-muted">{assignedTruck.district}</span>
                        </div>
                      ) : (
                        <span className="text-muted italic">Not assigned</span>
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
                      {booking.status === "pending" ? (
                        <button
                          onClick={() => openApproveModal(booking)}
                          className="px-3 py-1 text-sm bg-accent-2 text-white rounded hover:opacity-90 transition"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-xs text-muted">{booking.status}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Add Order Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
              <h2 className="font-rajdhani text-lg font-bold text-white">Add New Order</h2>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:opacity-70 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Customer *</label>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                >
                  <option value="">Choose a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.store_name} — {c.location}</option>
                  ))}
                </select>
              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-navy">Order Items *</label>
                  <button
                    onClick={handleAddItem}
                    className="text-xs text-accent-2 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, "product_id", e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (₱{p.price})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.qty_ordered}
                        onChange={(e) => handleItemChange(idx, "qty_ordered", parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                        placeholder="Qty"
                      />
                      {orderItems.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-400 hover:text-red-600 text-lg font-bold px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={isCreating}
                className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Booking Modal ── */}
      {showApproveModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border max-w-lg w-full">
            <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
              <h2 className="font-rajdhani text-lg font-bold text-white">Approve Order</h2>
              <button onClick={closeApproveModal} className="text-white hover:opacity-70 text-2xl">×</button>
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
                <div className="px-3 py-2 bg-off-white rounded-lg text-sm text-navy">
                  <span className="font-semibold">{selectedBooking.customer?.store_name || "Unknown"}</span>
                  {selectedBooking.customer?.contact_info && (
                    <span className="text-xs text-muted block">{selectedBooking.customer.contact_info}</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Location</label>
                <div className="px-3 py-2 bg-off-white rounded-lg text-sm text-navy">
                  {selectedBooking.customer?.location || "Unknown"}
                </div>
              </div>

              {approveSuccess ? (
                <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-semibold">
                  ✓ {approveSuccess}
                </div>
              ) : (
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  The truck will be automatically assigned based on the customer's location.
                </div>
              )}
            </div>

            <div className="bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
              <button
                onClick={closeApproveModal}
                className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
              >
                {approveSuccess ? "Close" : "Cancel"}
              </button>
              {!approveSuccess && (
                <button
                  onClick={handleApproveBooking}
                  disabled={isApproving}
                  className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isApproving ? "Approving…" : "Approve Order"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
