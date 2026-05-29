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

interface BatchItem {
  productId: string;
  quantity: number;
  expiryDate: string;
}

interface Batch {
  id: string;
  name: string;
  items: BatchItem[];
  createdAt: string;
}

interface PalletBatch {
  id: string;
  pallet_id: string;
  qty_units: number;
  expiration_date_note?: string;
  placement_location?: string;
  supplier_name?: string;
  received_date?: string;
  temperature_log?: string;
  storage_zone?: string;
}

export function Inventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [palletBatchMap, setPalletBatchMap] = useState<Record<string, PalletBatch[]>>({});
  const { batches, setBatches, selectedBatchId, setSelectedBatchId, searchQuery, setSearchQuery, refreshBatchesFromDB } = useInventoryContext();
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

      const [productsRes, batchesRes] = await Promise.all([
        fetch("/api/products", { headers }),
        fetch("/api/batches", { headers }),
      ]);

      const productsData = productsRes.ok ? await productsRes.json() : [];
      const batchesData: PalletBatch[] = batchesRes.ok ? await batchesRes.json() : [];

      const qtyMap: Record<string, number> = {};
      const palletMap: Record<string, PalletBatch[]> = {};
      for (const b of (batchesData as any[])) {
        qtyMap[b.product_id] = (qtyMap[b.product_id] || 0) + (b.qty_units || 0);
        if (!palletMap[b.product_id]) palletMap[b.product_id] = [];
        palletMap[b.product_id].push(b);
      }
      setPalletBatchMap(palletMap);

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
    return currentBatch.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        return { ...product, batchQuantity: item.quantity, batchExpiryDate: item.expiryDate };
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

  const createNewBatch = async (batchItems: BatchItem[], batchName: string) => {
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
      setBatches(batches.map((b) => ({ ...b, items: b.items.filter((i) => i.productId !== id) })));
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
      <div className="bg-white rounded-2xl border border-border p-6">
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
      </div>

      {/* Search */}
      <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
        <span className="text-muted">🔍</span>
        <input type="text" placeholder="Search by SKU or name…" value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm" />
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="text-xs text-muted">Page {currentPage} of {Math.max(1, totalPages)} · {filteredBatchProducts.length} items</div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-border rounded text-xs font-semibold disabled:opacity-50">← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 2), currentPage + 1).map((page) => (
              <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 rounded text-xs font-semibold ${page === currentPage ? "bg-accent-2 text-white" : "border border-border hover:bg-off-white"}`}>{page}</button>
            ))}
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-border rounded text-xs font-semibold disabled:opacity-50">Next →</button>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-border">
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
      </div>

      {/* Extra Info Popup */}
      {extraInfoProduct && (
        <ExtraInfoModal
          product={extraInfoProduct}
          palletBatches={palletBatchMap[extraInfoProduct.id] || []}
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
          onEditBatch={(batchId, items) => { setBatches(batches.map((b) => b.id === batchId ? { ...b, items } : b)); setIsBatchModalOpen(false); }}
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
function ExtraInfoModal({ product, palletBatches, onClose }: { product: InventoryProduct & { batchQuantity: number }; palletBatches: PalletBatch[]; onClose: () => void }) {
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
                ["Manufacturer", "Frabelle Food Corp."],
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

          {/* Pallet Batches */}
          <div>
            <h3 className="text-xs font-bold text-muted uppercase letter-spacing-wider mb-3">
              Pallet Batches ({palletBatches.length})
            </h3>
            {palletBatches.length === 0 ? (
              <div className="text-center text-muted text-sm py-6 bg-off-white rounded-lg">No pallet batches recorded for this product</div>
            ) : (
              <div className="space-y-3">
                {palletBatches.map((pallet) => (
                  <div key={pallet.id} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy text-sm">Pallet: {pallet.pallet_id}</span>
                      <span className="px-2 py-0.5 bg-accent-2/10 text-accent-2 rounded text-xs font-bold">{pallet.qty_units} units</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {([
                        ["Supplier", pallet.supplier_name],
                        ["Received Date", pallet.received_date],
                        ["Expiry Note", pallet.expiration_date_note],
                        ["Placement", pallet.placement_location],
                        ["Storage Zone", pallet.storage_zone],
                        ["Temp Log", pallet.temperature_log],
                      ] as [string, string | undefined][]).map(([label, val]) => val ? (
                        <div key={label}>
                          <span className="text-muted font-semibold">{label}: </span>
                          <span className="text-navy">{val}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
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
function BatchModal({ batches, selectedBatchId, onSelectBatch, onDeleteBatch, onCreateBatch, onEditBatch, onClose, newBatchName, setNewBatchName, products, startCreating = false, onRefresh }: { batches: Batch[]; selectedBatchId: string; onSelectBatch: (id: string) => void; onDeleteBatch: (id: string) => void; onCreateBatch: (items: BatchItem[], batchName: string) => void; onEditBatch: (id: string, items: BatchItem[]) => void; onClose: () => void; newBatchName: string; setNewBatchName: (n: string) => void; products: InventoryProduct[]; startCreating?: boolean; onRefresh: () => void }) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(startCreating);
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">
            {isCreatingBatch ? "Create New Pallet Batch" : isEditingBatch ? "Edit Batch" : "Manage Batches"}
          </h2>
          <button onClick={() => { setIsCreatingBatch(false); setIsEditingBatch(false); setBatchItems([]); onClose(); }} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">
          {!isCreatingBatch && !isEditingBatch ? (
            <>
              <div className="space-y-2 mb-6">
                <h3 className="text-xs font-semibold text-muted uppercase mb-3">Available Batches</h3>
                {batches.map((batch) => (
                  <div key={batch.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedBatchId === batch.id ? "border-accent-2 bg-accent-2/10" : "border-border hover:bg-off-white"}`} onClick={() => onSelectBatch(batch.id)}>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-navy">{batch.name}</div>
                      <div className="text-xs text-muted">{batch.items.length} product{batch.items.length !== 1 ? "s" : ""}</div>
                    </div>
                    {batch.id !== "batch-all" && (
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingBatchId(batch.id); setIsEditingBatch(true); setBatchItems(batch.items); }} className="px-2 py-1 bg-gold text-white rounded text-xs font-semibold hover:opacity-90">✏</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteBatch(batch.id); }} className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90">🗑</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={() => { setIsCreatingBatch(true); setBatchItems([]); setNewBatchName(""); }} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90">➕ Create New Pallet Batch</button>
              </div>
            </>
          ) : (
            <CreateBatchForm
              newBatchName={newBatchName} setNewBatchName={setNewBatchName}
              batchItems={batchItems} setBatchItems={setBatchItems} isEditing={isEditingBatch}
              onCreateBatch={() => {
                if (isEditingBatch) { onEditBatch(editingBatchId, batchItems); setIsEditingBatch(false); }
                else { onCreateBatch(batchItems, newBatchName); setIsCreatingBatch(false); }
                setBatchItems([]);
                onRefresh();
              }}
              onCancel={() => { setIsCreatingBatch(false); setIsEditingBatch(false); setBatchItems([]); }}
              products={products}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CreateBatchForm ──────────────────────────────────────────────────────────
function CreateBatchForm({ newBatchName, setNewBatchName, batchItems, setBatchItems, onCreateBatch, onCancel, isEditing, products }: { newBatchName: string; setNewBatchName: (n: string) => void; batchItems: BatchItem[]; setBatchItems: (items: BatchItem[]) => void; onCreateBatch: () => void; onCancel: () => void; isEditing?: boolean; products: InventoryProduct[] }) {
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [palletData, setPalletData] = useState<Record<string, { pallet_id: string; expiration_date_note: string; placement_location: string; supplier_name: string; received_date: string; temperature_log: string; storage_zone: string }>>({});

  useEffect(() => {
    fetch("/api/products", { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` } })
      .then((r) => r.ok ? r.json() : []).then(setDbProducts).catch(() => {});
  }, []);

  const allProducts = dbProducts.length > 0 ? dbProducts : products.map((p) => ({ id: p.id, name: p.description, sku: p.sku }));

  const addItem = (productId: string) => {
    if (!productId || batchItems.some((i) => i.productId === productId)) { alert("Already added"); return; }
    const p = products.find((x) => x.id === productId);
    setBatchItems([...batchItems, { productId, quantity: p?.quantity ?? 0, expiryDate: p?.expiryDate ?? new Date().toISOString().split("T")[0] }]);
    setPalletData((prev) => ({ ...prev, [productId]: { pallet_id: "", expiration_date_note: "", placement_location: "", supplier_name: "", received_date: "", temperature_log: "", storage_zone: "" } }));
  };

  const removeItem = (productId: string) => {
    setBatchItems(batchItems.filter((i) => i.productId !== productId));
    setPalletData((prev) => { const d = { ...prev }; delete d[productId]; return d; });
  };

  const updateItem = (productId: string, field: "quantity" | "expiryDate", value: any) =>
    setBatchItems(batchItems.map((i) => i.productId === productId ? { ...i, [field]: value } : i));

  const updatePallet = (productId: string, field: string, value: string) =>
    setPalletData((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));

  const getName = (id: string) => dbProducts.find((p) => p.id === id)?.name || products.find((p) => p.id === id)?.description || "";
  const getSku = (id: string) => dbProducts.find((p) => p.id === id)?.sku || products.find((p) => p.id === id)?.sku || "";

  const handleCreate = async () => {
    if (!newBatchName.trim() || batchItems.length === 0) return;
    const token = localStorage.getItem("auth_token") || "";
    for (const item of batchItems) {
      const pd = palletData[item.productId];
      if (!pd?.pallet_id) { alert(`Please enter a Pallet ID for ${getName(item.productId)}`); return; }
      try {
        await fetch("/api/batches", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            product_id: item.productId,
            pallet_id: pd.pallet_id,
            qty_units: item.quantity,
            batch_name: newBatchName,          // ← persists the group name in DB
            expiration_date_note: pd.expiration_date_note || null,
            placement_location: pd.placement_location || null,
            supplier_name: pd.supplier_name || null,
            received_date: pd.received_date || null,
            temperature_log: pd.temperature_log || null,
            storage_zone: pd.storage_zone || null,
          }),
        });
      } catch (err) {
        console.error("Failed to save pallet batch:", err);
      }
    }
    onCreateBatch();
  };

  return (
    <div className="space-y-6">
      {/* Batch Name */}
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">Batch Name *</label>
        <input type="text" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} placeholder="e.g., Morning Delivery, Q1 Restock" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
      </div>

      {/* Product selector */}
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">Add Products *</label>
        <select onChange={(e) => { if (e.target.value) { addItem(e.target.value); e.target.value = ""; } }} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
          <option value="">Choose a product to add...</option>
          {allProducts.filter((p) => !batchItems.some((i) => i.productId === p.id)).map((p) => (
            <option key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ""}{p.name}</option>
          ))}
        </select>
      </div>

      {/* Per-product pallet form — card layout, fields matching table columns */}
      {batchItems.map((item) => {
        const pd = palletData[item.productId] || {};
        const product = products.find((p) => p.id === item.productId);
        const isReorder = (item.quantity <= (product?.reorderPoint ?? 300));
        return (
          <div key={item.productId} className="border border-border rounded-xl overflow-hidden">
            <div className="bg-navy-mid px-4 py-2 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold text-sm">{getName(item.productId)}</span>
                {getSku(item.productId) && <span className="text-muted text-xs ml-2">SKU: {getSku(item.productId)}</span>}
              </div>
              <button onClick={() => removeItem(item.productId)} className="px-2 py-0.5 bg-red text-white rounded text-xs font-semibold hover:opacity-90">Remove</button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              {/* Pallet ID — required DB identifier */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Pallet ID *</label>
                <input type="text" value={pd.pallet_id || ""} onChange={(e) => updatePallet(item.productId, "pallet_id", e.target.value)} placeholder="e.g., PLT-001" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
              </div>
              {/* Stock Qty — matches "Stock Qty" column, editable */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Stock Qty *</label>
                <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.productId, "quantity", parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
              </div>
              {/* Cost Per Item — matches "Cost Per Item" column, read-only */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Cost Per Item (₱)</label>
                <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-off-white text-muted">
                  ₱{(product?.unitPrice ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </div>
              </div>
              {/* Reorder Level — matches "Reorder Level" column, read-only */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Reorder Level</label>
                <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-off-white text-muted">
                  {product?.reorderPoint ?? 300}
                </div>
              </div>
              {/* Reorder Status — matches "Reorder" column, auto-computed */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Reorder Status</label>
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${isReorder ? "bg-orange-400 text-white" : "bg-green/20 text-green"}`}>
                  {isReorder ? "RE-ORDER" : "OK"}
                </span>
              </div>
              {/* Item Discontinued — matches "Item Discontinued?" column, read-only */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Item Discontinued?</label>
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold text-white ${product?.isDiscontinued ? "bg-red" : "bg-green"}`}>
                  {product?.isDiscontinued ? "YES" : "NO"}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-off-white">Cancel</button>
        <button onClick={handleCreate} disabled={!newBatchName.trim() || batchItems.length === 0} className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
          ✓ {isEditing ? "Save Changes" : "Create Pallet Batch"}
        </button>
      </div>
    </div>
  );
}
