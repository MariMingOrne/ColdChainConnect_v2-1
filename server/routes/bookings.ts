import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { bookings, booking_items } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

export const listBookings: RequestHandler = async (req, res) => {
  try {
    // Demo mode
    if (!process.env.DATABASE_URL) {
      return res.json([]);
    }

    const { status } = req.query;

    const whereClause = status ? eq(bookings.status, status as any) : undefined;

    const allBookings = await db.query.bookings.findMany({
      where: whereClause,
      with: {
        booking_items: true,
        customer: true,
        driver: {
          with: {
            user: true,
          },
        },
      },
    });

    res.json(allBookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createBooking: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { customer_id, driver_id, items } = req.body;

  if (!customer_id || !items || !Array.isArray(items)) {
    return res.status(400).json({
      error: "Customer ID and items array are required",
    });
  }

  try {
    const bookingId = randomUUID();

    // Create booking (auto-approve)
    await db.insert(bookings).values({
      id: bookingId,
      customer_id,
      driver_id,
      status: "approved",
    });

    // Create booking items
    for (const item of items) {
      await db.insert(booking_items).values({
        id: randomUUID(),
        booking_id: bookingId,
        product_id: item.product_id,
        qty_ordered: item.qty_ordered,
      });
    }

    const newBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        booking_items: true,
        customer: true,
        driver: {
          with: {
            user: true,
          },
        },
      },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "booking",
        bookingId,
        undefined,
        newBooking
      );
    }

    res.status(201).json(newBooking);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateBookingStatus: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  const { status, driver_id } = req.body;

  if (!status && !driver_id) {
    return res.status(400).json({ error: "Status or driver_id is required" });
  }

  try {
    const existing = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const updates: any = { updated_at: new Date() };
    if (status) updates.status = status;
    if (driver_id) updates.driver_id = driver_id;

    await db
      .update(bookings)
      .set(updates)
      .where(eq(bookings.id, id));

    const updated = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: {
        booking_items: true,
        customer: true,
        driver: {
          with: {
            user: true,
          },
        },
      },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "booking",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
