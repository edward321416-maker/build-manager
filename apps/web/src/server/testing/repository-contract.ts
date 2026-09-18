import type {
  BuildingRepository,
  TicketRepository,
} from "@build-manager/application";
import type { Building, Ticket } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import { representativeBuilding, representativeTicket } from "./aggregates";

export type RepositoryFixture = {
  buildings: BuildingRepository;
  tickets: TicketRepository;
  dispose(): void;
};

function byId<T extends { id: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => left.id.localeCompare(right.id));
}

function otherBuilding(): Building {
  return {
    ...representativeBuilding,
    id: "demo-building-b",
    displayName: "DEMO 라온하우징",
  };
}

function otherTicket(): Ticket {
  return {
    ...representativeTicket,
    id: "ticket-b",
    buildingId: "demo-building-b",
    repairPacket: null,
    routeDecision: null,
    status: "IN_PROGRESS",
  };
}

/**
 * One behavioural contract, run against every repository implementation.
 *
 * It asserts only semantics the application ports actually define. The ports
 * promise no ordering, so every list assertion sorts first rather than
 * inventing a guarantee an implementation might not keep.
 */
export function describeRepositoryContract(
  label: string,
  createFixture: () => RepositoryFixture,
): void {
  describe(`${label}: building repository`, () => {
    it("returns a saved building by id", async () => {
      const fixture = createFixture();
      try {
        await fixture.buildings.save(representativeBuilding);

        expect(await fixture.buildings.findById("demo-building-a")).toEqual(
          representativeBuilding,
        );
      } finally {
        fixture.dispose();
      }
    });

    it("returns null for a building it does not hold", async () => {
      const fixture = createFixture();
      try {
        expect(await fixture.buildings.findById("missing")).toBeNull();
      } finally {
        fixture.dispose();
      }
    });

    it("replaces a building saved again under the same id", async () => {
      const fixture = createFixture();
      try {
        await fixture.buildings.save(representativeBuilding);
        await fixture.buildings.save({
          ...representativeBuilding,
          displayName: "DEMO 해솔빌라 (정정)",
        });

        expect(
          (await fixture.buildings.findById("demo-building-a"))?.displayName,
        ).toBe("DEMO 해솔빌라 (정정)");
        expect(await fixture.buildings.list()).toHaveLength(1);
      } finally {
        fixture.dispose();
      }
    });

    it("lists every saved building and nothing when empty", async () => {
      const fixture = createFixture();
      try {
        expect(await fixture.buildings.list()).toEqual([]);

        await fixture.buildings.save(representativeBuilding);
        await fixture.buildings.save(otherBuilding());

        expect(byId(await fixture.buildings.list())).toEqual(
          byId([representativeBuilding, otherBuilding()]),
        );
      } finally {
        fixture.dispose();
      }
    });

    it("preserves verified routing-eligible context through a round trip", async () => {
      const fixture = createFixture();
      try {
        await fixture.buildings.save(representativeBuilding);
        const stored = await fixture.buildings.findById("demo-building-a");

        expect(stored?.context).toEqual(representativeBuilding.context);
        expect(
          stored?.context.filter(
            (entry) => entry.verified && entry.routingEligible,
          ),
        ).toHaveLength(2);
      } finally {
        fixture.dispose();
      }
    });

    it("hands back a copy rather than shared mutable state", async () => {
      const fixture = createFixture();
      try {
        await fixture.buildings.save(representativeBuilding);

        const first = await fixture.buildings.findById("demo-building-a");
        first!.displayName = "MUTATED";

        expect(
          (await fixture.buildings.findById("demo-building-a"))?.displayName,
        ).toBe("DEMO 해솔빌라");
      } finally {
        fixture.dispose();
      }
    });
  });

  describe(`${label}: ticket repository`, () => {
    it("returns a saved ticket by id", async () => {
      const fixture = createFixture();
      try {
        await fixture.tickets.save(representativeTicket);

        expect(await fixture.tickets.findById("ticket-a")).toEqual(
          representativeTicket,
        );
      } finally {
        fixture.dispose();
      }
    });

    it("returns null for a ticket it does not hold", async () => {
      const fixture = createFixture();
      try {
        expect(await fixture.tickets.findById("missing")).toBeNull();
      } finally {
        fixture.dispose();
      }
    });

    it("replaces a ticket saved again under the same id", async () => {
      const fixture = createFixture();
      try {
        await fixture.tickets.save(representativeTicket);
        await fixture.tickets.save({
          ...representativeTicket,
          status: "OVERRIDDEN",
        });

        expect((await fixture.tickets.findById("ticket-a"))?.status).toBe(
          "OVERRIDDEN",
        );
        expect(await fixture.tickets.list({})).toHaveLength(1);
      } finally {
        fixture.dispose();
      }
    });

    it("lists every ticket and filters by building", async () => {
      const fixture = createFixture();
      try {
        expect(await fixture.tickets.list({})).toEqual([]);

        await fixture.tickets.save(representativeTicket);
        await fixture.tickets.save(otherTicket());

        expect(byId(await fixture.tickets.list({}))).toEqual(
          byId([representativeTicket, otherTicket()]),
        );
        expect(
          await fixture.tickets.list({ buildingId: "demo-building-b" }),
        ).toEqual([otherTicket()]);
        expect(await fixture.tickets.list({ buildingId: "missing" })).toEqual([]);
      } finally {
        fixture.dispose();
      }
    });

    it("preserves the packet revision, recommendation, and route decision", async () => {
      const fixture = createFixture();
      try {
        await fixture.tickets.save(representativeTicket);
        const stored = await fixture.tickets.findById("ticket-a");

        expect(stored?.repairPacket?.revision).toBe(3);
        expect(stored?.repairPacket?.recommendation).toEqual(
          representativeTicket.repairPacket?.recommendation,
        );
        expect(stored?.repairPacket?.contextSnapshot).toEqual(
          representativeTicket.repairPacket?.contextSnapshot,
        );
        expect(stored?.routeDecision).toEqual(representativeTicket.routeDecision);
        expect(stored?.evidence).toEqual(representativeTicket.evidence);
        expect(stored?.answers).toEqual(representativeTicket.answers);
      } finally {
        fixture.dispose();
      }
    });

    it("hands back a copy rather than shared mutable state", async () => {
      const fixture = createFixture();
      try {
        await fixture.tickets.save(representativeTicket);

        const first = await fixture.tickets.findById("ticket-a");
        first!.status = "IN_PROGRESS";

        expect((await fixture.tickets.findById("ticket-a"))?.status).toBe(
          "APPROVED",
        );
      } finally {
        fixture.dispose();
      }
    });
  });
}
