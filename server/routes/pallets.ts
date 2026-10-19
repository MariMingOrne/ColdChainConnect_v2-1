import { RequestHandler } from "express";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { Pallet, PalletItem, CreatePalletSchema, UpdatePalletStatusSchema } from "../../shared/api";
import { db } from "../db";
import { inventory_batches, batch_pallets, pallet_items, order_pallets, order_pallet_items, products } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { getAgentOrderIds } from "../services/agent-bookings";

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

    for (const batch of batches) {
      for (const pallet of batch.pallets) {
        for (const item of pallet.items) {
          const productId = item.product_id;
          if (!result[productId]) {
            result[productId] = 0;
          }
          result[productId] += item.qty_units;
        }
      }
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
    const { order_id, items } = CreatePalletSchema.parse(req.body);
    const palletId = randomUUID();

    if (req.user?.role === "agent" && !(await getAgentOrderIds(req.user.userId)).includes(order_id)) {
      return res.status(403).json({ error: "You can only create pallets for your own or assigned orders" });
    }

    const productRows = await db
      .select({ id: products.id, price: products.price })
      .from(products)
      .where(inArray(products.id, items.map((item) => item.product_id)));
    const priceByProductId = new Map(productRows.map((p) => [p.id, p.price]));

    await db.insert(order_pallets).values({
      id: palletId,
      order_id,
      status: "draft",
    });

    const itemsData = items.map((item) => ({
      id: randomUUID(),
      pallet_id: palletId,
      product_id: item.product_id,
      qty_units: item.qty_units,
      batch_item_id: item.batch_item_id,
      unit_cost: priceByProductId.get(item.product_id) ?? "0.00",
    }));

    for (const item of itemsData) {
      await db.insert(order_pallet_items).values(item);
    }

    const newPallet = await db.query.order_pallets.findFirst({
      where: eq(order_pallets.id, palletId),
      with: { items: true },
    });

    res.status(201).json(formatPallet(newPallet));
  } catch (error: any) {
    console.error("Error creating pallet:", error);
    res.status(400).json({ error: error.message });
  }
};

export const updatePalletStatus: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = UpdatePalletStatusSchema.parse(req.body);

    const existing = await db.query.order_pallets.findFirst({
      where: eq(order_pallets.id, id),
      with: { items: true, order: true },
    });
    if (!existing) return res.status(404).json({ error: "Pallet not found" });

    if (req.user?.role === "agent") {
      if (!(await getAgentOrderIds(req.user.userId)).includes(existing.order_id)) {
        return res.status(403).json({ error: "You can only update pallets for your own or assigned orders" });
      }

      const validTransition =
        (existing.status === "draft" && status === "prepared") ||
        (existing.status === "approved" && status === "shipped");
      if (!validTransition) {
        return res.status(400).json({ error: "Pallets must be prepared and approved before shipping" });
      }
    }

    await db.update(order_pallets)
      .set({ status, updated_at: new Date() })
      .where(eq(order_pallets.id, id));

    const updated = await db.query.order_pallets.findFirst({
      where: eq(order_pallets.id, id),
      with: { items: true },
    });

    res.json(formatPallet(updated));
  } catch (error: any) {
    console.error("Error updating pallet status:", error);
    res.status(400).json({ error: error.message });
  }
};

export const approvePallet: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const pallet = await db.query.order_pallets.findFirst({
      where: eq(order_pallets.id, id),
      with: { items: true, order: true },
    });

    if (!pallet) return res.status(404).json({ error: "Pallet not found" });

    if (req.user?.role === "agent" && !(await getAgentOrderIds(req.user.userId)).includes(pallet.order_id)) {
      return res.status(403).json({ error: "You can only approve pallets for your own or assigned orders" });
    }

    const requiredStatus = req.user?.role === "agent" ? "prepared" : "draft";
    if (pallet.status !== requiredStatus) {
      return res.status(400).json({ error: `Only ${requiredStatus} pallets can be approved` });
    }

    const inventory = await calculateProductInventory();

    if (pallet.items) {
      for (const item of pallet.items) {
        const available = inventory[item.product_id] || 0;
        if (available < item.qty_units) {
          return res.status(400).json({
            error: `Insufficient inventory for product ${item.product_id}. Available: ${available}, Needed: ${item.qty_units}`,
          });
        }
      }
    }

    await db.update(order_pallets)
      .set({ status: "approved", updated_at: new Date() })
      .where(eq(order_pallets.id, id));

    const updated = await db.query.order_pallets.findFirst({
      where: eq(order_pallets.id, id),
      with: { items: true },
    });

    res.json(formatPallet(updated));
  } catch (error: any) {
    console.error("Error approving pallet:", error);
    res.status(400).json({ error: error.message });
  }
};

export const deletePalletForOrder: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query.order_pallets.findFirst(
      { where: eq(order_pallets.id, id) }
    );
    if (!existing) return res.status(404).json({ error: "Pallet not found" });

    await db.delete(order_pallets).where(eq(order_pallets.id, id));
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
