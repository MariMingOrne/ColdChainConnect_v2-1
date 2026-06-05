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
import { Plus, Eye, Check, RefreshCw, Calendar } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Booking, Customer, InventoryBatch, Pallet } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function Preparation() {
  const [orders, setOrders] = useState<Booking[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "prep" | "ready">("approved");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "week" | "month" | "custom">("today");
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Booking | null>(null);
  const [showPaletModal, setShowPaletModal] = useState(false);

  const fetchAll = async () => {
    try {
      const [oRes, pRes, bRes, cRes] = await Promise.all([
        fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/pallets", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/inventory-batches", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (oRes.ok) setOrders(await oRes.json());
      if (pRes.ok) setPallets(await pRes.json());
      if (bRes.ok) setBatches(await bRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
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

  useEffect(() => {
    if (token) {
      fetchAll();
    }
  }, [token]);

  const isDateInRange = (dateStr: string): boolean => {
    if (dateRangeFilter === "all") return true;

    const orderDate = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const orderDateOnly = new Date(
      orderDate.getFullYear(),
      orderDate.getMonth(),
      orderDate.getDate()
    );

    if (dateRangeFilter === "today") {
      return orderDateOnly.getTime() === today.getTime();
    }

    if (dateRangeFilter === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return orderDateOnly >= weekStart && orderDateOnly <= weekEnd;
    }

    if (dateRangeFilter === "month") {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth()
      );
    }

    if (dateRangeFilter === "custom") {
      if (!customDateStart || !customDateEnd) return true;
      const start = new Date(customDateStart);
      const end = new Date(customDateEnd);
      end.setHours(23, 59, 59, 999);
      return orderDate >= start && orderDate <= end;
    }

    return true;
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  const filtered = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (!isDateInRange(order.created_at)) return false;

    return true;
  });

  const ordersReadyForPrep = filtered.length;
  const pendingPalletItems = orders.reduce((sum, order) => {
    const orderPallets = pallets.filter((p) => p.order_id === order.id && p.status === "draft");
    return (
      sum +
      orderPallets.reduce((pSum, p) => pSum + (p.items?.length ?? 0), 0)
    );
  }, 0);
  const palletsCreatedToday = pallets.filter((p) => {
    const today = new Date();
    const pDate = new Date(p.created_at);
    return (
      pDate.getFullYear() === today.getFullYear() &&
      pDate.getMonth() === today.getMonth() &&
      pDate.getDate() === today.getDate()
    );
  }).length;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Preparation</h1>
          <p className="text-gray-600">Prepare pallets for customer orders</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600 font-semibold">Orders Ready</p>
          <p className="text-2xl font-bold text-blue-800">{ordersReadyForPrep}</p>
        </Card>
        <Card className="p-4 bg-orange-50 border-orange-200">
          <p className="text-xs text-orange-600 font-semibold">Items Pending</p>
          <p className="text-2xl font-bold text-orange-800">{pendingPalletItems}</p>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-xs text-green-600 font-semibold">Pallets Today</p>
          <p className="text-2xl font-bold text-green-800">{palletsCreatedToday}</p>
        </Card>
      </div>

      {/* Filters */}
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

      {/* Orders Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {orders.length === 0 ? "No orders found" : "No orders match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const customer = customers.find((c) => c.id === order.customer_id);
                const itemCount = order.booking_items?.length ?? 0;
                const orderPallets = pallets.filter((p) => p.order_id === order.id);
                const approvedPalletCount = orderPallets.filter((p) => p.status === "approved").length;

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-semibold text-accent-2">
                      {order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold text-navy">{customer?.store_name || "Unknown"}</span>
                        {customer?.location && (
                          <span className="text-xs text-muted">{customer.location}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-1">
                        {order.booking_items && order.booking_items.length > 0 ? (
                          <>
                            {order.booking_items.map((item) => (
                              <div key={item.id} className="text-xs">
                                <span className="font-semibold text-navy">{item.product?.name || item.product_id}</span>
                                <span className="text-muted"> × {item.qty_ordered}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <span className="font-semibold text-muted">No items</span>
                        )}
                      </div>
                      {approvedPalletCount > 0 && (
                        <span className="text-xs text-green-600 block mt-1">
                          {approvedPalletCount} pallet(s) ready
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${
                        order.status === "approved"
                          ? "bg-blue-100 text-blue-800"
                          : order.status === "ready"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowPaletModal(true);
                          }}
                        >
                          <Plus className="w-4 h-4" title="Create Pallet" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" title="View Details" />
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

      {/* Create Pallet Modal */}
      {showPaletModal && selectedOrder && (
        <CreatePalletModal
          order={selectedOrder}
          batches={batches}
          onClose={() => {
            setShowPaletModal(false);
            setSelectedOrder(null);
          }}
          onCreated={() => {
            handleRefresh();
            setShowPaletModal(false);
            setSelectedOrder(null);
          }}
          token={token}
        />
      )}
    </div>
  );
}

interface CreatePalletModalProps {
  order: Booking;
  batches: InventoryBatch[];
  onClose: () => void;
  onCreated: () => void;
  token: string;
}

function CreatePalletModal({
  order,
  batches,
  onClose,
  onCreated,
  token,
}: CreatePalletModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [suggestedItems, setSuggestedItems] = useState<Array<{
    product_id: string;
    product_name?: string;
    qty_units: number;
    batch_item_id: string;
    batch_name: string;
    expiry_note?: string;
  }>>([]);
  const [manualSelections, setManualSelections] = useState<Array<{
    product_id: string;
    batch_item_id: string;
    qty_units: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const PALLET_CAPACITY = 50;

  useEffect(() => {
    // Auto-find matching items from inventory sorted by expiry date
    const orderItems = order.booking_items || [];
    const suggested: Array<{
      product_id: string;
      product_name?: string;
      qty_units: number;
      batch_item_id: string;
      batch_name: string;
      expiry_note?: string;
    }> = [];
    let totalItems = 0;

    for (const orderItem of orderItems) {
      const neededQty = orderItem.qty_ordered;
      let remainingQty = neededQty;

      // Collect all matching inventory items and sort by expiry (nearest first)
      const matchingItems = batches
        .flatMap((batch) =>
          (batch.items || [])
            .filter((item) => item.product_id === orderItem.product_id)
            .map((item) => ({
              batchId: batch.id,
              batchName: batch.name,
              item,
              expiryNote: batch.items?.find(i => i.id === item.id)?.created_at || "",
            }))
        )
        .sort((a, b) => {
          // Sort by expiry date (closer dates first - FIFO)
          const dateA = new Date(a.expiryNote).getTime();
          const dateB = new Date(b.expiryNote).getTime();
          return dateA - dateB;
        });

      // Fill pallet with matching items up to capacity and order requirements
      for (const { batchId, batchName, item } of matchingItems) {
        if (remainingQty <= 0 || totalItems >= PALLET_CAPACITY) break;

        const qtyToTake = Math.min(remainingQty, item.qty_units, PALLET_CAPACITY - totalItems);

        suggested.push({
          product_id: item.product_id,
          product_name: orderItem.product?.name,
          qty_units: qtyToTake,
          batch_item_id: item.id,
          batch_name: batchName,
          expiry_note: item.created_at,
        });

        remainingQty -= qtyToTake;
        totalItems += qtyToTake;
      }

      if (remainingQty > 0) {
        const productName = orderItem.product?.name || orderItem.product_id;
        setError(`Insufficient inventory for ${productName}: need ${remainingQty} more units`);
      }
    }

    setSuggestedItems(suggested);
  }, [order, batches]);

  const handleCreatePallet = async () => {
    const itemsToSubmit = mode === "automatic" ? suggestedItems : manualSelections;

    if (itemsToSubmit.length === 0) {
      setError("Please select items for the pallet");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/pallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: order.id,
          items: itemsToSubmit.map((item) => ({
            product_id: item.product_id,
            qty_units: item.qty_units,
            batch_item_id: item.batch_item_id,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to create pallet");

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pallet");
    } finally {
      setIsCreating(false);
    }
  };

  const totalQtyForMode = (mode === "automatic" ? suggestedItems : manualSelections).reduce(
    (sum, item) => sum + item.qty_units,
    0
  );

  const getAvailableItems = (productId: string) => {
    return batches
      .flatMap((batch) =>
        (batch.items || [])
          .filter((item) => item.product_id === productId)
          .map((item) => ({
            batch_item_id: item.id,
            batch_name: batch.name,
            qty_available: item.qty_units,
            item,
          }))
      )
      .sort((a, b) => {
        const dateA = new Date(a.item.created_at).getTime();
        const dateB = new Date(b.item.created_at).getTime();
        return dateA - dateB;
      });
  };

  const handleManualSelect = (productId: string, batchItemId: string, qty: number) => {
    setManualSelections((prev) => {
      const existing = prev.findIndex(
        (s) => s.product_id === productId && s.batch_item_id === batchItemId
      );

      if (qty === 0) {
        if (existing >= 0) prev.splice(existing, 1);
        return [...prev];
      }

      if (existing >= 0) {
        prev[existing].qty_units = qty;
        return [...prev];
      }

      return [...prev, { product_id: productId, batch_item_id: batchItemId, qty_units: qty }];
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Create Pallet</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Order ID</label>
            <div className="px-3 py-2 bg-off-white rounded-lg text-sm font-mono text-navy">
              {order.id.slice(0, 8)}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-navy mb-2">Products Needed:</p>
            <div className="space-y-1">
              {order.booking_items && order.booking_items.length > 0 ? (
                order.booking_items.map((item) => (
                  <p key={item.id} className="text-xs text-gray-700">
                    • {item.product?.name || item.product_id} <span className="text-gray-500">({item.qty_ordered} units)</span>
                  </p>
                ))
              ) : (
                <p className="text-xs text-gray-600">No items in order</p>
              )}
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setMode("automatic")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                mode === "automatic"
                  ? "border-accent-2 text-accent-2"
                  : "border-transparent text-gray-600 hover:text-navy"
              }`}
            >
              Automatic (by Expiry)
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                mode === "manual"
                  ? "border-accent-2 text-accent-2"
                  : "border-transparent text-gray-600 hover:text-navy"
              }`}
            >
              Manual Selection
            </button>
          </div>

          {error && (
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-700">{error}</p>
            </div>
          )}

          {/* Automatic Mode */}
          {mode === "automatic" && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-800 mb-2">Suggested Pallet (Auto-matched by expiry):</p>
              {suggestedItems.length > 0 ? (
                <div className="space-y-1">
                  {suggestedItems.map((item, idx) => (
                    <p key={idx} className="text-xs text-blue-700">
                      • {item.product_name || item.product_id}: {item.qty_units} units (from {item.batch_name})
                    </p>
                  ))}
                  <p className="text-xs font-semibold text-blue-800 mt-2 pt-2 border-t border-blue-200">
                    Total: {totalQtyForMode}/{PALLET_CAPACITY} items
                  </p>
                </div>
              ) : (
                <p className="text-xs text-blue-600">Finding best matches from inventory…</p>
              )}
            </div>
          )}

          {/* Manual Mode */}
          {mode === "manual" && (
            <div className="space-y-4">
              {order.booking_items && order.booking_items.length > 0 ? (
                order.booking_items.map((orderItem) => {
                  const availableItems = getAvailableItems(orderItem.product_id);
                  return (
                    <div key={orderItem.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-semibold text-navy mb-2">
                        {orderItem.product?.name || orderItem.product_id} <span className="text-gray-500">(need {orderItem.qty_ordered} units)</span>
                      </p>
                      {availableItems.length > 0 ? (
                        <div className="space-y-2">
                          {availableItems.map((batch) => {
                            const selected = manualSelections.find(
                              (s) => s.product_id === orderItem.product_id && s.batch_item_id === batch.batch_item_id
                            );
                            return (
                              <div key={batch.batch_item_id} className="flex items-center gap-2">
                                <div className="flex-1">
                                  <p className="text-xs text-gray-700">
                                    {batch.batch_name}
                                    <span className="text-gray-500"> ({batch.qty_available} available)</span>
                                  </p>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max={batch.qty_available}
                                  value={selected?.qty_units || 0}
                                  onChange={(e) =>
                                    handleManualSelect(
                                      orderItem.product_id,
                                      batch.batch_item_id,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 px-2 py-1 border border-border rounded text-xs text-center"
                                  placeholder="qty"
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-orange-600">No inventory available for this product</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-600">No items to select</p>
              )}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-navy">
                  Total: {totalQtyForMode}/{PALLET_CAPACITY} items
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePallet}
            disabled={isCreating || suggestedItems.length === 0}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {isCreating ? "Creating…" : "Create Pallet"}
          </button>
        </div>
      </div>
    </div>
  );
}
