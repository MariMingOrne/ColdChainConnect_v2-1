import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { deliveries, delivery_items, accounts_receivable, invoices, agents, customers, trucks } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { isIsoDate, todayIsoDate } from "../services/schedule-date";
import { logAction } from "../middleware/audit-logger";

// ─── Safe query helper ────────────────────────────────────────────────────────
// Tries to include driver/agent relations (requires migration 0008 to be run).
// Falls back to delivery_items only if the columns don't exist yet, so the
// server never returns a 500 just because the migration is pending.

async function findDeliveryById(id: string) {
  try {
    return await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
      with: { delivery_items: true, driver: true, agent: true },
    });
  } catch {
    return await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
      with: { delivery_items: true },
    });
  }
}

async function findAllDeliveries(whereClause: any) {
  try {
    return await db.query.deliveries.findMany({
      where: whereClause,
      with: { delivery_items: true, driver: true, agent: true },
    });
  } catch {
    return await db.query.deliveries.findMany({
      where: whereClause,
      with: { delivery_items: true },
    });
  }
}

export const listDeliveries: RequestHandler = async (req: AuthRequest, res) => {
  try {
    // Demo mode
    if (!process.env.DATABASE_URL) {
      return res.json([]);
    }

    const conditions = [];
    const { status } = req.query;
    if (status) conditions.push(eq(deliveries.status, status as any));

    if (req.user?.role === "agent") {
      const agentProfile = await db.query.agents.findFirst({
        where: eq(agents.user_id, req.user.userId),
      });
      if (!agentProfile) return res.json([]);
      conditions.push(eq(deliveries.agent_id, agentProfile.id));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const allDeliveries = await findAllDeliveries(whereClause);

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
  const { truck_id, destinations, driver_id, agent_id, scheduled_date } = req.body;

  if (!truck_id || !destinations || !Array.isArray(destinations)) {
    return res.status(400).json({
      error: "Truck ID and destinations array are required",
    });
  }

  if (scheduled_date !== undefined && (typeof scheduled_date !== "string" || !isIsoDate(scheduled_date))) {
    return res.status(400).json({ error: "scheduled_date must be YYYY-MM-DD" });
  }

  try {
    const [truck] = await db.select().from(trucks).where(eq(trucks.id, truck_id));
    if (!truck) {
      return res.status(404).json({ error: "Truck not found" });
    }

    for (const dest of destinations) {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, dest.destination_customer_id),
      });
      if (!customer || customer.district !== truck.district) {
        return res.status(400).json({
          error: `Stops must be customers in ${truck.district}. ${customer?.store_name ?? "This customer"} is not in that district.`,
        });
      }
    }

    const deliveryId = randomUUID();

    // If the caller is an agent, resolve their agent profile id and lock it in.
    // An admin can supply agent_id manually; if omitted it stays null.
    let resolvedAgentId: string | null = agent_id ?? null;

    if (req.user?.role === "agent") {
      // Look up the agent row that corresponds to the logged-in user
      const agentProfile = await db.query.agents.findFirst({
        where: eq(agents.user_id, req.user.userId),
      });
      if (agentProfile) {
        resolvedAgentId = agentProfile.id;
      }
    }

    // Create delivery
    await db.insert(deliveries).values({
      id: deliveryId,
      truck_id,
      driver_id: driver_id ?? null,
      agent_id: resolvedAgentId,
      scheduled_date: scheduled_date ?? todayIsoDate(),
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

    const newDelivery = await findDeliveryById(deliveryId);

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

    const updated = await findDeliveryById(id);

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

// ─── DELETE /api/deliveries/:id ───────────────────────────────────────────────
// Releases (removes) a completed delivery. Only completed deliveries can be
// released — active/in-transit ones are blocked to prevent data loss.

export const releaseDelivery: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  try {
    const existing = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
      with: { delivery_items: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (existing.status !== "completed") {
      return res
        .status(400)
        .json({ error: "Only completed deliveries can be released" });
    }

    await db.delete(deliveries).where(eq(deliveries.id, id));

    if (req.user) {
      await logAction(
        req.user.userId,
        "delete",
        "delivery",
        id,
        existing,
        undefined
      );
    }

    res.json({ message: "Delivery released" });
  } catch (error) {
    console.error("Error releasing delivery:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── PATCH /api/deliveries/:id/assign ────────────────────────────────────────
// Update the driver and/or agent on an existing delivery.
// Agents can only update deliveries that belong to them (agent_id matches
// their own agent profile). Admins can assign freely.

export const assignDelivery: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  const { driver_id, agent_id } = req.body;

  try {
    const existing = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    // If the caller is an agent, verify ownership
    if (req.user?.role === "agent") {
      const agentProfile = await db.query.agents.findFirst({
        where: eq(agents.user_id, req.user.userId),
      });
      if (!agentProfile || (existing as any).agent_id !== agentProfile.id) {
        return res.status(403).json({ error: "You can only modify your own deliveries" });
      }
      // Agents cannot reassign agent_id away from themselves
      if (agent_id !== undefined && agent_id !== agentProfile.id) {
        return res.status(403).json({ error: "Agents cannot change the assigned agent" });
      }
    }

    await db
      .update(deliveries)
      .set({
        ...(driver_id !== undefined ? { driver_id: driver_id || null } : {}),
        ...(agent_id  !== undefined ? { agent_id:  agent_id  || null } : {}),
        updated_at: new Date(),
      })
      .where(eq(deliveries.id, id));

    const updated = await findDeliveryById(id);

    if (req.user) {
      await logAction(req.user.userId, "update", "delivery", id, existing, updated);
    }

    res.json(updated);
  } catch (error) {
    console.error("Error assigning delivery:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
