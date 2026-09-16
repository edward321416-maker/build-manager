import type { Ticket } from "@build-manager/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { isApplicationError } from "../errors";
import type { ApplicationDependencies } from "../ports";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { approveRecommendation } from "./approve-recommendation";
import { createDemoBuilding } from "./create-demo-building";
import { createTicket } from "./create-ticket";
import { finalizeTicket } from "./finalize-ticket";
import { overrideRoute } from "./override-route";
import { requestMoreInfo } from "./request-more-info";
import { submitTicketAnswer } from "./submit-ticket-answer";
import { submitTicketEvidence } from "./submit-ticket-evidence";
import { verifyBuildingContext } from "./verify-building-context";

let deps: ApplicationDependencies;

beforeEach(() => {
  deps = createInMemoryDependencies();
});

/**
 * Asserts the machine-readable refusal, not its wording. The HTTP layer maps
 * this code to 409, so the code is what callers actually depend on.
 */
async function expectStateConflict(
  operation: () => Promise<unknown>,
): Promise<void> {
  let caught: unknown = null;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }

  if (!isApplicationError(caught)) {
    expect.fail(`expected an ApplicationError, got ${String(caught)}`);
  }
  expect(caught.code).toBe("STATE_CONFLICT");
}

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

async function ownerDirectBuilding(): Promise<string> {
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

const CLEAN_LEAK_INTAKE = [
  ["safety.electricalWaterRisk", false],
  ["safety.otherUrgentHazard", false],
  ["safety.gasSmell", false],
  ["safety.smokeOrFire", false],
  ["leak.location", "CEILING_WALL"],
  ["leak.active", true],
  ["leak.applianceOnly", false],
  ["leak.firstObservedAt", "2026-09-14 아침"],
] as const;

const CLEAN_HEATING_INTAKE = [
  ["safety.gasSmell", false],
  ["safety.smokeOrFire", false],
  ["safety.electricalWaterRisk", false],
  ["safety.otherUrgentHazard", false],
  ["heating.hotWater", false],
  ["heating.allRooms", true],
  ["heating.powerOn", true],
  ["heating.errorCode", "E1"],
] as const;

/** A leak ticket a landlord may act on: READY_FOR_REVIEW. */
async function reviewableLeakTicket(): Promise<Ticket> {
  const buildingId = await officeManagedBuilding();
  const ticket = await createTicket(deps, {
    buildingId,
    unitId: "demo-unit-b",
    issueType: "LEAK",
    rawUserText: "천장에서 물이 떨어집니다.",
  });

  for (const [questionId, value] of CLEAN_LEAK_INTAKE) {
    await submitTicketAnswer(deps, { ticketId: ticket.id, questionId, value });
  }
  await submitTicketEvidence(deps, {
    ticketId: ticket.id,
    evidenceType: "LEAK_AREA_PHOTO",
    fixtureId: "synthetic:leak-area",
  });

  return finalizeTicket(deps, { ticketId: ticket.id });
}

/** A heating ticket on HEATING_INDIVIDUAL_V1, likewise READY_FOR_REVIEW. */
async function reviewableHeatingTicket(): Promise<Ticket> {
  const buildingId = await ownerDirectBuilding();
  const ticket = await createTicket(deps, {
    buildingId,
    unitId: "demo-unit-a",
    issueType: "HEATING",
    rawUserText: "난방이 안 돼요",
  });

  for (const [questionId, value] of CLEAN_HEATING_INTAKE) {
    await submitTicketAnswer(deps, { ticketId: ticket.id, questionId, value });
  }
  await submitTicketEvidence(deps, {
    ticketId: ticket.id,
    evidenceType: "CONTROL_PANEL_PHOTO",
    fixtureId: "synthetic:control-panel",
  });

  return finalizeTicket(deps, { ticketId: ticket.id });
}

async function reload(ticketId: string): Promise<Ticket> {
  const ticket = await deps.tickets.findById(ticketId);
  if (ticket === null) {
    expect.fail(`ticket ${ticketId} vanished`);
  }
  return ticket;
}

describe("more-info request integrity", () => {
  it("refuses a request that asks for nothing at all", async () => {
    const ticket = await reviewableLeakTicket();

    await expectStateConflict(() =>
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "확인이 필요합니다",
      }),
    );
  });

  it("refuses a question id the selected protocol does not define", async () => {
    const ticket = await reviewableLeakTicket();

    await expectStateConflict(() =>
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "확인이 필요합니다",
        requestedQuestionIds: ["does.not.exist"],
      }),
    );
  });

  it("refuses an evidence type that belongs to another protocol", async () => {
    const ticket = await reviewableHeatingTicket();

    await expectStateConflict(() =>
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "확인이 필요합니다",
        requestedEvidenceTypes: ["LEAK_AREA_PHOTO"],
      }),
    );
  });

  it("refuses a duplicated question id instead of quietly deduplicating", async () => {
    const ticket = await reviewableHeatingTicket();

    await expectStateConflict(() =>
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "확인이 필요합니다",
        requestedQuestionIds: ["heating.hotWater", "heating.hotWater"],
      }),
    );
  });

  it("refuses a duplicated evidence type instead of quietly deduplicating", async () => {
    const ticket = await reviewableHeatingTicket();

    await expectStateConflict(() =>
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "확인이 필요합니다",
        requestedEvidenceTypes: ["CONTROL_PANEL_PHOTO", "CONTROL_PANEL_PHOTO"],
      }),
    );
  });

  it("leaves the stored ticket untouched when it refuses a request", async () => {
    const ticket = await reviewableHeatingTicket();
    const before = await reload(ticket.id);

    await expectStateConflict(() =>
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "확인이 필요합니다",
        requestedQuestionIds: ["does.not.exist"],
        requestedEvidenceTypes: ["LEAK_AREA_PHOTO"],
      }),
    );

    expect(await reload(ticket.id)).toEqual(before);
  });

  it("accepts a question the selected protocol does define", async () => {
    const ticket = await reviewableHeatingTicket();

    const returned = await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "온수 상태를 다시 확인해 주세요",
      requestedQuestionIds: ["heating.hotWater"],
    });

    expect(returned.status).toBe("NEEDS_MORE_INFO");
    expect(returned.moreInfoRequest?.requestedQuestionIds).toEqual([
      "heating.hotWater",
    ]);
  });

  it("accepts an evidence type the selected protocol does define", async () => {
    const ticket = await reviewableHeatingTicket();

    const returned = await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "표시창 사진을 다시 올려 주세요",
      requestedEvidenceTypes: ["CONTROL_PANEL_PHOTO"],
    });

    expect(returned.status).toBe("NEEDS_MORE_INFO");
    expect(returned.moreInfoRequest?.requestedEvidenceTypes).toEqual([
      "CONTROL_PANEL_PHOTO",
    ]);
  });
});

describe("finalize integrity", () => {
  it("refuses to reopen an approved ticket", async () => {
    const ticket = await reviewableLeakTicket();
    const recommended = ticket.repairPacket?.recommendation?.primary;
    if (recommended === undefined) {
      expect.fail("the reviewable ticket carried no recommendation to approve");
    }
    await approveRecommendation(deps, {
      ticketId: ticket.id,
      selectedRoute: recommended,
    });

    await expectStateConflict(() =>
      finalizeTicket(deps, { ticketId: ticket.id }),
    );
  });

  it("refuses to reopen an overridden ticket", async () => {
    const ticket = await reviewableLeakTicket();
    await overrideRoute(deps, {
      ticketId: ticket.id,
      selectedRoute: "GENERAL_VENDOR",
      reason: "현장 확인 결과 일반 업체가 적합함",
    });

    await expectStateConflict(() =>
      finalizeTicket(deps, { ticketId: ticket.id }),
    );
  });

  it("refuses to finalize while a requested question is outstanding", async () => {
    const ticket = await reviewableHeatingTicket();
    await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "온수 상태를 다시 확인해 주세요",
      requestedQuestionIds: ["heating.hotWater"],
    });

    await expectStateConflict(() =>
      finalizeTicket(deps, { ticketId: ticket.id }),
    );
  });

  it("refuses to finalize while requested evidence is outstanding", async () => {
    const ticket = await reviewableHeatingTicket();
    await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "표시창 사진을 다시 올려 주세요",
      requestedEvidenceTypes: ["CONTROL_PANEL_PHOTO"],
    });

    await expectStateConflict(() =>
      finalizeTicket(deps, { ticketId: ticket.id }),
    );
  });

  it("still refuses after only one of several requested items arrives", async () => {
    const ticket = await reviewableHeatingTicket();
    await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "둘 다 확인해 주세요",
      requestedQuestionIds: ["heating.hotWater"],
      requestedEvidenceTypes: ["CONTROL_PANEL_PHOTO"],
    });

    // Answering one item moves the ticket off NEEDS_MORE_INFO, which is
    // exactly why the guard cannot key off status.
    const answered = await submitTicketAnswer(deps, {
      ticketId: ticket.id,
      questionId: "heating.hotWater",
      value: false,
    });
    expect(answered.status).toBe("IN_PROGRESS");
    expect(answered.moreInfoRequest).not.toBeNull();

    await expectStateConflict(() =>
      finalizeTicket(deps, { ticketId: ticket.id }),
    );
  });

  it("keeps the outstanding request after refusing a finalize", async () => {
    const ticket = await reviewableHeatingTicket();
    await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "온수 상태를 다시 확인해 주세요",
      requestedQuestionIds: ["heating.hotWater"],
    });

    await expectStateConflict(() =>
      finalizeTicket(deps, { ticketId: ticket.id }),
    );

    const after = await reload(ticket.id);
    expect(after.moreInfoRequest?.requestedQuestionIds).toEqual([
      "heating.hotWater",
    ]);
  });

  it("finalizes once every requested item has arrived, clearing the request", async () => {
    const ticket = await reviewableHeatingTicket();
    await requestMoreInfo(deps, {
      ticketId: ticket.id,
      reason: "둘 다 확인해 주세요",
      requestedQuestionIds: ["heating.hotWater"],
      requestedEvidenceTypes: ["CONTROL_PANEL_PHOTO"],
    });

    await submitTicketAnswer(deps, {
      ticketId: ticket.id,
      questionId: "heating.hotWater",
      value: false,
    });
    await submitTicketEvidence(deps, {
      ticketId: ticket.id,
      evidenceType: "CONTROL_PANEL_PHOTO",
      fixtureId: "synthetic:control-panel",
    });

    const refinalized = await finalizeTicket(deps, { ticketId: ticket.id });

    expect(refinalized.status).toBe("READY_FOR_REVIEW");
    expect(refinalized.moreInfoRequest ?? null).toBeNull();
    expect(refinalized.repairPacket?.revision).toBe(2);
  });
});
