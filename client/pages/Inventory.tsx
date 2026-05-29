import { useState, useEffect } from "react";
import { useInventoryContext } from "../context/InventoryContext";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Eye } from "lucide-react";
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
  daysPerReorder: number;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [extraInfoProduct, setExtraInfoProduct] = useState<(InventoryProduct & { batchQuantity: number }) | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [startBatchCreation, setStartBatchCreation] = useState(false);

  const [formData, setFormData] = useState<InventoryProduct>({
    id: "", sku: "", description: "", unitPrice: 0, supplierId: "",
    weight: 0, quantity: 0, expiryDate: "", imageFilename: "",
    reorderPoint: 300, lastUpdated: new Date().toISOString().split("T")[0],
    manufacturer: "", daysPerReorder: 90, isDiscontinued: false,
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
        daysPerReorder: p.days_per_reorder ?? 90,
        isDiscontinued: p.is_discontinued ?? false,
      }));

      setProducts(mapped);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  useEffect(() => { fetchProductsFromApi(); }, []);

  const currentBatch = batches.find((b) => b.id === selectedBatchId);

  const getBatchProducts = (): (InventoryProduct & { batchQuantity: number; batchExpiryDate: string })[] => {
    if (!currentBatch || currentBatch.id === "batch-all") {
      return products.map((p) => ({ ...p, batchQuantity: p.quantity, batchExpiryDate: p.expiryDate }));
    }

    if (selectedPalletId) {
      const pallet = currentBatch.pallets.find((p) => p.id === selectedPalletId);
      if (!pallet) return [];
      return pallet.items
        .map((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return null;
          return { ...product, batchQuantity: item.quantity, batchExpiryDate: item.expirationNote || product.expiryDate };
        })
        .filter(Boolean) as (InventoryProduct & { batchQuantity: number; batchExpiryDate: string })[];
    }

    const allItems = currentBatch.pallets.flatMap((p) => p.items);
    return allItems
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        return { ...product, batchQuantity: item.quantity, batchExpiryDate: item.expirationNote || product.expiryDate };
      })
      .filter(Boolean) as (InventoryProduct & { batchQuantity: number; batchExpiryDate: string })[];
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

  const createNewBatch = async (pallets: any[], batchName: string) => {
    // After pallet rows are saved to DB, refresh batches from DB so the
    // new named batch appears with the correct DB-derived id.
    await refreshBatchesFromDB();
    // Select the newly created batch by its DB-derived id
    const newId = `db-batch-${batchName.toLowerCase().replace(/\s+/g, "-")}`;
    setSelectedBatchId(newId);
    setNewBatchName("");
    setIsBatchModalOpen(false);
  };

  const deleteBatch = async (batchId: string) => {
    if (batchId === "batch-all") { alert("Cannot delete the default 'All Products' batch"); return; }
    if (!confirm("Are you sure you want to delete this batch?")) return;
    // Find all pallet rows belonging to this batch by matching the batch name
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

  const handleSaveProduct = async () => {
    if (formData.unitPrice <= 0) { alert("Unit price must be positive"); return; }
    try {
      const token = localStorage.getItem("auth_token") || "";
      const endpoint = selectedProduct ? `/api/products/${selectedProduct.id}` : "/api/products";
      const method = selectedProduct ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formData.description, sku: formData.sku, price: formData.unitPrice,
          manufacturer: formData.manufacturer, reorder_point: formData.reorderPoint,
          days_per_reorder: formData.daysPerReorder, is_discontinued: formData.isDiscontinued,
        }),
      });
      if (!response.ok) throw new Error("Failed to save product");
      await fetchProductsFromApi();
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      alert("Failed to save product. Please try again.");
    }
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

  const handleEdit = (product: InventoryProduct) => { setSelectedProduct(product); setFormData(product); setIsModalOpen(true); };

  const resetForm = () => {
    setFormData({ id: "", sku: "", description: "", unitPrice: 0, supplierId: "", weight: 0, quantity: 0, expiryDate: "", imageFilename: "", reorderPoint: 300, lastUpdated: new Date().toISOString().split("T")[0], manufacturer: "", daysPerReorder: 90, isDiscontinued: false });
    setSelectedProduct(null);
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
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">⬇ Import Excel</button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">⬆ Export Excel</button>
        </div>
      </div>

      {/* Batch Selector */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-navy">Current Batch</label>
            <button onClick={() => setIsBatchModalOpen(true)} className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 w-fit">
              📦 {currentBatch?.name || "Select Batch"}
            </button>
          </div>
          <button onClick={() => { setNewBatchName(""); setStartBatchCreation(true); setIsBatchModalOpen(true); }} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 w-fit">
            ➕ Create New Batch
          </button>
        </div>

        {/* Pallet Selector */}
        {currentBatch && currentBatch.id !== "batch-all" && currentBatch.pallets.length > 0 && (
          <div className="border-t border-border pt-4">
            <label className="text-xs font-semibold text-navy mb-2 block">Select Pallet</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPalletId(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  !selectedPalletId
                    ? "bg-accent-2 text-white"
                    : "bg-off-white border border-border text-navy hover:bg-off-white/70"
                }`}
              >
                All Pallets ({currentBatch.pallets.length})
              </button>
              {currentBatch.pallets.map((pallet) => {
                const itemCount = pallet.items.length;
                const totalQty = pallet.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <button
                    key={pallet.id}
                    onClick={() => setSelectedPalletId(pallet.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                      selectedPalletId === pallet.id
                        ? "bg-accent-2 text-white"
                        : "bg-off-white border border-border text-navy hover:bg-off-white/70"
                    }`}
                  >
                    {pallet.palletId} ({itemCount} items, {totalQty} qty)
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Search + Add + Delete Toggle */}
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
                {["Reorder", "Name", "Cost Per Item", "Stock Qty", "Reorder Level", "Item Discontinued?", "Actions"].map((col) => (
                  <th key={col} className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedBatchProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">No products in this batch</td></tr>
              ) : (
                paginatedBatchProducts.map((product) => {
                  const isReorder = getReorderStatus(product.batchQuantity, product.reorderPoint) === "RE-ORDER";
                  return (
                    <tr key={product.id} className={`border-b border-border transition-colors ${isReorder ? "bg-orange-50 hover:bg-orange-100/60" : "hover:bg-off-white/50"}`}>
                      {/* Reorder Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${isReorder ? "bg-orange-400 text-white" : "bg-green/20 text-green"}`}>
                          {isReorder ? "RE-ORDER" : "OK"}
                        </span>
                      </td>
                      {/* Name */}
                      <td className="px-3 py-3 text-navy font-semibold max-w-[200px] truncate">{product.description}</td>
                      {/* Cost Per Item */}
                      <td className="px-3 py-3 text-navy whitespace-nowrap">₱{product.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                      {/* Stock Qty */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${isReorder ? "bg-red" : "bg-green"}`}>
                          {product.batchQuantity.toLocaleString()}
                        </span>
                      </td>
                      {/* Reorder Level */}
                      <td className="px-3 py-3 text-navy whitespace-nowrap">{product.reorderPoint}</td>
                      {/* Item Discontinued */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${product.isDiscontinued ? "bg-red text-white" : "bg-green text-white"}`}>
                          {product.isDiscontinued ? "YES" : "NO"}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <ActionButtons
                          onView={() => setExtraInfoProduct(product)}
                          onEdit={() => handleEdit(product)}
                          onDelete={() => handleDelete(product.id)}
                          showDelete={showDeleteButtons}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Always Display */}
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
          onClose={() => setExtraInfoProduct(null)}
        />
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <ProductModal
          title={selectedProduct ? "Edit Product" : "Add New Product"}
          onClose={() => { setIsModalOpen(false); resetForm(); }}
          onSave={handleSaveProduct}
          suppliers={suppliers}
          formData={formData}
          setFormData={setFormData}
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
function ExtraInfoModal({ product, onClose }: { product: InventoryProduct & { batchQuantity: number }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="font-rajdhani text-lg font-bold text-white">{product.description}</h2>
            <p className="text-xs text-muted mt-0.5">SKU: {product.sku}</p>
          </div>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Product Details */}
          <div>
            <h3 className="text-xs font-bold text-muted uppercase letter-spacing-wider mb-3">Product Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Manufacturer", product.manufacturer || "N/A"],
                ["Unit Price", `₱${product.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                ["Stock Quantity", product.batchQuantity.toLocaleString()],
                ["Inventory Value", `₱${(product.unitPrice * product.batchQuantity).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                ["Reorder Level", product.reorderPoint.toString()],
                ["Batch Tracking", product.isDiscontinued ? "Disabled" : "Enabled"],
                ["Last Updated", new Date(product.lastUpdated).toLocaleDateString("en-PH")],
              ].map(([label, value]) => (
                <div key={label} className="bg-off-white rounded-lg p-3">
                  <div className="text-xs text-muted font-semibold mb-0.5">{label}</div>
                  <div className="text-sm font-semibold text-navy">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ title, onClose, onSave, suppliers, formData, setFormData }: { title: string; onClose: () => void; onSave: () => void; suppliers: string[]; formData: InventoryProduct; setFormData: (d: InventoryProduct) => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">SKU Code</label>
              <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" placeholder="e.g., 7700165" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Manufacturer</label>
              <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" placeholder="e.g., Frabelle Food Corp." />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Product Name *</label>
            <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" placeholder="Product name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Cost Per Item (₱) *</label>
              <input type="number" step="0.01" min="0" value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Reorder Level</label>
              <input type="number" min="0" value={formData.reorderPoint} onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Days Per Reorder</label>
              <input type="number" min="0" value={formData.daysPerReorder} onChange={(e) => setFormData({ ...formData, daysPerReorder: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="discontinued" checked={formData.isDiscontinued} onChange={(e) => setFormData({ ...formData, isDiscontinued: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="discontinued" className="text-xs font-semibold text-navy">Item Discontinued</label>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white">Cancel</button>
          <button onClick={onSave} className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90">Save Product</button>
        </div>
      </div>
    </div>
  );
}

// ─── BatchModal ────────────────────────────────────────────────────────────────
function BatchModal({ batches, selectedBatchId, onSelectBatch, onDeleteBatch, onCreateBatch, onEditBatch, onClose, newBatchName, setNewBatchName, products, startCreating = false, onRefresh }: { batches: any[]; selectedBatchId: string; onSelectBatch: (id: string) => void; onDeleteBatch: (id: string) => void; onCreateBatch: (items: any[], batchName: string) => void; onEditBatch: (id: string, items: any[]) => void; onClose: () => void; newBatchName: string; setNewBatchName: (n: string) => void; products: InventoryProduct[]; startCreating?: boolean; onRefresh: () => void }) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(startCreating);
  const [pallets, setPallets] = useState<any[]>([]);

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
              <div className="space-y-2 mb-6">
                <h3 className="text-xs font-semibold text-muted uppercase mb-3">Available Batches</h3>
                {batches.map((batch) => {
                  const totalPallets = batch.pallets?.length || 0;
                  const totalItems = batch.pallets?.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0) || 0;
                  return (
                    <div key={batch.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedBatchId === batch.id ? "border-accent-2 bg-accent-2/10" : "border-border hover:bg-off-white"}`} onClick={() => onSelectBatch(batch.id)}>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-navy">{batch.name}</div>
                        <div className="text-xs text-muted">{totalPallets} pallet{totalPallets !== 1 ? "s" : ""} · {totalItems} item{totalItems !== 1 ? "s" : ""}</div>
                      </div>
                      {batch.id !== "batch-all" && (
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); onDeleteBatch(batch.id); }} className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90">🗑</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button onClick={() => { setIsCreatingBatch(true); setPallets([]); setNewBatchName(""); }} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90">➕ Create New Batch</button>
              </div>
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

  useEffect(() => {
    fetch("/api/products", { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` } })
      .then((r) => r.ok ? r.json() : []).then(setDbProducts).catch(() => {});
  }, []);

  const allProducts = dbProducts.length > 0 ? dbProducts : products.map((p) => ({ id: p.id, name: p.description, sku: p.sku }));
  const getName = (id: string) => dbProducts.find((p) => p.id === id)?.name || products.find((p) => p.id === id)?.description || "";
  const getSku = (id: string) => dbProducts.find((p) => p.id === id)?.sku || products.find((p) => p.id === id)?.sku || "";

  const addPallet = () => {
    setPallets([...pallets, { pallet_id: "", supplier_name: "Frabelle Food Corp", received_date: "", temperature_log: "", storage_zone: "", placement_location: "", items: [] }]);
  };

  const removePallet = (idx: number) => {
    setPallets(pallets.filter((_, i) => i !== idx));
  };

  const addItemToPallet = (palletIdx: number, productId: string) => {
    if (!productId || pallets[palletIdx].items.some((i: any) => i.product_id === productId)) { alert("Product already in this pallet"); return; }
    const p = products.find((x) => x.id === productId);
    const newPallets = [...pallets];
    newPallets[palletIdx].items.push({ product_id: productId, qty_units: p?.quantity ?? 0, expiration_date_note: "" });
    setPallets(newPallets);
  };

  const removeItemFromPallet = (palletIdx: number, itemIdx: number) => {
    const newPallets = [...pallets];
    newPallets[palletIdx].items.splice(itemIdx, 1);
    setPallets(newPallets);
  };

  const updatePallet = (idx: number, field: string, value: any) => {
    const newPallets = [...pallets];
    newPallets[idx][field] = value;
    setPallets(newPallets);
  };

  const updatePalletItem = (palletIdx: number, itemIdx: number, field: string, value: any) => {
    const newPallets = [...pallets];
    newPallets[palletIdx].items[itemIdx][field] = value;
    setPallets(newPallets);
  };

  const handleCreate = async () => {
    if (!newBatchName.trim() || pallets.length === 0 || pallets.some((p) => !p.pallet_id || p.items.length === 0)) {
      alert("Ensure batch name is set, all pallets have IDs, and each pallet has at least one item");
      return;
    }
    const token = localStorage.getItem("auth_token") || "";
    try {
      await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ batch_name: newBatchName, pallets }),
      });
      onCreateBatch();
    } catch (err) {
      console.error("Failed to create batch:", err);
      alert("Failed to create batch");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">Batch Name *</label>
        <input type="text" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} placeholder="e.g., Morning Delivery, Q1 Restock" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-navy">Pallets *</h3>
        {pallets.map((pallet, palletIdx) => {
          const usedProducts = pallet.items.map((i: any) => i.product_id);
          const availableProducts = allProducts.filter((p) => !usedProducts.includes(p.id));
          return (
            <div key={palletIdx} className="border border-border rounded-xl overflow-hidden">
              <div className="bg-navy-mid px-4 py-2 flex items-center justify-between">
                <span className="text-white font-semibold text-sm">Pallet {palletIdx + 1}</span>
                <button onClick={() => removePallet(palletIdx)} className="px-2 py-0.5 bg-red text-white rounded text-xs font-semibold hover:opacity-90">Remove</button>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Pallet ID *</label>
                    <input type="text" value={pallet.pallet_id} onChange={(e) => updatePallet(palletIdx, "pallet_id", e.target.value)} placeholder="e.g., PLT-001" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Supplier</label>
                    <input type="text" value={pallet.supplier_name || ""} readOnly className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-off-white text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Received Date</label>
                    <input type="date" value={pallet.received_date || ""} onChange={(e) => updatePallet(palletIdx, "received_date", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Storage Zone</label>
                    <input type="text" value={pallet.storage_zone || ""} onChange={(e) => updatePallet(palletIdx, "storage_zone", e.target.value)} placeholder="e.g., Zone A" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-2">Add Products to Pallet *</label>
                  <select onChange={(e) => { if (e.target.value) { addItemToPallet(palletIdx, e.target.value); e.target.value = ""; } }} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
                    <option value="">Choose a product...</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ""}{p.name}</option>
                    ))}
                  </select>
                </div>

                {pallet.items.length > 0 && (
                  <div className="bg-off-white rounded-lg p-3 space-y-2">
                    <label className="text-xs font-semibold text-navy">Items in Pallet ({pallet.items.length})</label>
                    {pallet.items.map((item: any, itemIdx: number) => {
                      const product = products.find((p) => p.id === item.product_id);
                      return (
                        <div key={itemIdx} className="bg-white border border-border rounded p-2 flex items-end gap-2">
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-navy">{getName(item.product_id)}</div>
                            <div className="text-xs text-muted">{getSku(item.product_id)}</div>
                          </div>
                          <input type="number" min="1" value={item.qty_units} onChange={(e) => updatePalletItem(palletIdx, itemIdx, "qty_units", parseInt(e.target.value) || 1)} className="w-20 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:border-accent-2" />
                          <button onClick={() => removeItemFromPallet(palletIdx, itemIdx)} className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button onClick={addPallet} className="w-full px-4 py-2 border border-accent-2 text-accent-2 rounded-lg font-semibold text-sm hover:bg-accent-2/5">➕ Add Pallet</button>
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-off-white">Cancel</button>
        <button onClick={handleCreate} disabled={!newBatchName.trim() || pallets.length === 0} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
          ✓ Create Batch
        </button>
      </div>
    </div>
  );
}
