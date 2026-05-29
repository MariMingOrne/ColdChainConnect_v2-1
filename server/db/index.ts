import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Only connect in non-development or when DATABASE_URL is explicitly set
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
  client.connect()
    .then(() => {
      console.log("✓ Database connected");
    })
    .catch((err: any) => {
      console.error("❌ Database connection failed:", err.message);
      console.error("⚠️  Running in demo mode without database");
    });
}

export const db = drizzle(client, { schema });
