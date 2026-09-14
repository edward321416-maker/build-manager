import { DatabaseSync } from "node:sqlite";

/**
 * Hardened open options. Extension loading stays off permanently, and
 * double-quoted string literals stay off so a mistyped identifier fails loudly
 * instead of silently becoming a text value.
 */
export const SQLITE_OPEN_OPTIONS = {
  allowExtension: false,
  defensive: true,
  enableDoubleQuotedStringLiterals: false,
  enableForeignKeyConstraints: true,
} as const;

/**
 * Sole owner of a `DatabaseSync` connection.
 *
 * Repositories and the demo resetter borrow the connection and must never
 * close it; only the holder of this handle closes. `DatabaseSync.close()`
 * throws when the database is already closed, so `close()` here is idempotent.
 */
export type SqliteDatabaseHandle = {
  readonly database: DatabaseSync;
  readonly isOpen: boolean;
  close(): void;
};

/**
 * Opens a database. There is no module-level connection: every caller gets an
 * independent handle, and nothing is opened at import time.
 */
export function openSqliteDatabase(databasePath: string): SqliteDatabaseHandle {
  const database = new DatabaseSync(databasePath, SQLITE_OPEN_OPTIONS);
  let open = true;

  return {
    database,
    get isOpen() {
      return open;
    },
    close() {
      if (!open) {
        return;
      }
      open = false;
      database.close();
    },
  };
}
