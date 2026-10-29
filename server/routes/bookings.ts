import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { bookings, booking_items, invoices, agents, trucks, users, order_pallets } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { CreditBlockResponse } from "../../shared/api";
import { evaluateCreditRules } from "../services/credit-rules";
import { estimateOrderTotal, loadCustomerCredit } from "../services/customer-credit";
import { getAgentOrderIds } from "../services/agent-bookings";

// Returns the truck serving the given district, preferring an available truck.
function findTruckForDistrict(
  allTrucks: Array<{ id: string; district: string; status: string | null }>,
  district: string
): { id: string; district: string; status: string | null } | null {
  const matches = allTrucks.filter((t) => t.district === district);
  if (matches.length === 0) return null;
  return matches.find((t) => t.status === "available") || matches[0];
}

export const listBookings: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);

    const { status } = req.query;
    const agentOrderIds = req.user?.role === "agent"
      ? await getAgentOrderIds(req.user.userId)
      : undefined;
    if (agentOrderIds?.length === 0) return res.json([]);

    const conditions = [
      status ? eq(bookings.status, status as any) : undefined,
      agentOrderIds ? inArray(bookings.id, agentOrderIds) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [allBookings, agentProfiles] = await Promise.all([
      db.query.bookings.findMany({
        where: whereClause,
        with: {
          booking_items: {
            with: {
              product: true,
            },
          },
          customer: { with: { discounts: true } },
          creator: true,
        },
      }),
      db.query.agents.findMany({
        columns: { user_id: true, full_name: true },
      }),
    ]);
    const agentByUserId = new Map(agentProfiles.map((agent) => [agent.user_id, agent]));

    res.json(allBookings.map((booking) => ({
      ...booking,
      creator: booking.creator
        ? { ...booking.creator, agent: agentByUserId.get(booking.created_by) ?? null }
        : booking.creator,
    })));
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createBooking: RequestHandler = async (req: AuthRequest, res) => {
  const { customer_id, prepared_delivery_date, items, ar_override, ar_override_reason } = req.body;

  if (!customer_id || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Customer ID and items array are required" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Demo mode: no real DB, skip insert and return a stub
  if (!process.env.DATABASE_URL) {
    return res.status(201).json({
      id: randomUUID(),
      customer_id,
      prepared_delivery_date: prepared_delivery_date || null,
      status: "pending",
      booking_items: [],
    });
  }

  try {
    // Validate that the user in the JWT actually exists in the DB.
    // Prevents FK violations when a stale or demo token is used.
    const creatorExists = await db.query.users.findFirst({
      where: eq(users.id, req.user.userId),
    });
    if (!creatorExists) {
      return res.status(401).json({ error: "User account not found. Please log in again." });
    }

    if (items.some((item: { product_id?: string; qty_ordered?: unknown }) => !item?.product_id || item.qty_ordered === undefined)) {
      return res.status(400).json({ error: "Each item needs a product_id and qty_ordered" });
    }

    const credit = await loadCustomerCredit(customer_id);
    if (!credit) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const newOrderAmount = await estimateOrderTotal(items, credit.discountRate);
    const violations = evaluateCreditRules({ ...credit.state, newOrderAmount });

    let creditOverride: { reason: string; violations: typeof violations } | null = null;
    if (violations.length > 0) {
      const isAdmin = req.user.role === "admin";
      const reason = typeof ar_override_reason === "string" ? ar_override_reason.trim() : "";
      if (!isAdmin || ar_override !== true) {
        const block: CreditBlockResponse = {
          error: "This customer's credit terms or limit block this booking.",
          code: "AR_CREDIT_BLOCKED",
          violations,
          canOverride: isAdmin,
        };
        return res.status(409).json(block);
      }
      if (!reason) {
        return res.status(400).json({ error: "An override reason is required" });
      }
      creditOverride = { reason, violations };
    }

    const bookingId = randomUUID();

    await db.insert(bookings).values({
      id: bookingId,
      customer_id,
      created_by: req.user.userId,
      status: "pending",
      prepared_delivery_date: prepared_delivery_date || null,
    });

    for (const item of items) {
      if (!item.product_id || item.qty_ordered === undefined) {
        throw new Error(`Invalid item: ${JSON.stringify(item)}`);
      }
      await db.insert(booking_items).values({
        id: randomUUID(),
        booking_id: bookingId,
        product_id: item.product_id,
        qty_ordered: parseInt(String(item.qty_ordered)),
      });
    }

    const newBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        booking_items: {
          with: {
            product: true,
          },
        },
        customer: { with: { discounts: true } },
        creator: true,
      },
    });

    if (req.user) {
      await logAction(req.user.userId, "create", "booking", bookingId, undefined, newBooking);
    }

    if (req.user && creditOverride) {
      await logAction(req.user.userId, "ar_credit_override", "booking", bookingId, undefined, {
        customer_id,
        reason: creditOverride.reason,
        violations: creditOverride.violations,
        new_order_amount: newOrderAmount,
      });
    }

    res.status(201).json(newBooking);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
};

export const updateBookingStatus: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, driver_id } = req.body;

  if (!status && !driver_id) {
    return res.status(400).json({ error: "Status or driver_id is required" });
  }

  try {
    const existing = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: { customer: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Resolve which truck this booking should go to.
    // - If a truck was passed explicitly (driver_id), honor it.
    // - Otherwise, when approving, auto-assign the truck serving the customer's district.
    let resolvedTruckId: string | null = driver_id || null;
    if (driver_id) {
      const [explicitTruck] = await db.select().from(trucks).where(eq(trucks.id, driver_id));
      if (!explicitTruck) {
        return res.status(404).json({ error: "Truck not found" });
      }
      if (explicitTruck.district !== existing.customer?.district) {
        return res.status(400).json({
          error: `${explicitTruck.license_plate} serves ${explicitTruck.district}, but this customer is in ${existing.customer?.district || "no district"}.`,
        });
      }
    }
    if (!resolvedTruckId && status === "approved") {
      const customerDistrict = existing.customer?.district;
      if (!customerDistrict) {
        return res.status(400).json({
          error: `Set a truck district for "${existing.customer?.store_name || "this customer"}" in Customers first.`,
        });
      }
      const allTrucks = await db.select().from(trucks);
      const matchedTruck = findTruckForDistrict(allTrucks, customerDistrict);
      if (!matchedTruck) {
        return res.status(400).json({
          error: `No truck serves "${customerDistrict}". Add a truck for that district first.`,
        });
      }
      resolvedTruckId = matchedTruck.id;
    }

    const updates: any = {};
    if (status) updates.status = status;

    const updateResult = await db.transaction(async (tx) => {
      await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, id)).for("update");
      if (status && status !== "approved") {
        const existingInvoice = await tx.query.invoices.findFirst({
          where: eq(invoices.booking_id, id),
        });
        if (existingInvoice) return "invoiced";

        const reservedPallet = await tx.query.order_pallets.findFirst({
          where: eq(order_pallets.order_id, id),
        });
        if (reservedPallet) return "reserved";
      }
      await tx.update(bookings).set(updates).where(eq(bookings.id, id));
      return "updated";
    });
    if (updateResult === "invoiced") {
      return res.status(409).json({ error: "An invoiced order cannot be moved out of approved status." });
    }
    if (updateResult === "reserved") {
      return res.status(409).json({ error: "Remove the order's unshipped pallets before moving it out of approved status." });
    }

    const updated = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: { booking_items: true, customer: true, creator: true },
    });

    if (req.user) {
      await logAction(req.user.userId, "update", "booking", id, existing, updated);
    }

    res.json({ booking: updated, invoice: null });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteBooking: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const existing = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const isAdmin = req.user.role === "admin";
    if (!isAdmin && existing.created_by !== req.user.userId) {
      return res.status(403).json({ error: "You can only roll back orders you created" });
    }
    if (existing.status !== "pending") {
      return res.status(400).json({ error: "Only pending orders can be rolled back" });
    }

    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.booking_id, id) });
    if (invoice) {
      return res.status(409).json({ error: "This order already has an invoice and cannot be rolled back" });
    }

    const preparedPallet = await db.query.order_pallets.findFirst({
      where: and(eq(order_pallets.order_id, id), ne(order_pallets.status, "draft")),
    });
    if (preparedPallet) {
      return res.status(409).json({ error: "This order has prepared pallets and cannot be rolled back" });
    }

    await db.delete(bookings).where(eq(bookings.id, id));
    await logAction(req.user.userId, "rollback", "booking", id, existing, undefined);

    res.status(204).end();
  } catch (error) {
    console.error("Error rolling back booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
