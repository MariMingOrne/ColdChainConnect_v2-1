import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { trucks } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { CreateTruckSchema, UpdateTruckSchema } from "../../shared/api";
import { logAction } from "../middleware/audit-logger";
import { demoTrucks } from "../demo-data";

export const listTrucks: RequestHandler = async (_req, res) => {
  try {
    // Use demo data if no database
    if (!process.env.DATABASE_URL) {
      return res.json(demoTrucks);
    }

    const allTrucks = await db.query.trucks.findMany();
    res.json(allTrucks);
  } catch (error) {
    console.error("Error fetching trucks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createTruck: RequestHandler = async (req: AuthRequest, res) => {
  const parsed = CreateTruckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { license_plate, district, driver_id } = parsed.data;

  try {
    const id = randomUUID();
    await db.insert(trucks).values({
      id,
      license_plate,
      district,
      driver_id,
      status: "available",
    });

    const newTruck = await db.query.trucks.findFirst({
      where: eq(trucks.id, id),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "truck",
        id,
        undefined,
        newTruck
      );
    }

    res.status(201).json(newTruck);
  } catch (error) {
    console.error("Error creating truck:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateTruck: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parsed = UpdateTruckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { license_plate, district, driver_id, status } = parsed.data;

  try {
    const existing = await db.query.trucks.findFirst({
      where: eq(trucks.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Truck not found" });
    }

    await db
      .update(trucks)
      .set({
        license_plate: license_plate || existing.license_plate,
        district: district || existing.district,
        driver_id: driver_id ?? existing.driver_id,
        status: status || existing.status,
        updated_at: new Date(),
      })
      .where(eq(trucks.id, id));

    const updated = await db.query.trucks.findFirst({
      where: eq(trucks.id, id),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "truck",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating truck:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteTruck: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const existing = await db.query.trucks.findFirst({
      where: eq(trucks.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Truck not found" });
    }

    await db.delete(trucks).where(eq(trucks.id, id));

    if (req.user) {
      await logAction(
        req.user.userId,
        "delete",
        "truck",
        id,
        existing,
        undefined
      );
    }

    res.json({ message: "Truck deleted" });
  } catch (error) {
    console.error("Error deleting truck:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
