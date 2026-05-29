import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useInventoryContext } from "../../context/InventoryContext";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Product } from "@shared/api";
import { Upload, RefreshCw } from "lucide-react";
import { ActionButtons } from "@/components/ActionButtons";

interface PricingProps {
  onBack?: () => void;
}

interface ProductForm {
  name: string;
  sku?: string;
  price: string;
  image_filename?: string;
  batch_tracking_enabled: boolean;
}

function StatsBox({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  const colorClass = color ? `text-${color}` : "text-accent-2";
  return (
    <div className="bg-white border border-border rounded-lg p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`font-rajdhani text-xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function ProductModal({
  title,
  formData,
  setFormData,
  onClose,
  onSave,
}: {
  title: string;
  formData: ProductForm;
  setFormData: (data: ProductForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setFormData({ ...formData, image_filename: data.filename });
    } catch (err) {
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Product Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., Chicken Breast"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">SKU Code</label>
            <input
              type="text"
              value={formData.sku || ""}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., 7700165"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Unit Price (₱) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-2">Product Image</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="flex-1 text-sm text-muted file:px-3 file:py-2 file:border file:border-border file:rounded-lg file:bg-white file:text-navy file:cursor-pointer hover:file:bg-off-white"
              />
              {uploadingImage && <span className="text-xs text-muted">Uploading...</span>}
            </div>
            {formData.image_filename && (
              <div className="mt-2 text-xs text-success">✓ {formData.image_filename}</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="batch_tracking"
              checked={formData.batch_tracking_enabled}
              onChange={(e) => setFormData({ ...formData, batch_tracking_enabled: e.target.checked })}
              className="w-4 h-4 accent-navy"
            />
            <label htmlFor="batch_tracking" className="text-sm font-semibold text-navy">
              Enable Batch Tracking
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90"
          >
            Save Product
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Product Details</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {product.image_filename && (
            <div className="w-full bg-off-white rounded-lg p-4 text-center">
              <img src={`/uploads/${product.image_filename}`} alt={product.name} className="max-w-full h-auto mx-auto max-h-64" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Product Name</label>
            <div className="text-sm text-navy font-semibold">{product.name}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">SKU Code</label>
            <div className="text-sm text-navy">{product.sku || "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Unit Price</label>
            <div className="text-sm text-navy font-semibold">₱{parseFloat(product.price ?? "0").toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Batch Tracking</label>
            <div className="text-sm"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${product.batch_tracking_enabled ? "badge-green" : "badge-red"}`}>{product.batch_tracking_enabled ? "Enabled" : "Disabled"}</span></div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end border-t border-border rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pricing({ onBack }: PricingProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Shared with Inventory via context
  const { searchQuery, setSearchQuery } = useInventoryContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductForm>({
    name: "",
    sku: "",
    price: "",
    image_filename: "",
    batch_tracking_enabled: true,
  });
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const itemsPerPage = 10;

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading products");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchProducts();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchProducts();
    }
  }, [token]);

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: "", sku: "", price: "", image_filename: "", batch_tracking_enabled: true });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku ?? "",
      price: product.price?.toString() ?? "",
      image_filename: product.image_filename ?? "",
      batch_tracking_enabled: product.batch_tracking_enabled ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price) return;
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to save product");
      const saved = await response.json();
      if (editingProduct) {
        setProducts(products.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setProducts([...products, saved]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("Failed to save product");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(products.filter((p) => p.id !== id));
    } catch {
      alert("Failed to delete product");
    }
  };

  const trackedCount = products.filter((p) => p.batch_tracking_enabled).length;
  const totalValue = products.reduce((sum, p) => sum + parseFloat(p.price ?? "0"), 0);
  const avgPrice = products.length > 0 ? totalValue / products.length : 0;

  if (isLoading) {
    return (
      <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 space-y-6">
        <div className="text-muted text-sm">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto scrollbar-visible space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
              Pricing Management
            </h1>
            <p className="text-xs text-muted mt-1">
              Manage product prices and batch tracking settings
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">
            ⬇ Import Excel
          </button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">
            ⬆ Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsBox label="Total Products" value={products.length.toString()} icon="🏷️" />
        <StatsBox label="Batch Tracked" value={trackedCount.toString()} icon="📦" />
        <StatsBox
          label="Avg Price"
          value={`₱${avgPrice.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`}
          icon="💰"
        />
        <StatsBox
          label="Untracked"
          value={(products.length - trackedCount).toString()}
          icon="⚠️"
          color="gold"
        />
      </div>

      {/* Search + Add + Delete Toggle */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <SearchFilterBar
          searchTerm={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          placeholder="Search by product name…"
        />
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 w-fit"
        >
          ➕ Add Product
        </button>
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto scrollbar-visible text-xs md:text-sm">
          <table className="w-full">
            <thead>
              <tr>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Status
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Image
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Product Name
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Unit Price
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap hidden md:table-cell">
                  Batch Tracking
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    {products.length === 0 ? "No products found" : "No results matching your search"}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-border hover:bg-off-white/50 transition-colors"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${product.batch_tracking_enabled ? "badge-green" : "badge-gold"
                          }`}
                      >
                        {product.batch_tracking_enabled ? "Tracked" : "Untracked"}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {product.image_filename ? (
                        <div className="w-10 h-10 bg-off-white rounded-lg overflow-hidden border border-border flex items-center justify-center">
                          <img src={`/uploads/${product.image_filename}`} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-off-white rounded-lg border border-border flex items-center justify-center text-muted text-xs">
                          —
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-navy font-semibold">
                      {product.name}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="stock-val stock-ok">
                        ₱{parseFloat(product.price ?? "0").toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${product.batch_tracking_enabled ? "badge-green" : "badge-red"
                        }`}>
                        {product.batch_tracking_enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ActionButtons
                        onView={() => setViewingProduct(product)}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => handleDelete(product.id)}
                        showDelete={showDeleteButtons}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Always Display */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-off-white/50">
          <div className="text-xs text-muted">
            Page {currentPage} of {Math.max(1, totalPages)} · {filteredProducts.length} products
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

      {/* View Modal */}
      {viewingProduct && (
        <ViewProductModal product={viewingProduct} onClose={() => setViewingProduct(null)} />
      )}

      {/* Modal */}
      {isModalOpen && (
        <ProductModal
          title={editingProduct ? "Edit Product" : "Add New Product"}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
