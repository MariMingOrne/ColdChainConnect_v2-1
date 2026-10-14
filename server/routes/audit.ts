import { RequestHandler } from "express";
import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { agents, audit_logs, users } from "../db/schema";

export const listAuditLogs: RequestHandler = async (req, res) => {
  try {
    const { user_id, action, start_date, end_date, limit = "100" } = req.query;

    let whereConditions = [];

    if (user_id) {
      whereConditions.push((audit_logs.user_id as any) === user_id);
    }

    if (action) {
      whereConditions.push((audit_logs.action as any) === action);
    }

    if (start_date) {
      whereConditions.push(
        gte(audit_logs.created_at, new Date(start_date as string))
      );
    }

    if (end_date) {
      whereConditions.push(
        lte(audit_logs.created_at, new Date(end_date as string))
      );
    }

    const logs = await db.query.audit_logs.findMany({
      where:
        whereConditions.length > 0
          ? and(...(whereConditions as any))
          : undefined,
      orderBy: desc(audit_logs.created_at),
      limit: Math.min(parseInt(limit as string), 1000),
    });

    const userIds = [...new Set(logs.map((log) => log.user_id))];
    const userRows = userIds.length
      ? await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const agentRows = userIds.length
      ? await db
          .select({ user_id: agents.user_id, full_name: agents.full_name })
          .from(agents)
          .where(inArray(agents.user_id, userIds))
      : [];

    const agentNames = new Map(agentRows.map((a) => [a.user_id, a.full_name]));
    const usernames = new Map(userRows.map((u) => [u.id, u.username]));

    res.json(
      logs.map((log) => ({
        ...log,
        user_name: agentNames.get(log.user_id) || usernames.get(log.user_id) || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
