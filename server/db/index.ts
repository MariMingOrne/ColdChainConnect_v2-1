import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
});

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
  pool.connect()
    .then((client) => {
      client.release();
      console.log("✓ Database connected (pool)");
    })
    .catch((err: any) => {
      console.error("❌ Database connection failed:", err.message);
      console.error("⚠️  Running in demo mode without database");
    });
}

export const db = drizzle(pool, { schema });
