import {
  createInMemoryBuildingRepository,
  createInMemoryTicketRepository,
} from "@build-manager/application/testing";
import { describe, expect, it } from "vitest";
import {
  describeRepositoryContract,
  type RepositoryFixture,
} from "../testing/repository-contract";
import { openSqliteDatabase } from "./database";
import {
  createSqliteBuildingRepository,
  createSqliteTicketRepository,
} from "./repositories";
import { bootstrapSchema } from "./schema";

describeRepositoryContract("in-memory", (): RepositoryFixture => {
  return {
    buildings: createInMemoryBuildingRepository(),
    tickets: createInMemoryTicketRepository(),
    dispose() {
      // Nothing to release.
    },
  };
});

describeRepositoryContract("sqlite", (): RepositoryFixture => {
  const handle = openSqliteDatabase(":memory:");
  bootstrapSchema(handle.database);

  return {
    buildings: createSqliteBuildingRepository(handle.database),
    tickets: createSqliteTicketRepository(handle.database),
    dispose() {
      handle.close();
    },
  };
});

describe("sqlite repository ownership", () => {
  it("never closes the connection it borrows", async () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      bootstrapSchema(handle.database);
      const buildings = createSqliteBuildingRepository(handle.database);

      await buildings.list();
      await buildings.findById("missing");

      expect(handle.isOpen).toBe(true);
      expect(() =>
        handle.database.prepare("SELECT COUNT(*) AS total FROM buildings").get(),
      ).not.toThrow();
    } finally {
      handle.close();
    }
  });

  it("stores each aggregate under its own row key", async () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      bootstrapSchema(handle.database);
      const tickets = createSqliteTicketRepository(handle.database);
      const buildings = createSqliteBuildingRepository(handle.database);

      const { representativeTicket, representativeBuilding } = await import(
        "../testing/aggregates"
      );
      await tickets.save(representativeTicket);
      await buildings.save(representativeBuilding);

      expect(
        handle.database.prepare("SELECT id FROM tickets").all(),
      ).toEqual([{ id: "ticket-a" }]);
      expect(
        handle.database.prepare("SELECT id FROM buildings").all(),
      ).toEqual([{ id: "demo-building-a" }]);
    } finally {
      handle.close();
    }
  });

  it("surfaces a corrupted row instead of returning a broken aggregate", async () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      bootstrapSchema(handle.database);
      handle.database
        .prepare(
          "INSERT INTO buildings (id, aggregate_version, aggregate_json) VALUES (?, ?, ?)",
        )
        .run("demo-building-a", 1, "{not json");

      const buildings = createSqliteBuildingRepository(handle.database);

      await expect(buildings.findById("demo-building-a")).rejects.toThrowError(
        /json/i,
      );
    } finally {
      handle.close();
    }
  });

  it("binds identifiers as parameters rather than interpolating them", async () => {
    const handle = openSqliteDatabase(":memory:");

    try {
      bootstrapSchema(handle.database);
      const buildings = createSqliteBuildingRepository(handle.database);

      const hostileId = "demo'); DROP TABLE buildings;--";
      const { representativeBuilding } = await import("../testing/aggregates");
      await buildings.save({ ...representativeBuilding, id: hostileId });

      expect((await buildings.findById(hostileId))?.id).toBe(hostileId);
      expect(await buildings.list()).toHaveLength(1);
    } finally {
      handle.close();
    }
  });
});
