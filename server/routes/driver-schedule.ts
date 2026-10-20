import { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { deliveries, drivers } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { isIsoDate, todayIsoDate } from "../services/schedule-date";

export const getDriverSchedule: RequestHandler = async (req: AuthRequest, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : todayIsoDate();
  if (!isIsoDate(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }

  try {
    let driverId: string | undefined;

    if (req.user?.role === "driver") {
      const profile = await db.query.drivers.findFirst({
        where: eq(drivers.user_id, req.user.userId),
      });
      if (!profile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      driverId = profile.id;
    } else {
      driverId = typeof req.query.driver_id === "string" ? req.query.driver_id : undefined;
      if (!driverId) {
        return res.status(400).json({ error: "driver_id is required" });
      }
    }

    const driver = await db.query.drivers.findFirst({
      where: eq(drivers.id, driverId),
      columns: { id: true, full_name: true },
    });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const scheduledRuns = await db.query.deliveries.findMany({
      where: eq(deliveries.scheduled_date, date),
      with: {
        truck: true,
        delivery_items: {
          with: {
            destination_customer: true,
            invoice: { with: { invoice_items: true } },
          },
        },
      },
    });
    const runs = scheduledRuns.filter((run) => (run.driver_id ?? run.truck.driver_id) === driverId);

    res.json({ date, driver, deliveries: runs });
  } catch (error) {
    console.error("Error fetching driver schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
