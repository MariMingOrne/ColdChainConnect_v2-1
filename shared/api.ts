/**
 * Shared code between client and server
 */

import { z } from "zod";

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: "admin" | "agent" | "driver";
  };
}

export interface MfaChallengeResponse {
  mfa: "setup" | "verify";
  challenge_token: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

export interface MfaVerifyRequest {
  challenge_token: string;
  code: string;
}

export interface LogoutResponse {
  message: string;
}

export interface CreateAccountRequest {
  username: string;
  password: string;
  role: "admin" | "agent";
}

export interface CreateAccountResponse {
  id: string;
  username: string;
  role: "admin" | "agent";
}

// User types
export interface User {
  id: string;
  username: string;
  role: "admin" | "agent" | "driver";
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Customer types
export interface CustomerDiscount {
  id?: string;
  label: string;
  rate: number | string;
}

export interface Customer {
  id: string;
  store_name: string;
  location: string;
  district?: string | null;
  street_number?: string | null;
  street_address?: string | null;
  state?: string | null;
  postal_code?: string | null;
  contact_person?: string;
  contact_info?: string;
  agent_id?: string;
  payment_type?: "cash" | "check" | "bank_transfer" | "cod" | "credit";
  credit_limit?: string | null;
  credit_terms_days?: number;
  discounts?: CustomerDiscount[];
  created_at: string;
  updated_at: string;
}

export interface CreditViolation {
  code: "OVERDUE_BEYOND_TERMS" | "CREDIT_LIMIT_EXCEEDED";
  message: string;
}

export interface CreditBlockResponse {
  error: string;
  code: "AR_CREDIT_BLOCKED";
  violations: CreditViolation[];
  canOverride: boolean;
}

export function totalDiscountRate(discounts: CustomerDiscount[] | undefined): number {
  return (discounts ?? []).reduce((sum, discount) => sum + Number(discount.rate), 0);
}

export function formatCustomerAddress(
  customer: Pick<Customer, "location" | "street_number" | "street_address" | "state" | "postal_code">
): string {
  const streetLine = [customer.street_number, customer.street_address].filter(Boolean).join(" ");
  const parts = [streetLine, customer.location, customer.state, customer.postal_code].filter(Boolean);
  return parts.join(", ");
}

export const CreateCustomerSchema = z.object({
  store_name: z.string().min(1, "Store name is required"),
  location: z.string().min(1, "Location is required"),
  district: z.string().optional(),
  street_number: z.string().optional(),
  street_address: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  contact_person: z.string().optional(),
  contact_info: z.string().optional(),
  agent_id: z.string().optional(),
  payment_type: z.enum(["cash", "check", "bank_transfer", "cod", "credit"]).optional(),
  discounts: z
    .array(z.object({ label: z.string().min(1), rate: z.number().gt(0).max(1) }))
    .refine((list) => list.reduce((sum, d) => sum + d.rate, 0) <= 1 + 1e-9, {
      message: "Combined discounts cannot exceed 100%",
    })
    .optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

// Product types
export interface Product {
  id: string;
  name: string;
  sku?: string;
  price: string;
  image_filename?: string;
  batch_tracking_enabled: boolean;
  reorder_point?: number;
  manufacturer?: string;
  is_discontinued?: boolean;
  created_at: string;
  updated_at: string;
}

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  price: z.string().or(z.number()).refine((val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return !isNaN(num) && num > 0;
  }, "Price must be a positive number"),
  image_filename: z.string().optional(),
  batch_tracking_enabled: z.boolean().default(true),
});

export const UpdateProductSchema = CreateProductSchema.partial();

// Batch types
export interface Batch {
  id: string;
  product_id: string;
  pallet_id: string;
  qty_units: number;
  expiration_date_note?: string;
  placement_location?: string;
  created_at: string;
  updated_at: string;
}

export const CreateBatchSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
  pallet_id: z.string().min(1, "Pallet ID is required"),
  qty_units: z.number().int().positive("Quantity must be positive"),
  expiration_date_note: z.string().optional(),
  placement_location: z.string().optional(),
});

export const UpdateBatchSchema = CreateBatchSchema.partial();

// Inventory Batch types (restock batches, separate from physical Batch/pallet)
export interface InventoryBatch {
  id: string;
  name: string;
  status: "open" | "closed";
  created_at: string;
  closed_at?: string;
  updated_at: string;
  items?: InventoryBatchItem[];
}

export interface InventoryBatchItem {
  id: string;
  batch_id: string;
  product_id: string;
  qty_units: number;
  unit_cost: string;
  created_at: string;
  updated_at: string;
}

export const CreateInventoryBatchSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product ID is required"),
    qty_units: z.number().int().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
});

export const UpdateInventoryBatchSchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  name: z.string().optional(),
});

// Pallet types (for order preparation)
export interface Pallet {
  id: string;
  order_id: string;
  truck_id?: string;
  status: "draft" | "prepared" | "approved" | "shipped";
  created_at: string;
  updated_at: string;
  items?: PalletItem[];
}

export interface PalletItem {
  id: string;
  pallet_id: string;
  product_id: string;
  qty_units: number;
  unit_cost: string;
  batch_item_id: string;
  created_at: string;
  updated_at: string;
}

export const CreatePalletSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product ID is required"),
    qty_units: z.number().int().positive("Quantity must be positive"),
    batch_item_id: z.string().min(1, "Batch item ID is required"),
  })).min(1, "At least one item is required"),
});

export const UpdatePalletStatusSchema = z.object({
  status: z.enum(["draft", "prepared", "approved", "shipped"]),
});

// Agent types — account-linked staff with login credentials
export interface Agent {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  contact_info?: string;
  emergency_contact?: string;
  hire_date?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
}

export const CreateAgentSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  full_name: z.string().optional(),
  email: z.string().email("Valid email is required").optional(),
  contact_info: z.string().optional(),
  emergency_contact: z.string().optional(),
  hire_date: z.string().optional(),
  address: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const UpdateAgentSchema = CreateAgentSchema.omit({ username: true, password: true }).partial();

// Driver types — standalone field staff (no login account)
export interface Driver {
  id: string;
  full_name?: string;
  contact_info?: string;
  license?: string;
  hire_date?: string;
  employment_type?: "full_time" | "part_time";
  is_active: boolean;
  user_id?: string | null;
  user?: { id: string; username: string; mfa_enabled: boolean } | null;
  created_at: string;
  updated_at: string;
}

export interface DriverSchedule {
  date: string;
  driver: { id: string; full_name: string | null };
  deliveries: DriverScheduleRun[];
}

export interface DriverScheduleRun {
  id: string;
  status: "pending" | "in_transit" | "completed";
  truck: { id: string; license_plate: string; district: string };
  delivery_items: DriverScheduleStop[];
}

export interface DriverScheduleStop {
  id: string;
  status: "pending" | "in_transit" | "completed";
  destination_customer: {
    id: string;
    store_name: string;
    location: string;
    street_address: string | null;
    contact_person: string | null;
    contact_info: string | null;
  };
  invoice: {
    id: string;
    receipt_number: string | null;
    total_amount: string | null;
    payment_status: string;
    invoice_items: { id: string; product_name: string; qty_ordered: number }[];
  };
}

export const CreateDriverSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  contact_info: z.string().optional(),
  license: z.string().optional(),
  hire_date: z.string().optional(),
  employment_type: z.enum(["full_time", "part_time"]).optional(),
  is_active: z.boolean().default(true),
});

export const UpdateDriverSchema = CreateDriverSchema.partial();

// Truck types
export interface Truck {
  id: string;
  license_plate: string;
  district: string;
  driver_id?: string;
  status: "available" | "in_transit" | "maintenance";
  created_at: string;
  updated_at: string;
}

export const CreateTruckSchema = z.object({
  license_plate: z
    .string()
    .regex(/^[A-Z]{3} \d{3,4}$/, "License plate must look like ABC 1234"),
  district: z.string().min(1, "District is required"),
  driver_id: z.string().optional(),
  status: z.enum(["available", "in_transit", "maintenance"]).default("available"),
});

export const UpdateTruckSchema = CreateTruckSchema.partial();

// Booking types
export interface Booking {
  id: string;
  customer_id: string;
  created_by: string;
  status: "pending" | "approved" | "rejected" | "prep" | "ready";
  prepared_delivery_date?: string | null;
  created_at: string;
  customer?: Customer;
  creator?: User;
  booking_items?: BookingItem[];
}

export interface BookingItem {
  id: string;
  booking_id: string;
  product_id: string;
  qty_ordered: number;
  created_at: string;
  product?: Product;
}

export const CreateBookingItemSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
  qty_ordered: z.number().int().positive("Quantity must be positive"),
});

export const CreateBookingSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
  prepared_delivery_date: z.string().optional(),
  items: z.array(CreateBookingItemSchema).min(1, "At least one item is required"),
});

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "prep", "ready"]),
});

// Invoice types
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string | null;
  qty_ordered: number;
  unit_price: string;
  amount: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  booking_id: string;
  agent_id: string;
  status: "draft" | "issued" | "paid";
  payment_status: "unpaid" | "paid";
  // Snapshot fields
  receipt_number?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_payment_type?: string | null;
  discount_rate?: string | null;
  gross_amount?: string | null;
  discount_amount?: string | null;
  total_amount?: string | null;
  prepared_by?: string | null;
  invoice_items?: InvoiceItem[];
  booking?: Booking;
  created_at: string;
  updated_at: string;
}

export const CreateInvoiceSchema = z.object({
  booking_id: z.string().min(1, "Booking ID is required"),
  agent_id: z.string().min(1, "Agent ID is required"),
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(["draft", "issued", "paid"]),
});

export const UpdateInvoicePaymentStatusSchema = z.object({
  payment_status: z.enum(["unpaid", "paid"]),
});

// Delivery types
export interface Delivery {
  id: string;
  truck_id: string;
  driver_id?: string | null;
  agent_id?: string | null;
  driver?: Driver | null;
  agent?: Agent | null;
  status: "pending" | "in_transit" | "completed";
  scheduled_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  invoice_id: string;
  destination_customer_id: string;
  status: "pending" | "in_transit" | "completed";
  is_paid?: boolean;
  payment_method?: string;
  payment_reference?: string | null;
  paid_at?: string;
  completed_at?: string;
  receipt_number?: string;
  created_at: string;
  updated_at: string;
}

export const CreateDeliveryItemSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
  destination_customer_id: z.string().min(1, "Destination customer ID is required"),
});

export const CreateDeliverySchema = z.object({
  truck_id: z.string().min(1, "Truck ID is required"),
  items: z.array(CreateDeliveryItemSchema).min(1, "At least one delivery item is required"),
  driver_id: z.string().optional().nullable(),
  agent_id: z.string().optional().nullable(),
});

export const UpdateDeliveryStatusSchema = z.object({
  status: z.enum(["pending", "in_transit", "completed"]),
});

export const UpdateDeliveryItemStatusSchema = z.object({
  status: z.enum(["pending", "in_transit", "completed"]),
});

export const AssignDeliverySchema = z.object({
  driver_id: z.string().nullable().optional(),
  agent_id:  z.string().nullable().optional(),
});

export const ConfirmDeliveryItemSchema = z.object({
  is_paid: z.boolean().default(false),
  payment_method: z.string().optional(),
});

// Accounts Receivable types
export interface AccountsReceivable {
  id: string;
  customer_id: string;
  delivery_item_id: string;
  invoice_id: string;
  amount_due: string;
  status: "outstanding" | "paid" | "partial";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentReturn {
  id: string;
  invoice_id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  qty_returned: number;
  return_type: "good" | "damaged";
  reason?: string | null;
  status: "pending" | "accepted" | "rejected";
  restored_to_pallet_id?: string | null;
  ar_credit_id?: string | null;
  created_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  // eager-loaded
  invoice?: Invoice;
  customer?: Customer;
  product?: Product;
}

// Audit types
export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  created_at: string;
}

export interface DemoResponse {
  message: string;
}

export interface SalesForecastPoint {
  date: string;
  total: number;
}

export interface SalesProductInsight {
  product_name: string;
  days_sold: number;
  consistency_percent: number;
  avg_daily_qty: number;
  suggested_restock_qty: number;
}

export interface SalesForecastResponse {
  history: SalesForecastPoint[];
  forecast: SalesForecastPoint[];
  projected_7_day_total: number;
  trend: "up" | "down" | "flat";
  trend_percent: number;
  has_enough_data: boolean;
  history_days_with_sales: number;
  note: string;
  product_insights: SalesProductInsight[];
  ai_summary: string | null;
}
