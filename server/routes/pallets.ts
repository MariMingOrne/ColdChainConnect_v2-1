import { RequestHandler } from "express";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { Pallet, PalletItem, CreatePalletSchema, UpdatePalletStatusSchema } from "../../shared/api";
import { db } from "../db";
import { inventory_batches, batch_pallets, pallet_items, order_pallets, order_pallet_items, products, invoices, bookings } from "../db/schema";
import { getReservedUnitsBySource } from "../services/inventory-reservations";
import { AuthRequest } from "../middleware/auth";
import { getAgentOrderIds } from "../services/agent-bookings";
import { createInvoiceAfterPicking } from "../services/booking-invoices";
import { logAction } from "../middleware/audit-logger";

async function calculateProductInventory(): Promise<Record<string, number>> {
  try {
    if (!process.env.DATABASE_URL) {
      return {};
    }

    const result: Record<string, number> = {};

    const batches = await db.query.inventory_batches.findMany({
      where: eq(inventory_batches.is_archived, false),
      with: {
        pallets: {
          with: {
            items: true,
          },
        },
      },
    });

    const stockItems = batches.flatMap((batch) => batch.pallets.flatMap((pallet) => pallet.items));
    const reservedBySource = await getReservedUnitsBySource(stockItems.map((item) => item.id));

    for (const item of stockItems) {
      result[item.product_id] = (result[item.product_id] ?? 0) + Math.max(0, item.qty_units - (reservedBySource.get(item.id) ?? 0));
    }

    return result;
  } catch (error) {
    console.error("Error calculating inventory:", error);
    return {};
  }
}

function formatPallet(dbPallet: any): Pallet {
  return {
    id: dbPallet.id,
    order_id: dbPallet.order_id,
    truck_id: dbPallet.truck_id || undefined,
    status: dbPallet.status as "draft" | "prepared" | "approved" | "shipped",
    created_at: dbPallet.created_at.toISOString(),
    updated_at: dbPallet.updated_at.toISOString(),
    items: (dbPallet.items || []).map((item: any) => ({
      id: item.id,
      pallet_id: item.pallet_id,
      product_id: item.product_id,
      qty_units: item.qty_units,
      unit_cost: item.unit_cost || "0.00",
      batch_item_id: item.batch_item_id,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    })),
  };
}

async function tryInvoiceAfterPicking(orderId: string, userId?: string) {
  const result = await createInvoiceAfterPicking(orderId);
  if (result.status === "created" && userId && result.invoice) {
    await logAction(userId, "create", "invoice", result.invoice.id, undefined, result.invoice);
  }
  return result;
}

export const listPallets: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const agentOrderIds = req.user?.role === "agent"
      ? await getAgentOrderIds(req.user.userId)
      : undefined;
    if (agentOrderIds?.length === 0) return res.json([]);

    const dbPallets = await db.query.order_pallets.findMany({
      where: agentOrderIds ? inArray(order_pallets.order_id, agentOrderIds) : undefined,
      with: {
        items: true,
      },
      orderBy: (table) => [table.created_at],
    });

    const pallets = dbPallets.map(formatPallet);
    res.json(pallets);
  } catch (error) {
    console.error("Error fetching pallets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPallet: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dbPallet = await db.query.order_pallets.findFirst({
      where: eq(order_pallets.id, id),
      with: {
        items: true,
        order: true,
      },
    });

    if (!dbPallet) return res.status(404).json({ error: "Pallet not found" });
    if (req.user?.role === "agent" && !(await getAgentOrderIds(req.user.userId)).includes(dbPallet.order_id)) {
      return res.status(403).json({ error: "You can only view pallets for your own or assigned orders" });
    }
    res.json(formatPallet(dbPallet));
  } catch (error) {
    console.error("Error fetching pallet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createPallet: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { order_id, pallets } = CreatePalletSchema.parse(req.body);

    if (req.user?.role === "agent" && !(await getAgentOrderIds(req.user.userId)).includes(order_id)) {
      return res.status(403).json({ error: "You can only create pallets for your own or assigned orders" });
    }

    const requestedItems = pallets.flatMap((pallet) => pallet.items);
    const sourceIds = [...new Set(requestedItems.map((item) => item.batch_item_id))];
    const productRows = await db
      .select({ id: products.id, price: products.price })
      .from(products)
      .where(inArray(products.id, [...new Set(requestedItems.map((item) => item.product_id))]));
    const priceByProductId = new Map(productRows.map((product) => [product.id, product.price]));

    const result = await db.transaction(async (tx) => {
      const [booking] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, order_id)).for("update");
      if (!booking) return { status: "not_found" as const, palletIds: [] as string[] };

      const existingInvoice = await tx.query.invoices.findFirst({ where: eq(invoices.booking_id, order_id) });
      if (existingInvoice) return { status: "invoiced" as const, palletIds: [] as string[] };

      await tx.select({ id: pallet_items.id }).from(pallet_items).where(inArray(pallet_items.id, sourceIds)).for("update");
      const sourceItems = await tx.query.pallet_items.findMany({
        where: inArray(pallet_items.id, sourceIds),
        with: { pallet: { with: { batch: true } } },
      });
      const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
      if (sourceItems.length !== sourceIds.length) {
        return { status: "invalid_source" as const, palletIds: [] as string[] };
      }

      const reservedRows = await tx
        .select({
          sourceItemId: order_pallet_items.batch_item_id,
          quantity: sql<number>`sum(${order_pallet_items.qty_units})::int`,
        })
        .from(order_pallet_items)
        .innerJoin(order_pallets, eq(order_pallet_items.pallet_id, order_pallets.id))
        .where(and(inArray(order_pallet_items.batch_item_id, sourceIds), ne(order_pallets.status, "shipped")))
        .groupBy(order_pallet_items.batch_item_id);
      const reservedBySource = new Map(reservedRows.map((row) => [row.sourceItemId, row.quantity]));
      const requestedBySource = new Map<string, number>();

      for (const item of requestedItems) {
        const source = sourceById.get(item.batch_item_id);
        if (!source || source.product_id !== item.product_id || source.pallet.batch.is_archived) {
          return { status: "invalid_source" as const, palletIds: [] as string[] };
        }
        requestedBySource.set(item.batch_item_id, (requestedBySource.get(item.batch_item_id) ?? 0) + item.qty_units);
      }

      for (const [sourceItemId, requested] of requestedBySource) {
        const source = sourceById.get(sourceItemId)!;
        const available = source.qty_units - (reservedBySource.get(sourceItemId) ?? 0);
        if (requested > available) {
          return {
            status: "insufficient_stock" as const,
            palletIds: [] as string[],
            error: `Only ${Math.max(0, available)} units remain available from source item ${sourceItemId}.`,
          };
        }
      }

      const palletIds = pallets.map(() => randomUUID());
      for (const [index, pallet] of pallets.entries()) {
        const palletId = palletIds[index];
        await tx.insert(order_pallets).values({ id: palletId, order_id, status: "draft" });
        await tx.insert(order_pallet_items).values(pallet.items.map((item) => ({
          id: randomUUID(),
          pallet_id: palletId,
          product_id: item.product_id,
          qty_units: item.qty_units,
          batch_item_id: item.batch_item_id,
          unit_cost: priceByProductId.get(item.product_id) ?? "0.00",
        })));
      }
      return { status: "created" as const, palletIds };
    });

    if (result.status === "not_found") return res.status(404).json({ error: "Booking not found" });
    if (result.status === "invoiced") return res.status(409).json({ error: "This order has already been invoiced." });
    if (result.status === "invalid_source") return res.status(409).json({ error: "A selected inventory item is unavailable or no longer matches the product." });
    if (result.status === "insufficient_stock") return res.status(409).json({ error: result.error });

    const createdPallets = await db.query.order_pallets.findMany({
      where: inArray(order_pallets.id, result.palletIds),
      with: { items: true },
    });
    res.status(201).json(createdPallets.map(formatPallet));
  } catch (error: any) {
    console.error("Error creating pallet:", error);
    res.status(400).json({ error: error.message });
  }
};

export const updatePalletStatus: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = UpdatePalletStatusSchema.parse(req.body);
    const existing = await db.query.order_pallets.findFirst({ where: eq(order_pallets.id, id) });
    if (!existing) return res.status(404).json({ error: "Pallet not found" });

    if (req.user?.role === "agent" && !(await getAgentOrderIds(req.user.userId)).includes(existing.order_id)) {
      return res.status(403).json({ error: "You can only update pallets for your own or assigned orders" });
    }

    const statusRank: Record<Pallet["status"], number> = { draft: 0, prepared: 1, approved: 2, shipped: 3 };
    const updateResult = await db.transaction(async (tx) => {
      await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, existing.order_id)).for("update");
      const current = await tx.query.order_pallets.findFirst({
        where: eq(order_pallets.id, id),
        with: { items: true },
      });
      if (!current) return { status: "not_found" as const };

      const invoice = await tx.query.invoices.findFirst({ where: eq(invoices.booking_id, current.order_id) });
      if (req.user?.role === "agent") {
        const agentTransition =
          (current.status === "draft" && status === "prepared") ||
          (current.status === "prepared" && status === "approved") ||
          (current.status === "approved" && status === "shipped");
        if (!agentTransition) return { status: "invalid_transition" as const };
      }
      const movingBackward = statusRank[status] < statusRank[current.status as Pallet["status"]];
      if (invoice && movingBackward) return { status: "invoiced" as const };

      const isAllowedTransition =
        status === current.status ||
        (current.status === "draft" && status === "prepared") ||
        (current.status === "prepared" && status === "approved") ||
        (current.status === "approved" && status === "shipped") ||
        (movingBackward && !invoice);
      if (!isAllowedTransition) return { status: "invalid_transition" as const };
      if (status === "shipped" && !invoice) return { status: "invoice_required" as const };

      if (status === "shipped" && current.status !== "shipped") {
        const sourceIds = [...new Set(current.items.map((item) => item.batch_item_id))];
        await tx.select({ id: pallet_items.id }).from(pallet_items).where(inArray(pallet_items.id, sourceIds)).for("update");
        const sourceItems = await tx.query.pallet_items.findMany({
          where: inArray(pallet_items.id, sourceIds),
          with: { pallet: { with: { batch: true } } },
        });
        const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
        const quantitiesBySource = new Map<string, number>();
        for (const item of current.items) {
          quantitiesBySource.set(item.batch_item_id, (quantitiesBySource.get(item.batch_item_id) ?? 0) + item.qty_units);
        }
        if (sourceItems.length !== sourceIds.length) return { status: "invalid_source" as const };
        for (const [sourceId, quantity] of quantitiesBySource) {
          const source = sourceById.get(sourceId)!;
          if (source.pallet.batch.is_archived || source.qty_units < quantity) {
            return { status: "insufficient_stock" as const };
          }
        }
        for (const [sourceId, quantity] of quantitiesBySource) {
          const source = sourceById.get(sourceId)!;
          await tx.update(pallet_items)
            .set({ qty_units: source.qty_units - quantity, updated_at: new Date() })
            .where(eq(pallet_items.id, sourceId));
        }
      }

      await tx.update(order_pallets).set({ status, updated_at: new Date() }).where(eq(order_pallets.id, id));
      return { status: "updated" as const };
    });

    if (updateResult.status === "not_found") return res.status(404).json({ error: "Pallet not found" });
    if (updateResult.status === "invoiced") return res.status(409).json({ error: "Pallet status cannot be moved backward after invoicing." });
    if (updateResult.status === "invalid_transition") {
      return res.status(400).json({ error: "Prepare pallets before marking them ready, then mark ready pallets as shipped." });
    }
    if (updateResult.status === "invoice_required") return res.status(409).json({ error: "An issued invoice is required before shipping." });
    if (updateResult.status === "invalid_source") return res.status(409).json({ error: "A selected source inventory item no longer exists." });
    if (updateResult.status === "insufficient_stock") return res.status(409).json({ error: "Source stock is insufficient to ship this pallet." });

    const updated = await db.query.order_pallets.findFirst({ where: eq(order_pallets.id, id), with: { items: true } });
    const invoiceResult = await tryInvoiceAfterPicking(existing.order_id, req.user?.userId);
    const invoicePendingReason = invoiceResult.status === "incomplete_pick"
      ? "Invoice not created: picked quantities must exactly match the booking."
      : undefined;
    res.json({ ...formatPallet(updated), invoice_pending_reason: invoicePendingReason });
  } catch (error: any) {
    console.error("Error updating pallet status:", error);
    res.status(400).json({ error: error.message });
  }
};

export const approvePallet: RequestHandler = (req: AuthRequest, res, next) => {
  req.body = { ...req.body, status: "approved" };
  return updatePalletStatus(req, res, next);
};

export const deletePalletForOrder: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query.order_pallets.findFirst(
      { where: eq(order_pallets.id, id) }
    );
    if (!existing) return res.status(404).json({ error: "Pallet not found" });

    const deleteResult = await db.transaction(async (tx) => {
      await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, existing.order_id)).for("update");
      const current = await tx.query.order_pallets.findFirst({ where: eq(order_pallets.id, id) });
      if (!current) return "not_found";

      const existingInvoice = await tx.query.invoices.findFirst({
        where: eq(invoices.booking_id, current.order_id),
      });
      if (existingInvoice) return "invoiced";

      await tx.delete(order_pallets).where(eq(order_pallets.id, id));
      return "deleted";
    });

    if (deleteResult === "not_found") return res.status(404).json({ error: "Pallet not found" });
    if (deleteResult === "invoiced") {
      return res.status(409).json({ error: "Pallets cannot be removed after invoicing." });
    }
    res.json({ message: "Pallet deleted" });
  } catch (error) {
    console.error("Error deleting pallet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProductInventory: RequestHandler = async (_req, res) => {
  const inventory = await calculateProductInventory();
  res.json(inventory);
};

export const getProductStock: RequestHandler = async (req, res) => {
  const { productId } = req.params;
  const inventory = await calculateProductInventory();
  const stock = inventory[productId] || 0;
  res.json({ product_id: productId, available_stock: stock });
};

export const suggestBatches: RequestHandler = async (req, res) => {
  const { orderId } = req.params;

  res.json({
    order_id: orderId,
    suggested_batches: [],
  });
};
