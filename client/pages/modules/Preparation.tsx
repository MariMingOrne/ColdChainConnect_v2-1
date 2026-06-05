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
import { Check, RefreshCw, Calendar } from "lucide-react";
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

  const isOrderPrepared = (orderId: string): boolean => {
    const orderPallets = pallets.filter((p) => p.order_id === orderId);
    return orderPallets.length > 0 && orderPallets.every((p) => p.status === "prepared" || p.status === "approved" || p.status === "shipped");
  };

  const handleMarkPrepared = async (orderId: string) => {
    try {
      const orderPallets = pallets.filter((p) => p.order_id === orderId && p.status === "draft");
      for (const pallet of orderPallets) {
        await fetch(`/api/pallets/${pallet.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "prepared" }),
        });
      }
      handleRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark pallets as prepared");
    }
  };

  const handleUndoPrepared = async (orderId: string) => {
    try {
      const orderPallets = pallets.filter((p) => p.order_id === orderId && p.status === "prepared");
      for (const pallet of orderPallets) {
        await fetch(`/api/pallets/${pallet.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "draft" }),
        });
      }
      handleRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo prepared status");
    }
  };

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
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  {orders.length === 0 ? "No orders found" : "No orders match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const customer = customers.find((c) => c.id === order.customer_id);
                const itemCount = order.booking_items?.length ?? 0;
                const orderPallets = pallets.filter((p) => p.order_id === order.id);
                const approvedPalletCount = orderPallets.filter((p) => p.status === "approved").length;
                const draftPalletCount = orderPallets.filter((p) => p.status === "draft").length;
                const isPrepared = isOrderPrepared(order.id);

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
                    <TableCell className="text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {!isPrepared && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowPaletModal(true);
                              }}
                              disabled={isPrepared}
                            >
                              Prepare
                            </Button>
                            {draftPalletCount > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkPrepared(order.id)}
                                className="bg-green-600 text-white hover:bg-green-700"
                              >
                                Prepared
                              </Button>
                            )}
                          </>
                        )}
                        {isPrepared && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUndoPrepared(order.id)}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            Undo
                          </Button>
                        )}
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
          isPrepared={isOrderPrepared(selectedOrder.id)}
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
  isPrepared?: boolean;
}

type PalletDraft = {
  items: Array<{
    product_id: string;
    product_name?: string;
    product_sku?: string;
    qty_units: number;
    batch_item_id: string;
    batch_name: string;
    expiry_note?: string;
  }>;
  totalQty: number;
};

function CreatePalletModal({
  order,
  batches,
  onClose,
  onCreated,
  token,
  isPrepared = false,
}: CreatePalletModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [suggestedPallets, setSuggestedPallets] = useState<PalletDraft[]>([]);
  const [manualPallets, setManualPallets] = useState<PalletDraft[]>([
    { items: [], totalQty: 0 }
  ]);
  const [error, setError] = useState<string | null>(null);

  const PALLET_CAPACITY = 50;

  useEffect(() => {
    // Auto-find matching items from inventory sorted by expiry date, splitting into multiple pallets
    const orderItems = order.booking_items || [];
    const pallets: PalletDraft[] = [];
    let currentPallet: PalletDraft = { items: [], totalQty: 0 };

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

      // Fill pallets with matching items, creating new pallets when capacity is exceeded
      for (const { batchId, batchName, item } of matchingItems) {
        if (remainingQty <= 0) break;

        const qtyToTake = Math.min(remainingQty, item.qty_units);
        let qtyAdded = 0;

        while (qtyAdded < qtyToTake) {
          const spaceInCurrentPallet = PALLET_CAPACITY - currentPallet.totalQty;
          const qtyForThisPallet = Math.min(qtyToTake - qtyAdded, spaceInCurrentPallet);

          currentPallet.items.push({
            product_id: item.product_id,
            product_name: orderItem.product?.name,
            product_sku: orderItem.product?.sku,
            qty_units: qtyForThisPallet,
            batch_item_id: item.id,
            batch_name: batchName,
            expiry_note: item.created_at,
          });

          currentPallet.totalQty += qtyForThisPallet;
          qtyAdded += qtyForThisPallet;

          if (currentPallet.totalQty >= PALLET_CAPACITY) {
            pallets.push(currentPallet);
            currentPallet = { items: [], totalQty: 0 };
          }
        }

        remainingQty -= qtyToTake;
      }

      if (remainingQty > 0) {
        const productName = orderItem.product?.name || orderItem.product_id;
        setError(`Insufficient inventory for ${productName}: need ${remainingQty} more units`);
      }
    }

    // Add the last pallet if it has items
    if (currentPallet.items.length > 0) {
      pallets.push(currentPallet);
    }

    setSuggestedPallets(pallets.length > 0 ? pallets : [{ items: [], totalQty: 0 }]);
  }, [order, batches]);

  const handleCreatePallet = async () => {
    const palletsToCreate = mode === "automatic" ? suggestedPallets : manualPallets;
    const validPallets = palletsToCreate.filter((p) => p.items.length > 0);

    if (validPallets.length === 0) {
      setError("Please select items for at least one pallet");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      // Create pallets in sequence
      for (const pallet of validPallets) {
        const response = await fetch("/api/pallets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_id: order.id,
            items: pallet.items.map((item) => ({
              product_id: item.product_id,
              qty_units: item.qty_units,
              batch_item_id: item.batch_item_id,
            })),
          }),
        });

        if (!response.ok) throw new Error("Failed to create pallet");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pallets");
    } finally {
      setIsCreating(false);
    }
  };

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

  const handleManualSelect = (
    palletIdx: number,
    productId: string,
    batchItemId: string,
    qty: number
  ) => {
    setManualPallets((prev) => {
      const updated = [...prev];
      const pallet = updated[palletIdx];
      const existingIdx = pallet.items.findIndex(
        (s) => s.product_id === productId && s.batch_item_id === batchItemId
      );

      if (qty === 0) {
        if (existingIdx >= 0) {
          pallet.totalQty -= pallet.items[existingIdx].qty_units;
          pallet.items.splice(existingIdx, 1);
        }
      } else {
        if (existingIdx >= 0) {
          const oldQty = pallet.items[existingIdx].qty_units;
          pallet.items[existingIdx].qty_units = qty;
          pallet.totalQty += qty - oldQty;
        } else {
          const batchItem = batches
            .flatMap((b) => b.items || [])
            .find((i) => i.id === batchItemId);

          if (!batchItem) return prev;

          const batchName = batches.find(
            (b) => b.items?.some((i) => i.id === batchItemId)
          )?.name || "";

          const orderItem = order.booking_items?.find(
            (oi) => oi.product_id === productId
          );

          pallet.items.push({
            product_id: productId,
            product_name: orderItem?.product?.name,
            product_sku: orderItem?.product?.sku,
            qty_units: qty,
            batch_item_id: batchItemId,
            batch_name: batchName,
            expiry_note: batchItem.created_at,
          });
          pallet.totalQty += qty;
        }
      }

      // Check if pallet exceeds capacity and split if needed
      if (pallet.totalQty > PALLET_CAPACITY) {
        setError(`Pallet would exceed ${PALLET_CAPACITY} unit capacity. Use another pallet.`);
        // Revert the change
        return prev;
      }

      setError(null);
      return updated;
    });
  };

  const addNewPallet = () => {
    setManualPallets((prev) => [...prev, { items: [], totalQty: 0 }]);
  };

  const removePallet = (index: number) => {
    setManualPallets((prev) => prev.filter((_, i) => i !== index));
  };

  const duplicatePallet = (index: number) => {
    setManualPallets((prev) => {
      const palletToDuplicate = prev[index];
      const newPallet: PalletDraft = {
        items: palletToDuplicate.items.map((item) => ({ ...item })),
        totalQty: palletToDuplicate.totalQty,
      };
      return [...prev, newPallet];
    });
  };

  const getTotalQuantityByProduct = () => {
    const totals: { [key: string]: { name: string; qty: number } } = {};
    manualPallets.forEach((pallet) => {
      pallet.items.forEach((item) => {
        const key = item.product_id;
        if (!totals[key]) {
          totals[key] = { name: item.product_name || item.product_id, qty: 0 };
        }
        totals[key].qty += item.qty_units;
      });
    });
    return totals;
  };

  const getProductQuantityStatus = (productId: string) => {
    const orderItem = order.booking_items?.find((item) => item.product_id === productId);
    const totalSelections = getTotalQuantityByProduct();
    const selected = totalSelections[productId]?.qty || 0;

    // Item exists in order
    if (orderItem) {
      const needed = orderItem.qty_ordered;
      const isOver = selected > needed;
      const difference = Math.abs(selected - needed);
      return { needed, selected, isOver, difference, isNotNeeded: false };
    }

    // Item does NOT exist in order but is in pallets
    return { needed: 0, selected, isOver: false, difference: 0, isNotNeeded: selected > 0 };
  };

  const getUnneededItems = () => {
    const totalSelections = getTotalQuantityByProduct();
    const neededProductIds = new Set(
      (order.booking_items || []).map((item) => item.product_id)
    );

    return Object.entries(totalSelections)
      .filter(([productId]) => !neededProductIds.has(productId))
      .map(([productId, { name, qty }]) => ({ productId, name, qty }));
  };

  if (isPrepared) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl border border-border max-w-md w-full">
          <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
            <h2 className="font-rajdhani text-lg font-bold text-white">Order Prepared</h2>
            <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">
              ×
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700">
              This order has already been marked as prepared. You cannot create additional pallets for this order.
            </p>
            <p className="text-sm text-gray-600">
              Click the "Undo" button in the orders table to revert the prepared status if you need to make changes.
            </p>
          </div>
          <div className="bg-off-white px-6 py-4 flex justify-end border-t border-border rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="space-y-3">
              {suggestedPallets.length > 0 && suggestedPallets[0].items.length > 0 ? (
                suggestedPallets.map((pallet, palletIdx) => (
                  <div key={palletIdx} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-800 mb-2">
                      Pallet {palletIdx + 1} (Auto-matched by expiry):
                    </p>
                    <div className="space-y-1">
                      {pallet.items.map((item, idx) => (
                        <p key={idx} className="text-xs text-blue-700">
                          • {item.product_name || item.product_id}: {item.qty_units} units (from {item.batch_name})
                        </p>
                      ))}
                      <p className="text-xs font-semibold text-blue-800 mt-2 pt-2 border-t border-blue-200">
                        Total: {pallet.totalQty}/{PALLET_CAPACITY} items
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-blue-600">Finding best matches from inventory…</p>
              )}
            </div>
          )}

          {/* Manual Mode */}
          {mode === "manual" && (
            <div className="space-y-4">
              {manualPallets.map((pallet, palletIdx) => (
                <div key={palletIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-navy">Pallet {palletIdx + 1}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => duplicatePallet(palletIdx)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        title="Duplicate this pallet"
                      >
                        Duplicate
                      </button>
                      {manualPallets.length > 1 && (
                        <button
                          onClick={() => removePallet(palletIdx)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {order.booking_items && order.booking_items.length > 0 ? (
                    <div className="space-y-3">
                      {order.booking_items.map((orderItem) => {
                        const availableItems = getAvailableItems(orderItem.product_id);
                        const palletUsed = pallet.items
                          .filter((i) => i.product_id === orderItem.product_id)
                          .reduce((sum, i) => sum + i.qty_units, 0);

                        return (
                          <div
                            key={orderItem.id}
                            className="p-2 bg-white rounded border border-gray-100"
                          >
                            <p className="text-xs font-semibold text-navy mb-2">
                              {orderItem.product?.name || orderItem.product_id}{" "}
                              {orderItem.product?.sku && (
                                <span className="text-gray-500">({orderItem.product.sku})</span>
                              )}
                            </p>
                            {availableItems.length > 0 ? (
                              <div className="space-y-1.5">
                                {availableItems.map((batch) => {
                                  const selected = pallet.items.find(
                                    (s) =>
                                      s.product_id === orderItem.product_id &&
                                      s.batch_item_id === batch.batch_item_id
                                  );
                                  return (
                                    <div key={batch.batch_item_id} className="flex items-center gap-2">
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-700">
                                          {batch.batch_name}
                                          <span className="text-gray-500">
                                            {" "}
                                            ({batch.qty_available} available)
                                          </span>
                                        </p>
                                      </div>
                                      <input
                                        type="number"
                                        min="0"
                                        max={Math.min(
                                          batch.qty_available,
                                          PALLET_CAPACITY - pallet.totalQty +
                                            (selected?.qty_units || 0)
                                        )}
                                        value={selected?.qty_units || 0}
                                        onChange={(e) =>
                                          handleManualSelect(
                                            palletIdx,
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
                              <p className="text-xs text-orange-600">
                                No inventory available for this product
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No items to select</p>
                  )}

                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-navy">
                      Total: {pallet.totalQty}/{PALLET_CAPACITY} items
                      {pallet.totalQty === PALLET_CAPACITY && (
                        <span className="text-orange-600 ml-1">(at capacity)</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}

              <button
                onClick={addNewPallet}
                className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-semibold text-navy hover:bg-white transition-colors"
              >
                + Add Another Pallet
              </button>

              {/* Total Quantities Summary */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                <p className="text-xs font-semibold text-blue-800">Total Quantities Across All Pallets:</p>
                {Object.entries(getTotalQuantityByProduct()).length > 0 ? (
                  <div className="space-y-2">
                    {/* Needed items from order */}
                    {(order.booking_items || []).map((orderItem) => {
                      const status = getProductQuantityStatus(orderItem.product_id);
                      return (
                        <div key={orderItem.id} className="flex items-center justify-between">
                          <p className="text-xs text-blue-700">
                            {orderItem.product?.name || orderItem.product_id}:{" "}
                            <span className="font-semibold">{status.selected} units</span>
                            <span className="text-gray-500"> (need {status.needed})</span>
                          </p>
                          {status.isOver && (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                              +{status.difference} over
                            </span>
                          )}
                          {!status.isOver && status.selected > 0 && status.selected === status.needed && (
                            <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                              ✓ Complete
                            </span>
                          )}
                          {!status.isOver && status.selected > 0 && status.selected < status.needed && (
                            <span className="text-xs font-semibold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                              -{status.difference} needed
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Items not needed in order */}
                    {getUnneededItems().length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs font-semibold text-red-700 mb-1">⚠ Items Not Needed:</p>
                        {getUnneededItems().map((item) => (
                          <p key={item.productId} className="text-xs text-red-600">
                            • {item.name}: <span className="font-semibold">{item.qty} units</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-blue-600">No items selected yet</p>
                )}
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
            disabled={
              isCreating ||
              (mode === "automatic" ? suggestedPallets.every((p) => p.items.length === 0) : manualPallets.every((p) => p.items.length === 0))
            }
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {isCreating
              ? "Creating…"
              : mode === "automatic"
              ? `Create ${suggestedPallets.filter((p) => p.items.length > 0).length} Pallet(s)`
              : `Create ${manualPallets.filter((p) => p.items.length > 0).length} Pallet(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
