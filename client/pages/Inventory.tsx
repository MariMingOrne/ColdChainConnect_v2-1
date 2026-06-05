import { useState, useEffect } from "react";
import { useInventoryContext } from "../context/InventoryContext";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { ActionButtons } from "@/components/ActionButtons";

interface InventoryProduct {
  id: string;
  sku: string;
  description: string;
  unitPrice: number;
  supplierId: string;
  weight: number;
  quantity: number;
  expiryDate: string;
  imageFilename?: string;
  reorderPoint: number;
  lastUpdated: string;
  manufacturer: string;
  isDiscontinued: boolean;
}

interface PalletDisplay {
  id: string;
  palletId: string;
  itemCount: number;
  totalQty: number;
}

export function Inventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const { batches, setBatches, selectedBatchId, setSelectedBatchId, selectedPalletId, setSelectedPalletId, searchQuery, setSearchQuery, refreshBatchesFromDB } = useInventoryContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [extraInfoProduct, setExtraInfoProduct] = useState<(InventoryProduct & { batchQuantity: number }) | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [startBatchCreation, setStartBatchCreation] = useState(false);

  const emptyForm = (): InventoryProduct => ({
    id: "", sku: "", description: "", unitPrice: 0, supplierId: "",
    weight: 0, quantity: 0, expiryDate: "", imageFilename: "",
    reorderPoint: 300, lastUpdated: new Date().toISOString().split("T")[0],
    manufacturer: "", isDiscontinued: false,
  });

  const [showDeleteButtons, setShowDeleteButtons] = useState(false);

  const itemsPerPage = 10;

  const fetchProductsFromApi = async () => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const headers = { Authorization: `Bearer ${token}` };

      const productsRes = await fetch("/api/products", { headers });
      const productsData = productsRes.ok ? await productsRes.json() : [];

      const qtyMap: Record<string, number> = {};
      for (const batch of batches) {
        for (const pallet of batch.pallets) {
          for (const item of pallet.items) {
            qtyMap[item.productId] = (qtyMap[item.productId] || 0) + item.quantity;
          }
        }
      }

      const mapped: InventoryProduct[] = productsData.map((p: any) => ({
        id: p.id,
        sku: p.sku || p.name,
        description: p.name,
        unitPrice: parseFloat(p.price) || 0,
        supplierId: p.supplier_id || "",
        weight: 0,
        quantity: qtyMap[p.id] ?? 0,
        expiryDate: new Date().toISOString().split("T")[0],
        imageFilename: p.image_filename,
        reorderPoint: p.reorder_point ?? 300,
        lastUpdated: p.updated_at || new Date().toISOString(),
        manufacturer: p.manufacturer || "",
        isDiscontinued: p.is_discontinued ?? false,
      }));

      setProducts(mapped);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  useEffect(() => {
    fetchProductsFromApi();
  }, [batches]);

  const currentBatch = batches.find((b) => b.id === selectedBatchId);

  const getBatchProducts = (): (InventoryProduct & { batchQuantity: number; batchExpiryDate: string; itemId?: string })[] => {
    if (!currentBatch || currentBatch.id === "batch-all") {
      return products.map((p) => ({ ...p, batchQuantity: p.quantity, batchExpiryDate: p.expiryDate }));
    }

    const itemsByProduct: Record<string, { quantity: number; expiryDates: string[]; itemId?: string }> = {};
    for (const pallet of currentBatch.pallets) {
      for (const item of pallet.items) {
        if (!itemsByProduct[item.productId]) {
          itemsByProduct[item.productId] = { quantity: 0, expiryDates: [], itemId: item.id };
        }
        itemsByProduct[item.productId].quantity += item.quantity;
        if (item.expirationNote) {
          itemsByProduct[item.productId].expiryDates.push(item.expirationNote);
        }
      }
    }
    return Object.entries(itemsByProduct)
      .map(([productId, { quantity, expiryDates, itemId }]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;
        const uniqueDates = [...new Set(expiryDates)];
        return {
          ...product,
          batchQuantity: quantity,
          batchExpiryDate: uniqueDates.length > 0 ? uniqueDates.join(", ") : product.expiryDate,
          itemId,
        };
      })
      .filter(Boolean) as (InventoryProduct & { batchQuantity: number; batchExpiryDate: string; itemId?: string })[];
  };

  const batchProducts = getBatchProducts();

  const filteredBatchProducts = batchProducts.filter((p) =>
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredBatchProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBatchProducts = filteredBatchProducts.slice(startIndex, startIndex + itemsPerPage);

  const suppliers = Array.from(new Set(products.map((p) => p.supplierId))).sort();

  const getReorderStatus = (qty: number, reorderPoint: number) => qty <= reorderPoint ? "RE-ORDER" : "OK";

  const getStockHighlightColor = (qty: number, reorderPoint: number) => {
    if (qty <= reorderPoint) return { bg: "bg-orange-50", hover: "hover:bg-orange-100/60" };
    const percentage = (qty / reorderPoint) * 100;
    if (percentage < 150) return { bg: "bg-yellow-50", hover: "hover:bg-yellow-100/60" };
    return { bg: "", hover: "hover:bg-off-white/50" };
  };

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return { status: "expired", icon: "❌", color: { bg: "bg-red-50", hover: "hover:bg-red-100/60" } };
    if (daysUntilExpiry <= 7) return { status: "almost-expired", icon: "⚠️", color: { bg: "bg-yellow-50", hover: "hover:bg-yellow-100/60" } };
    return { status: "ok", icon: "✅", color: { bg: "", hover: "hover:bg-off-white/50" } };
  };

  const getRowHighlightColor = (qty: number, reorderPoint: number, expiryDate?: string) => {
    // Only use expiry status for specific pallet view
    if (selectedBatchId !== "batch-all" && selectedPalletId && expiryDate) {
      return getExpiryStatus(expiryDate).color;
    }
    // Otherwise use stock quantity highlighting
    return getStockHighlightColor(qty, reorderPoint);
  };

  const createNewBatch = async (pallets: any[], batchName: string) => {
    await refreshBatchesFromDB();
    setNewBatchName("");
    setStartBatchCreation(false);
    setIsBatchModalOpen(false);
  };

  const deleteBatch = async (batchId: string) => {
    if (batchId === "batch-all") { alert("Cannot delete the default 'All Products' batch"); return; }
    if (!confirm("Are you sure you want to delete this batch?")) return;
    const batchName = batches.find((b) => b.id === batchId)?.name;
    if (batchName) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const res = await fetch("/api/batches", { headers: { Authorization: `Bearer ${token}` } });
        const rows: any[] = res.ok ? await res.json() : [];
        const toDelete = rows.filter((r) => r.batch_name === batchName);
        await Promise.all(toDelete.map((r) =>
          fetch(`/api/batches/${r.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
        ));
      } catch (err) { console.error("Failed to delete batch rows:", err); }
    }
    if (selectedBatchId === batchId) setSelectedBatchId("batch-all");
    await refreshBatchesFromDB();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const token = localStorage.getItem("auth_token") || "";
      const response = await fetch(`/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Failed to delete");
      setProducts(products.filter((p) => p.id !== id));
      setBatches(batches.map((b) => ({
        ...b,
        pallets: b.pallets.map((p: any) => ({
          ...p,
          items: p.items.filter((i: any) => i.productId !== id),
        })),
      })));
      await fetchProductsFromApi();
    } catch (err) {
      alert("Failed to delete product. Please try again.");
    }
  };

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto scrollbar-visible space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-off-white rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-navy" />
          </button>
          <div>
            <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">Inventory Management</h1>
            <p className="text-xs text-muted mt-1">Track, manage, and monitor all frozen goods SKUs</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => navigate("/information-management/products")} className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-colors">👁 Show All Products</button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">⬇ Import Excel</button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">⬆ Export Excel</button>
        </div>
      </div>

      {/* Products Section */}
      <div className="space-y-6">

      {/* Batch Selector Card */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-navy">Current Batch</label>
            <button onClick={() => setIsBatchModalOpen(true)} className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 w-fit">
              📦 {currentBatch?.name || "All Products"}
            </button>
          </div>
          <button onClick={() => { setNewBatchName(""); setStartBatchCreation(true); setIsBatchModalOpen(true); }} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 w-fit">
            ➕ Add Items
          </button>
        </div>
      </div>

      {/* Search + Delete Toggle */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2 flex-1">
          <span className="text-muted">🔍</span>
          <input type="text" placeholder="Search by SKU or name…" value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm" />
        </div>
        <button
          onClick={() => setShowDeleteButtons(!showDeleteButtons)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            showDeleteButtons
              ? "bg-red text-white hover:opacity-90"
              : "bg-white border border-border text-navy hover:bg-off-white"
          }`}
        >
          {showDeleteButtons ? "🔓 Delete Enabled" : "🔒 Enable Delete"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsBox label="Total Items" value={batchProducts.length.toString()} icon="📦" />
        <StatsBox label="Re-Order Needed" value={batchProducts.filter((p) => p.batchQuantity <= p.reorderPoint).length.toString()} icon="⚠️" color="red" />
        <StatsBox label="Total Stock Qty" value={batchProducts.reduce((s, p) => s + p.batchQuantity, 0).toLocaleString()} icon="🔢" color="accent-2" />
        <StatsBox label="Total Value" value={`₱${batchProducts.reduce((s, p) => s + p.unitPrice * p.batchQuantity, 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`} icon="💰" />
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto scrollbar-visible text-xs">
          <table className="w-full">
            <thead>
              <tr>
                {["Name", "Cost Per Item", "Stock Qty"].map((col) => (
                  <th key={col} className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                    {col}
                  </th>
                ))}
                {selectedBatchId === "batch-all" && (
                  <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                    Reorder Level
                  </th>
                )}
                {selectedBatchId !== "batch-all" && (
                  <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                    Expiry Date
                  </th>
                )}
                <th style={{ width: '120px' }} className="sticky right-0 z-10 bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-center border-b border-border whitespace-nowrap shadow-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedBatchProducts.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No products in this batch</td></tr>
              ) : (
                paginatedBatchProducts.map((product) => {
                  const uniqueKey = product.itemId ? `${product.id}-${product.itemId}` : product.id;
                  const highlightColor = getRowHighlightColor(product.batchQuantity, product.reorderPoint, product.batchExpiryDate);
                  const expiryStatus = selectedBatchId !== "batch-all" ? getExpiryStatus(product.batchExpiryDate) : null;
                  return (
                    <tr key={uniqueKey} className={`border-b border-border transition-colors ${highlightColor.bg} ${highlightColor.hover}`}>
                      {/* Name */}
                      <td className="px-3 py-3 text-navy font-semibold max-w-[200px] truncate flex items-center gap-2">
                        {expiryStatus && <span title={expiryStatus.status}>{expiryStatus.icon}</span>}
                        {product.description}
                      </td>
                      {/* Cost Per Item */}
                      <td className="px-3 py-3 text-navy whitespace-nowrap">₱{product.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                      {/* Stock Qty */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                          product.batchQuantity / product.reorderPoint < 0.5 ? "bg-red" :
                          product.batchQuantity / product.reorderPoint < 1 ? "bg-yellow-500" :
                          "bg-green"
                        }`}>
                          {product.batchQuantity.toLocaleString()}
                        </span>
                      </td>
                      {/* Reorder Level — read-only display in All Products view */}
                      {selectedBatchId === "batch-all" && (
                        <td className="px-3 py-3 text-navy whitespace-nowrap font-semibold">
                          {product.reorderPoint.toLocaleString()}
                        </td>
                      )}
                      {/* Expiry Date — display in batch view */}
                      {selectedBatchId !== "batch-all" && (
                        <td className="px-3 py-3 text-navy whitespace-nowrap text-sm">
                          {product.batchExpiryDate ? new Date(product.batchExpiryDate).toLocaleDateString("en-PH") : "N/A"}
                        </td>
                      )}
                      {/* Actions */}
                      <td style={{ width: '120px' }} className="sticky right-0 z-10 px-3 py-3 whitespace-nowrap bg-white border-l border-border shadow-left">
                        <div className="flex items-center justify-center gap-1">
                          <ActionButtons
                            onView={() => setExtraInfoProduct(product)}
                            onEdit={undefined}
                            onDelete={() => handleDelete(product.id)}
                            showDelete={showDeleteButtons}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-off-white/50">
          <div className="text-xs text-muted">
            Page {currentPage} of {Math.max(1, totalPages)} · {filteredBatchProducts.length} items
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-navy bg-white rounded border border-border">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Extra Info Popup */}
      {extraInfoProduct && (
        <ExtraInfoModal
          product={extraInfoProduct}
          batches={batches}
          onClose={() => setExtraInfoProduct(null)}
          onSelectPallet={(batchId, palletId) => {
            setSelectedBatchId(batchId);
            setSelectedPalletId(palletId);
            setExtraInfoProduct(null);
          }}
        />
      )}

      {/* Batch Modal */}
      {isBatchModalOpen && (
        <BatchModal
          batches={batches} selectedBatchId={selectedBatchId}
          onSelectBatch={(id) => { setSelectedBatchId(id); setIsBatchModalOpen(false); }}
          onDeleteBatch={deleteBatch}
          onCreateBatch={createNewBatch}
          onEditBatch={() => {}}
          onClose={() => { setIsBatchModalOpen(false); setStartBatchCreation(false); }}
          newBatchName={newBatchName} setNewBatchName={setNewBatchName}
          products={products} startCreating={startBatchCreation}
          onRefresh={async () => { await fetchProductsFromApi(); await refreshBatchesFromDB(); }}
        />
      )}
      </div>
    </div>
  );
}

// ─── StatsBox ─────────────────────────────────────────────────────────────────
function StatsBox({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="bg-white border border-border rounded-lg p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`font-rajdhani text-xl font-bold ${color ? `text-${color}` : "text-accent-2"}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

// ─── Extra Info Modal ─────────────────────────────────────────────────────────
function ExtraInfoModal({ product, batches, onClose, onSelectPallet }: { product: InventoryProduct & { batchQuantity: number }; batches: any[]; onClose: () => void; onSelectPallet: (batchId: string, palletId: string) => void }) {
  const batchesWithProduct = batches
    .filter((b) => b.id !== "batch-all" && b.pallets.some((pallet: any) => pallet.items.some((item: any) => item.productId === product.id)))
    .map((batch) => {
      const totalQty = batch.pallets.reduce((sum: number, pallet: any) =>
        sum + (pallet.items.find((item: any) => item.productId === product.id)?.quantity || 0), 0);
      return { batchId: batch.id, batchName: batch.name, quantity: totalQty };
    });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="font-rajdhani text-lg font-bold text-white">{product.description}</h2>
            <p className="text-xs text-muted mt-0.5">SKU: {product.sku}</p>
          </div>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-muted uppercase letter-spacing-wider mb-3">Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Inventory Value", `₱${(product.unitPrice * product.batchQuantity).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                ["Reorder Level", product.reorderPoint.toString()],
                ["Last Updated", new Date(product.lastUpdated).toLocaleDateString("en-PH")],
              ].map(([label, value]) => (
                <div key={label} className="bg-off-white rounded-lg p-3">
                  <div className="text-xs text-muted font-semibold mb-0.5">{label}</div>
                  <div className="text-sm font-semibold text-navy">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-muted uppercase letter-spacing-wider mb-3">Batches Containing This Product</h3>
            {batchesWithProduct.length === 0 ? (
              <div className="bg-off-white rounded-lg p-4 text-center">
                <p className="text-xs text-muted">No batches currently contain this product</p>
              </div>
            ) : (
              <div className="space-y-2">
                {batchesWithProduct.map((batch, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectPallet(batch.batchId, "")}
                    className="w-full text-left bg-off-white hover:bg-accent-2/10 rounded-lg p-3 border border-border hover:border-accent-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-navy">{batch.batchName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted font-semibold mb-0.5">Quantity</div>
                        <div className="text-lg font-bold text-accent-2">{batch.quantity.toLocaleString()}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── BatchModal ────────────────────────────────────────────────────────────────
function BatchModal({ batches, selectedBatchId, onSelectBatch, onDeleteBatch, onCreateBatch, onEditBatch, onClose, newBatchName, setNewBatchName, products, startCreating = false, onRefresh }: { batches: any[]; selectedBatchId: string; onSelectBatch: (id: string) => void; onDeleteBatch: (id: string) => void; onCreateBatch: (items: any[], batchName: string) => void; onEditBatch: (id: string, items: any[]) => void; onClose: () => void; newBatchName: string; setNewBatchName: (n: string) => void; products: InventoryProduct[]; startCreating?: boolean; onRefresh: () => void }) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(startCreating);
  const [pallets, setPallets] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const activeBatches = batches.filter((b) => !b.isArchived && b.id !== "batch-all");
  const archivedBatches = batches.filter((b) => b.isArchived);

  const handleArchiveBatch = async (batchId: string) => {
    const token = localStorage.getItem("auth_token") || "";
    try {
      const response = await fetch(`/api/batches/${batchId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_archived: true }),
      });
      if (!response.ok) throw new Error("Failed to archive batch");
      await onRefresh();
    } catch (err) {
      console.error("Failed to archive batch:", err);
      alert("Failed to archive batch. Please try again.");
    }
  };

  const handleUnarchiveBatch = async (batchId: string) => {
    const token = localStorage.getItem("auth_token") || "";
    try {
      const response = await fetch(`/api/batches/${batchId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_archived: false }),
      });
      if (!response.ok) throw new Error("Failed to unarchive batch");
      await onRefresh();
    } catch (err) {
      console.error("Failed to unarchive batch:", err);
      alert("Failed to unarchive batch. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-3xl w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">
            {isCreatingBatch ? "Create New Batch" : "Manage Batches"}
          </h2>
          <button onClick={() => { setIsCreatingBatch(false); setPallets([]); onClose(); }} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">
          {!isCreatingBatch ? (
            <>
              {!showArchived ? (
                <>
                  <div className="space-y-2 mb-6">
                    <h3 className="text-xs font-semibold text-muted uppercase mb-3">Active Batches</h3>
                    <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedBatchId === "batch-all" ? "border-accent-2 bg-accent-2/10" : "border-border hover:bg-off-white"}`} onClick={() => onSelectBatch("batch-all")}>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-navy">📦 All Products</div>
                        <div className="text-xs text-muted">View all products across all batches</div>
                      </div>
                    </div>
                    {activeBatches.length === 0 ? (
                      <p className="text-xs text-muted py-4">No active batches</p>
                    ) : (
                      activeBatches.map((batch) => {
                        const totalItems = batch.pallets?.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0) || 0;
                        return (
                          <div key={batch.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedBatchId === batch.id ? "border-accent-2 bg-accent-2/10" : "border-border hover:bg-off-white"}`} onClick={() => onSelectBatch(batch.id)}>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-navy">{batch.name}</div>
                              <div className="text-xs text-muted">{totalItems} item{totalItems !== 1 ? "s" : ""}</div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); handleArchiveBatch(batch.id); }} className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-semibold hover:opacity-90" title="Archive batch">📦</button>
                              <button onClick={(e) => { e.stopPropagation(); onDeleteBatch(batch.id); }} className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90">🗑</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-2 justify-between">
                    <button onClick={() => setShowArchived(true)} className="px-4 py-2 bg-gray-400 text-white rounded-lg font-semibold text-sm hover:opacity-90">📋 View Archived ({archivedBatches.length})</button>
                    <button onClick={() => { setIsCreatingBatch(true); setPallets([]); setNewBatchName(""); }} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90">➕ Create New Batch</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 mb-6">
                    <h3 className="text-xs font-semibold text-muted uppercase mb-3">Archived Batches</h3>
                    {archivedBatches.length === 0 ? (
                      <p className="text-xs text-muted py-4">No archived batches</p>
                    ) : (
                      archivedBatches.map((batch) => {
                        const totalItems = batch.pallets?.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0) || 0;
                        return (
                          <div key={batch.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-off-white/50 transition-colors">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-navy">{batch.name}</div>
                              <div className="text-xs text-muted">{totalItems} item{totalItems !== 1 ? "s" : ""}</div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleUnarchiveBatch(batch.id)} className="px-2 py-1 bg-green text-white rounded text-xs font-semibold hover:opacity-90" title="Restore batch">♻️</button>
                              <button onClick={() => onDeleteBatch(batch.id)} className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90">🗑</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex justify-start">
                    <button onClick={() => setShowArchived(false)} className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90">← Back to Active</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <CreateBatchForm
              newBatchName={newBatchName}
              setNewBatchName={setNewBatchName}
              pallets={pallets}
              setPallets={setPallets}
              onCreateBatch={async () => {
                if (newBatchName.trim() && pallets.length > 0) {
                  await onCreateBatch(pallets, newBatchName);
                  setIsCreatingBatch(false);
                  setPallets([]);
                  onRefresh();
                }
              }}
              onCancel={() => { setIsCreatingBatch(false); setPallets([]); }}
              products={products}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CreateBatchForm ──────────────────────────────────────────────────────────
function CreateBatchForm({ newBatchName, setNewBatchName, pallets, setPallets, onCreateBatch, onCancel, products }: { newBatchName: string; setNewBatchName: (n: string) => void; pallets: any[]; setPallets: (p: any[]) => void; onCreateBatch: () => void; onCancel: () => void; products: InventoryProduct[] }) {
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/products", { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` } })
      .then((r) => r.ok ? r.json() : []).then(setDbProducts).catch(() => {});
  }, []);

  const allProducts = dbProducts.length > 0 ? dbProducts : products.map((p) => ({ id: p.id, name: p.description, sku: p.sku }));
  const getName = (id: string) => dbProducts.find((p) => p.id === id)?.name || products.find((p) => p.id === id)?.description || "";
  const getSku = (id: string) => dbProducts.find((p) => p.id === id)?.sku || products.find((p) => p.id === id)?.sku || "";

  const addItem = (productId: string) => {
    if (!productId || items.some((i) => i.product_id === productId)) { alert("Product already added"); return; }
    const p = products.find((x) => x.id === productId);
    setItems([...items, { product_id: productId, qty_units: p?.quantity ?? 0, expiration_date_note: "" }]);
  };

  const removeItem = (itemIdx: number) => {
    setItems(items.filter((_, i) => i !== itemIdx));
  };

  const updateItem = (itemIdx: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[itemIdx][field] = value;
    setItems(newItems);
  };

  const handleCreate = async () => {
    if (!newBatchName.trim() || items.length === 0) {
      alert("Ensure batch name is set and at least one item is added");
      return;
    }
    const token = localStorage.getItem("auth_token") || "";
    try {
      const pallet = { pallet_id: "UNPALLETTED", items };
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ batch_name: newBatchName, pallets: [pallet] }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert("Failed to create batch: " + (error.error || "Unknown error"));
        return;
      }
      onCreateBatch();
    } catch (err) {
      console.error("Failed to create batch:", err);
      alert("Failed to create batch: " + String(err));
    }
  };

  const usedProducts = items.map((i) => i.product_id);
  const availableProducts = allProducts.filter((p) => {
    const product = products.find((prod) => prod.id === p.id);
    return !usedProducts.includes(p.id) && !product?.isDiscontinued;
  });

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">Batch Name *</label>
        <input type="text" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} placeholder="e.g., Morning Delivery, Q1 Restock" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-navy">Items *</h3>

        <div>
          <label className="block text-xs font-semibold text-navy mb-2">Add Products *</label>
          <select onChange={(e) => { if (e.target.value) { addItem(e.target.value); e.target.value = ""; } }} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
            <option value="">Choose a product...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ""}{p.name}</option>
            ))}
          </select>
        </div>

        {items.length > 0 && (
          <div className="bg-off-white rounded-lg p-3 space-y-2">
            <label className="text-xs font-semibold text-navy">Items ({items.length})</label>
            {items.map((item, itemIdx) => (
              <div key={itemIdx} className="bg-white border border-border rounded p-2 space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-navy">{getName(item.product_id)}</div>
                    <div className="text-xs text-muted">{getSku(item.product_id)}</div>
                  </div>
                  <input type="number" min="1" value={item.qty_units} onChange={(e) => updateItem(itemIdx, "qty_units", parseInt(e.target.value) || 1)} className="w-20 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:border-accent-2" />
                  <button onClick={() => removeItem(itemIdx)} className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90">✕</button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Expiry Date</label>
                  <input type="date" value={item.expiration_date_note || ""} onChange={(e) => updateItem(itemIdx, "expiration_date_note", e.target.value)} className="w-full px-2 py-1 border border-border rounded text-sm focus:outline-none focus:border-accent-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-off-white">Cancel</button>
        <button onClick={handleCreate} disabled={!newBatchName.trim() || items.length === 0} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
          ✓ Add Items
        </button>
      </div>
    </div>
  );
}
