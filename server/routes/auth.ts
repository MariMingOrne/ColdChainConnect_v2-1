import { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  refreshToken,
  signMfaChallenge,
  verifyMfaChallenge,
} from "../auth";
import {
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  MfaChallengeResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
} from "@shared/api";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

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

    res.json({
      mfa: user.mfa_enabled ? "verify" : "setup",
      challenge_token: signMfaChallenge(user.id),
    } as MfaChallengeResponse);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleMfaSetup: RequestHandler = async (req, res) => {
  const { challenge_token } = req.body as { challenge_token?: string };
  const userId = challenge_token ? verifyMfaChallenge(challenge_token) : null;
  if (!userId) {
    return res.status(401).json({ error: "Sign-in expired. Please log in again." });
  }

  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return res.status(401).json({ error: "Sign-in expired. Please log in again." });
    if (user.mfa_enabled) {
      return res.status(400).json({ error: "MFA is already enabled for this account" });
    }

    const secret = generateSecret();
    const otpauth_url = generateURI({
      issuer: "Cold Chain Connect",
      label: user.username,
      secret,
    });
    const qr_data_url = await QRCode.toDataURL(otpauth_url);

    await db.update(users).set({ mfa_secret: secret }).where(eq(users.id, userId));

    res.json({ secret, otpauth_url, qr_data_url } as MfaSetupResponse);
  } catch (error) {
    console.error("MFA setup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleMfaVerify: RequestHandler = async (req, res) => {
  const { challenge_token, code } = req.body as MfaVerifyRequest;
  const userId = challenge_token ? verifyMfaChallenge(challenge_token) : null;
  if (!userId) {
    return res.status(401).json({ error: "Sign-in expired. Please log in again." });
  }
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the 6-digit code from your authenticator app" });
  }

  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return res.status(401).json({ error: "Sign-in expired. Please log in again." });
    if (!user.mfa_secret) {
      return res.status(400).json({ error: "MFA is not set up for this account" });
    }

    const result = await verify({ secret: user.mfa_secret, token: code });
    if (!result.valid) {
      return res.status(401).json({ error: "Invalid code. Check your authenticator app and try again." });
    }

    if (!user.mfa_enabled) {
      await db.update(users).set({ mfa_enabled: true }).where(eq(users.id, userId));
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
    console.error("MFA verify error:", error);
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

/**
 * POST /api/users/:userId/mfa/reset
 * Admin-only: clear a user's authenticator enrollment so they set up MFA again at next login.
 */
export const resetUserMfa: RequestHandler = async (req: AuthRequest, res) => {
  const { userId } = req.params;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await db
      .update(users)
      .set({ mfa_enabled: false, mfa_secret: null })
      .where(eq(users.id, userId));

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "user_mfa",
        userId,
        { mfa_enabled: user.mfa_enabled },
        { mfa_enabled: false }
      );
    }

    res.json({ id: user.id, username: user.username, mfa_enabled: false });
  } catch (error) {
    console.error("MFA reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
