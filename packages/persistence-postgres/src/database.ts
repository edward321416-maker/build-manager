import { Pool, type PoolConfig } from "pg";

export type PostgresDatabase = { close(): Promise<void> };
const pools = new WeakMap<PostgresDatabase, Pool>();

export function createPostgresDatabase(config: PoolConfig): PostgresDatabase {
  const pool = new Pool(config);
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
