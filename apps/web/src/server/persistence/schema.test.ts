import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openSqliteDatabase } from "./database";
import { SQLITE_DATABASE_SCHEMA_VERSION, bootstrapSchema } from "./schema";

function withDatabase<T>(operation: (database: DatabaseSync) => T): T {
  const handle = openSqliteDatabase(":memory:");
  try {
    return operation(handle.database);
  } finally {
    handle.close();
  }
}

function userVersion(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  return row.user_version;
}

describe("new database bootstrap", () => {
  it("creates both tables and stamps the database schema version", () => {
    withDatabase((database) => {
      bootstrapSchema(database);

      expect(userVersion(database)).toBe(SQLITE_DATABASE_SCHEMA_VERSION);
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('buildings','tickets') ORDER BY name",
          )
          .all(),
      ).toEqual([{ name: "buildings" }, { name: "tickets" }]);
    });
  });

  it("creates the aggregate columns the codecs rely on", () => {
    withDatabase((database) => {
      bootstrapSchema(database);

      for (const table of ["buildings", "tickets"]) {
        const columns = database
          .prepare(`PRAGMA table_info(${table})`)
          .all() as Array<{ name: string; type: string; notnull: number }>;

        expect(
          columns.map((column) => [column.name, column.type, column.notnull]),
        ).toEqual([
          ["id", "TEXT", 1],
          ["aggregate_version", "INTEGER", 1],
          ["aggregate_json", "TEXT", 1],
        ]);
      }
    });
  });

  it("is idempotent for an already bootstrapped database", () => {
    withDatabase((database) => {
      bootstrapSchema(database);
      database
        .prepare("INSERT INTO buildings (id, aggregate_version, aggregate_json) VALUES (?, ?, ?)")
        .run("demo-building-a", 1, "{}");

      expect(() => bootstrapSchema(database)).not.toThrow();

      expect(userVersion(database)).toBe(SQLITE_DATABASE_SCHEMA_VERSION);
      expect(
        database.prepare("SELECT COUNT(*) AS total FROM buildings").get(),
      ).toEqual({ total: 1 });
    });
  });
});

describe("fail-closed validation", () => {
  it("refuses an unversioned database that already holds a target table", () => {
    withDatabase((database) => {
      database.exec("CREATE TABLE buildings (whatever TEXT) STRICT;");

      expect(() => bootstrapSchema(database)).toThrowError(/unversioned/i);
    });
  });

  it("refuses an unsupported database schema version", () => {
    withDatabase((database) => {
      database.exec("PRAGMA user_version = 7");

      expect(() => bootstrapSchema(database)).toThrowError(/unsupported/i);
    });
  });

  it("refuses a version 1 database that is missing a table", () => {
    withDatabase((database) => {
      bootstrapSchema(database);
      database.exec("DROP TABLE tickets");

      expect(() => bootstrapSchema(database)).toThrowError(/tickets/i);
    });
  });

  it("refuses a version 1 database whose table shape is wrong", () => {
    withDatabase((database) => {
      bootstrapSchema(database);
      database.exec("DROP TABLE tickets");
      database.exec(
        "CREATE TABLE tickets (id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL, aggregate_json TEXT NOT NULL) STRICT;",
      );

      expect(() => bootstrapSchema(database)).toThrowError(/tickets/i);
    });
  });

  it("refuses a version 1 database whose column type drifted", () => {
    withDatabase((database) => {
      bootstrapSchema(database);
      database.exec("DROP TABLE buildings");
      database.exec(
        "CREATE TABLE buildings (id TEXT PRIMARY KEY, aggregate_version TEXT NOT NULL, aggregate_json TEXT NOT NULL) STRICT;",
      );

      expect(() => bootstrapSchema(database)).toThrowError(/buildings/i);
    });
  });

  it("does not delete or migrate an incompatible database", () => {
    withDatabase((database) => {
      database.exec("CREATE TABLE buildings (whatever TEXT) STRICT;");
      database
        .prepare("INSERT INTO buildings (whatever) VALUES (?)")
        .run("pre-existing");

      expect(() => bootstrapSchema(database)).toThrowError();

      expect(
        database.prepare("SELECT whatever FROM buildings").all(),
      ).toEqual([{ whatever: "pre-existing" }]);
      expect(userVersion(database)).toBe(0);
    });
  });
});
