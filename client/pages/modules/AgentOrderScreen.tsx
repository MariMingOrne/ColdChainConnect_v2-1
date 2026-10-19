import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Booking, Customer, Product } from "@shared/api";
import { cn } from "@/lib/utils";
import { AgentProductPicker } from "./AgentProductPicker";
import { AgentOrderItems } from "./AgentOrderItems";
import { AgentPendingOrders } from "./AgentPendingOrders";
import { AgentBarcodeScanner } from "./AgentBarcodeScanner";

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
  const [isScanning, setIsScanning] = useState(false);
  const totalQty = orderItems.reduce((sum, item) => sum + item.qty_ordered, 0);
  const canCreate = !isCreating && !!newCustomerId && orderItems.length > 0;

  if (isScanning) {
    return <AgentBarcodeScanner onClose={() => setIsScanning(false)} />;
  }

  return (
    <div className="min-h-full flex flex-col bg-off-white">
      <header className="bg-navy text-white px-5 pt-5 pb-4">
        <p className="font-rajdhani text-xl font-bold tracking-wide">ACDP</p>
        <div className="mt-4 flex items-end justify-between gap-3">
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

          <footer className="sticky bottom-16 bg-white border-t border-border px-4 pt-3 pb-4 flex items-start gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 border border-border rounded-full font-semibold text-sm text-navy"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsScanning(true)}
              aria-label="Open barcode scanner"
              className="-mt-7 w-14 h-14 shrink-0 rounded-full bg-navy text-white flex items-center justify-center shadow-lg border-4 border-white"
            >
              <ScanBarcode size={22} />
            </button>
            <button
              type="button"
              onClick={onCreateOrder}
              disabled={!canCreate}
              className="flex-1 py-3 rounded-full font-semibold text-sm text-white bg-accent-2 disabled:opacity-50"
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
