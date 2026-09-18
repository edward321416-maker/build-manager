import { describe, expect, it } from "vitest";
import { openSqliteDatabase } from "./database";
import { withTransaction, type TransactionalDatabase } from "./transaction";

function recordingDatabase(
  behaviour: Partial<Record<string, () => void>> = {},
): TransactionalDatabase & { statements: string[] } {
  let inTransaction = false;
  const statements: string[] = [];

  return {
    statements,
    get isTransaction() {
      return inTransaction;
    },
    exec(sql: string) {
      statements.push(sql);
      if (sql === "BEGIN IMMEDIATE") {
        inTransaction = true;
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        inTransaction = false;
      }
      behaviour[sql]?.();
    },
  };
}

describe("withTransaction", () => {
  it("commits the work of a successful operation", () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      handle.database.exec("CREATE TABLE probe (id TEXT PRIMARY KEY) STRICT;");

      const result = withTransaction(handle.database, () => {
        handle.database.prepare("INSERT INTO probe (id) VALUES (?)").run("a");
        return "committed";
      });

      expect(result).toBe("committed");
      expect(handle.database.prepare("SELECT id FROM probe").all()).toEqual([
        { id: "a" },
      ]);
      expect(handle.database.isTransaction).toBe(false);
    } finally {
      handle.close();
    }
  });

  it("opens the transaction immediately rather than deferring it", () => {
    const database = recordingDatabase();

    withTransaction(database, () => undefined);

    expect(database.statements).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("rolls back the work of a failing operation and rethrows the original error", () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      handle.database.exec("CREATE TABLE probe (id TEXT PRIMARY KEY) STRICT;");
      handle.database.prepare("INSERT INTO probe (id) VALUES (?)").run("keep");

      expect(() =>
        withTransaction(handle.database, () => {
          handle.database.prepare("INSERT INTO probe (id) VALUES (?)").run("discard");
          throw new Error("operation failed");
        }),
      ).toThrowError("operation failed");

      expect(handle.database.prepare("SELECT id FROM probe").all()).toEqual([
        { id: "keep" },
      ]);
      expect(handle.database.isTransaction).toBe(false);
    } finally {
      handle.close();
    }
  });

  it("refuses to nest instead of silently joining an open transaction", () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      handle.database.exec("BEGIN IMMEDIATE");

      expect(() => withTransaction(handle.database, () => undefined)).toThrowError(
        /already open/i,
      );

      handle.database.exec("ROLLBACK");
    } finally {
      handle.close();
    }
  });

  it("surfaces both failures when the rollback itself fails", () => {
    const database = recordingDatabase({
      ROLLBACK: () => {
        throw new Error("rollback failed");
      },
    });

    const failure = (() => {
      try {
        withTransaction(database, () => {
          throw new Error("operation failed");
        });
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toBeInstanceOf(AggregateError);
    const aggregate = failure as AggregateError;
    expect(aggregate.errors.map((entry) => (entry as Error).message)).toEqual([
      "operation failed",
      "rollback failed",
    ]);
  });

  it("does not replace the original failure with the rollback failure", () => {
    const database = recordingDatabase({
      ROLLBACK: () => {
        throw new Error("rollback failed");
      },
    });

    try {
      withTransaction(database, () => {
        throw new Error("operation failed");
      });
      expect.unreachable("withTransaction should have thrown");
    } catch (error) {
      const aggregate = error as AggregateError;
      expect((aggregate.errors[0] as Error).message).toBe("operation failed");
    }
  });
});
