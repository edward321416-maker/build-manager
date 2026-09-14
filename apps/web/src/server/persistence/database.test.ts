import { describe, expect, it } from "vitest";
import { SQLITE_OPEN_OPTIONS, openSqliteDatabase } from "./database";

describe("sqlite database handle", () => {
  it("opens an in-memory database that is usable", () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      handle.database.exec("CREATE TABLE probe (id TEXT PRIMARY KEY) STRICT;");
      handle.database.prepare("INSERT INTO probe (id) VALUES (?)").run("a");

      expect(handle.database.prepare("SELECT id FROM probe").all()).toEqual([
        { id: "a" },
      ]);
    } finally {
      handle.close();
    }
  });

  it("opens with extension loading disabled and the hardened options", () => {
    expect(SQLITE_OPEN_OPTIONS).toEqual({
      allowExtension: false,
      defensive: true,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
    });

    const handle = openSqliteDatabase(":memory:");
    try {
      expect(() => handle.database.enableLoadExtension(true)).toThrowError();
    } finally {
      handle.close();
    }
  });

  it("rejects a double-quoted string literal instead of treating it as text", () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      handle.database.exec("CREATE TABLE probe (id TEXT PRIMARY KEY) STRICT;");
      expect(() =>
        handle.database.exec('INSERT INTO probe (id) VALUES ("not-a-column")'),
      ).toThrowError();
    } finally {
      handle.close();
    }
  });

  it("reports whether it is open and makes close idempotent", () => {
    const handle = openSqliteDatabase(":memory:");

    expect(handle.isOpen).toBe(true);

    handle.close();
    expect(handle.isOpen).toBe(false);

    expect(() => handle.close()).not.toThrow();
    expect(() => handle.close()).not.toThrow();
    expect(handle.isOpen).toBe(false);
  });

  it("creates independent handles rather than one shared module connection", () => {
    const first = openSqliteDatabase(":memory:");
    const second = openSqliteDatabase(":memory:");

    try {
      expect(first.database).not.toBe(second.database);

      first.database.exec("CREATE TABLE only_first (id TEXT PRIMARY KEY) STRICT;");

      expect(() => second.database.prepare("SELECT id FROM only_first").all()).toThrowError();
    } finally {
      first.close();
      second.close();
    }
  });

  it("leaves the other handle usable when one is closed", () => {
    const first = openSqliteDatabase(":memory:");
    const second = openSqliteDatabase(":memory:");

    try {
      first.close();

      second.database.exec("CREATE TABLE still_open (id TEXT PRIMARY KEY) STRICT;");
      expect(second.database.prepare("SELECT id FROM still_open").all()).toEqual([]);
    } finally {
      first.close();
      second.close();
    }
  });
});
