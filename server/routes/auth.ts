import { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  refreshToken,
} from "../auth";
import { LoginRequest, LoginResponse, LogoutResponse } from "@shared/api";
import { AuthRequest } from "../middleware/auth";

export const handleLogin: RequestHandler<{}, LoginResponse | object> = async (
  req,
  res
) => {
  const { username, password } = req.body as LoginRequest;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    // Demo mode: allow any login with username
    if (!process.env.DATABASE_URL) {
      const token = signToken({
        userId: "demo-" + username,
        username: username,
        role: "admin",
      });

      return res.json({
        token,
        user: {
          id: "demo-" + username,
          username: username,
          role: "admin",
        },
      } as LoginResponse);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    } as LoginResponse);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleLogout: RequestHandler<{}, LogoutResponse> = (_req, res) => {
  res.json({ message: "Logged out successfully" });
};

export const handleRefresh: RequestHandler = (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const newToken = signToken(req.user);
  res.json({ token: newToken });
};

/**
 * PATCH /api/users/:userId/password
 * Admin-only: update the password_hash for any user account.
 * Used by the Drivers page when editing a driver's login credentials.
 */
export const updateUserPassword: RequestHandler = async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== "string" || password.trim().length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const password_hash = await hashPassword(password);

    await db
      .update(users)
      .set({ password_hash })
      .where(eq(users.id, userId));

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
