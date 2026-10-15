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

const MODULE_KEYWORDS = {
  products: ["product", "products", "price", "pricing"],
  customers: ["customer", "customers", "client", "clients"],
  inventory: ["inventory", "batch", "batches", "stock"],
  orders: ["booking", "bookings", "order", "orders"],
  invoices: ["invoice", "invoices", "invoicing", "receipt"],
  trucks: ["delivery", "deliveries", "truck", "trucks", "dispatch"],
};

const includesQuery = (query: string, values: (string | null | undefined)[]) =>
  values.some((value) => value?.toLowerCase().includes(query));

// A module keyword match (e.g. "booking") returns every record in that module.
const matchesModule = (query: string, keywords: string[]) =>
  query.length >= 3 && keywords.some((keyword) => keyword.includes(query));

function selectRecords<T>(
  items: T[],
  query: string,
  keywords: string[],
  fields: (item: T) => (string | null | undefined)[]
): T[] {
  if (matchesModule(query, keywords)) return items;
  return items.filter((item) => includesQuery(query, fields(item)));
}

export function searchAll(data: SearchData, rawQuery: string): SearchGroup[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const customerNameById = new Map(data.customers.map((c) => [c.id, c.store_name]));
  const bookingRows = data.bookings.map((booking) => ({
    booking,
    customerName: customerNameById.get(booking.customer_id) ?? booking.customer?.store_name ?? "",
  }));

  const groups: SearchGroup[] = [
    {
      label: "Products",
      hits: selectRecords(data.products, query, MODULE_KEYWORDS.products, (p) => [p.name, p.sku, p.manufacturer]).map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: [p.sku, p.manufacturer].filter(Boolean).join(" · "),
        path: PATHS.products,
      })),
    },
    {
      label: "Customers",
      hits: selectRecords(data.customers, query, MODULE_KEYWORDS.customers, (c) => [c.store_name, c.location, c.contact_person]).map((c) => ({
        id: c.id,
        title: c.store_name,
        subtitle: c.location,
        path: PATHS.customers,
      })),
    },
    {
      label: "Inventory",
      hits: selectRecords(data.inventoryBatches, query, MODULE_KEYWORDS.inventory, (b) => [b.name]).map((b) => ({
        id: b.id,
        title: b.name,
        subtitle: b.status,
        path: PATHS.inventory,
      })),
    },
    {
      label: "Order Summary",
      hits: selectRecords(bookingRows, query, MODULE_KEYWORDS.orders, (row) => [row.customerName, row.booking.status]).map(({ booking, customerName }) => ({
        id: booking.id,
        title: customerName || "Unknown customer",
        subtitle: `${booking.status} · ${new Date(booking.created_at).toLocaleDateString()}`,
        path: PATHS.orders,
      })),
    },
    {
      label: "Invoicing",
      hits: selectRecords(data.invoices, query, MODULE_KEYWORDS.invoices, (i) => [i.receipt_number, i.customer_name, i.status]).map((i) => ({
        id: i.id,
        title: i.receipt_number ?? i.customer_name ?? "Invoice",
        subtitle: [i.customer_name, i.status].filter(Boolean).join(" · "),
        path: PATHS.invoices,
      })),
    },
    {
      label: "Delivery",
      hits: selectRecords(data.trucks, query, MODULE_KEYWORDS.trucks, (t) => [t.license_plate, t.district, t.status]).map((t) => ({
        id: t.id,
        title: t.license_plate,
        subtitle: `${t.district} · ${t.status}`,
        path: PATHS.trucks,
      })),
    },
  ];

  return groups.filter((group) => group.hits.length > 0);
}
