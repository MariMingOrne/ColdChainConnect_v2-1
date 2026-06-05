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
  const { notes, confirmed_by, is_paid, payment_method } = req.body ?? {};

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

    // 3. Load the parent delivery to get the truck_id
    const delivery = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, deliveryId),
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
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
        is_paid: is_paid ?? false,
        payment_method: is_paid ? payment_method : null,
        paid_at: is_paid ? now : null,
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
      confirmed_at: now,
    });

    // 7. If NOT paid, create Accounts Receivable entry
    if (!is_paid) {
      // Calculate the total invoice amount from booking items
      let totalAmount = "0";
      if (invoice.booking?.booking_items) {
        totalAmount = invoice.booking.booking_items
          .reduce((sum, item: any) => sum + (parseFloat(item.qty_ordered || 0) * (invoice.booking?.customer_id ? 100 : 0)), 0)
          .toString();
      }

      const arId = randomUUID();
      await db.insert(accounts_receivable).values({
        id: arId,
        customer_id: item.destination_customer_id,
        delivery_item_id: itemId,
        invoice_id: item.invoice_id,
        amount_due: totalAmount || "0.00",
        status: "outstanding",
        notes: `Delivery completed on ${now.toISOString()}. Payment method: pending. Customer still owes this amount.`,
      });
    }

    // 8. Only mark invoice as paid if payment was made
    if (is_paid) {
      await db
        .update(invoices)
        .set({
          status: "paid",
          payment_status: "paid",
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
          is_paid: is_paid ?? false,
          payment_method: is_paid ? payment_method : null,
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
