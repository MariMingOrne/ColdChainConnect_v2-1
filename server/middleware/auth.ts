import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../auth";

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (payload.role === "driver" && !DRIVER_ALLOWED_PATHS.has(req.path)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  req.user = payload;
  next();
}

const DRIVER_ALLOWED_PATHS = new Set([
  "/api/driver-schedule",
  "/api/auth/refresh",
]);

export function requireRole(...roles: Array<"admin" | "agent" | "driver">) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
