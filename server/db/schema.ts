import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  varchar,
  pgEnum,
  foreignKey,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "driver"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "approved",
  "prep",
  "ready",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "in_transit",
  "completed",
]);
export const truckStatusEnum = pgEnum("truck_status", [
  "available",
  "in_transit",
  "maintenance",
]);

// Users table
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("driver").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Customers table
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  store_name: text("store_name").notNull(),
  location: text("location").notNull(),
  contact_info: text("contact_info"),
  agent_id: text("agent_id").references(() => users.id),
  payment_type: text("payment_type"),
  tax_rate: decimal("tax_rate", { precision: 5, scale: 2 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Products table
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sku: text("sku").unique(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  image_filename: text("image_filename"),
  batch_tracking_enabled: boolean("batch_tracking_enabled").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Inventory batches table (Pallets)
export const inventory_batches = pgTable("inventory_batches", {
  id: text("id").primaryKey(),
  product_id: text("product_id")
    .notNull()
    .references(() => products.id),
  pallet_id: text("pallet_id").notNull().unique(),
  qty_units: integer("qty_units").notNull(),
  expiration_date_note: text("expiration_date_note"),
  placement_location: text("placement_location"),
  // Cold-chain & batch grouping fields
  batch_name: text("batch_name"),
  supplier_name: text("supplier_name"),
  received_date: text("received_date"),
  temperature_log: text("temperature_log"),
  storage_zone: text("storage_zone"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Drivers table
export const drivers = pgTable("drivers", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  address: text("address"),
  contact_info: text("contact_info"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Agents table
export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull(),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Trucks table
export const trucks = pgTable("trucks", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  district: text("district").notNull(),
  driver_id: text("driver_id").references(() => drivers.id),
  status: truckStatusEnum("status").default("available"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  customer_id: text("customer_id")
    .notNull()
    .references(() => customers.id),
  driver_id: text("driver_id").references(() => drivers.id),
  status: bookingStatusEnum("status").default("pending").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Booking items table
export const booking_items = pgTable("booking_items", {
  id: text("id").primaryKey(),
  booking_id: text("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  product_id: text("product_id")
    .notNull()
    .references(() => products.id),
  qty_ordered: integer("qty_ordered").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  booking_id: text("booking_id")
    .notNull()
    .references(() => bookings.id),
  agent_id: text("agent_id")
    .notNull()
    .references(() => users.id),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  payment_status: varchar("payment_status", { length: 20 })
    .default("unpaid")
    .notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Deliveries table
export const deliveries = pgTable("deliveries", {
  id: text("id").primaryKey(),
  truck_id: text("truck_id")
    .notNull()
    .references(() => trucks.id),
  status: deliveryStatusEnum("status").default("pending").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Delivery items table (destinations per delivery)
// completed_at and receipt_number are set when a stop is confirmed.
export const delivery_items = pgTable("delivery_items", {
  id: text("id").primaryKey(),
  delivery_id: text("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  invoice_id: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  destination_customer_id: text("destination_customer_id")
    .notNull()
    .references(() => customers.id),
  status: deliveryStatusEnum("status").default("pending").notNull(),
  completed_at: timestamp("completed_at"),
  receipt_number: text("receipt_number"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Receipts table — created when a delivery stop is confirmed by the driver
export const receipts = pgTable("receipts", {
  id: text("id").primaryKey(),
  receipt_number: text("receipt_number").notNull().unique(),
  delivery_item_id: text("delivery_item_id")
    .notNull()
    .references(() => delivery_items.id),
  customer_id: text("customer_id")
    .notNull()
    .references(() => customers.id),
  truck_id: text("truck_id")
    .notNull()
    .references(() => trucks.id),
  invoice_id: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  confirmed_by: text("confirmed_by"),
  notes: text("notes"),
  confirmed_at: timestamp("confirmed_at").defaultNow().notNull(),
});

// Audit logs table
export const audit_logs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  resource_type: text("resource_type").notNull(),
  resource_id: text("resource_id"),
  before_state: text("before_state"),
  after_state: text("after_state"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
// Required for db.query.*findMany({ with: { ... } }) to work.

export const usersRelations = relations(users, ({ many }) => ({
  customers: many(customers),
  drivers: many(drivers),
  invoices: many(invoices),
  audit_logs: many(audit_logs),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  agent: one(users, { fields: [customers.agent_id], references: [users.id] }),
  bookings: many(bookings),
  delivery_items: many(delivery_items),
  receipts: many(receipts),
}));

export const productsRelations = relations(products, ({ many }) => ({
  inventory_batches: many(inventory_batches),
  booking_items: many(booking_items),
}));

export const inventoryBatchesRelations = relations(inventory_batches, ({ one }) => ({
  product: one(products, { fields: [inventory_batches.product_id], references: [products.id] }),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, { fields: [drivers.user_id], references: [users.id] }),
  trucks: many(trucks),
  bookings: many(bookings),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  // Add relations to agents as needed
}));

export const trucksRelations = relations(trucks, ({ one, many }) => ({
  driver: one(drivers, { fields: [trucks.driver_id], references: [drivers.id] }),
  deliveries: many(deliveries),
  receipts: many(receipts),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(customers, { fields: [bookings.customer_id], references: [customers.id] }),
  driver: one(drivers, { fields: [bookings.driver_id], references: [drivers.id] }),
  booking_items: many(booking_items),
  invoices: many(invoices),
}));

export const bookingItemsRelations = relations(booking_items, ({ one }) => ({
  booking: one(bookings, { fields: [booking_items.booking_id], references: [bookings.id] }),
  product: one(products, { fields: [booking_items.product_id], references: [products.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  booking: one(bookings, { fields: [invoices.booking_id], references: [bookings.id] }),
  agent: one(users, { fields: [invoices.agent_id], references: [users.id] }),
  delivery_items: many(delivery_items),
  receipts: many(receipts),
}));

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  truck: one(trucks, { fields: [deliveries.truck_id], references: [trucks.id] }),
  delivery_items: many(delivery_items),
}));

export const deliveryItemsRelations = relations(delivery_items, ({ one, many }) => ({
  delivery: one(deliveries, { fields: [delivery_items.delivery_id], references: [deliveries.id] }),
  invoice: one(invoices, { fields: [delivery_items.invoice_id], references: [invoices.id] }),
  destination_customer: one(customers, { fields: [delivery_items.destination_customer_id], references: [customers.id] }),
  receipt: many(receipts),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  delivery_item: one(delivery_items, { fields: [receipts.delivery_item_id], references: [delivery_items.id] }),
  customer: one(customers, { fields: [receipts.customer_id], references: [customers.id] }),
  truck: one(trucks, { fields: [receipts.truck_id], references: [trucks.id] }),
  invoice: one(invoices, { fields: [receipts.invoice_id], references: [invoices.id] }),
}));

export const auditLogsRelations = relations(audit_logs, ({ one }) => ({
  user: one(users, { fields: [audit_logs.user_id], references: [users.id] }),
}));
