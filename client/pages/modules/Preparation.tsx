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
                      <span className="font-semibold">{itemCount} items</span>
                      {approvedPalletCount > 0 && (
                        <span className="text-xs text-green-600 block">
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

interface AllocationItem {
  product_id: string;
  qty_units: number;
  batch_item_id: string;
  batch_name: string;
  batch_id: string;
  expiry_date: string;
}

interface BatchSourceGroup {
  batch_name: string;
  batch_id: string;
  items: Array<{
    product_id: string;
    qty_units: number;
    expiry_date: string;
  }>;
  total_qty: number;
}

interface ExpiryGroup {
  expiry_date: string;
  batches: Array<{
    batch_id: string;
    batch_name: string;
    product_id: string;
    qty_units: number;
  }>;
  total_qty: number;
}

function CreatePalletModal({
  order,
  batches,
  onClose,
  onCreated,
  token,
}: CreatePalletModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [allocationItems, setAllocationItems] = useState<AllocationItem[]>([]);
  const [batchSources, setBatchSources] = useState<BatchSourceGroup[]>([]);
  const [expiryGroups, setExpiryGroups] = useState<ExpiryGroup[]>([]);
  const [insufficiencies, setInsufficiencies] = useState<Array<{
    product_id: string;
    ordered: number;
    allocated: number;
    missing: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const PALLET_CAPACITY = 50;

  useEffect(() => {
    allocateItemsToPallet();
  }, [order, batches]);

  const allocateItemsToPallet = () => {
    const orderItems = order.booking_items || [];
    const allocated: AllocationItem[] = [];
    const insufficiencies: typeof insufficiencies = [];
    let totalItems = 0;

    for (const orderItem of orderItems) {
      const neededQty = orderItem.qty_ordered;
      let remainingQty = neededQty;

      const matchingInventoryItems = batches
        .flatMap((batch) =>
          (batch.items || []).map((item) => ({
            batch_id: batch.id,
            batch_name: batch.name,
            inventory_item: item,
            expiry_date: item.created_at,
          }))
        )
        .filter((item) => item.inventory_item.product_id === orderItem.product_id)
        .sort((a, b) => {
          const dateA = new Date(a.expiry_date).getTime();
          const dateB = new Date(b.expiry_date).getTime();
          return dateA - dateB;
        });

      for (const source of matchingInventoryItems) {
        if (remainingQty <= 0 || totalItems >= PALLET_CAPACITY) break;

        const qtyToTake = Math.min(
          remainingQty,
          source.inventory_item.qty_units,
          PALLET_CAPACITY - totalItems
        );

        allocated.push({
          product_id: source.inventory_item.product_id,
          qty_units: qtyToTake,
          batch_item_id: source.inventory_item.id,
          batch_name: source.batch_name,
          batch_id: source.batch_id,
          expiry_date: source.expiry_date,
        });

        remainingQty -= qtyToTake;
        totalItems += qtyToTake;
      }

      if (remainingQty > 0) {
        insufficiencies.push({
          product_id: orderItem.product_id,
          ordered: neededQty,
          allocated: neededQty - remainingQty,
          missing: remainingQty,
        });
      }
    }

    setAllocationItems(allocated);
    setInsufficiencies(insufficiencies);

    const batchGroups = groupByBatch(allocated);
    setBatchSources(batchGroups);

    const expiryGroups = groupByExpiry(allocated);
    setExpiryGroups(expiryGroups);

    if (insufficiencies.length > 0) {
      const errorMsg = insufficiencies
        .map((insuf) => `Product ${insuf.product_id}: need ${insuf.missing} more units`)
        .join("; ");
      setError(errorMsg);
    } else {
      setError(null);
    }
  };

  const groupByBatch = (items: AllocationItem[]): BatchSourceGroup[] => {
    const grouped = new Map<string, BatchSourceGroup>();

    for (const item of items) {
      const key = item.batch_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          batch_name: item.batch_name,
          batch_id: item.batch_id,
          items: [],
          total_qty: 0,
        });
      }

      const group = grouped.get(key)!;
      group.items.push({
        product_id: item.product_id,
        qty_units: item.qty_units,
        expiry_date: item.expiry_date,
      });
      group.total_qty += item.qty_units;
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.batch_name.localeCompare(b.batch_name)
    );
  };

  const groupByExpiry = (items: AllocationItem[]): ExpiryGroup[] => {
    const grouped = new Map<string, ExpiryGroup>();

    for (const item of items) {
      const key = item.expiry_date;
      if (!grouped.has(key)) {
        grouped.set(key, {
          expiry_date: key,
          batches: [],
          total_qty: 0,
        });
      }

      const group = grouped.get(key)!;
      group.batches.push({
        batch_id: item.batch_id,
        batch_name: item.batch_name,
        product_id: item.product_id,
        qty_units: item.qty_units,
      });
      group.total_qty += item.qty_units;
    }

    return Array.from(grouped.values()).sort((a, b) =>
      new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    );
  };

  const handleCreatePallet = async () => {
    if (allocationItems.length === 0) {
      setError("No matching inventory items found for this order");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/pallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: order.id,
          items: allocationItems.map((item) => ({
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

  const totalQty = allocationItems.reduce((sum, item) => sum + item.qty_units, 0);
  const allItemsAllocated = insufficiencies.length === 0;
  const singleExpiryDate = expiryGroups.length === 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border sticky top-0 rounded-t-2xl">
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

          {error && (
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-700 font-semibold mb-1">
                {allItemsAllocated ? "✓ Full allocation possible" : "⚠ Partial allocation"}
              </p>
              {!allItemsAllocated && (
                <p className="text-xs text-orange-700">{error}</p>
              )}
            </div>
          )}

          {/* Pallet Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-800 mb-3">Pallet Summary</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-blue-700">Capacity: {totalQty}/{PALLET_CAPACITY} items</span>
              <span className="text-xs font-semibold text-blue-800">
                {Math.round((totalQty / PALLET_CAPACITY) * 100)}% full
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-accent-2 h-2 rounded-full"
                style={{ width: `${Math.min((totalQty / PALLET_CAPACITY) * 100, 100)}%` }}
              ></div>
            </div>
            {singleExpiryDate && (
              <p className="text-xs text-blue-700 mt-2 font-semibold">
                ✓ All items expire on: {new Date(expiryGroups[0].expiry_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Expiry Date Groups */}
          {expiryGroups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-navy">Items by Expiration Date</p>
              {expiryGroups.map((group, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {new Date(group.expiry_date).toLocaleDateString()}
                    </span>
                    <span className="text-xs font-bold text-gray-900">{group.total_qty} units</span>
                  </div>
                  <div className="space-y-1">
                    {group.batches.map((batch, bIdx) => (
                      <div key={bIdx} className="text-xs text-gray-600 flex justify-between pl-2">
                        <span>
                          {batch.batch_name} - Product {batch.product_id}
                        </span>
                        <span className="font-semibold">{batch.qty_units} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Batch Source Groups */}
          {batchSources.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-navy">Items by Batch Source</p>
              {batchSources.map((source, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">{source.batch_name}</span>
                    <span className="text-xs font-bold text-gray-900">{source.total_qty} units</span>
                  </div>
                  <div className="space-y-1">
                    {source.items.map((item, iIdx) => (
                      <div key={iIdx} className="text-xs text-gray-600 flex justify-between pl-2">
                        <span>
                          Product {item.product_id}
                          {!singleExpiryDate && (
                            <span className="text-gray-500 ml-1">
                              (exp: {new Date(item.expiry_date).toLocaleDateString()})
                            </span>
                          )}
                        </span>
                        <span className="font-semibold">{item.qty_units} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Insufficient Items Warning */}
          {insufficiencies.length > 0 && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <p className="text-xs font-semibold text-yellow-800 mb-2">Partially Allocated</p>
              {insufficiencies.map((insuf, idx) => (
                <p key={idx} className="text-xs text-yellow-700">
                  Product {insuf.product_id}: {insuf.allocated}/{insuf.ordered} units
                  (missing {insuf.missing})
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border sticky bottom-0 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePallet}
            disabled={isCreating || allocationItems.length === 0}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {isCreating ? "Creating…" : "Create Pallet"}
          </button>
        </div>
      </div>
    </div>
  );
}
