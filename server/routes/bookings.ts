import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, booking_items, invoices, agents, trucks } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

// ─── Location → Truck matching ────────────────────────────────────────────
// Cities that belong to the "Metro Manila" / NCR district. Customer locations are
// stored as city names (e.g. "Makati City") while trucks cover broader districts
// (e.g. "Metro Manila"), so we group cities under their district here.
const METRO_MANILA_CITIES = [
  "manila", "quezon", "makati", "taguig", "pasig", "mandaluyong", "san juan",
  "marikina", "pasay", "paranaque", "parañaque", "las pinas", "las piñas",
  "muntinlupa", "caloocan", "malabon", "navotas", "valenzuela", "pateros",
  "bonifacio", "bgc", "global city",
];

const normalize = (value?: string | null) => (value || "").toLowerCase().trim();

function locationMatchesDistrict(location?: string | null, district?: string | null): boolean {
  const loc = normalize(location);
  const dist = normalize(district);
  if (!loc || !dist) return false;
  if (loc === dist) return true;
  // Substring either direction: "Tagaytay City" ↔ "Tagaytay"
  if (loc.includes(dist) || dist.includes(loc)) return true;
  // Metro Manila / NCR grouping for cities within it
  const distIsMetro = dist.includes("metro manila") || dist.includes("ncr");
  if (distIsMetro && METRO_MANILA_CITIES.some((city) => loc.includes(city))) return true;
  return false;
}

// Returns the best truck serving the given customer location, preferring an
// available truck. Returns null when no truck covers the location.
function findTruckForLocation(
  allTrucks: Array<{ id: string; district: string; status: string | null }>,
  location?: string | null
): { id: string; district: string; status: string | null } | null {
  const matches = allTrucks.filter((t) => locationMatchesDistrict(location, t.district));
  if (matches.length === 0) return null;
  return matches.find((t) => t.status === "available") || matches[0];
}

export const listBookings: RequestHandler = async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);

    const { status } = req.query;
    const whereClause = status ? eq(bookings.status, status as any) : undefined;

    const allBookings = await db.query.bookings.findMany({
      where: whereClause,
      with: {
        booking_items: {
          with: {
            product: true,
          },
        },
        customer: true,
        creator: true,
      },
    });

    res.json(allBookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createBooking: RequestHandler = async (req: AuthRequest, res) => {
  const { customer_id, items } = req.body;

  if (!customer_id || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Customer ID and items array are required" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const bookingId = randomUUID();

    await db.insert(bookings).values({
      id: bookingId,
      customer_id,
      created_by: req.user.userId,
      status: "pending",
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
        customer: true,
        creator: true,
      },
    });

    if (req.user) {
      await logAction(req.user.userId, "create", "booking", bookingId, undefined, newBooking);
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
    // - Otherwise, when approving, auto-assign the truck that serves the
    //   customer's location based on the truck's district.
    let resolvedTruckId: string | null = driver_id || null;
    if (!resolvedTruckId && status === "approved") {
      const allTrucks = await db.select().from(trucks);
      const matchedTruck = findTruckForLocation(allTrucks, existing.customer?.location);
      if (!matchedTruck) {
        return res.status(400).json({
          error: `No truck serves "${existing.customer?.location || "this location"}". Add a truck for that district first.`,
        });
      }
      resolvedTruckId = matchedTruck.id;
    }

    const updates: any = {};
    if (status) updates.status = status;

    await db.update(bookings).set(updates).where(eq(bookings.id, id));

    // When a truck is assigned, auto-create an invoice (only once per booking).
    let newInvoice = null;
    if (resolvedTruckId && req.user) {
      const existingInvoice = await db.query.invoices.findFirst({
        where: eq(invoices.booking_id, id),
      });

      if (existingInvoice) {
        newInvoice = existingInvoice;
      } else {
        // Use the logged-in user's ID directly — invoices.agent_id references users.id
        const agentId = req.user.userId;
        const invoiceId = randomUUID();

        try {
          await db.insert(invoices).values({
            id: invoiceId,
            booking_id: id,
            agent_id: agentId,
            status: "issued",
            payment_status: "unpaid",
          });

          newInvoice = await db.query.invoices.findFirst({
            where: eq(invoices.id, invoiceId),
          });

          await logAction(req.user.userId, "create", "invoice", invoiceId, undefined, newInvoice);
        } catch (invoiceErr) {
          console.error("Error creating invoice (truck still assigned):", invoiceErr);
          // Don't fail the whole request — truck assignment succeeded
        }
      }
    }

    const updated = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: { booking_items: true, customer: true, creator: true },
    });

    if (req.user) {
      await logAction(req.user.userId, "update", "booking", id, existing, updated);
    }

    res.json({ booking: updated, invoice: newInvoice });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
