import { demoBuildings } from "@build-manager/fixtures";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createMemoryServerContainer,
  createSqliteServerContainer,
} from "./container";
import { openSqliteDatabase } from "./persistence/database";
import { encodeTicket } from "./persistence/codecs";
import { bootstrapSchema } from "./persistence/schema";
import { representativeTicket } from "./testing/aggregates";

async function withTemporaryDatabase(
  operation: (databasePath: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "build-manager-container-"));
  try {
    await operation(join(directory, "demo.sqlite"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("memory server container", () => {
  it("seeds the canonical demo buildings into an empty store", async () => {
    const container = createMemoryServerContainer();

    try {
      expect(
        (await container.dependencies.buildings.list())
          .map((entry) => entry.id)
          .sort(),
      ).toEqual(demoBuildings.map((entry) => entry.id).sort());
    } finally {
      container.close();
    }
  });

  it("runs a demo reset through the wired use case", async () => {
    const container = createMemoryServerContainer();

    try {
      await container.dependencies.tickets.save(representativeTicket);

      const reseeded = await container.useCases.resetDemo();

      expect(reseeded).toEqual(demoBuildings);
      expect(await container.dependencies.tickets.list({})).toEqual([]);
    } finally {
      container.close();
    }
  });

  it("closes idempotently", () => {
    const container = createMemoryServerContainer();

    container.close();

    expect(() => container.close()).not.toThrow();
    expect(() => container.close()).not.toThrow();
  });
});

describe("sqlite server container", () => {
  it("seeds an empty database on construction", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const container = createSqliteServerContainer({ databasePath });

      try {
        expect(
          (await container.dependencies.buildings.list())
            .map((entry) => entry.id)
            .sort(),
        ).toEqual(demoBuildings.map((entry) => entry.id).sort());
      } finally {
        container.close();
      }
    });
  });

  it("preserves an existing store instead of reseeding it", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const first = createSqliteServerContainer({ databasePath });
      const mutatedName = "DEMO 해솔빌라 (소유자 확인)";
      try {
        const building = (await first.dependencies.buildings.findById(
          demoBuildings[0]!.id,
        ))!;
        await first.dependencies.buildings.save({
          ...building,
          displayName: mutatedName,
        });
        await first.dependencies.tickets.save(representativeTicket);
      } finally {
        first.close();
      }

      const second = createSqliteServerContainer({ databasePath });
      try {
        expect(
          (await second.dependencies.buildings.findById(demoBuildings[0]!.id))
            ?.displayName,
        ).toBe(mutatedName);
        expect(await second.dependencies.tickets.list({})).toHaveLength(1);
      } finally {
        second.close();
      }
    });
  });

  it("fails closed on a store holding tickets with no buildings", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const handle = openSqliteDatabase(databasePath);
      try {
        bootstrapSchema(handle.database);
        const row = encodeTicket(representativeTicket);
        handle.database
          .prepare(
            "INSERT INTO tickets (id, aggregate_version, aggregate_json) VALUES (?, ?, ?)",
          )
          .run(row.id, row.aggregate_version, row.aggregate_json);
      } finally {
        handle.close();
      }

      expect(() => createSqliteServerContainer({ databasePath })).toThrowError(
        /inconsistent/i,
      );

      const check = openSqliteDatabase(databasePath);
      try {
        expect(
          check.database.prepare("SELECT COUNT(*) AS total FROM tickets").get(),
        ).toEqual({ total: 1 });
      } finally {
        check.close();
      }
    });
  });

  it("closes idempotently and releases the database", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const container = createSqliteServerContainer({ databasePath });

      container.close();
      expect(() => container.close()).not.toThrow();
      expect(() => container.close()).not.toThrow();

      const reopened = openSqliteDatabase(databasePath);
      try {
        expect(() => bootstrapSchema(reopened.database)).not.toThrow();
      } finally {
        reopened.close();
      }
    });
  });

  it("drives a building-aware ticket end to end through the wired use cases", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const container = createSqliteServerContainer({ databasePath });

      try {
        const ticket = await container.useCases.createTicket({
          buildingId: demoBuildings[0]!.id,
          unitId: "demo-unit-a",
          issueType: "HEATING",
          rawUserText: "난방이 되지 않습니다.",
        });

        expect(ticket.protocolId).toBe("HEATING_INDIVIDUAL_V1");

        const shared = await container.useCases.createTicket({
          buildingId: demoBuildings[1]!.id,
          unitId: "demo-unit-b",
          issueType: "HEATING",
          rawUserText: "난방이 되지 않습니다.",
        });

        expect(shared.protocolId).toBe("HEATING_SHARED_V1");
        expect(await container.useCases.getTicket({ ticketId: ticket.id })).toEqual(
          ticket,
        );
        expect(await container.useCases.listTickets({})).toHaveLength(2);
      } finally {
        container.close();
      }
    });
  });

  it("survives a restart with its tickets intact", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const first = createSqliteServerContainer({ databasePath });
      let ticketId: string;
      try {
        const ticket = await first.useCases.createTicket({
          buildingId: demoBuildings[0]!.id,
          unitId: "demo-unit-a",
          issueType: "HEATING",
          rawUserText: "난방이 되지 않습니다.",
        });
        ticketId = ticket.id;
      } finally {
        first.close();
      }

      const second = createSqliteServerContainer({ databasePath });
      try {
        expect(await second.useCases.getTicket({ ticketId })).not.toBeNull();
      } finally {
        second.close();
      }
    });
  });
});
