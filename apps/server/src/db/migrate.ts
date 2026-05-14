import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { logger } from "../observability/logger";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function runMigrations() {
  logger.info("running migrations");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  logger.info("migrations complete");
  await sql.end();
}

runMigrations().catch((error) => {
  logger.error({ err: error }, "migration failed");
  process.exit(1);
});
