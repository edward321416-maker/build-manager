import type { DemoStateResetter } from "@build-manager/application";
import type { Building } from "@build-manager/domain";
import type { DatabaseSync } from "node:sqlite";
import { encodeBuilding } from "./codecs";
import { withTransaction } from "./transaction";

/**
 * This store holds synthetic demo state only, so an explicit reset may clear
 * the tables outright. That is safe precisely because nothing real lives here;
 * this resetter must not be reused for a mixed or production store.
 */
export function createSqliteDemoStateResetter(
  database: DatabaseSync,
  canonicalBuildings: readonly Building[],
): DemoStateResetter {
  return {
    async reset() {
      withTransaction(database, () => {
        database.prepare("DELETE FROM tickets").run();
        database.prepare("DELETE FROM buildings").run();

        const insert = database.prepare(
          "INSERT INTO buildings (id, aggregate_version, aggregate_json) VALUES (?, ?, ?)",
        );
        for (const building of canonicalBuildings) {
          const row = encodeBuilding(building);
          insert.run(row.id, row.aggregate_version, row.aggregate_json);
        }
      });

      return canonicalBuildings.map((building) => structuredClone(building));
    },
  };
}

export type DemoStoreCounts = {
  buildings: number;
  tickets: number;
};

export type InitialSeedDecision = "SEED" | "PRESERVE";

/**
 * Decides what container start-up may do to an existing store.
 *
 * Seeding happens only for a completely empty store. Tickets without buildings
 * is an inconsistent demo store: it fails closed rather than deleting the
 * tickets or silently reseeding underneath them. An existing store is
 * preserved, so owner-verified mutations survive a restart and only the
 * explicit reset endpoint is destructive.
 */
export function decideInitialSeed(counts: DemoStoreCounts): InitialSeedDecision {
  if (counts.buildings === 0 && counts.tickets === 0) {
    return "SEED";
  }
  if (counts.buildings === 0) {
    throw new Error(
      `Refusing to start: inconsistent demo store holds ${counts.tickets} ticket(s) with no buildings`,
    );
  }
  return "PRESERVE";
}
