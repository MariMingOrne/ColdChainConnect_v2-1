import { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { invoices } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { createInvoiceAfterPicking } from "../services/booking-invoices";

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  if (!booking_id) return res.status(400).json({ error: "Booking ID is required" });
  if (!req.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const result = await createInvoiceAfterPicking(booking_id);
    if (result.status === "not_found") return res.status(404).json({ error: "Booking not found" });
    if (result.status === "not_ready") {
      return res.status(409).json({ error: "Prepare all pallets before creating the invoice." });
    }
    if (result.status === "incomplete_pick") {
      return res.status(409).json({ error: "Picked quantities must exactly match the booking before invoicing." });
    }

    if (result.status === "created") {
      await logAction(req.user.userId, "create", "invoice", result.invoice!.id, undefined, result.invoice);
    }

    res.status(result.status === "created" ? 201 : 200).json(result.invoice);
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
