import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { InventoryBatch, InventoryBatchItem } from "@shared/api";
import { useAuth } from "../hooks/useAuth";

export function InventoryBatchesTab() {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [batchItems, setBatchItems] = useState<{ product_id: string; qty_units: number }[]>([
    { product_id: "", qty_units: 1 },
  ]);
  const [products, setProducts] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { token } = useAuth();

  const fetchBatches = async () => {
    try {
      const response = await fetch("/api/inventory-batches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch batches");
      const data = await response.json();
      setBatches(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading batches");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBatches();
      fetchProducts();
    }
  }, [token]);

  const handleAddItem = () =>
    setBatchItems((prev) => [...prev, { product_id: "", qty_units: 1 }]);

  const handleRemoveItem = (idx: number) =>
    setBatchItems((prev) => prev.filter((_, i) => i !== idx));

  const handleItemChange = (idx: number, field: "product_id" | "qty_units", value: any) =>
    setBatchItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: field === "qty_units" ? parseInt(value) || 1 : value } : item
      )
    );

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) return alert("Please enter batch name");
    if (batchItems.some((i) => !i.product_id)) return alert("Please select product for each item");

    setIsCreating(true);
    try {
      const response = await fetch("/api/inventory-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newBatchName, items: batchItems }),
      });

      if (!response.ok) throw new Error("Failed to create batch");
      const newBatch = await response.json();

      setBatches((prev) => [newBatch, ...prev]);
      setShowCreateModal(false);
      setNewBatchName("");
      setBatchItems([{ product_id: "", qty_units: 1 }]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseBatch = async (batchId: string) => {
    try {
      const response = await fetch(`/api/inventory-batches/${batchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "closed" }),
      });

      if (!response.ok) throw new Error("Failed to close batch");
      const updated = await response.json();

      setBatches((prev) => prev.map((b) => (b.id === batchId ? updated : b)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close batch");
    }
  };

  if (isLoading) return <div className="p-6">Loading batches...</div>;

  return (
    <div className="flex-1 flex flex-col gap-6">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-navy">Inventory Batches</h2>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create New Batch
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total Qty</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No batches found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch) => {
                const itemCount = batch.items?.length ?? 0;
                const totalQty = batch.items?.reduce((sum, item) => sum + item.qty_units, 0) ?? 0;
                const isExpanded = expandedBatchId === batch.id;

                return (
                  <div key={batch.id}>
                    <TableRow
                      onClick={() =>
                        setExpandedBatchId(isExpanded ? null : batch.id)
                      }
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell className="font-semibold text-navy">{batch.name}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-sm font-semibold ${
                            batch.status === "open"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{itemCount} items</TableCell>
                      <TableCell className="text-sm font-semibold">{totalQty} units</TableCell>
                      <TableCell className="text-sm">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {batch.status === "open" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseBatch(batch.id);
                              }}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                            >
                              Close Batch
                            </button>
                          )}
                          <button className="text-gray-600 hover:text-navy transition">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && batch.items && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-gray-50 p-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-navy mb-3">Batch Items</h4>
                            {batch.items.map((item) => {
                              const product = products.find((p) => p.id === item.product_id);
                              return (
                                <div
                                  key={item.id}
                                  className="flex justify-between items-center p-3 bg-white rounded border border-border"
                                >
                                  <div>
                                    <p className="font-semibold text-navy">
                                      {product?.name || item.product_id}
                                    </p>
                                    <p className="text-xs text-muted">
                                      Cost: ₱{item.unit_cost}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-navy">{item.qty_units} units</p>
                                    <p className="text-xs text-muted">
                                      Subtotal: ₱{(parseFloat(item.unit_cost) * item.qty_units).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </div>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
              <h2 className="font-rajdhani text-lg font-bold text-white">Create New Batch</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white hover:opacity-70 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g., Morning Delivery, Weekly Restock"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-navy">Batch Items *</label>
                  <button
                    onClick={handleAddItem}
                    className="text-xs text-accent-2 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {batchItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, "product_id", e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₱{p.price})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.qty_units}
                        onChange={(e) => handleItemChange(idx, "qty_units", e.target.value)}
                        className="w-20 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                        placeholder="Qty"
                      />
                      {batchItems.length > 1 && (
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
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBatch}
                disabled={isCreating}
                className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
