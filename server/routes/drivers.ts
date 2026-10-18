import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { drivers, users } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { hashPassword } from "../auth";

const driverWithUser = {
  user: { columns: { id: true, username: true, mfa_enabled: true } },
} as const;

type LoginInput = { username?: string; password?: string };

function readLoginInput(body: Record<string, unknown>): LoginInput {
  return {
    username: typeof body.username === "string" ? body.username.trim() : undefined,
    password: typeof body.password === "string" ? body.password : undefined,
  };
}

async function validateLoginInput(
  input: LoginInput,
  currentUserId: string | null,
  requirePassword: boolean
): Promise<string | null> {
  if (!input.username) {
    if (requirePassword && input.password) return "Username is required to set a password";
    return null;
  }
  if (requirePassword || input.password !== undefined) {
    if (!input.password || input.password.trim().length < 4) {
      return "Password must be at least 4 characters";
    }
  }
  const taken = await db.query.users.findFirst({ where: eq(users.username, input.username) });
  if (taken && taken.id !== currentUserId) return "Username already exists";
  return null;
}

export const listDrivers: RequestHandler = async (_req, res) => {
  try {
    const allDrivers = await db.query.drivers.findMany({ with: driverWithUser });
    res.json(allDrivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createDriver: RequestHandler = async (req: AuthRequest, res) => {
  const { full_name, contact_info, license, hire_date, employment_type, is_active = true } = req.body;
  const login = readLoginInput(req.body);

  if (!full_name) {
    return res.status(400).json({ error: "Full name is required" });
  }

  const wantsLogin = Boolean(login.username);
  if (wantsLogin) {
    const loginError = await validateLoginInput(login, null, true);
    if (loginError) return res.status(400).json({ error: loginError });
  }

  try {
    const id = randomUUID();
    let userId: string | null = null;

    if (wantsLogin) {
      userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        username: login.username!,
        password_hash: await hashPassword(login.password!),
        role: "driver",
      });
    }

    await db.insert(drivers).values({
      id,
      user_id: userId,
      full_name,
      contact_info,
      license,
      hire_date,
      employment_type,
      is_active,
    });

    const newDriver = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
      with: driverWithUser,
    });

    if (req.user) {
      await logAction(req.user.userId, "create", "driver", id, undefined, newDriver);
    }

    res.status(201).json(newDriver);
  } catch (error) {
    console.error("Error creating driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateDriver: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { full_name, contact_info, license, hire_date, employment_type, is_active } = req.body;
  const login = readLoginInput(req.body);

  try {
    const existing = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
      with: driverWithUser,
    });

    if (!existing) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const hasLogin = Boolean(existing.user_id);
    const wantsLoginChange = Boolean(login.username) || login.password !== undefined;
    if (wantsLoginChange) {
      const loginError = await validateLoginInput(
        { username: login.username ?? existing.user?.username, password: login.password },
        existing.user_id,
        !hasLogin
      );
      if (loginError) return res.status(400).json({ error: loginError });
    }

    if (wantsLoginChange && !hasLogin && !login.username) {
      return res.status(400).json({ error: "Username is required to create a login" });
    }

    if (wantsLoginChange && hasLogin) {
      const userUpdate: Partial<typeof users.$inferInsert> = { updated_at: new Date() };
      if (login.username) userUpdate.username = login.username;
      if (login.password) userUpdate.password_hash = await hashPassword(login.password);
      await db.update(users).set(userUpdate).where(eq(users.id, existing.user_id!));
    }

    if (wantsLoginChange && !hasLogin) {
      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        username: login.username!,
        password_hash: await hashPassword(login.password!),
        role: "driver",
      });
      await db.update(drivers).set({ user_id: userId }).where(eq(drivers.id, id));
    }

    await db.update(drivers).set({
      full_name: full_name ?? existing.full_name,
      contact_info: contact_info ?? existing.contact_info,
      license: license ?? existing.license,
      hire_date: hire_date ?? existing.hire_date,
      employment_type: employment_type ?? existing.employment_type,
      is_active: is_active ?? existing.is_active,
      updated_at: new Date(),
    }).where(eq(drivers.id, id));

    const updated = await db.query.drivers.findFirst({
      where: eq(drivers.id, id),
      with: driverWithUser,
    });

    if (req.user) {
      await logAction(req.user.userId, "update", "driver", id, existing, updated);
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
    if (existing.user_id) {
      await db.delete(users).where(eq(users.id, existing.user_id));
    }

    if (req.user) {
      await logAction(req.user.userId, "delete", "driver", id, existing, undefined);
    }

    res.json({ message: "Driver deleted" });
  } catch (error) {
    console.error("Error deleting driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
