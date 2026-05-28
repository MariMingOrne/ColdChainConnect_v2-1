import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Send, RefreshCw } from "lucide-react";
import { Customer, Product } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

interface BookingLineItem {
  id: string;
  product_id: string;
  product_name: string;
  qty_ordered: number;
}

export function MobileBooking() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [lineItems, setLineItems] = useState<BookingLineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { token } = useAuth();

  const fetchData = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!custRes.ok || !prodRes.ok) throw new Error("Failed to fetch data");

      const [custData, prodData] = await Promise.all([
        custRes.json(),
        prodRes.json(),
      ]);

      setCustomers(custData);
      setProducts(prodData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const addLineItem = () => {
    if (!selectedProduct || !quantity) {
      setError("Select product and enter quantity");
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const newItem: BookingLineItem = {
      id: Math.random().toString(36),
      product_id: selectedProduct,
      product_name: product.name,
      qty_ordered: parseInt(quantity),
    };

    setLineItems([...lineItems, newItem]);
    setSelectedProduct("");
    setQuantity("1");
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const submitBooking = async () => {
    if (!selectedCustomer || lineItems.length === 0) {
      setError("Select customer and add items");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_id: selectedCustomer,
          items: lineItems.map((item) => ({
            product_id: item.product_id,
            qty_ordered: item.qty_ordered,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to create booking");

      setSuccess(true);
      setSelectedCustomer("");
      setLineItems([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating booking");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading && !isRefreshing) return <div className="p-6">Loading...</div>;

  const selectedCustomerName =
    customers.find((c) => c.id === selectedCustomer)?.store_name || "No customer";

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 max-w-2xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy">Create Order</h1>
          <p className="text-gray-600 text-sm">Add products and submit booking</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
          title="Refresh data"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700 text-sm">{error}</p>
        </Card>
      )}

      {success && (
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-green-700 text-sm">✓ Booking created successfully!</p>
        </Card>
      )}

      {/* Customer Selection */}
      <Card className="p-4">
        <Label htmlFor="customer" className="text-sm font-semibold block mb-2">
          Select Customer
        </Label>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger id="customer">
            <SelectValue placeholder="Choose a customer store" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.store_name} - {customer.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Current Selection */}
      {selectedCustomer && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-sm">
            <span className="font-semibold">Store:</span> {selectedCustomerName}
          </p>
        </Card>
      )}

      {/* Add Items */}
      <Card className="p-4 border-2 border-dashed">
        <h3 className="font-semibold text-navy mb-3 text-sm">Add Products</h3>

        <div className="space-y-3">
          <div>
            <Label htmlFor="product" className="text-xs font-semibold block mb-1">
              Product
            </Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger id="product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - ₱{product.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="qty" className="text-xs font-semibold block mb-1">
              Quantity
            </Label>
            <Input
              id="qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          <Button
            onClick={addLineItem}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>
      </Card>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-navy mb-3 text-sm">Order Items</h3>
          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  <p className="text-xs text-gray-600">Qty: {item.qty_ordered}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLineItem(item.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm">
              <span className="font-semibold">Total Items:</span>{" "}
              {lineItems.reduce((sum, item) => sum + item.qty_ordered, 0)}
            </p>
          </div>
        </Card>
      )}

      {/* Submit */}
      {selectedCustomer && lineItems.length > 0 && (
        <Button
          onClick={submitBooking}
          disabled={isSending}
          className="w-full gap-2 bg-green-600 hover:bg-green-700"
          size="lg"
        >
          <Send className="w-4 h-4" />
          {isSending ? "Submitting..." : "Submit Booking"}
        </Button>
      )}
    </div>
  );
}
