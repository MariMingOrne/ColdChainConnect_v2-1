import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../auth";
import { CreateAccountRequest, CreateAccountResponse } from "@shared/api";

const ROLES: CreateAccountRequest["role"][] = ["admin", "agent"];

export const handleCreateAccount: RequestHandler = async (req, res) => {
  const body = req.body as Partial<CreateAccountRequest>;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;

  if (!username || !password || !role) {
    return res.status(400).json({ error: "Username, password, and role required" });
  }

  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "Role must be admin or agent" });
  }

  if (password.trim().length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const id = randomUUID();
    await db.insert(users).values({
      id,
      username,
      password_hash: await hashPassword(password),
      role,
    });

    const created: CreateAccountResponse = { id, username, role };
    res.status(201).json(created);
  } catch (error) {
    console.error("Account creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
