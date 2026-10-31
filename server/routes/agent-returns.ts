import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  agent_returns,
  invoices,
  invoice_items,
  pallet_items,
  batch_pallets,
  accounts_receivable,
} from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

// ─── GET /api/agent-returns ───────────────────────────────────────────────────
export const listAgentReturns: RequestHandler = async (_req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const all = await db.query.agent_returns.findMany({
      with: { invoice: true, customer: true, product: true, creator: true },
      orderBy: [desc(agent_returns.created_at)],
    });
    res.json(all);
  } catch (err) {
    console.error("Error listing agent returns:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── POST /api/agent-returns ──────────────────────────────────────────────────
export const createAgentReturn: RequestHandler = async (req: AuthRequest, res) => {
  const { invoice_id, customer_id, items, return_type, reason } = req.body;
  if (
    typeof invoice_id !== "string" ||
    typeof customer_id !== "string" ||
    !Array.isArray(items) || items.length === 0 ||
    !["good", "damaged"].includes(return_type)
  ) {
    return res.status(400).json({ error: "invoice_id, customer_id, items, and a valid return_type are required" });
  }

  if (
    items.some((item: any) =>
      typeof item?.product_id !== "string" ||
      !Number.isInteger(item.qty_returned) ||
      item.qty_returned < 1
    ) ||
    new Set(items.map((item: any) => item.product_id)).size !== items.length
  ) {
    return res.status(400).json({ error: "Each return item must have a unique product and a positive whole-number quantity" });
  }

  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoice_id),
      with: { booking: true, invoice_items: true },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.booking?.customer_id !== customer_id) {
      return res.status(400).json({ error: "Invoice does not belong to the selected customer" });
    }

    const invoiceLines = new Map(invoice.invoice_items.map((line) => [line.product_id, line]));
    if (items.some((item: any) => !invoiceLines.has(item.product_id))) {
      return res.status(400).json({ error: "Every returned product must belong to the selected invoice" });
    }

    const created = await db.transaction(async (tx) => {
      const values = items.map((item: { product_id: string; qty_returned: number }) => {
        const line = invoiceLines.get(item.product_id)!;
        return {
          id: randomUUID(),
          invoice_id,
          customer_id,
          product_id: item.product_id,
          product_name: line.product_name,
          qty_returned: item.qty_returned,
          return_type,
          reason: reason ?? null,
          status: "pending",
          created_by: req.user?.userId ?? null,
        };
      });
      return tx.insert(agent_returns).values(values).returning();
    });

    if (req.user) {
      await Promise.all(created.map((item) => logAction(req.user!.userId, "create", "agent_return", item.id)));
    }
    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating agent return:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── POST /api/agent-returns/:id/accept ──────────────────────────────────────
export const acceptAgentReturn: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const ret = await db.query.agent_returns.findFirst({ where: eq(agent_returns.id, id) });
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status !== "pending") return res.status(409).json({ error: "Return already processed" });

    let restoredPalletId: string | null = null;

    // If return_type === "good", restore qty to the most recent active pallet for this product
    if (ret.return_type === "good") {
      const existingPalletItem = await db.query.pallet_items.findFirst({
        where: eq(pallet_items.product_id, ret.product_id),
        with: { pallet: true },
      });

      if (existingPalletItem) {
        await db
          .update(pallet_items)
          .set({ qty_units: sql`${pallet_items.qty_units} + ${ret.qty_returned}`, updated_at: new Date() })
          .where(eq(pallet_items.id, existingPalletItem.id));
        restoredPalletId = existingPalletItem.pallet_id;
      }
      // If no existing pallet item, stock is just written off (no pallet to restore to)
    }
    // If return_type === "damaged", do NOT restore — write off only

    // Fetch invoice to get amount for AR credit note
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, ret.invoice_id) });

    // Calculate credit amount proportional to qty returned
    let creditAmount = "0.00";
    if (invoice) {
      const invItems = await db.query.invoice_items.findMany({
        where: eq(invoice_items.invoice_id, invoice.id),
      });
      const lineItem = invItems.find((i) => i.product_id === ret.product_id);
      if (lineItem) {
        const unitPrice = parseFloat(lineItem.unit_price);
        const computed = unitPrice * ret.qty_returned;
        creditAmount = computed > 0 ? computed.toFixed(2) : "0.00";
      } else if (invoice.total_amount) {
        // Fallback: use full invoice total as credit if line item not found
        creditAmount = parseFloat(invoice.total_amount) > 0
          ? parseFloat(invoice.total_amount).toFixed(2)
          : "0.00";
      }
    }

    // Create AR credit entry (negative — reduces what customer owes)
    // delivery_item_id is null because this credit originates from a return, not a delivery stop
    const arCreditId = randomUUID();
    await db.insert(accounts_receivable).values({
      id: arCreditId,
      customer_id: ret.customer_id,
      delivery_item_id: null,
      invoice_id: ret.invoice_id,
      amount_due: `-${creditAmount}`,
      status: "outstanding",
      notes: `Return credit: ${ret.qty_returned}x ${ret.product_name} (${ret.return_type}). Return ID: ${id}`,
    });

    // Update the return record
    await db
      .update(agent_returns)
      .set({
        status: "accepted",
        restored_to_pallet_id: restoredPalletId,
        ar_credit_id: arCreditId,
        reviewed_by: req.user?.userId ?? null,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(agent_returns.id, id));

    const updated = await db.query.agent_returns.findFirst({
      where: eq(agent_returns.id, id),
      with: { invoice: true, customer: true, product: true },
    });
    if (req.user) await logAction(req.user.userId, "accept", "agent_return", id, ret, updated);
    res.json(updated);
  } catch (err) {
    console.error("Error accepting agent return:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── POST /api/agent-returns/:id/reject ──────────────────────────────────────
export const rejectAgentReturn: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const ret = await db.query.agent_returns.findFirst({ where: eq(agent_returns.id, id) });
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status !== "pending") return res.status(409).json({ error: "Return already processed" });

    await db
      .update(agent_returns)
      .set({
        status: "rejected",
        reason: reason ?? ret.reason,
        reviewed_by: req.user?.userId ?? null,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(agent_returns.id, id));

    const updated = await db.query.agent_returns.findFirst({ where: eq(agent_returns.id, id) });
    if (req.user) await logAction(req.user.userId, "reject", "agent_return", id, ret, updated);
    res.json(updated);
  } catch (err) {
    console.error("Error rejecting agent return:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
