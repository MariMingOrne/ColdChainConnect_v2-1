import { useState, useEffect } from "react";
import { useInventoryContext } from "../context/InventoryContext";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

// REQ-INV-001: Product interface with all required fields
// QR modal camera removed - now available in Dispatch page only
interface InventoryProduct {
  id: string;
  sku: string; // SKU code
  description: string;
  unitPrice: number; // Positive decimal validation
  supplierId: string; // REQ-INV-002: Foreign key constraint
  weight: number; // kg - Positive decimal validation
  quantity: number;
  expiryDate: string;
  imageFilename?: string; // REQ-INV-009: Image management
  reorderPoint: number; // REQ-INV-008: Low-stock alert threshold
  lastUpdated: string;
}

interface BatchItem {
  productId: string;
  quantity: number;
  expiryDate: string;
}

interface Batch {
  id: string;
  name: string;
  items: BatchItem[]; // Now contains items with custom quantities and expiry dates
  createdAt: string;
}

export function Inventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryProduct[]>([
    {
      id: "1",
      sku: "7700165",
      description: "FF Bossing Hatdogs KingSize",
      unitPrice: 148.57,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 56,
      expiryDate: "2026-05-05",
      imageFilename: "ff-hatdogs-kingsize.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-28",
    },
    {
      id: "2",
      sku: "7700169",
      description: "FF Bossing Cheesedog KingSize",
      unitPrice: 156.19,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 38,
      expiryDate: "2026-05-18",
      imageFilename: "ff-cheesedog-kingsize.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-27",
    },
    {
      id: "3",
      sku: "7700160",
      description: "FF Bossing Chicken Franks King",
      unitPrice: 163.81,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 130,
      expiryDate: "2026-06-10",
      imageFilename: "ff-chicken-franks.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-26",
    },
    {
      id: "4",
      sku: "7702039",
      description: "FF Bossing Cheesedogs",
      unitPrice: 36.19,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 148,
      expiryDate: "2026-06-22",
      imageFilename: "ff-cheesedogs.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-25",
    },
    {
      id: "5",
      sku: "7700181",
      description: "FF Bossing Cheesedog Footlong",
      unitPrice: 153.33,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 148,
      expiryDate: "2026-07-01",
      imageFilename: "ff-cheesedog-footlong.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-24",
    },
    {
      id: "6",
      sku: "7702041",
      description: "FF Bossing Chicken Hd Regular",
      unitPrice: 35.34,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 73,
      expiryDate: "2026-06-30",
      imageFilename: "ff-chicken-hd-regular.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-23",
    },
    {
      id: "7",
      sku: "7702031",
      description: "FF Bossing Hungarian Sausage w/Cheese",
      unitPrice: 129.32,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 14,
      expiryDate: "2026-05-12",
      imageFilename: "ff-hungarian-sausage.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-22",
    },
    {
      id: "8",
      sku: "770218",
      description: "McCain Fries",
      unitPrice: 500.0,
      supplierId: "Frabelle Food Corp",
      weight: 12.0,
      quantity: 199,
      expiryDate: "2026-08-15",
      imageFilename: "mccain-fries.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-21",
    },
  ]);

  // Shared with Pricing via context
  const { batches, setBatches, selectedBatchId, setSelectedBatchId, searchQuery, setSearchQuery } = useInventoryContext();
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProductsFromApi = async () => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const response = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Map API products to InventoryProduct shape
        const mapped: InventoryProduct[] = data.map((p: any) => ({
          id: p.id,
          sku: p.sku || p.name,
          description: p.name,
          unitPrice: parseFloat(p.price) || 0,
          supplierId: "",
          weight: 0,
          quantity: 0,
          expiryDate: new Date().toISOString().split("T")[0],
          imageFilename: p.image_filename,
          reorderPoint: 0,
          lastUpdated: p.updated_at || new Date().toISOString(),
        }));
        setProducts(mapped);
      }
    } catch (err) {
      console.error("Failed to load products from API:", err);
    }
  };

  // Fetch products from API on mount
  useEffect(() => {
    fetchProductsFromApi();
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [qrProduct, setQrProduct] = useState<InventoryProduct | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [startBatchCreation, setStartBatchCreation] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState<InventoryProduct>({
    id: "",
    sku: "",
    description: "",
    unitPrice: 0,
    supplierId: "",
    weight: 0,
    quantity: 0,
    expiryDate: "",
    imageFilename: "",
    reorderPoint: 100,
    lastUpdated: new Date().toISOString().split("T")[0],
  });

  const itemsPerPage = 10;

  // Get current batch
  const currentBatch = batches.find((b) => b.id === selectedBatchId);

  // Get products for current batch with batch-specific quantities and expiry dates
  const getBatchProducts = (): (InventoryProduct & { batchQuantity: number; batchExpiryDate: string })[] => {
    // "All Products" batch — show every product
    if (!currentBatch || currentBatch.id === "batch-all") {
      return products.map((p) => ({
        ...p,
        batchQuantity: p.quantity,
        batchExpiryDate: p.expiryDate,
      }));
    }
    return currentBatch.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        return {
          ...product,
          batchQuantity: item.quantity,
          batchExpiryDate: item.expiryDate,
        };
      })
      .filter((item) => item !== null) as (InventoryProduct & { batchQuantity: number; batchExpiryDate: string })[];
  };

  // Get all products for the right panel
  const getAllProducts = (): InventoryProduct[] => {
    return products;
  };

  const batchProducts = getBatchProducts();
  const allProducts = getAllProducts();

  // Filter batch products by search
  const filteredBatchProducts = batchProducts.filter((product) => {
    return (
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Pagination for batch products
  const totalPages = Math.ceil(filteredBatchProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBatchProducts = filteredBatchProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Get unique suppliers
  const suppliers = Array.from(new Set(products.map((p) => p.supplierId))).sort();

  // Batch management functions
  const createNewBatch = (batchItems: BatchItem[]) => {
    if (!newBatchName.trim()) {
      alert("Please enter a batch name");
      return;
    }

    if (batchItems.length === 0) {
      alert("Please select at least one product for this batch");
      return;
    }

    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      name: newBatchName,
      items: batchItems,
      createdAt: new Date().toISOString(),
    };

    setBatches([...batches, newBatch]);
    setSelectedBatchId(newBatch.id);
    setNewBatchName("");
    setIsBatchModalOpen(false);
  };

  const deleteBatch = (batchId: string) => {
    if (batchId === "batch-all") {
      alert("Cannot delete the default 'All Products' batch");
      return;
    }

    if (confirm("Are you sure you want to delete this batch?")) {
      setBatches(batches.filter((b) => b.id !== batchId));
      if (selectedBatchId === batchId) {
        const firstBatch = batches.find((b) => b.id !== batchId);
        setSelectedBatchId(firstBatch?.id || "batch-all");
      }
    }
  };

  const removeProductFromBatch = (productId: string) => {
    if (!currentBatch) return;

    setBatches(
      batches.map((b) =>
        b.id === currentBatch.id
          ? { ...b, items: b.items.filter((item) => item.productId !== productId) }
          : b
      )
    );
  };

  const addProductToBatch = (productId: string) => {
    if (!currentBatch) return;

    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const itemExists = currentBatch.items.some((item) => item.productId === productId);
    if (!itemExists) {
      setBatches(
        batches.map((b) =>
          b.id === currentBatch.id
            ? {
                ...b,
                items: [
                  ...b.items,
                  {
                    productId,
                    quantity: product.quantity,
                    expiryDate: product.expiryDate,
                  },
                ],
              }
            : b
        )
      );
    }
  };

  // Product management functions
  const handleSaveProduct = async () => {
    if (formData.unitPrice <= 0) {
      alert("Unit price must be a positive number");
      return;
    }
    if (formData.weight <= 0) {
      alert("Weight must be a positive number");
      return;
    }
    if (!formData.supplierId) {
      alert("Please select a valid supplier");
      return;
    }

    try {
      const token = localStorage.getItem("auth_token") || "";

      if (selectedProduct) {
        // Update existing product
        const response = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.description,
            sku: formData.sku,
            price: formData.unitPrice,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update product");
        }
      } else {
        // Create new product
        const response = await fetch("/api/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.description,
            sku: formData.sku,
            price: formData.unitPrice,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create product");
        }

        const newProduct = await response.json();
        // Add new product to current batch
        if (currentBatch) {
          addProductToBatch(newProduct.id);
        }
      }

      // Refetch products from database
      await fetchProductsFromApi();
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save product:", err);
      alert("Failed to save product. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const response = await fetch(`/api/products/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error("Failed to delete product");
        }

        setProducts(products.filter((p) => p.id !== id));
        // Remove from all batches
        setBatches(
          batches.map((b) => ({
            ...b,
            items: b.items.filter((item) => item.productId !== id),
          }))
        );

        // Refetch products from database
        await fetchProductsFromApi();
      } catch (err) {
        console.error("Failed to delete product:", err);
        alert("Failed to delete product. Please try again.");
      }
    }
  };

  const handleEdit = (product: InventoryProduct) => {
    setSelectedProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleViewQR = (product: InventoryProduct) => {
    setQrProduct(product);
  };

  const resetForm = () => {
    setFormData({
      id: "",
      sku: "",
      description: "",
      unitPrice: 0,
      supplierId: "",
      weight: 0,
      quantity: 0,
      expiryDate: "",
      imageFilename: "",
      reorderPoint: 100,
      lastUpdated: new Date().toISOString().split("T")[0],
    });
    setSelectedProduct(null);
  };

  const getStockStatus = (product: InventoryProduct) => {
    if (product.quantity < product.reorderPoint) {
      return { status: "critical", label: "Low Stock" };
    }
    if (product.quantity < product.reorderPoint * 0.8) {
      return { status: "warning", label: "Warning" };
    }
    return { status: "ok", label: "OK" };
  };

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      return { status: "expired", label: "Expired", days: daysUntilExpiry };
    }
    if (daysUntilExpiry <= 7) {
      return { status: "expiring", label: "Expiring Soon", days: daysUntilExpiry };
    }
    return { status: "ok", label: "Valid", days: daysUntilExpiry };
  };

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto scrollbar-visible space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-off-white rounded-lg transition-colors"
            title="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-navy" />
          </button>
          <div>
            <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
              Inventory Management
            </h1>
            <p className="text-xs text-muted mt-1">
              Track, manage, and monitor all frozen goods SKUs
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">
            ⬇ Import Excel
          </button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">
            ⬆ Export Excel
          </button>
        </div>
      </div>

      {/* Batch Selector and Controls */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-navy">Current Batch</label>
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity w-fit"
            >
              📦 {currentBatch?.name || "Select Batch"}
            </button>
          </div>
          <button
            onClick={() => {
              setNewBatchName("");
              setStartBatchCreation(true);
              setIsBatchModalOpen(true);
            }}
            className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity w-fit"
          >
            ➕ Create New Batch
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
          <span className="text-muted">🔍</span>
          <input
            type="text"
            placeholder="Search by SKU, description…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm"
          />
        </div>
      </div>

      {/* Inventory Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsBox
          label="Total Items"
          value={batchProducts.length.toString()}
          icon="📦"
        />
        <StatsBox
          label="Low Stock"
          value={batchProducts.filter((p) => p.quantity < p.reorderPoint).length.toString()}
          icon="⚠️"
          color="red"
        />
        <StatsBox
          label="Expiring Soon"
          value={batchProducts.filter((p) => {
            const status = getExpiryStatus(p.expiryDate);
            return status.status === "expiring" || status.status === "expired";
          }).length.toString()}
          icon="🕐"
          color="gold"
        />
        <StatsBox
          label="Total Value"
          value={`₱${batchProducts.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`}
          icon="💰"
        />
      </div>

      {/* Batch Table */}
      <div>
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto scrollbar-visible text-xs md:text-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      Status
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      SKU Code
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap hidden sm:table-cell">
                      Description
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      Qty
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap hidden lg:table-cell">
                      Expiry
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBatchProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted">
                        No products in this batch
                      </td>
                    </tr>
                  ) : (
                    paginatedBatchProducts.map((product) => {
                      const stockStatus = getStockStatus(product);
                      const expiryStatus = getExpiryStatus(product.expiryDate);
                      return (
                        <tr
                          key={product.id}
                          className="border-b border-border hover:bg-off-white/50 transition-colors"
                        >
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold badge-${
                                expiryStatus.status === "expired"
                                  ? "red"
                                  : expiryStatus.status === "expiring"
                                    ? "gold"
                                    : "green"
                              }`}
                            >
                              {expiryStatus.status === "expired"
                                ? "Expired"
                                : expiryStatus.status === "expiring"
                                  ? "Almost Expiry"
                                  : "Not"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-navy font-semibold whitespace-nowrap">
                            {product.sku}
                          </td>
                          <td className="px-3 py-3 text-navy hidden sm:table-cell max-w-xs truncate">
                            {product.description}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`px-2 py-1 rounded text-xs font-bold text-white ${
                                  product.batchQuantity < product.reorderPoint
                                    ? "bg-red"
                                    : product.batchQuantity < product.reorderPoint * 0.8
                                      ? "bg-gold"
                                      : "bg-green"
                                }`}
                              >
                                {product.batchQuantity}
                              </span>
                              <span className="text-xs text-muted">
                                {product.batchQuantity < product.reorderPoint
                                  ? "Critical"
                                  : product.batchQuantity < product.reorderPoint * 0.8
                                    ? "Low Stock"
                                    : "Adequate"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-navy hidden lg:table-cell whitespace-nowrap">
                            {product.batchExpiryDate}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleViewQR(product)}
                                className="px-2 py-1 bg-white border border-border text-navy rounded text-xs font-semibold hover:bg-off-white"
                                title="View QR Code"
                              >
                                ⬜
                              </button>
                              <button
                                onClick={() => handleEdit(product)}
                                className="px-2 py-1 bg-gold text-white rounded text-xs font-semibold hover:opacity-90"
                                title="Edit"
                              >
                                ✏
                              </button>
                              <button
                                onClick={() => removeProductFromBatch(product.id)}
                                className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90"
                                title="Remove from batch"
                              >
                                ✕
                              </button>
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="text-xs text-muted">
                Page {currentPage} of {totalPages} · {filteredBatchProducts.length} items
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-border rounded text-xs font-semibold disabled:opacity-50"
                >
                  ← Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, currentPage - 2), currentPage + 1)
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        page === currentPage
                          ? "bg-accent-2 text-white"
                          : "border border-border hover:bg-off-white"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-border rounded text-xs font-semibold disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={selectedProduct ? "Edit Product" : "Add New Product"}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          onSave={handleSaveProduct}
          suppliers={suppliers}
          formData={formData}
          setFormData={setFormData}
        />
      )}

      {/* Batch Selector Modal */}
      {isBatchModalOpen && (
        <BatchModal
          batches={batches}
          selectedBatchId={selectedBatchId}
          onSelectBatch={(batchId) => {
            setSelectedBatchId(batchId);
            setIsBatchModalOpen(false);
          }}
          onDeleteBatch={deleteBatch}
          onCreateBatch={createNewBatch}
          onEditBatch={(batchId, updatedItems) => {
            setBatches(
              batches.map((b) =>
                b.id === batchId ? { ...b, items: updatedItems } : b
              )
            );
            setIsBatchModalOpen(false);
          }}
          onClose={() => {
            setIsBatchModalOpen(false);
            setStartBatchCreation(false);
          }}
          newBatchName={newBatchName}
          setNewBatchName={setNewBatchName}
          products={products}
          startCreating={startBatchCreation}
        />
      )}

      {/* QR Code Modal */}
      {qrProduct && (
        <QRModal product={qrProduct} onClose={() => setQrProduct(null)} />
      )}
    </div>
  );
}

// Stats Box Component
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
    <div className={`bg-white border border-border rounded-lg p-3 text-center`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`font-rajdhani text-xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

// Modal Component
function Modal({
  title,
  onClose,
  onSave,
  suppliers,
  formData,
  setFormData,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  suppliers: string[];
  formData: InventoryProduct;
  setFormData: (data: InventoryProduct) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-white hover:opacity-70 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                SKU Code *
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                placeholder="e.g., 7700165"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Supplier *
              </label>
              <select
                value={formData.supplierId}
                onChange={(e) =>
                  setFormData({ ...formData, supplierId: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Description *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="Product description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Unit Price (₱) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.weight}
                onChange={(e) =>
                  setFormData({ ...formData, weight: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Reorder Point *
              </label>
              <input
                type="number"
                min="0"
                value={formData.reorderPoint}
                onChange={(e) =>
                  setFormData({ ...formData, reorderPoint: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Image Filename
              </label>
              <input
                type="text"
                value={formData.imageFilename || ""}
                onChange={(e) =>
                  setFormData({ ...formData, imageFilename: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                placeholder="product.jpg"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border">
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

// Batch Selector Modal Component
function BatchModal({
  batches,
  selectedBatchId,
  onSelectBatch,
  onDeleteBatch,
  onCreateBatch,
  onEditBatch,
  onClose,
  newBatchName,
  setNewBatchName,
  products,
  startCreating = false,
}: {
  batches: Batch[];
  selectedBatchId: string;
  onSelectBatch: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
  onCreateBatch: (items: BatchItem[]) => void;
  onEditBatch: (batchId: string, items: BatchItem[]) => void;
  onClose: () => void;
  newBatchName: string;
  setNewBatchName: (name: string) => void;
  products: InventoryProduct[];
  startCreating?: boolean;
}) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(startCreating);
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string>("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">
            {isCreatingBatch ? "Create New Batch" : isEditingBatch ? "Edit Batch" : "Manage Batches"}
          </h2>
          <button
            onClick={() => {
              setIsCreatingBatch(false);
              setIsEditingBatch(false);
              setBatchItems([]);
              onClose();
            }}
            className="text-white hover:opacity-70 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {!isCreatingBatch && !isEditingBatch ? (
            <>
              {/* Existing Batches */}
              <div className="space-y-2 mb-6">
                <h3 className="text-xs font-semibold text-muted uppercase mb-3">
                  Available Batches
                </h3>
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedBatchId === batch.id
                        ? "border-accent-2 bg-accent-2/10"
                        : "border-border hover:bg-off-white"
                    }`}
                    onClick={() => onSelectBatch(batch.id)}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-navy">{batch.name}</div>
                      <div className="text-xs text-muted">
                        {batch.items.length} product{batch.items.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {batch.id !== "batch-all" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBatchId(batch.id);
                              setIsEditingBatch(true);
                              setBatchItems(batch.items);
                            }}
                            className="px-2 py-1 bg-gold text-white rounded text-xs font-semibold hover:opacity-90"
                            title="Edit batch"
                          >
                            ✏
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBatch(batch.id);
                            }}
                            className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90"
                            title="Delete batch"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Create New Batch Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setIsCreatingBatch(true);
                    setBatchItems([]);
                    setNewBatchName("");
                  }}
                  className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  ➕ Create New Batch
                </button>
              </div>
            </>
          ) : (
            <CreateBatchForm
              newBatchName={newBatchName}
              setNewBatchName={setNewBatchName}
              batchItems={batchItems}
              setBatchItems={setBatchItems}
              isEditing={isEditingBatch}
              onCreateBatch={() => {
                if (isEditingBatch) {
                  onEditBatch(editingBatchId, batchItems);
                  setIsEditingBatch(false);
                } else {
                  onCreateBatch(batchItems);
                  setIsCreatingBatch(false);
                }
                setBatchItems([]);
              }}
              onCancel={() => {
                setIsCreatingBatch(false);
                setIsEditingBatch(false);
                setBatchItems([]);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Search Products Modal Component
function SearchProductsModal({
  onClose,
  onSelectProduct,
  selectedProductIds,
}: {
  onClose: () => void;
  onSelectProduct: (productId: string) => void;
  selectedProductIds: string[];
}) {
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products", {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDbProducts(data);
          setFilteredProducts(data);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = dbProducts.filter(
      (p) =>
        (p.name?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.price?.toString().includes(query)) &&
        !selectedProductIds.includes(p.id)
    );
    setFilteredProducts(filtered);
  }, [searchQuery, dbProducts, selectedProductIds]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">Search Products</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
            <span className="text-muted">🔍</span>
            <input
              type="text"
              placeholder="Search by name, SKU, or price…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto scrollbar-visible max-h-[50vh]">
            {isLoading ? (
              <div className="text-center text-muted py-4">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-muted py-4">No products found</div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      onSelectProduct(product.id);
                      setSearchQuery("");
                    }}
                    className="w-full text-left p-3 border border-border rounded-lg hover:bg-off-white transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-navy text-sm">{product.name}</div>
                      <div className="text-xs text-muted">{product.sku && `SKU: ${product.sku}`}</div>
                    </div>
                    <div className="text-accent-2 font-semibold text-sm">₱{product.price}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end border-t border-border">
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

// Create Batch Form Component
function CreateBatchForm({
  newBatchName,
  setNewBatchName,
  batchItems,
  setBatchItems,
  onCreateBatch,
  onCancel,
  isEditing,
}: {
  newBatchName: string;
  setNewBatchName: (name: string) => void;
  batchItems: BatchItem[];
  setBatchItems: (items: BatchItem[]) => void;
  onCreateBatch: () => void;
  onCancel: () => void;
  isEditing?: boolean;
}) {
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Fallback to local products if db fetch fails
  const [products, setProducts] = useState<InventoryProduct[]>([
    {
      id: "1",
      sku: "7700165",
      description: "FF Bossing Hatdogs KingSize",
      unitPrice: 148.57,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 56,
      expiryDate: "2026-05-05",
      imageFilename: "ff-hatdogs-kingsize.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-28",
    },
    {
      id: "2",
      sku: "7700169",
      description: "FF Bossing Cheesedog KingSize",
      unitPrice: 156.19,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 38,
      expiryDate: "2026-05-18",
      imageFilename: "ff-cheesedog-kingsize.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-27",
    },
    {
      id: "3",
      sku: "7700160",
      description: "FF Bossing Chicken Franks King",
      unitPrice: 163.81,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 130,
      expiryDate: "2026-06-10",
      imageFilename: "ff-chicken-franks.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-26",
    },
    {
      id: "4",
      sku: "7702039",
      description: "FF Bossing Cheesedogs",
      unitPrice: 36.19,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 148,
      expiryDate: "2026-06-22",
      imageFilename: "ff-cheesedogs.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-25",
    },
    {
      id: "5",
      sku: "7700181",
      description: "FF Bossing Cheesedog Footlong",
      unitPrice: 153.33,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 148,
      expiryDate: "2026-07-01",
      imageFilename: "ff-cheesedog-footlong.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-24",
    },
    {
      id: "6",
      sku: "7702041",
      description: "FF Bossing Chicken Hd Regular",
      unitPrice: 35.34,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 73,
      expiryDate: "2026-06-30",
      imageFilename: "ff-chicken-hd-regular.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-23",
    },
    {
      id: "7",
      sku: "7702031",
      description: "FF Bossing Hungarian Sausage w/Cheese",
      unitPrice: 129.32,
      supplierId: "Frabelle Food Corp",
      weight: 1.0,
      quantity: 14,
      expiryDate: "2026-05-12",
      imageFilename: "ff-hungarian-sausage.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-22",
    },
    {
      id: "8",
      sku: "770218",
      description: "McCain Fries",
      unitPrice: 500.0,
      supplierId: "Frabelle Food Corp",
      weight: 12.0,
      quantity: 199,
      expiryDate: "2026-08-15",
      imageFilename: "mccain-fries.jpg",
      reorderPoint: 100,
      lastUpdated: "2026-04-21",
    },
  ]);

  useEffect(() => {
    const fetchDbProducts = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/products", {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDbProducts(data);
        }
      } catch (error) {
        console.error("Failed to fetch products from database:", error);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    fetchDbProducts();
  }, []);

  const addItemToBatch = (productId: string) => {
    // Use dbProducts (from API) first, fall back to local products
    const apiProduct = dbProducts.find((p) => p.id === productId);
    const localProduct = products.find((p) => p.id === productId);
    if (!apiProduct && !localProduct) return;

    const alreadyAdded = batchItems.some((item) => item.productId === productId);
    if (alreadyAdded) {
      alert("This product is already in the batch");
      return;
    }

    setBatchItems([
      ...batchItems,
      {
        productId,
        quantity: apiProduct ? 0 : (localProduct?.quantity ?? 0),
        expiryDate: apiProduct ? new Date().toISOString().split("T")[0] : (localProduct?.expiryDate ?? ""),
      },
    ]);
  };

  const removeItemFromBatch = (productId: string) => {
    setBatchItems(batchItems.filter((item) => item.productId !== productId));
  };

  const updateBatchItem = (productId: string, field: "quantity" | "expiryDate", value: any) => {
    setBatchItems(
      batchItems.map((item) =>
        item.productId === productId ? { ...item, [field]: value } : item
      )
    );
  };

  const getProductName = (productId: string) => {
    return dbProducts.find((p) => p.id === productId)?.name ||
           products.find((p) => p.id === productId)?.description || "";
  };

  const getProductSku = (productId: string) => {
    return dbProducts.find((p) => p.id === productId)?.sku ||
           products.find((p) => p.id === productId)?.sku || "";
  };

  return (
    <div className="space-y-6">
      {/* Batch Name */}
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">
          Batch Name *
        </label>
        <input
          type="text"
          value={newBatchName}
          onChange={(e) => setNewBatchName(e.target.value)}
          placeholder="e.g., Morning Delivery, Q1 Restock"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
        />
      </div>

      {/* Product Selection */}
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">
          Select Products to Add *
        </label>
        <div className="flex gap-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                addItemToBatch(e.target.value);
                e.target.value = "";
              }
            }}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          >
            <option value="">Choose a product to add...</option>
            {(dbProducts.length > 0 ? dbProducts : products)
              .filter((p) => !batchItems.some((item) => item.productId === p.id))
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku ? `${product.sku} - ` : ""}{product.name || product.description}
                </option>
              ))}
          </select>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 whitespace-nowrap"
          >
            🔍 Search
          </button>
        </div>
      </div>

      {/* Selected Items Table */}
      {batchItems.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-navy mb-3">Batch Items</h3>
          <div className="border border-border rounded-lg overflow-x-auto scrollbar-visible">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-navy-mid border-b border-border">
                  <th className="px-3 py-2 text-left text-muted font-bold">SKU</th>
                  <th className="px-3 py-2 text-left text-muted font-bold">Description</th>
                  <th className="px-3 py-2 text-left text-muted font-bold">Quantity</th>
                  <th className="px-3 py-2 text-left text-muted font-bold">Expiry Date</th>
                  <th className="px-3 py-2 text-left text-muted font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchItems.map((item) => (
                  <tr key={item.productId} className="border-b border-border hover:bg-off-white/50">
                    <td className="px-3 py-2 font-semibold text-navy">
                      {getProductSku(item.productId)}
                    </td>
                    <td className="px-3 py-2 text-navy max-w-xs truncate">
                      {getProductName(item.productId)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateBatchItem(
                            item.productId,
                            "quantity",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="w-16 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:border-accent-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) =>
                          updateBatchItem(item.productId, "expiryDate", e.target.value)
                        }
                        className="w-28 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:border-accent-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeItemFromBatch(item.productId)}
                        className="px-2 py-1 bg-red text-white rounded text-xs font-semibold hover:opacity-90"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-muted">
            Total items in batch: {batchItems.length}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-off-white"
        >
          Cancel
        </button>
        <button
          onClick={onCreateBatch}
          disabled={!newBatchName.trim() || batchItems.length === 0}
          className="px-4 py-2 bg-green text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ✓ Create Batch
        </button>
      </div>

      {/* Search Products Modal */}
      {isSearchOpen && (
        <SearchProductsModal
          onClose={() => setIsSearchOpen(false)}
          onSelectProduct={(productId) => {
            addItemToBatch(productId);
            setIsSearchOpen(false);
          }}
          selectedProductIds={batchItems.map((item) => item.productId)}
        />
      )}
    </div>
  );
}

// QR Code Modal Component
function QRModal({
  product,
  onClose,
}: {
  product: InventoryProduct;
  onClose: () => void;
}) {
  const qrCodeId = `QR-${product.sku}-${product.id}`;

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=300,height=400");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code - ${product.sku}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; text-align: center; }
            .qr-container { border: 2px solid #000; padding: 20px; margin-bottom: 20px; }
            svg { max-width: 200px; }
            .info { font-size: 12px; margin-top: 10px; }
            .label { font-weight: bold; font-size: 14px; margin-bottom: 10px; }
            @media print { body { margin: 0; padding: 5px; } }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="label">${product.sku}</div>
            <svg width="200" height="200" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="80" height="80" fill="white" />
              <rect x="5" y="5" width="28" height="28" rx="3" fill="#060761" />
              <rect x="9" y="9" width="20" height="20" rx="2" fill="white" />
              <rect x="13" y="13" width="12" height="12" rx="1" fill="#060761" />
              <rect x="47" y="5" width="28" height="28" rx="3" fill="#060761" />
              <rect x="51" y="9" width="20" height="20" rx="2" fill="white" />
              <rect x="55" y="13" width="12" height="12" rx="1" fill="#060761" />
              <rect x="5" y="47" width="28" height="28" rx="3" fill="#060761" />
              <rect x="9" y="51" width="20" height="20" rx="2" fill="white" />
              <rect x="13" y="55" width="12" height="12" rx="1" fill="#060761" />
              <rect x="41" y="41" width="6" height="6" fill="#060761" />
              <rect x="49" y="41" width="6" height="6" fill="#060761" />
              <rect x="57" y="41" width="6" height="6" fill="#060761" />
              <rect x="65" y="41" width="6" height="6" fill="#060761" />
              <rect x="41" y="49" width="6" height="6" fill="#060761" />
              <rect x="57" y="49" width="6" height="6" fill="#060761" />
              <rect x="41" y="57" width="6" height="6" fill="#060761" />
              <rect x="49" y="57" width="6" height="6" fill="#060761" />
              <rect x="65" y="57" width="6" height="6" fill="#060761" />
              <rect x="41" y="65" width="6" height="6" fill="#060761" />
              <rect x="57" y="65" width="6" height="6" fill="#060761" />
              <rect x="65" y="65" width="6" height="6" fill="#060761" />
            </svg>
            <div class="info">
              <div><strong>${product.description}</strong></div>
              <div>QR ID: ${qrCodeId}</div>
              <div>Expiry: ${product.expiryDate}</div>
            </div>
          </div>
          <script>window.print(); window.close();</script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-rajdhani text-lg font-bold text-navy">
            QR Code - {product.sku}
          </h2>
          <button
            onClick={onClose}
            className="text-navy hover:opacity-70 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="bg-off-white p-6 rounded-lg flex flex-col items-center gap-4 mb-6 border-2 border-navy/20">
          {/* QR Code Placeholder SVG */}
          <svg
            width="200"
            height="200"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="80" height="80" fill="white" />
            {/* Top-left position marker */}
            <rect x="5" y="5" width="28" height="28" rx="3" fill="#060761" />
            <rect x="9" y="9" width="20" height="20" rx="2" fill="white" />
            <rect x="13" y="13" width="12" height="12" rx="1" fill="#060761" />
            {/* Top-right position marker */}
            <rect x="47" y="5" width="28" height="28" rx="3" fill="#060761" />
            <rect x="51" y="9" width="20" height="20" rx="2" fill="white" />
            <rect x="55" y="13" width="12" height="12" rx="1" fill="#060761" />
            {/* Bottom-left position marker */}
            <rect x="5" y="47" width="28" height="28" rx="3" fill="#060761" />
            <rect x="9" y="51" width="20" height="20" rx="2" fill="white" />
            <rect x="13" y="55" width="12" height="12" rx="1" fill="#060761" />
            {/* Data area */}
            <rect x="41" y="41" width="6" height="6" fill="#060761" />
            <rect x="49" y="41" width="6" height="6" fill="#060761" />
            <rect x="57" y="41" width="6" height="6" fill="#060761" />
            <rect x="65" y="41" width="6" height="6" fill="#060761" />
            <rect x="41" y="49" width="6" height="6" fill="#060761" />
            <rect x="57" y="49" width="6" height="6" fill="#060761" />
            <rect x="41" y="57" width="6" height="6" fill="#060761" />
            <rect x="49" y="57" width="6" height="6" fill="#060761" />
            <rect x="65" y="57" width="6" height="6" fill="#060761" />
            <rect x="41" y="65" width="6" height="6" fill="#060761" />
            <rect x="57" y="65" width="6" height="6" fill="#060761" />
            <rect x="65" y="65" width="6" height="6" fill="#060761" />
          </svg>
          <div className="text-xs text-muted font-mono">{qrCodeId}</div>
        </div>

        <div className="space-y-2 mb-6 bg-navy/5 p-4 rounded-lg">
          <div className="flex justify-between">
            <span className="text-xs text-muted font-semibold">SKU:</span>
            <span className="text-sm font-semibold text-navy">{product.sku}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted font-semibold">Description:</span>
            <span className="text-sm font-semibold text-navy max-w-xs text-right">
              {product.description}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted font-semibold">Quantity:</span>
            <span className="text-sm font-semibold text-navy">{product.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted font-semibold">Expiry:</span>
            <span className="text-sm font-semibold text-navy">{product.expiryDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted font-semibold">Unit Price:</span>
            <span className="text-sm font-semibold text-navy">
              ₱{product.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted text-center">
            ⚠️ Print and attach this QR code to the shipment for tracking
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-off-white"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2"
            >
              🖨 Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
