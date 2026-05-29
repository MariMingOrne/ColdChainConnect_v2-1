import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

export const listAgents: RequestHandler = async (_req, res) => {
  try {
    const allAgents = await db.query.agents.findMany();
    res.json(allAgents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createAgent: RequestHandler = async (req: AuthRequest, res) => {
  const { name, email, phone, role } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: "Name, email, and role are required" });
  }

  try {
    const id = randomUUID();
    await db.insert(agents).values({
      id,
      name,
      email,
      phone,
      role,
      is_active: true,
    });

    const newAgent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "agent",
        id,
        undefined,
        newAgent
      );
    }

    res.status(201).json(newAgent);
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAgent: RequestHandler = async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, email, phone, role, is_active } = req.body;

  try {
    const existing = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Agent not found" });
    }

    await db
      .update(agents)
      .set({
        name: name ?? existing.name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        role: role ?? existing.role,
        is_active: is_active ?? existing.is_active,
        updated_at: new Date(),
      })
      .where(eq(agents.id, id));

    const updated = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "agent",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating agent:", error);
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

    if (req.user) {
      await logAction(
        req.user.userId,
        "delete",
        "agent",
        id,
        existing,
        undefined
      );
    }

    res.json({ message: "Agent deleted" });
  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
