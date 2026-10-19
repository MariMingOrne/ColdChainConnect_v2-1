import { useState } from "react";
import { Booking, Customer, Product } from "@shared/api";
import { cn } from "@/lib/utils";
import { AgentProductPicker } from "./AgentProductPicker";
import { AgentOrderItems } from "./AgentOrderItems";
import { AgentPendingOrders } from "./AgentPendingOrders";

interface OrderItem {
  product_id: string;
  qty_ordered: number;
}

interface AgentOrderScreenProps {
  customers: Customer[];
  products: Product[];
  productStock: Record<string, number>;
  orderItems: OrderItem[];
  newCustomerId: string;
  preparedDeliveryDate: string;
  isCreating: boolean;
  pendingOrders: Booking[];
  currentUserId: string;
  rollingBackId: string | null;
  onCustomerChange: (customerId: string) => void;
  onPreparedDeliveryDateChange: (date: string) => void;
  onAddItem: (productId: string) => void;
  onRemoveItem: (idx: number) => void;
  onItemChange: (idx: number, field: "product_id" | "qty_ordered", value: string | number) => void;
  onCancel: () => void;
  onCreateOrder: () => void;
  onRollbackOrder: (booking: Booking) => void;
}

export function AgentOrderScreen({
  customers,
  products,
  productStock,
  orderItems,
  newCustomerId,
  preparedDeliveryDate,
  isCreating,
  pendingOrders,
  currentUserId,
  rollingBackId,
  onCustomerChange,
  onPreparedDeliveryDateChange,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onCancel,
  onCreateOrder,
  onRollbackOrder,
}: AgentOrderScreenProps) {
  const [view, setView] = useState<"new" | "pending">("new");
  const [tab, setTab] = useState<"products" | "items">("products");
  const totalQty = orderItems.reduce((sum, item) => sum + item.qty_ordered, 0);
  const canCreate = !isCreating && !!newCustomerId && orderItems.length > 0;

  return (
    <div className="min-h-full flex flex-col bg-off-white">
      <header className="bg-navy text-white px-5 pt-5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-rajdhani text-2xl font-bold">Point of Sale</h1>
            <p className="text-xs text-white/70">Create a customer order</p>
          </div>
          <p className="text-xs font-semibold">
            Total Items: <span className="text-accent-2">{totalQty}</span>
          </p>
        </div>
      </header>

      <div className="flex bg-white border-b border-border">
        {(["new", "pending"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "flex-1 py-3 text-sm font-semibold transition",
              view === key ? "border-b-2 border-accent-2 text-accent-2" : "text-muted"
            )}
          >
            {key === "new" ? "New Order" : `Pending (${pendingOrders.length})`}
          </button>
        ))}
      </div>

      {view === "new" ? (
        <>
          <div className="flex-1 p-4 space-y-4">
            <section className="bg-white rounded-xl border border-border p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-2">Customer *</label>
                <select
                  value={newCustomerId}
                  onChange={(e) => onCustomerChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                >
                  <option value="">Select a customer store</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.store_name} — {c.location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-2">Prepared Delivery Date</label>
                <input
                  type="date"
                  value={preparedDeliveryDate}
                  onChange={(e) => onPreparedDeliveryDateChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
            </section>

            <section className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="flex border-b border-border">
                {(["products", "items"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      "flex-1 py-3 text-sm font-semibold transition",
                      tab === key ? "border-b-2 border-accent-2 text-accent-2" : "text-muted"
                    )}
                  >
                    {key === "products" ? "Products" : `Order Items (${totalQty})`}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {tab === "products" ? (
                  <AgentProductPicker
                    products={products}
                    productStock={productStock}
                    orderItems={orderItems}
                    onAddItem={onAddItem}
                    onRemoveItem={onRemoveItem}
                  />
                ) : (
                  <AgentOrderItems
                    products={products}
                    productStock={productStock}
                    orderItems={orderItems}
                    onItemChange={onItemChange}
                    onRemoveItem={onRemoveItem}
                    onBrowseProducts={() => setTab("products")}
                  />
                )}
              </div>
            </section>
          </div>

          <footer className="mt-auto flex shrink-0 items-center gap-3 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[52px] flex-[0.8] rounded-xl border border-border bg-off-white px-4 font-semibold text-sm text-muted transition hover:bg-border/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreateOrder}
              disabled={!canCreate}
              className="min-h-[52px] flex-[1.2] rounded-xl bg-navy px-4 font-semibold text-sm text-white transition hover:bg-navy-mid active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              {isCreating ? "Creating…" : "Create Order"}
            </button>
          </footer>
        </>
      ) : (
        <div className="flex-1 p-4">
          <AgentPendingOrders
            orders={pendingOrders}
            currentUserId={currentUserId}
            rollingBackId={rollingBackId}
            onRollback={onRollbackOrder}
          />
        </div>
      )}
    </div>
  );
}
