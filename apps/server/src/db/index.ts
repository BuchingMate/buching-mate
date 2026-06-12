import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Modest pool with an idle timeout: `bun --watch` reloads spawn a fresh pool
// without closing the old one, and leaked idle connections piled up to
// Postgres' max_connections (FATAL 53300). The timeout lets orphans die.
const client = postgres(connectionString, { max: 5, idle_timeout: 20 });
export const db = drizzle(client, { schema });
