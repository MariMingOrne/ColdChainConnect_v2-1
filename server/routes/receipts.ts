import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  receipts,
  delivery_items,
  deliveries,
  invoices,
  accounts_receivable,
  agents,
  drivers,
  order_pallets,
} from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

// ─── GET /api/receipts ────────────────────────────────────────────────────────
// Returns all receipts (joined data is resolved on the client via separate
// /api/customers, /api/trucks, /api/invoices calls — same pattern as deliveries).

export const listReceipts: RequestHandler = async (_req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json([]);
    }

    const all = await db.select().from(receipts).orderBy(receipts.confirmed_at);
    res.json(all);
  } catch (error) {
    console.error("Error fetching receipts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── POST /api/deliveries/:id/items/:itemId/confirm ───────────────────────────
// Called by the mobile app (or the admin UI) to confirm a delivery stop.
// Side-effects:
//   1. Sets delivery_item.status = "completed", completed_at, receipt_number
//   2. Sets invoice.status = "paid", payment_status = "paid"
//   3. Creates a receipts row
//   4. If every item in the delivery is now completed, sets delivery.status = "completed"

export const confirmDeliveryItem: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id: deliveryId, itemId } = req.params;
  const { notes, confirmed_by, is_paid, payment_amount, payment_method, payment_reference } = req.body ?? {};

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    // 1. Load the item with its invoice
    const item = await db.query.delivery_items.findFirst({
      where: and(
        eq(delivery_items.id, itemId),
        eq(delivery_items.delivery_id, deliveryId)
      ),
    });

    if (!item) {
      return res.status(404).json({ error: "Delivery item not found" });
    }
    if (item.status === "completed") {
      return res.status(409).json({ error: "Delivery item already confirmed" });
    }

    // 2. Load the invoice to get amount details
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, item.invoice_id),
      with: {
        booking: {
          with: {
            booking_items: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const invoiceTotal = Number(invoice.total_amount ?? invoice.gross_amount ?? 0);
    const invoiceTotalCents = Math.round(invoiceTotal * 100);
    const collectedAmount = payment_amount === undefined
      ? (is_paid ? invoiceTotal : 0)
      : Number(payment_amount);

    if (!Number.isFinite(collectedAmount) || collectedAmount < 0 || Math.round(collectedAmount * 100) > invoiceTotalCents) {
      return res.status(400).json({ error: "Payment amount must be between zero and the invoice total" });
    }
    if (collectedAmount > 0 && !payment_method) {
      return res.status(400).json({ error: "Payment method is required when recording a payment" });
    }

    const collectedCents = Math.round(collectedAmount * 100);
    const remainingCents = invoiceTotalCents - collectedCents;
    const isFullyPaid = remainingCents === 0;

    // 3. Load the parent delivery to get the truck_id
    const delivery = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, deliveryId),
      with: { truck: { columns: { driver_id: true } } },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (req.user?.role === "agent") {
      const profile = await db.query.agents.findFirst({
        where: eq(agents.user_id, req.user.userId),
        columns: { id: true },
      });
      if (!profile || delivery.agent_id !== profile.id) {
        return res.status(403).json({ error: "Only the assigned agent can confirm this delivery" });
      }
    } else if (req.user?.role === "driver") {
      const profile = await db.query.drivers.findFirst({
        where: eq(drivers.user_id, req.user.userId),
        columns: { id: true },
      });
      if (!profile || (delivery.driver_id ?? delivery.truck?.driver_id) !== profile.id) {
        return res.status(403).json({ error: "Only the assigned driver can confirm this delivery" });
      }
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to confirm this delivery" });
    }

    const pallets = await db.query.order_pallets.findMany({
      where: eq(order_pallets.order_id, invoice.booking_id),
      columns: { status: true },
    });
    if (pallets.length === 0 || pallets.some((pallet) => pallet.status !== "shipped")) {
      return res.status(409).json({ error: "All pallets for this order must be shipped before delivery confirmation" });
    }

    // 4. Generate receipt number: OR-YYYYMMDD-XXXX
    const now = new Date();
    const datePart = now
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const suffix = randomUUID().slice(0, 4).toUpperCase();
    const receiptNumber = `OR-${datePart}-${suffix}`;

    const receiptId = randomUUID();

    // 5. Mark delivery item as completed with payment info
    await db
      .update(delivery_items)
      .set({
        status: "completed",
        completed_at: now,
        receipt_number: receiptNumber,
        is_paid: isFullyPaid,
        payment_method: collectedCents > 0 ? payment_method : null,
        payment_reference: collectedCents > 0 ? (payment_reference ?? null) : null,
        paid_at: isFullyPaid ? now : null,
        updated_at: now,
      })
      .where(eq(delivery_items.id, itemId));

    // 6. Create the receipt record
    await db.insert(receipts).values({
      id: receiptId,
      receipt_number: receiptNumber,
      delivery_item_id: itemId,
      customer_id: item.destination_customer_id,
      truck_id: delivery.truck_id,
      invoice_id: item.invoice_id,
      confirmed_by: confirmed_by ?? req.user?.userId ?? null,
      notes: notes ?? null,
      payment_reference: collectedCents > 0 ? (payment_reference ?? null) : null,
      confirmed_at: now,
    });

    if (remainingCents > 0) {
      const arId = randomUUID();
      await db.insert(accounts_receivable).values({
        id: arId,
        customer_id: item.destination_customer_id,
        delivery_item_id: itemId,
        invoice_id: item.invoice_id,
        amount_due: (remainingCents / 100).toFixed(2),
        status: "outstanding",
        notes: `Delivery confirmed on ${now.toISOString()}. ${collectedCents > 0 ? `Partial payment of ${(collectedCents / 100).toFixed(2)} received.` : "Payment pending."}`,
      });
    }

    if (isFullyPaid || collectedCents > 0) {
      await db
        .update(invoices)
        .set({
          ...(isFullyPaid ? { status: "paid" as const, payment_status: "paid" } : { payment_status: "partial" }),
          updated_at: now,
        })
        .where(eq(invoices.id, item.invoice_id));
    }

    // 9. Check if all items in the delivery are completed → mark delivery done
    const remainingItems = await db.query.delivery_items.findMany({
      where: and(
        eq(delivery_items.delivery_id, deliveryId),
      ),
    });

    const allDone = remainingItems.every((i) =>
      i.id === itemId ? true : i.status === "completed"
    );

    if (allDone) {
      await db
        .update(deliveries)
        .set({ status: "completed", updated_at: now })
        .where(eq(deliveries.id, deliveryId));
    }

    // 10. Audit log
    if (req.user) {
      await logAction(
        req.user.userId,
        "confirm",
        "delivery_item",
        itemId,
        { status: item.status },
        {
          status: "completed",
          receipt_number: receiptNumber,
          is_paid: isFullyPaid,
          payment_amount: (collectedCents / 100).toFixed(2),
          payment_method: collectedCents > 0 ? payment_method : null,
        }
      );
    }

    const newReceipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, receiptId),
    });

    res.status(201).json(newReceipt);
  } catch (error) {
    console.error("Error confirming delivery item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── POST /api/deliveries/:id/items/:itemId/payment ───────────────────────────
// Records payment for a stop that was confirmed as unpaid.
// Side-effects:
//   1. Sets delivery_item.is_paid = true with payment method, reference and paid_at
//   2. Marks the outstanding accounts_receivable entry for this stop as paid
//   3. Sets invoice.status = "paid", payment_status = "paid"

export const recordDeliveryItemPayment: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id: deliveryId, itemId } = req.params;
  const { payment_amount, payment_method, payment_reference } = req.body ?? {};

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "Database not configured" });
  }
  if (!payment_method) {
    return res.status(400).json({ error: "Payment method is required" });
  }
  if (payment_amount === undefined || !Number.isFinite(Number(payment_amount)) || Number(payment_amount) <= 0) {
    return res.status(400).json({ error: "A payment amount greater than zero is required" });
  }

  try {
    const item = await db.query.delivery_items.findFirst({
      where: and(
        eq(delivery_items.id, itemId),
        eq(delivery_items.delivery_id, deliveryId)
      ),
    });

    if (!item) {
      return res.status(404).json({ error: "Delivery item not found" });
    }
    if (item.status !== "completed") {
      return res.status(409).json({ error: "Confirm the delivery before recording payment" });
    }
    if (item.is_paid) {
      return res.status(409).json({ error: "Payment is already recorded for this delivery item" });
    }

    const outstanding = await db.query.accounts_receivable.findFirst({
      where: and(
        eq(accounts_receivable.delivery_item_id, itemId),
        eq(accounts_receivable.status, "outstanding")
      ),
    });
    if (!outstanding) {
      return res.status(409).json({ error: "No outstanding balance was found for this delivery item" });
    }
    const paymentCents = Math.round(Number(payment_amount) * 100);
    const outstandingCents = Math.round(Number(outstanding.amount_due) * 100);
    if (paymentCents <= 0 || paymentCents > outstandingCents) {
      return res.status(400).json({ error: "Payment amount must be greater than zero and no more than the outstanding balance" });
    }
    const remainingCents = outstandingCents - paymentCents;
    const isFullyPaid = remainingCents === 0;

    const delivery = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, deliveryId),
      with: { truck: { columns: { driver_id: true } } },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (req.user?.role === "agent") {
      const profile = await db.query.agents.findFirst({
        where: eq(agents.user_id, req.user.userId),
        columns: { id: true },
      });
      if (!profile || delivery.agent_id !== profile.id) {
        return res.status(403).json({ error: "Only the assigned agent can record payment for this delivery" });
      }
    } else if (req.user?.role === "driver") {
      const profile = await db.query.drivers.findFirst({
        where: eq(drivers.user_id, req.user.userId),
        columns: { id: true },
      });
      if (!profile || (delivery.driver_id ?? delivery.truck?.driver_id) !== profile.id) {
        return res.status(403).json({ error: "Only the assigned driver can record payment for this delivery" });
      }
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to record payment for this delivery" });
    }

    const now = new Date();

    await db
      .update(delivery_items)
      .set({
        is_paid: isFullyPaid,
        payment_method,
        payment_reference: payment_reference ?? null,
        paid_at: isFullyPaid ? now : null,
        updated_at: now,
      })
      .where(eq(delivery_items.id, itemId));

    await db
      .update(receipts)
      .set({ payment_reference: payment_reference ?? null })
      .where(eq(receipts.delivery_item_id, itemId));

    await db
      .update(accounts_receivable)
      .set({
        amount_due: (remainingCents / 100).toFixed(2),
        status: isFullyPaid ? "paid" : "outstanding",
        updated_at: now,
      })
      .where(eq(accounts_receivable.id, outstanding.id));

    await db
      .update(invoices)
      .set({
        ...(isFullyPaid ? { status: "paid" as const, payment_status: "paid" } : { payment_status: "partial" }),
        updated_at: now,
      })
      .where(eq(invoices.id, item.invoice_id));

    if (req.user) {
      await logAction(
        req.user.userId,
        "record_payment",
        "delivery_item",
        itemId,
        { is_paid: false },
        { is_paid: isFullyPaid, payment_amount: (paymentCents / 100).toFixed(2), remaining_amount: (remainingCents / 100).toFixed(2), payment_method }
      );
    }

    const updated = await db.query.delivery_items.findFirst({
      where: eq(delivery_items.id, itemId),
    });

    res.json(updated);
  } catch (error) {
    console.error("Error recording delivery payment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
