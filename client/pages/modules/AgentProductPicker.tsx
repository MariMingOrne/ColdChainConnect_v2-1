import { useState } from "react";
import { Search } from "lucide-react";
import { Product } from "@shared/api";
import { cn } from "@/lib/utils";

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
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term)
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
        />
      </div>

      <ul className="divide-y divide-border">
        {filtered.map((product) => {
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
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-40",
                  isAdded ? "bg-accent-2 text-white" : "border border-accent-2 text-accent-2"
                )}
              >
                {isAdded ? "✓ Added" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted py-8">No products found</p>
      )}
    </div>
  );
}
