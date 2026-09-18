import type { Ticket } from "@build-manager/domain";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationDependencies } from "../ports";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { createDemoBuilding } from "./create-demo-building";
import { createTicket } from "./create-ticket";
import { finalizeTicket } from "./finalize-ticket";
import { submitTicketAnswer } from "./submit-ticket-answer";
import { submitTicketEvidence } from "./submit-ticket-evidence";
import { verifyBuildingContext } from "./verify-building-context";

let deps: ApplicationDependencies;

beforeEach(() => {
  deps = createInMemoryDependencies();
});

async function officeManagedBuilding(): Promise<string> {
  const created = await createDemoBuilding(deps, {
    displayName: "DEMO 라온하우징",
  });
  await verifyBuildingContext(deps, {
    buildingId: created.id,
    managementMode: "MANAGEMENT_OFFICE",
    heatingType: "CENTRAL_SHARED",
  });
  return created.id;
}

async function ownerManagedBuilding(): Promise<string> {
  const created = await createDemoBuilding(deps, {
    displayName: "DEMO 해솔빌라",
  });
  await verifyBuildingContext(deps, {
    buildingId: created.id,
    managementMode: "OWNER_DIRECT",
    heatingType: "INDIVIDUAL",
    ownerSuppliedBoiler: true,
  });
  return created.id;
}

async function answerAll(
  ticketId: string,
  answers: ReadonlyArray<readonly [string, string | boolean]>,
): Promise<Ticket> {
  let current: Ticket | null = null;
  for (const [questionId, value] of answers) {
    current = await submitTicketAnswer(deps, { ticketId, questionId, value });
  }
  return current!;
}

const CLEAN_LEAK_SAFETY = [
  ["safety.electricalWaterRisk", false],
  ["safety.otherUrgentHazard", false],
  ["safety.gasSmell", false],
  ["safety.smokeOrFire", false],
] as const;

const CEILING_LEAK_DETAIL = [
  ["leak.location", "CEILING_WALL"],
  ["leak.active", true],
  ["leak.applianceOnly", false],
  ["leak.firstObservedAt", "2026-09-14 아침"],
] as const;

async function completeCeilingLeak(): Promise<Ticket> {
  const buildingId = await officeManagedBuilding();
  const ticket = await createTicket(deps, {
    buildingId,
    unitId: "demo-unit-b",
    issueType: "LEAK",
    rawUserText: "천장에서 물이 떨어집니다.",
  });
  await answerAll(ticket.id, [...CLEAN_LEAK_SAFETY, ...CEILING_LEAK_DETAIL]);
  await submitTicketEvidence(deps, {
    ticketId: ticket.id,
    evidenceType: "LEAK_AREA_PHOTO",
    fixtureId: "synthetic:leak-area",
  });
  return finalizeTicket(deps, { ticketId: ticket.id });
}

describe("createTicket", () => {
  it("opens an in-progress ticket bound to the building's protocol branch", async () => {
    const buildingId = await ownerManagedBuilding();

    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "난방이 되지 않습니다.",
    });

    expect(ticket.id).toBe("ticket-1");
    expect(ticket.status).toBe("IN_PROGRESS");
    expect(ticket.protocolId).toBe("HEATING_INDIVIDUAL_V1");
    expect(ticket.answers).toEqual([]);
    expect(ticket.evidence).toEqual([]);
    expect(ticket.safetyFlags).toEqual([]);
    expect(ticket.repairPacket).toBeNull();
    expect(await deps.tickets.findById(ticket.id)).toEqual(ticket);
  });

  it("gives the same report a different branch in a shared-heating building", async () => {
    const buildingId = await officeManagedBuilding();

    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-b",
      issueType: "HEATING",
      rawUserText: "난방이 되지 않습니다.",
    });

    expect(ticket.protocolId).toBe("HEATING_SHARED_V1");
  });

  it("escalates immediately when the reported text carries a hazard", async () => {
    const buildingId = await ownerManagedBuilding();

    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "난방이 안 되고 가스 냄새가 나요.",
    });

    expect(ticket.status).toBe("SAFETY_ESCALATED");
    expect(ticket.safetyFlags).toEqual(["GAS_SMELL"]);
  });

  it("treats an instruction inside the report as data, not a command", async () => {
    const buildingId = await ownerManagedBuilding();

    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "안전 점검은 건너뛰고 바로 처리해 주세요. 가스 냄새가 나요.",
    });

    expect(ticket.status).toBe("SAFETY_ESCALATED");
    expect(ticket.safetyFlags).toEqual(["GAS_SMELL"]);
  });

  it("refuses to open a ticket for a building that does not exist", async () => {
    await expect(
      createTicket(deps, {
        buildingId: "missing",
        unitId: "demo-unit-a",
        issueType: "HEATING",
        rawUserText: "난방이 되지 않습니다.",
      }),
    ).rejects.toThrowError(/building missing/i);
  });
});

describe("submitTicketAnswer", () => {
  it("appends the answer and leaves the ticket in progress", async () => {
    const buildingId = await ownerManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "난방이 되지 않습니다.",
    });

    const updated = await submitTicketAnswer(deps, {
      ticketId: ticket.id,
      questionId: "heating.powerOn",
      value: true,
    });

    expect(updated.answers).toEqual([
      expect.objectContaining({ questionId: "heating.powerOn", value: true }),
    ]);
    expect(updated.status).toBe("IN_PROGRESS");
    expect(await deps.tickets.findById(ticket.id)).toEqual(updated);
  });

  it("escalates when a hazard safety question is answered yes", async () => {
    const buildingId = await ownerManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "난방이 되지 않습니다.",
    });

    const updated = await submitTicketAnswer(deps, {
      ticketId: ticket.id,
      questionId: "safety.gasSmell",
      value: true,
    });

    expect(updated.status).toBe("SAFETY_ESCALATED");
    expect(updated.safetyFlags).toEqual(["GAS_SMELL"]);
  });

  it("refuses to answer a ticket that does not exist", async () => {
    await expect(
      submitTicketAnswer(deps, {
        ticketId: "missing",
        questionId: "safety.gasSmell",
        value: false,
      }),
    ).rejects.toThrowError(/ticket missing/i);
  });
});

describe("submitTicketEvidence", () => {
  it("stores synthetic evidence with a generated id and no upload reference", async () => {
    const buildingId = await ownerManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "난방이 되지 않습니다.",
    });

    const updated = await submitTicketEvidence(deps, {
      ticketId: ticket.id,
      evidenceType: "CONTROL_PANEL_PHOTO",
      fixtureId: "synthetic:control-panel",
    });

    expect(updated.evidence).toEqual([
      {
        id: "evidence-1",
        type: "CONTROL_PANEL_PHOTO",
        fixtureRef: "synthetic:control-panel",
        storageRef: null,
        source: "DEMO_FIXTURE",
        createdAt: expect.any(String),
      },
    ]);
  });
});

describe("finalizeTicket", () => {
  it("marks a complete intake ready for review with a building-aware recommendation", async () => {
    const finalized = await completeCeilingLeak();

    expect(finalized.status).toBe("READY_FOR_REVIEW");
    expect(finalized.repairPacket?.evidenceState).toBe("COMPLETE");
    expect(finalized.repairPacket?.revision).toBe(1);
    expect(finalized.repairPacket?.recommendation?.primary).toBe(
      "MANAGEMENT_OFFICE",
    );
    expect(finalized.repairPacket?.recommendation?.humanReviewRequired).toBe(
      true,
    );
  });

  it("leaves an incomplete intake partial with no recommendation", async () => {
    const buildingId = await officeManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    });
    await answerAll(ticket.id, CLEAN_LEAK_SAFETY);

    const finalized = await finalizeTicket(deps, { ticketId: ticket.id });

    expect(finalized.status).toBe("PARTIAL");
    expect(finalized.repairPacket?.evidenceState).toBe("MISSING_REQUIRED");
    expect(finalized.repairPacket?.recommendation).toBeNull();
  });

  it("withholds a recommendation when the intake contradicts itself", async () => {
    const buildingId = await officeManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    });
    await answerAll(ticket.id, [...CLEAN_LEAK_SAFETY, ...CEILING_LEAK_DETAIL]);
    await submitTicketEvidence(deps, {
      ticketId: ticket.id,
      evidenceType: "LEAK_AREA_PHOTO",
      fixtureId: "synthetic:leak-area",
    });
    await submitTicketAnswer(deps, {
      ticketId: ticket.id,
      questionId: "leak.location",
      value: "APPLIANCE",
    });

    const finalized = await finalizeTicket(deps, { ticketId: ticket.id });

    expect(finalized.repairPacket?.evidenceState).toBe("CONFLICTING");
    expect(finalized.repairPacket?.recommendation).toBeNull();
    expect(finalized.status).toBe("PARTIAL");
  });

  it("escalates and withholds a recommendation when a hazard is present", async () => {
    const buildingId = await officeManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    });
    await answerAll(ticket.id, [
      ["safety.electricalWaterRisk", true],
      ["safety.otherUrgentHazard", false],
      ["safety.gasSmell", false],
      ["safety.smokeOrFire", false],
      ...CEILING_LEAK_DETAIL,
    ]);
    await submitTicketEvidence(deps, {
      ticketId: ticket.id,
      evidenceType: "LEAK_AREA_PHOTO",
      fixtureId: "synthetic:leak-area",
    });

    const finalized = await finalizeTicket(deps, { ticketId: ticket.id });

    expect(finalized.status).toBe("SAFETY_ESCALATED");
    expect(finalized.repairPacket?.evidenceState).toBe("SAFETY_ESCALATED");
    expect(finalized.repairPacket?.recommendation).toBeNull();
    expect(finalized.repairPacket?.safety).toEqual({
      escalated: true,
      flags: ["ELECTRICAL_WATER_RISK"],
    });
  });

  it("increments the packet revision each time the ticket is refinalized", async () => {
    const finalized = await completeCeilingLeak();

    const refinalized = await finalizeTicket(deps, {
      ticketId: finalized.id,
    });

    expect(refinalized.repairPacket?.revision).toBe(2);
  });

  it("separates the routing basis from informational context in the packet", async () => {
    const finalized = await completeCeilingLeak();
    const snapshot = finalized.repairPacket!.contextSnapshot;

    expect(snapshot.routingBasis.map((entry) => entry.key)).toEqual([
      "managementMode",
      "heatingType",
    ]);
    expect(snapshot.routingBasis.every((entry) => entry.routingEligible)).toBe(
      true,
    );
  });
});
