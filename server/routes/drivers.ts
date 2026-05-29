import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { drivers } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

export const listDrivers: RequestHandler = async (_req, res) => {
  try {
    const allDrivers = await db.query.drivers.findMany({
      with: {
        user: true,
      },
    });
    res.json(allDrivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createDriver: RequestHandler = async (req: AuthRequest, res) => {
  const { user_id, full_name, address, contact_info, emergency_contact, license, hire_date, employment_type } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const id = randomUUID();
    await db.insert(drivers).values({
      id,
      user_id,
      full_name,
      address,
      contact_info,
      emergency_contact,
      license,
      hire_date,
      employment_type,
      is_active: true,
    });

    const newDriver = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
      with: {
        user: true,
      },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "driver",
        id,
        undefined,
        newDriver
      );
    }

    res.status(201).json(newDriver);
  } catch (error) {
    console.error("Error creating driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateDriver: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { full_name, address, contact_info, emergency_contact, license, hire_date, employment_type, is_active } = req.body;

  try {
    const existing = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
      with: {
        user: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Driver not found" });
    }

    await db
      .update(drivers)
      .set({
        full_name: full_name ?? existing.full_name,
        address: address ?? existing.address,
        contact_info: contact_info ?? existing.contact_info,
        emergency_contact: emergency_contact ?? existing.emergency_contact,
        license: license ?? existing.license,
        hire_date: hire_date ?? existing.hire_date,
        employment_type: employment_type ?? existing.employment_type,
        is_active: is_active ?? existing.is_active,
        updated_at: new Date(),
      })
      .where(eq(drivers.id, id));

    const updated = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
      with: {
        user: true,
      },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "driver",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteDriver: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const existing = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Driver not found" });
    }

    await db.delete(drivers).where(eq(drivers.id, id));

    if (req.user) {
      await logAction(
        req.user.userId,
        "delete",
        "driver",
        id,
        existing,
        undefined
      );
    }

    res.json({ message: "Driver deleted" });
  } catch (error) {
    console.error("Error deleting driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
