import { Trash2 } from "lucide-react";
import { Product } from "@shared/api";
import { QuantityStepper } from "./QuantityStepper";

interface OrderItem {
  product_id: string;
  qty_ordered: number;
}

interface AgentOrderItemsProps {
  products: Product[];
  productStock: Record<string, number>;
  orderItems: OrderItem[];
  onItemChange: (idx: number, field: "product_id" | "qty_ordered", value: string | number) => void;
  onRemoveItem: (idx: number) => void;
  onBrowseProducts: () => void;
}

export function AgentOrderItems({
  products,
  productStock,
  orderItems,
  onItemChange,
  onRemoveItem,
  onBrowseProducts,
}: AgentOrderItemsProps) {
  if (orderItems.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-sm text-muted">No items added yet.</p>
        <button
          type="button"
          onClick={onBrowseProducts}
          className="px-4 py-2 rounded-full border border-accent-2 text-accent-2 text-sm font-semibold"
        >
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {orderItems.map((item, idx) => {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) return null;
        const maxQty = productStock[item.product_id] || 0;

        return (
          <li key={`${item.product_id}-${idx}`} className="flex items-center gap-3 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">{product.name}</p>
              <p className="text-xs text-muted">
                ₱{product.price} · {maxQty} available
              </p>
            </div>
            <QuantityStepper
              value={item.qty_ordered}
              min={1}
              max={maxQty}
              onChange={(qty) => onItemChange(idx, "qty_ordered", qty)}
            />
            <button
              type="button"
              onClick={() => onRemoveItem(idx)}
              aria-label="Remove item"
              className="p-2 text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
