import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import type { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../migrations");

export async function runPostgresMigrations(client: Client): Promise<void> {
  await runner({
    dbClient: client,
    dir: migrationsDir,
    direction: "up",
    migrationsTable: "pgmigrations",
    migrationsSchema: "app_migrations",
    createMigrationsSchema: true,
    singleTransaction: true,
    checkOrder: true,
    advisoryLockMode: "fail",
    migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
  });
}
