import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
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
  const { truck_id, destinations, driver_id, scheduled_date } = req.body;

  if (!truck_id || !Array.isArray(destinations) || destinations.length === 0) {
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

    const invoiceIds = [...new Set(destinations.map((destination: { invoice_id: string }) => destination.invoice_id))];
    if (invoiceIds.length !== destinations.length) {
      return res.status(400).json({ error: "An invoice can only appear once in a delivery run" });
    }

    const saleInvoices = await db
      .select({ id: invoices.id, agent_id: invoices.agent_id })
      .from(invoices)
      .where(inArray(invoices.id, invoiceIds));
    if (saleInvoices.length !== invoiceIds.length) {
      return res.status(400).json({ error: "Every delivery stop must reference a valid invoice" });
    }

    const saleOwnerIds = [...new Set(saleInvoices.map((invoice) => invoice.agent_id))];
    if (saleOwnerIds.length !== 1) {
      return res.status(400).json({ error: "A delivery run can only contain sales placed by one agent" });
    }

    const saleOwnerId = saleOwnerIds[0];
    if (req.user?.role === "agent" && saleOwnerId !== req.user.userId) {
      return res.status(403).json({ error: "You can only dispatch sales you placed" });
    }

    const saleAgent = await db.query.agents.findFirst({
      where: eq(agents.user_id, saleOwnerId),
      columns: { id: true },
    });
    const resolvedAgentId = saleAgent?.id ?? null;
    const deliveryId = randomUUID();

    // Create delivery
    await db.insert(deliveries).values({
      id: deliveryId,
      truck_id,
      driver_id: driver_id ?? truck.driver_id ?? null,
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

// ─── PATCH /api/deliveries/:id/assign ────────────────────────────────────────
// Update the driver on an existing delivery. Agent assignment is derived from the sale owner.

export const assignDelivery: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  const { driver_id } = req.body;
  if (req.body.agent_id !== undefined) {
    return res.status(400).json({ error: "Agent assignment is derived from the sale owner" });
  }

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
    }

    await db
      .update(deliveries)
      .set({
        ...(driver_id !== undefined ? { driver_id: driver_id || null } : {}),
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
