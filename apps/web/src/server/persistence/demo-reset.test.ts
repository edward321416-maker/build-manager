import { demoBuildings } from "@build-manager/fixtures";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { representativeTicket } from "../testing/aggregates";
import { openSqliteDatabase } from "./database";
import { createSqliteDemoStateResetter, decideInitialSeed } from "./demo-reset";
import {
  createSqliteBuildingRepository,
  createSqliteTicketRepository,
} from "./repositories";
import { bootstrapSchema } from "./schema";

async function seededDatabase(
  operation: (database: DatabaseSync) => Promise<void>,
): Promise<void> {
  const handle = openSqliteDatabase(":memory:");
  try {
    bootstrapSchema(handle.database);
    await operation(handle.database);
  } finally {
    handle.close();
  }
}

/**
 * Test-only: blocks the canonical insert after the deletes have run, so the
 * real transaction path is exercised instead of adding a failure switch to
 * production code.
 */
function blockBuildingInserts(database: DatabaseSync): () => void {
  database.exec(
    `CREATE TRIGGER test_only_block_building_insert
     AFTER INSERT ON buildings
     BEGIN
       SELECT RAISE(ABORT, 'test-only: canonical building insert blocked');
     END;`,
  );
  return () => database.exec("DROP TRIGGER test_only_block_building_insert");
}

describe("sqlite demo reset", () => {
  it("clears demo tickets and reseeds the canonical buildings", async () => {
    await seededDatabase(async (database) => {
      const buildings = createSqliteBuildingRepository(database);
      const tickets = createSqliteTicketRepository(database);
      await tickets.save(representativeTicket);
      await buildings.save({
        ...demoBuildings[0]!,
        id: "stray-building",
        displayName: "DEMO 임시",
      });

      const reseeded = await createSqliteDemoStateResetter(
        database,
        demoBuildings,
      ).reset();

      expect(await tickets.list({})).toEqual([]);
      expect((await buildings.list()).map((entry) => entry.id).sort()).toEqual(
        demoBuildings.map((entry) => entry.id).sort(),
      );
      expect(reseeded).toEqual(demoBuildings);
    });
  });

  it("discards an owner-verified mutation and returns to the baseline", async () => {
    await seededDatabase(async (database) => {
      const buildings = createSqliteBuildingRepository(database);
      const resetter = createSqliteDemoStateResetter(database, demoBuildings);

      await resetter.reset();
      const mutated = (await buildings.findById(demoBuildings[0]!.id))!;
      await buildings.save({
        ...mutated,
        context: [
          ...mutated.context,
          {
            key: "heatingType",
            value: "CENTRAL_SHARED",
            sourceType: "OWNER_VERIFIED",
            sourceRef: "owner:mutation",
            verified: true,
            routingEligible: true,
            fetchedAt: null,
            updatedAt: "2026-09-14T09:00:00.000Z",
          },
        ],
      });

      await resetter.reset();

      expect(await buildings.findById(demoBuildings[0]!.id)).toEqual(
        demoBuildings[0],
      );
    });
  });

  it("is idempotent across repeated resets", async () => {
    await seededDatabase(async (database) => {
      const resetter = createSqliteDemoStateResetter(database, demoBuildings);
      const buildings = createSqliteBuildingRepository(database);

      const first = await resetter.reset();
      const second = await resetter.reset();

      expect(second).toEqual(first);
      expect(await buildings.list()).toHaveLength(demoBuildings.length);
    });
  });

  it("rolls back and leaves pre-reset state intact when the reseed fails", async () => {
    await seededDatabase(async (database) => {
      const buildings = createSqliteBuildingRepository(database);
      const tickets = createSqliteTicketRepository(database);

      await createSqliteDemoStateResetter(database, demoBuildings).reset();
      await tickets.save(representativeTicket);
      const beforeBuildings = await buildings.list();
      const beforeTickets = await tickets.list({});

      const restoreTrigger = blockBuildingInserts(database);
      try {
        await expect(
          createSqliteDemoStateResetter(database, demoBuildings).reset(),
        ).rejects.toThrowError(/blocked/i);
      } finally {
        restoreTrigger();
      }

      expect(await buildings.list()).toEqual(beforeBuildings);
      expect(await tickets.list({})).toEqual(beforeTickets);
      expect(database.isTransaction).toBe(false);
    });
  });

  it("leaves no partially reseeded state behind after a failure", async () => {
    await seededDatabase(async (database) => {
      const buildings = createSqliteBuildingRepository(database);
      await createSqliteDemoStateResetter(database, demoBuildings).reset();

      const restoreTrigger = blockBuildingInserts(database);
      try {
        await createSqliteDemoStateResetter(database, demoBuildings)
          .reset()
          .catch(() => undefined);
      } finally {
        restoreTrigger();
      }

      expect(await buildings.list()).toHaveLength(demoBuildings.length);
    });
  });
});

describe("initial seed decision", () => {
  it("seeds only a completely empty demo store", () => {
    expect(decideInitialSeed({ buildings: 0, tickets: 0 })).toBe("SEED");
  });

  it("preserves an existing demo store rather than reseeding it", () => {
    expect(decideInitialSeed({ buildings: 2, tickets: 0 })).toBe("PRESERVE");
    expect(decideInitialSeed({ buildings: 2, tickets: 5 })).toBe("PRESERVE");
  });

  it("fails closed on tickets without buildings instead of repairing it", () => {
    expect(() => decideInitialSeed({ buildings: 0, tickets: 3 })).toThrowError(
      /inconsistent/i,
    );
  });
});
