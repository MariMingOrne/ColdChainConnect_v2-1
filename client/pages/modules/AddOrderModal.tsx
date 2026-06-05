import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Product, Customer } from "@shared/api";

interface OrderItem {
  product_id: string;
  qty_ordered: number;
}

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
  productStock: Record<string, number>;
  orderItems: OrderItem[];
  newCustomerId: string;
  onCustomerChange: (customerId: string) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onItemChange: (idx: number, field: "product_id" | "qty_ordered", value: string | number) => void;
  onCreateOrder: () => void;
  isCreating: boolean;
}

export function AddOrderModal({
  isOpen,
  onClose,
  customers,
  products,
  productStock,
  orderItems,
  newCustomerId,
  onCustomerChange,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onCreateOrder,
  isCreating,
}: AddOrderModalProps) {
  const [selectedTab, setSelectedTab] = useState<"products" | "cart">("products");

  const getImageUrl = (imageFilename?: string): string => {
    if (!imageFilename) return "/placeholder.svg";
    if (imageFilename.startsWith("http")) return imageFilename;
    return `/uploads/${imageFilename}`;
  };

  const getStockStatus = (productId: string): { stock: number; isOutOfStock: boolean } => {
    const stock = productStock[productId] || 0;
    return { stock, isOutOfStock: stock === 0 };
  };

  const getTotalQuantity = (): number => {
    return orderItems.reduce((sum, item) => sum + item.qty_ordered, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Add New Order</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">
            ×
          </button>
        </div>

        {/* Customer Selection */}
        <div className="bg-off-white px-6 py-3 border-b border-border">
          <label className="block text-xs font-semibold text-navy mb-2">Select Customer *</label>
          <select
            value={newCustomerId}
            onChange={(e) => onCustomerChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          >
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.store_name} — {c.location}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-white">
          <button
            onClick={() => setSelectedTab("products")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
              selectedTab === "products"
                ? "border-b-2 border-accent-2 text-accent-2"
                : "text-muted hover:text-navy"
            }`}
          >
            Browse Products
          </button>
          <button
            onClick={() => setSelectedTab("cart")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
              selectedTab === "cart"
                ? "border-b-2 border-accent-2 text-accent-2"
                : "text-muted hover:text-navy"
            }`}
          >
            Order Items ({getTotalQuantity()})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTab === "products" ? (
            <div className="grid grid-cols-2 gap-4">
              {products.map((product) => {
                const { stock, isOutOfStock } = getStockStatus(product.id);
                const isSelected = orderItems.some((item) => item.product_id === product.id);

                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        if (!isSelected) {
                          onAddItem();
                          setTimeout(() => {
                            const lastIdx = orderItems.length;
                            onItemChange(lastIdx, "product_id", product.id);
                          }, 0);
                        }
                      }
                    }}
                    disabled={isOutOfStock}
                    className={`p-4 rounded-lg border-2 transition ${
                      isOutOfStock
                        ? "border-red-300 bg-red-50 opacity-60 cursor-not-allowed"
                        : isSelected
                          ? "border-accent-2 bg-blue-50"
                          : "border-border bg-white hover:border-accent-2 hover:shadow-md cursor-pointer"
                    }`}
                  >
                    {/* Image */}
                    <div className="w-full aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                      <img
                        src={getImageUrl(product.image_filename)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <h3 className="font-semibold text-sm text-navy mb-1">{product.name}</h3>
                    <p className="text-lg font-bold text-accent-2 mb-2">₱{product.price}</p>

                    {/* Stock Status */}
                    <div
                      className={`px-2 py-1 rounded text-sm font-semibold text-center ${
                        isOutOfStock
                          ? "bg-red-200 text-red-700"
                          : stock < 10
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {isOutOfStock ? "Out of Stock" : `${stock} in stock`}
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="mt-2 px-2 py-1 bg-accent-2 text-white text-xs font-semibold rounded text-center">
                        ✓ Added to order
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {orderItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted text-sm">No items added yet. Browse products to add items.</p>
                </div>
              ) : (
                <>
                  {orderItems.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    const maxQty = productStock[item.product_id] || 0;

                    if (!product) return null;

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-4 border border-border rounded-lg bg-off-white"
                      >
                        <img
                          src={getImageUrl(product.image_filename)}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-navy">{product.name}</h4>
                          <p className="text-xs text-muted">₱{product.price}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={item.qty_ordered}
                            onChange={(e) =>
                              onItemChange(idx, "qty_ordered", parseInt(e.target.value) || 1)
                            }
                            className="w-16 px-2 py-1 border border-border rounded text-sm text-center focus:outline-none focus:border-accent-2"
                          />
                          <span className="text-xs text-muted">{maxQty} available</span>
                        </div>
                        <button
                          onClick={() => onRemoveItem(idx)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-off-white px-6 py-4 flex justify-between items-center border-t border-border rounded-b-2xl">
          <div className="text-sm">
            {getTotalQuantity() > 0 && (
              <p className="font-semibold text-navy">
                Total Items: <span className="text-accent-2">{getTotalQuantity()}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={onCreateOrder}
              disabled={isCreating || !newCustomerId || orderItems.length === 0}
              className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={16} />
              {isCreating ? "Creating…" : "Create Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
