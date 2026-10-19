import { Product } from "@shared/api";

interface OrderItem {
  product_id: string;
  qty_ordered: number;
}

interface AgentProductPickerProps {
  products: Product[];
  productStock: Record<string, number>;
  orderItems: OrderItem[];
  onAddItem: (productId: string) => void;
  onRemoveItem: (idx: number) => void;
}

export function AgentProductPicker({
  products,
  productStock,
  orderItems,
  onAddItem,
  onRemoveItem,
}: AgentProductPickerProps) {
  return (
    <ul className="divide-y divide-border">
      {products.map((product) => {
        const stock = productStock[product.id] ?? 0;
        const isOutOfStock = stock === 0;
        const itemIdx = orderItems.findIndex((item) => item.product_id === product.id);
        const isAdded = itemIdx !== -1;

        return (
          <li key={product.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted">SKU: {product.sku || "—"}</p>
              <p className="text-sm font-semibold text-navy truncate">{product.name}</p>
              <p className="text-sm font-bold text-accent-2">₱{product.price}</p>
              {isOutOfStock && <p className="text-xs text-red-600">Out of stock</p>}
            </div>
            <button
              type="button"
              disabled={isOutOfStock && !isAdded}
              onClick={() => (isAdded ? onRemoveItem(itemIdx) : onAddItem(product.id))}
              className={
                isAdded
                  ? "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap bg-accent-2 text-white disabled:opacity-40"
                  : "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border border-accent-2 text-accent-2 disabled:opacity-40"
              }
            >
              {isAdded ? "✓ Added" : "Add"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
