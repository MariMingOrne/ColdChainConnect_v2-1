import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { deliveries, delivery_items, accounts_receivable, invoices } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

export const listDeliveries: RequestHandler = async (req, res) => {
  try {
    // Demo mode
    if (!process.env.DATABASE_URL) {
      return res.json([]);
    }

    const { status } = req.query;

    const whereClause = status ? eq(deliveries.status, status as any) : undefined;

    const allDeliveries = await db.query.deliveries.findMany({
      where: whereClause,
      with: {
        delivery_items: true,
      },
    });

    res.json(allDeliveries);
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createDelivery: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { truck_id, destinations } = req.body;

  if (!truck_id || !destinations || !Array.isArray(destinations)) {
    return res.status(400).json({
      error: "Truck ID and destinations array are required",
    });
  }

  try {
    const deliveryId = randomUUID();

    // Create delivery
    await db.insert(deliveries).values({
      id: deliveryId,
      truck_id,
      status: "pending",
    });

    // Create delivery items (destinations)
    for (const dest of destinations) {
      await db.insert(delivery_items).values({
        id: randomUUID(),
        delivery_id: deliveryId,
        invoice_id: dest.invoice_id,
        destination_customer_id: dest.destination_customer_id,
        status: "pending",
      });
    }

    const newDelivery = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, deliveryId),
      with: {
        delivery_items: true,
      },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "delivery",
        deliveryId,
        undefined,
        newDelivery
      );
    }

    res.status(201).json(newDelivery);
  } catch (error) {
    console.error("Error creating delivery:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateDeliveryStatus: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    const existing = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    await db
      .update(deliveries)
      .set({
        status,
        updated_at: new Date(),
      })
      .where(eq(deliveries.id, id));

    const updated = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
      with: {
        delivery_items: true,
      },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "delivery",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating delivery status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateDeliveryItemStatus: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { deliveryId, itemId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    const existing = await db.query.delivery_items.findFirst({
      where: eq((delivery_items.id as any), itemId),
    });

    if (!existing) {
      return res.status(404).json({ error: "Delivery item not found" });
    }

    await db
      .update(delivery_items)
      .set({
        status,
        updated_at: new Date(),
      })
      .where((eq(delivery_items.id as any, itemId) as any));

    const updated = await db.query.delivery_items.findFirst({
      where: eq((delivery_items.id as any), itemId),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "delivery_item",
        itemId,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating delivery item status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
