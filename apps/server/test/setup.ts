import { afterAll, beforeAll, beforeEach } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";

if (!process.env.DATABASE_URL?.endsWith("buching_test")) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL must target the buching_test database. Got: ${process.env.DATABASE_URL}`,
  );
}

const migratorClient = postgres(process.env.DATABASE_URL, { max: 1 });
const migratorDb = drizzle(migratorClient);

beforeAll(async () => {
  await migrate(migratorDb, { migrationsFolder: "./src/db/migrations" });
});

beforeEach(async () => {
  const rows = await migratorClient<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
  `;
  if (rows.length === 0) return;
  const tableList = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await migratorClient.unsafe(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await migratorClient.end();
});

export { sql };
