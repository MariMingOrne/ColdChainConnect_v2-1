import { RequestHandler } from "express";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { zipSync, strToU8 } from "fflate";
import { db } from "../db";
import * as schema from "../db/schema";

const EXCLUDED_COLUMNS = new Set(["password_hash"]);

export const downloadBackup: RequestHandler = async (_req, res) => {
  try {
    const files: Record<string, Uint8Array> = {};
    const counts: Record<string, number> = {};

    for (const table of Object.values(schema)) {
      if (!is(table, PgTable)) continue;

      const name = getTableName(table);
      const rows = await db.select().from(table);
      const sanitized = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(([key]) => !EXCLUDED_COLUMNS.has(key))
        )
      );

      files[`${name}.json`] = strToU8(JSON.stringify(sanitized, null, 2));
      counts[name] = sanitized.length;
    }

    const generatedAt = new Date().toISOString();
    files["manifest.json"] = strToU8(
      JSON.stringify({ generated_at: generatedAt, tables: counts }, null, 2)
    );

    const zip = zipSync(files, { level: 6 });
    const filename = `backup-${generatedAt.slice(0, 10)}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(zip));
  } catch (error) {
    console.error("Error creating backup:", error);
    res.status(500).json({ error: "Failed to create backup" });
  }
};
