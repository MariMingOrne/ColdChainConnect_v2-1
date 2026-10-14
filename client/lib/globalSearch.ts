import type { Booking, Customer, Invoice, InventoryBatch, Product, Truck } from "@shared/api";

export interface SearchData {
  products: Product[];
  customers: Customer[];
  inventoryBatches: InventoryBatch[];
  bookings: Booking[];
  invoices: Invoice[];
  trucks: Truck[];
}

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

export interface SearchGroup {
  label: string;
  hits: SearchHit[];
}

export const EMPTY_SEARCH_DATA: SearchData = {
  products: [],
  customers: [],
  inventoryBatches: [],
  bookings: [],
  invoices: [],
  trucks: [],
};

const PATHS = {
  products: "/information-management/products",
  customers: "/information-management/customers",
  inventory: "/information-management/inventory",
  orders: "/booking-dispatch/order-summary",
  invoices: "/booking-dispatch/invoicing",
  trucks: "/booking-dispatch/delivery",
};

const includesQuery = (query: string, values: (string | null | undefined)[]) =>
  values.some((value) => value?.toLowerCase().includes(query));

export function searchAll(data: SearchData, rawQuery: string): SearchGroup[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const customerNameById = new Map(data.customers.map((c) => [c.id, c.store_name]));
  const groups: SearchGroup[] = [
    {
      label: "Products",
      hits: data.products
        .filter((p) => includesQuery(query, [p.name, p.sku, p.manufacturer]))
        .map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: [p.sku, p.manufacturer].filter(Boolean).join(" · "),
          path: PATHS.products,
        })),
    },
    {
      label: "Customers",
      hits: data.customers
        .filter((c) => includesQuery(query, [c.store_name, c.location, c.contact_person]))
        .map((c) => ({
          id: c.id,
          title: c.store_name,
          subtitle: c.location,
          path: PATHS.customers,
        })),
    },
    {
      label: "Inventory",
      hits: data.inventoryBatches
        .filter((b) => includesQuery(query, [b.name]))
        .map((b) => ({
          id: b.id,
          title: b.name,
          subtitle: b.status,
          path: PATHS.inventory,
        })),
    },
    {
      label: "Order Summary",
      hits: data.bookings
        .map((b) => ({ booking: b, customerName: customerNameById.get(b.customer_id) ?? b.customer?.store_name ?? "" }))
        .filter(({ booking, customerName }) => includesQuery(query, [customerName, booking.status]))
        .map(({ booking, customerName }) => ({
          id: booking.id,
          title: customerName || "Unknown customer",
          subtitle: `${booking.status} · ${new Date(booking.created_at).toLocaleDateString()}`,
          path: PATHS.orders,
        })),
    },
    {
      label: "Invoicing",
      hits: data.invoices
        .filter((i) => includesQuery(query, [i.receipt_number, i.customer_name, i.status]))
        .map((i) => ({
          id: i.id,
          title: i.receipt_number ?? i.customer_name ?? "Invoice",
          subtitle: [i.customer_name, i.status].filter(Boolean).join(" · "),
          path: PATHS.invoices,
        })),
    },
    {
      label: "Delivery",
      hits: data.trucks
        .filter((t) => includesQuery(query, [t.name, t.district, t.status]))
        .map((t) => ({
          id: t.id,
          title: t.name,
          subtitle: `${t.district} · ${t.status}`,
          path: PATHS.trucks,
        })),
    },
  ];

  return groups.filter((group) => group.hits.length > 0);
}
