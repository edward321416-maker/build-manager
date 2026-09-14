import type { DatabaseSync } from "node:sqlite";

/**
 * Version of the SQLite database schema itself, stored in `PRAGMA
 * user_version`. Distinct from `PERSISTED_AGGREGATE_VERSION`, which versions
 * the JSON inside a row.
 */
export const SQLITE_DATABASE_SCHEMA_VERSION = 1;

const AGGREGATE_TABLES = ["buildings", "tickets"] as const;

type AggregateTable = (typeof AGGREGATE_TABLES)[number];

/** Static, source-controlled DDL. No value here comes from user input. */
const CREATE_TABLE_SQL: Record<AggregateTable, string> = {
  buildings: `CREATE TABLE buildings (
  id TEXT PRIMARY KEY,
  aggregate_version INTEGER NOT NULL,
  aggregate_json TEXT NOT NULL
) STRICT;`,
  tickets: `CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  aggregate_version INTEGER NOT NULL,
  aggregate_json TEXT NOT NULL
) STRICT;`,
};

const REQUIRED_COLUMNS: ReadonlyArray<{
  name: string;
  type: string;
  notnull: number;
}> = [
  { name: "id", type: "TEXT", notnull: 1 },
  { name: "aggregate_version", type: "INTEGER", notnull: 1 },
  { name: "aggregate_json", type: "TEXT", notnull: 1 },
];

type ColumnInfo = { name: string; type: string; notnull: number };

function readUserVersion(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  return row?.user_version ?? 0;
}

function existingAggregateTables(database: DatabaseSync): string[] {
  return (
    database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('buildings', 'tickets') ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

function assertTableShape(database: DatabaseSync, table: AggregateTable): void {
  // The table name is one of two source-controlled literals, never user input.
  const columns = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as ColumnInfo[];

  const actual = columns.map((column) => ({
    name: column.name,
    type: column.type,
    notnull: column.notnull,
  }));

  const matches =
    actual.length === REQUIRED_COLUMNS.length &&
    REQUIRED_COLUMNS.every((expected, index) => {
      const found = actual[index];
      return (
        found !== undefined &&
        found.name === expected.name &&
        found.type === expected.type &&
        found.notnull === expected.notnull
      );
    });

  if (!matches) {
    throw new Error(
      `Refusing to use database: table ${table} does not match the expected schema version ${SQLITE_DATABASE_SCHEMA_VERSION} shape`,
    );
  }
}

/**
 * Prepares a database for use, failing closed rather than guessing.
 *
 * An unversioned database that already holds one of the target tables is
 * rejected instead of being blessed, an unsupported version is rejected, and a
 * version-1 database is validated against the exact expected table shape.
 * Nothing is migrated and nothing is deleted.
 */
export function bootstrapSchema(database: DatabaseSync): void {
  const version = readUserVersion(database);

  if (version === SQLITE_DATABASE_SCHEMA_VERSION) {
    const present = existingAggregateTables(database);
    for (const table of AGGREGATE_TABLES) {
      if (!present.includes(table)) {
        throw new Error(
          `Refusing to use database: schema version ${SQLITE_DATABASE_SCHEMA_VERSION} is missing table ${table}`,
        );
      }
      assertTableShape(database, table);
    }
    return;
  }

  if (version !== 0) {
    throw new Error(
      `Refusing to use database: unsupported database schema version ${version}; expected 0 or ${SQLITE_DATABASE_SCHEMA_VERSION}`,
    );
  }

  const present = existingAggregateTables(database);
  if (present.length > 0) {
    throw new Error(
      `Refusing to use database: unversioned database already contains ${present.join(", ")}; refusing to adopt tables of unknown origin`,
    );
  }

  for (const table of AGGREGATE_TABLES) {
    database.exec(CREATE_TABLE_SQL[table]);
  }
  database.exec(`PRAGMA user_version = ${SQLITE_DATABASE_SCHEMA_VERSION}`);
}
