import jwt from "jsonwebtoken";
import { hash, compare } from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

export interface TokenPayload {
  userId: string;
  username: string;
  role: "admin" | "agent" | "driver";
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function signMfaChallenge(userId: string): string {
  return jwt.sign({ userId, purpose: "mfa" }, JWT_SECRET, { expiresIn: "5m" });
}

export function verifyMfaChallenge(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string };
    return payload.purpose === "mfa" ? payload.userId : null;
  } catch {
    return null;
  }
}

export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  return signToken(payload);
}
