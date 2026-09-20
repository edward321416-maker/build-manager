import { Pool, type PoolConfig } from "pg";

export type PostgresDatabase = { close(): Promise<void> };
const pools = new WeakMap<PostgresDatabase, Pool>();

export function createPostgresDatabase(config: PoolConfig): PostgresDatabase {
  const pool = new Pool(config);
  pool.on("error", (error: unknown) => {
    const code = typeof error === "object" && error !== null && "code" in error
      ? error.code : undefined;
    // pg has already removed the failed idle client. Never log the attached
    // Error/client/config: these may contain connection credentials.
    console.error("postgres.pool.idle_error",
      typeof code === "string" && code.length === 5 && /^[0-9A-Z]{5}$/.test(code)
        ? code : "UNKNOWN");
  });
  let closePromise: Promise<void> | undefined;
  const database: PostgresDatabase = {
    close() {
      closePromise ??= pool.end();
      return closePromise;
    },
  };
  pools.set(database, pool);
  return database;
}

export function getInternalPool(database: PostgresDatabase): Pool {
  const pool = pools.get(database);
  if (!pool) throw new TypeError("Unknown PostgresDatabase handle");
  return pool;
}
