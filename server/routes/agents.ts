import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents, users } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { hashPassword } from "../auth";

export const listAgents: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (req.user?.role === "agent") {
      const agent = await db.query.agents.findFirst({
        where: eq(agents.user_id, req.user.userId),
        with: { user: { columns: { password_hash: false, mfa_secret: false } } },
      });
      return res.json(agent ? [agent] : []);
    }

    const allAgents = await db.query.agents.findMany({
      with: { user: { columns: { password_hash: false, mfa_secret: false } } },
    });
    res.json(allAgents);
  } catch (error) {
    console.error("List agents error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createAgent: RequestHandler = async (req: AuthRequest, res) => {
  const {
    username,
    password,
    full_name,
    email,
    contact_info,
    emergency_contact,
    hire_date,
    address,
    is_active = true,
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    // Check username uniqueness
    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Create user account
    const userId = randomUUID();
    const password_hash = await hashPassword(password);
    await db.insert(users).values({
      id: userId,
      username,
      password_hash,
      role: "agent",
    });

    // Create agent profile
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      user_id: userId,
      full_name,
      email,
      contact_info,
      emergency_contact,
      hire_date,
      address,
      is_active,
    });

    const newAgent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: { user: { columns: { password_hash: false, mfa_secret: false } } },
    });

    if (req.user) {
      await logAction(req.user.userId, "create", "agent", agentId, undefined, newAgent);
    }

    res.status(201).json(newAgent);
  } catch (error) {
    console.error("Create agent error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAgent: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    full_name,
    email,
    contact_info,
    emergency_contact,
    hire_date,
    address,
    is_active,
  } = req.body;

  try {
    const existing = await db.query.agents.findFirst({
      where: eq(agents.id, id),
      with: { user: { columns: { password_hash: false, mfa_secret: false } } },
    });

    if (!existing) {
      return res.status(404).json({ error: "Agent not found" });
    }

    await db.update(agents).set({
      full_name: full_name ?? existing.full_name,
      email: email ?? existing.email,
      contact_info: contact_info ?? existing.contact_info,
      emergency_contact: emergency_contact ?? existing.emergency_contact,
      hire_date: hire_date ?? existing.hire_date,
      address: address ?? existing.address,
      is_active: is_active !== undefined ? is_active : existing.is_active,
      updated_at: new Date(),
    }).where(eq(agents.id, id));

    const updated = await db.query.agents.findFirst({
      where: eq(agents.id, id),
      with: { user: { columns: { password_hash: false, mfa_secret: false } } },
    });

    if (req.user) {
      await logAction(req.user.userId, "update", "agent", id, existing, updated);
    }

    res.json(updated);
  } catch (error) {
    console.error("Update agent error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteAgent: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const existing = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Agent not found" });
    }

    await db.delete(agents).where(eq(agents.id, id));
    // Also delete the linked user account
    await db.delete(users).where(eq(users.id, existing.user_id));

    if (req.user) {
      await logAction(req.user.userId, "delete", "agent", id, existing, undefined);
    }

    res.json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Delete agent error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
