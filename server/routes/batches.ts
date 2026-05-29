import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { inventory_batches, batch_pallets, pallet_items } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

export const listBatches: RequestHandler = async (_req, res) => {
  try {
    const allBatches = await db.query.inventory_batches.findMany({
      with: {
        pallets: {
          with: {
            items: {
              with: {
                product: true,
              },
            },
          },
        },
      },
    });
    res.json(allBatches);
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createBatch: RequestHandler = async (req: AuthRequest, res) => {
  const { batch_name, pallets } = req.body;

  if (!batch_name || !pallets || !Array.isArray(pallets) || pallets.length === 0) {
    return res.status(400).json({ error: "Batch name and pallets are required" });
  }

  try {
    const batchId = randomUUID();
    await db.insert(inventory_batches).values({
      id: batchId,
      batch_name,
    });

    for (const pallet of pallets) {
      const { pallet_id, supplier_name, received_date, temperature_log, storage_zone, placement_location, items } = pallet;

      if (!pallet_id || !items || !Array.isArray(items) || items.length === 0) {
        throw new Error("Each pallet must have an ID and items");
      }

      const palletDbId = randomUUID();
      await db.insert(batch_pallets).values({
        id: palletDbId,
        batch_id: batchId,
        pallet_id,
        supplier_name: supplier_name || null,
        received_date: received_date || null,
        temperature_log: temperature_log || null,
        storage_zone: storage_zone || null,
        placement_location: placement_location || null,
      });

      for (const item of items) {
        const { product_id, qty_units, expiration_date_note } = item;
        if (!product_id || !qty_units) {
          throw new Error("Each item must have product_id and qty_units");
        }

        const itemId = randomUUID();
        await db.insert(pallet_items).values({
          id: itemId,
          pallet_id: palletDbId,
          product_id,
          qty_units,
          expiration_date_note: expiration_date_note || null,
        });
      }
    }

    const newBatch = await db.query.inventory_batches.findFirst({
      where: eq(inventory_batches.id, batchId),
      with: {
        pallets: {
          with: {
            items: {
              with: { product: true },
            },
          },
        },
      },
    });

    if (req.user) await logAction(req.user.userId, "create", "batch", batchId, undefined, newBatch);
    res.status(201).json(newBatch);
  } catch (error) {
    console.error("Error creating batch:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
};

export const updateBatch: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { batch_name } = req.body;

  try {
    const existing = await db.query.inventory_batches.findFirst({ where: eq(inventory_batches.id, id) });
    if (!existing) return res.status(404).json({ error: "Batch not found" });

    if (batch_name) {
      await db.update(inventory_batches).set({
        batch_name,
        updated_at: new Date(),
      }).where(eq(inventory_batches.id, id));
    }

    const updated = await db.query.inventory_batches.findFirst({
      where: eq(inventory_batches.id, id),
      with: {
        pallets: {
          with: {
            items: { with: { product: true } },
          },
        },
      },
    });
    if (req.user) await logAction(req.user.userId, "update", "batch", id, existing, updated);
    res.json(updated);
  } catch (error) {
    console.error("Error updating batch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteBatch: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const existing = await db.query.inventory_batches.findFirst({ where: eq(inventory_batches.id, id) });
    if (!existing) return res.status(404).json({ error: "Batch not found" });
    await db.delete(inventory_batches).where(eq(inventory_batches.id, id));
    if (req.user) await logAction(req.user.userId, "delete", "batch", id, existing, undefined);
    res.json({ message: "Batch deleted" });
  } catch (error) {
    console.error("Error deleting batch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
