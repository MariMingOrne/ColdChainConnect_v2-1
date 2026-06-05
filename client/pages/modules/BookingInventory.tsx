import { useState, useEffect } from "react";
import { Trash2, RefreshCw, Eye, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pallet, Booking, Customer, Product } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function BookingInventory() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "approved" | "shipped">("all");
  const { token } = useAuth();

  const fetchAll = async () => {
    try {
      const [pRes, bRes, cRes, prRes] = await Promise.all([
        fetch("/api/pallets", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (pRes.ok) setPallets(await pRes.json());
      if (bRes.ok) setBookings(await bRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (prRes.ok) setProducts(await prRes.json());
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAll();
  }, [token]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchAll();
  };

  const handleDeletePallet = async (palletId: string) => {
    if (!confirm("Delete this pallet?")) return;
    setIsDeleting(palletId);
    try {
      const res = await fetch(`/api/pallets/${palletId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete pallet");
      await fetchAll();
      if (selectedPalletId === palletId) setSelectedPalletId(null);
    } catch (err) {
      alert("Failed to delete pallet");
    } finally {
      setIsDeleting(null);
    }
  };

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name || productId;

  const getCustomerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.store_name || customerId;

  const getCustomerLocation = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.location || "";

  const getBookingOrder = (orderId: string) =>
    bookings.find((b) => b.id === orderId);

  const currentPallet = pallets.find((p) => p.id === selectedPalletId);
  const currentOrder = currentPallet ? getBookingOrder(currentPallet.order_id) : null;

  const filtered = pallets.filter((pallet) => {
    if (statusFilter !== "all" && pallet.status !== statusFilter) return false;
    if (searchQuery) {
      const order = getBookingOrder(pallet.order_id);
      const customer = order ? customers.find((c) => c.id === order.customer_id) : null;
      const searchLower = searchQuery.toLowerCase();
      return (
        pallet.order_id.toLowerCase().includes(searchLower) ||
        pallet.id.toLowerCase().includes(searchLower) ||
        customer?.store_name.toLowerCase().includes(searchLower) ||
        customer?.location.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const stats = {
    total: pallets.length,
    draft: pallets.filter((p) => p.status === "draft").length,
    approved: pallets.filter((p) => p.status === "approved").length,
    shipped: pallets.filter((p) => p.status === "shipped").length,
  };

  if (isLoading) return <div className="p-6 text-gray-500">Loading pallets…</div>;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Pallets</h1>
          <p className="text-gray-600">Order fulfillment pallets from Preparation</p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted font-medium">TOTAL PALLETS</p>
          <p className="text-2xl font-bold text-navy mt-2">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted font-medium">DRAFT</p>
          <p className="text-2xl font-bold text-orange-500 mt-2">{stats.draft}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted font-medium">APPROVED</p>
          <p className="text-2xl font-bold text-green-500 mt-2">{stats.approved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted font-medium">SHIPPED</p>
          <p className="text-2xl font-bold text-blue-500 mt-2">{stats.shipped}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search by order, pallet, customer…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-accent-2"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="shipped">Shipped</option>
        </select>
      </div>

      {/* Pallets List or Detail View */}
      {!selectedPalletId ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
              <p>{pallets.length === 0 ? "No pallets created yet. Create pallets in the Preparation module." : "No pallets match your search."}</p>
            </Card>
          ) : (
            filtered.map((pallet) => {
              const order = getBookingOrder(pallet.order_id);
              const customer = order ? customers.find((c) => c.id === order.customer_id) : null;
              const statusColors: Record<string, string> = {
                draft: "bg-orange-50 text-orange-700 border-orange-200",
                approved: "bg-green-50 text-green-700 border-green-200",
                shipped: "bg-blue-50 text-blue-700 border-blue-200",
              };

              return (
                <Card
                  key={pallet.id}
                  className="p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedPalletId(pallet.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-navy">Pallet {pallet.id.substring(0, 8)}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${statusColors[pallet.status] || "bg-gray-50"}`}>
                        {pallet.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      Order: <span className="font-medium">{pallet.order_id.substring(0, 8)}</span>
                    </p>
                    {customer && (
                      <p className="text-sm text-muted">
                        Customer: <span className="font-medium">{customer.store_name}</span> · {customer.location}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {pallet.items?.length || 0} item{(pallet.items?.length || 0) !== 1 ? "s" : ""} · {pallet.items?.reduce((sum, item) => sum + item.qty_units, 0) || 0} units
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPalletId(pallet.id);
                      }}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePallet(pallet.id);
                      }}
                      disabled={isDeleting === pallet.id}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                    >
                      {isDeleting === pallet.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedPalletId(null)}
            className="text-sm font-medium text-accent-2 hover:text-accent-1 flex items-center gap-1"
          >
            ← Back to list
          </button>

          {currentPallet && currentOrder && (
            <>
              <Card className="p-6 bg-gradient-to-r from-navy/5 to-accent-2/5 border-navy/10">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted font-medium">PALLET ID</p>
                    <p className="text-lg font-bold text-navy mt-1">{currentPallet.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium">ORDER ID</p>
                    <p className="text-lg font-bold text-navy mt-1">{currentPallet.order_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium">STATUS</p>
                    <p className="text-lg font-bold text-orange-500 mt-1">{currentPallet.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium">CREATED</p>
                    <p className="text-sm text-muted mt-1">{new Date(currentPallet.created_at).toLocaleDateString()}</p>
                  </div>
                  {currentOrder && (
                    <div>
                      <p className="text-xs text-muted font-medium">CUSTOMER</p>
                      <p className="text-sm text-navy font-medium mt-1">
                        {getCustomerName(currentOrder.customer_id)}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-off-white">
                      <th className="text-left px-4 py-3 font-semibold text-navy">Product</th>
                      <th className="text-right px-4 py-3 font-semibold text-navy">Qty</th>
                      <th className="text-right px-4 py-3 font-semibold text-navy">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPallet.items?.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-off-white/50">
                        <td className="px-4 py-3 font-medium text-navy">{getProductName(item.product_id)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{item.qty_units}</td>
                        <td className="px-4 py-3 text-right text-muted">${item.unit_cost}</td>
                      </tr>
                    ))}
                    {(!currentPallet.items || currentPallet.items.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                          No items in this pallet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
