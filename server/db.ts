import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import { schemaSql } from "./schema-sql";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Single connection pool initialized once at startup
// max: 10 limits concurrent connections to prevent memory bloat
// idle_timeout: 20 seconds to release unused connections
// connect_timeout: 10 seconds max wait for connection
const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

// Run schema creation directly (no migration files needed)
export async function runMigrations() {
  console.log("Ensuring database schema exists...");
  try {
    const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
    await migrationClient.unsafe(schemaSql);
    await migrationClient.end();
    console.log("Database schema verified/created successfully");
  } catch (error: any) {
    console.error("Schema creation error:", error?.message || error);
    // Don't throw - allow server to start
  }
}
