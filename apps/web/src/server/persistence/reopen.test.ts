import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  representativeBuilding,
  representativeTicket,
} from "../testing/aggregates";
import { openSqliteDatabase } from "./database";
import {
  createSqliteBuildingRepository,
  createSqliteTicketRepository,
} from "./repositories";
import { SQLITE_DATABASE_SCHEMA_VERSION, bootstrapSchema } from "./schema";

/**
 * The database file lives in the OS temp directory, never in the project
 * source tree, and is removed in `finally` so a failing assertion cannot leave
 * an artifact behind.
 */
async function withTemporaryDatabase(
  operation: (databasePath: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "build-manager-sqlite-"));
  try {
    await operation(join(directory, "demo.sqlite"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("file-backed persistence survives a close and reopen", () => {
  it("returns the same domain semantics from a reopened database file", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const first = openSqliteDatabase(databasePath);
      try {
        bootstrapSchema(first.database);
        await createSqliteBuildingRepository(first.database).save(
          representativeBuilding,
        );
        await createSqliteTicketRepository(first.database).save(
          representativeTicket,
        );
      } finally {
        first.close();
      }

      expect(first.isOpen).toBe(false);

      const second = openSqliteDatabase(databasePath);
      try {
        expect(() => bootstrapSchema(second.database)).not.toThrow();
        expect(
          (
            second.database.prepare("PRAGMA user_version").get() as {
              user_version: number;
            }
          ).user_version,
        ).toBe(SQLITE_DATABASE_SCHEMA_VERSION);

        const buildings = createSqliteBuildingRepository(second.database);
        const tickets = createSqliteTicketRepository(second.database);

        expect(await buildings.findById("demo-building-a")).toEqual(
          representativeBuilding,
        );
        expect(await tickets.findById("ticket-a")).toEqual(representativeTicket);
        expect(await buildings.list()).toEqual([representativeBuilding]);
        expect(await tickets.list({ buildingId: "demo-building-a" })).toEqual([
          representativeTicket,
        ]);
      } finally {
        second.close();
      }
    });
  });

  it("keeps the routing basis and packet revision across the reopen", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const first = openSqliteDatabase(databasePath);
      try {
        bootstrapSchema(first.database);
        await createSqliteBuildingRepository(first.database).save(
          representativeBuilding,
        );
        await createSqliteTicketRepository(first.database).save(
          representativeTicket,
        );
      } finally {
        first.close();
      }

      const second = openSqliteDatabase(databasePath);
      try {
        const building = await createSqliteBuildingRepository(
          second.database,
        ).findById("demo-building-a");
        const ticket = await createSqliteTicketRepository(
          second.database,
        ).findById("ticket-a");

        expect(
          building?.context.filter(
            (entry) => entry.verified && entry.routingEligible,
          ),
        ).toHaveLength(2);
        expect(ticket?.repairPacket?.revision).toBe(3);
        expect(ticket?.repairPacket?.recommendation?.primary).toBe(
          "LANDLORD_REVIEW",
        );
        expect(ticket?.routeDecision?.selectedRoute).toBe("LANDLORD_REVIEW");
      } finally {
        second.close();
      }
    });
  });

  it("writes its database outside the project source tree", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const handle = openSqliteDatabase(databasePath);
      try {
        bootstrapSchema(handle.database);
      } finally {
        handle.close();
      }

      expect(databasePath.startsWith(tmpdir())).toBe(true);
      expect(databasePath.includes("apps")).toBe(false);
      expect(databasePath.includes("packages")).toBe(false);
    });
  });
});
