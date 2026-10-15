import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { invoices, invoice_items, bookings, booking_items, customers, products, users } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { totalDiscountRate } from "@shared/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateReceiptNumber(): string {
  const num = Math.floor(Math.random() * 99999).toString().padStart(6, "0");
  return `${num.slice(0, 3)} ${num.slice(3)}`;
}

async function fetchInvoiceWithItems(id: string) {
  return db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      invoice_items: true,
      booking: {
        with: {
          customer: true,
          booking_items: { with: { product: true } },
        },
      },
    },
  });
}

// ─── List Invoices ───────────────────────────────────────────────────────────

export const listInvoices: RequestHandler = async (req, res) => {
  try {
    const { status, payment_status, unpaid } = req.query;

    const allInvoices = await db.query.invoices.findMany({
      with: {
        invoice_items: true,
        booking: {
          with: {
            customer: true,
            booking_items: { with: { product: true } },
          },
        },
      },
    });

    let result = allInvoices;
    if (status) result = result.filter((i) => i.status === status);
    if (unpaid === "true") result = result.filter((i) => i.payment_status === "unpaid");
    else if (payment_status) result = result.filter((i) => i.payment_status === payment_status);

    res.json(result);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Get Single Invoice ──────────────────────────────────────────────────────

export const getInvoice: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await fetchInvoiceWithItems(id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Create Invoice ──────────────────────────────────────────────────────────

export const createInvoice: RequestHandler = async (req: AuthRequest, res) => {
  const { booking_id } = req.body;
  // agent_id from the body is accepted but treated as a hint only.
  // The invoice always belongs to the booking's original creator so that
  // admins approving orders don't accidentally become the invoice agent.

  if (!booking_id) {
    return res.status(400).json({ error: "Booking ID is required" });
  }

  try {
    // Guard: don't create duplicate invoice for same booking
    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.booking_id, booking_id),
    });
    if (existing) {
      const full = await fetchInvoiceWithItems(existing.id);
      return res.status(200).json(full);
    }

    // Fetch booking with all nested data needed for snapshot
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, booking_id),
      with: {
        customer: { with: { discounts: true } },
        booking_items: { with: { product: true } },
        creator: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Resolve agent: always prefer the booking's original creator (created_by).
    // Fall back to the body-supplied agent_id, then to the currently logged-in user.
    const resolvedAgentId: string =
      booking.created_by || req.body.agent_id || req.user?.userId || "";

    if (!resolvedAgentId) {
      return res.status(400).json({ error: "Unable to determine agent for invoice" });
    }

    // Fetch the agent's username to use as "prepared by"
    const agentUser = await db.query.users.findFirst({
      where: eq(users.id, resolvedAgentId),
    });

    // Compute totals from booking items
    const DISCOUNT_RATE = totalDiscountRate(booking.customer?.discounts);
    let gross = 0;
    const lineItems: Array<{
      product_id: string;
      product_name: string;
      product_sku: string | null;
      qty_ordered: number;
      unit_price: number;
      amount: number;
    }> = [];

    for (const item of booking.booking_items || []) {
      const price = parseFloat(item.product?.price || "0");
      const amount = price * item.qty_ordered;
      gross += amount;
      lineItems.push({
        product_id: item.product_id,
        product_name: item.product?.name || item.product_id,
        product_sku: item.product?.sku || null,
        qty_ordered: item.qty_ordered,
        unit_price: price,
        amount,
      });
    }

    const discountAmount = gross * DISCOUNT_RATE;
    const totalAmount = gross - discountAmount;

    // Insert invoice
    const id = randomUUID();
    await db.insert(invoices).values({
      id,
      booking_id,
      agent_id: resolvedAgentId,
      status: "draft",
      payment_status: "unpaid",
      receipt_number: generateReceiptNumber(),
      customer_name: booking.customer?.store_name || "",
      customer_address: booking.customer?.location || "",
      customer_payment_type: booking.customer?.payment_type || "cod",
      discount_rate: String(DISCOUNT_RATE),
      gross_amount: String(gross.toFixed(2)),
      discount_amount: String(discountAmount.toFixed(2)),
      total_amount: String(totalAmount.toFixed(2)),
      prepared_by: agentUser?.username || "",
    });

    // Insert line-item snapshots
    for (const line of lineItems) {
      await db.insert(invoice_items).values({
        id: randomUUID(),
        invoice_id: id,
        product_id: line.product_id,
        product_name: line.product_name,
        product_sku: line.product_sku,
        qty_ordered: line.qty_ordered,
        unit_price: String(line.unit_price.toFixed(2)),
        amount: String(line.amount.toFixed(2)),
      });
    }

    const newInvoice = await fetchInvoiceWithItems(id);

    if (req.user) {
      await logAction(req.user.userId, "create", "invoice", id, undefined, newInvoice);
    }

    res.status(201).json(newInvoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Update Invoice Status ───────────────────────────────────────────────────

export const updateInvoiceStatus: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: "Status is required" });

  try {
    const existing = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    await db.update(invoices).set({ status, updated_at: new Date() }).where(eq(invoices.id, id));
    const updated = await fetchInvoiceWithItems(id);

    if (req.user) {
      await logAction(req.user.userId, "update", "invoice", id, existing, updated);
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Update Invoice Payment Status ──────────────────────────────────────────

export const updateInvoicePaymentStatus: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;

  if (!payment_status) return res.status(400).json({ error: "Payment status is required" });

  try {
    const existing = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    await db.update(invoices).set({ payment_status, updated_at: new Date() }).where(eq(invoices.id, id));
    const updated = await fetchInvoiceWithItems(id);

    if (req.user) {
      await logAction(req.user.userId, "update", "invoice_payment", id, existing, updated);
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating invoice payment status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
