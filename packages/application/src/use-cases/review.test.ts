import type { Ticket } from "@build-manager/domain";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationDependencies } from "../ports";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { approveRecommendation } from "./approve-recommendation";
import { createDemoBuilding } from "./create-demo-building";
import { createTicket } from "./create-ticket";
import { finalizeTicket } from "./finalize-ticket";
import { getTicket } from "./get-ticket";
import { listTickets } from "./list-tickets";
import { overrideRoute } from "./override-route";
import { requestMoreInfo } from "./request-more-info";
import { submitTicketAnswer } from "./submit-ticket-answer";
import { submitTicketEvidence } from "./submit-ticket-evidence";
import { verifyBuildingContext } from "./verify-building-context";

let deps: ApplicationDependencies;

beforeEach(() => {
  deps = createInMemoryDependencies();
});

async function officeManagedBuilding(displayName = "DEMO 라온하우징") {
  const created = await createDemoBuilding(deps, { displayName });
  await verifyBuildingContext(deps, {
    buildingId: created.id,
    managementMode: "MANAGEMENT_OFFICE",
    heatingType: "CENTRAL_SHARED",
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

async function reviewableTicket(buildingId?: string): Promise<Ticket> {
  const targetBuilding = buildingId ?? (await officeManagedBuilding());
  const ticket = await createTicket(deps, {
    buildingId: targetBuilding,
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

async function escalatedTicket(): Promise<Ticket> {
  const buildingId = await officeManagedBuilding();
  const ticket = await createTicket(deps, {
    buildingId,
    unitId: "demo-unit-b",
    issueType: "LEAK",
    rawUserText: "천장 누수가 있고 가스 냄새도 납니다.",
  });
  return finalizeTicket(deps, { ticketId: ticket.id });
}

describe("approveRecommendation", () => {
  it("approves the exact route the current packet recommended", async () => {
    const reviewable = await reviewableTicket();

    const approved = await approveRecommendation(deps, {
      ticketId: reviewable.id,
      selectedRoute: "MANAGEMENT_OFFICE",
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.routeDecision).toEqual({
      action: "APPROVE_RECOMMENDATION",
      recommendedRoute: "MANAGEMENT_OFFICE",
      selectedRoute: "MANAGEMENT_OFFICE",
      actor: "LANDLORD",
      decidedAt: expect.any(String),
    });
    expect(await deps.tickets.findById(reviewable.id)).toEqual(approved);
  });

  it("refuses to approve a route the packet did not recommend", async () => {
    const reviewable = await reviewableTicket();

    await expect(
      approveRecommendation(deps, {
        ticketId: reviewable.id,
        selectedRoute: "GENERAL_VENDOR",
      }),
    ).rejects.toThrowError(/does not match/i);
    expect((await deps.tickets.findById(reviewable.id))?.status).toBe(
      "READY_FOR_REVIEW",
    );
  });

  it("refuses to approve when safety escalation left no recommendation", async () => {
    const escalated = await escalatedTicket();

    await expect(
      approveRecommendation(deps, {
        ticketId: escalated.id,
        selectedRoute: "MANAGEMENT_OFFICE",
      }),
    ).rejects.toThrowError(/no recommendation/i);
  });
});

describe("intake after a landlord decision", () => {
  it("refuses a further tenant answer once the route is approved", async () => {
    const reviewable = await reviewableTicket();
    await approveRecommendation(deps, {
      ticketId: reviewable.id,
      selectedRoute: "MANAGEMENT_OFFICE",
    });

    await expect(
      submitTicketAnswer(deps, {
        ticketId: reviewable.id,
        questionId: "leak.active",
        value: false,
      }),
    ).rejects.toThrowError(/landlord decision is already recorded/i);
    expect((await deps.tickets.findById(reviewable.id))?.status).toBe(
      "APPROVED",
    );
  });

  it("refuses further tenant evidence once the route is overridden", async () => {
    const reviewable = await reviewableTicket();
    await overrideRoute(deps, {
      ticketId: reviewable.id,
      selectedRoute: "GENERAL_VENDOR",
    });

    await expect(
      submitTicketEvidence(deps, {
        ticketId: reviewable.id,
        evidenceType: "GENERAL_PHOTO",
        fixtureId: "synthetic:general",
      }),
    ).rejects.toThrowError(/landlord decision is already recorded/i);
  });
});

describe("overrideRoute", () => {
  it("records a landlord override away from the recommendation", async () => {
    const reviewable = await reviewableTicket();

    const overridden = await overrideRoute(deps, {
      ticketId: reviewable.id,
      selectedRoute: "GENERAL_VENDOR",
      reason: "현장 확인 결과 일반 업체가 적합함",
    });

    expect(overridden.status).toBe("OVERRIDDEN");
    expect(overridden.routeDecision).toEqual({
      action: "OVERRIDE_ROUTE",
      recommendedRoute: "MANAGEMENT_OFFICE",
      selectedRoute: "GENERAL_VENDOR",
      reason: "현장 확인 결과 일반 업체가 적합함",
      actor: "LANDLORD",
      decidedAt: expect.any(String),
    });
  });

  it("stays available when the system recommended nothing", async () => {
    const escalated = await escalatedTicket();

    const overridden = await overrideRoute(deps, {
      ticketId: escalated.id,
      selectedRoute: "MANAGEMENT_OFFICE",
      reason: "안전 확인을 관리사무소에 요청",
    });

    expect(overridden.status).toBe("OVERRIDDEN");
    expect(overridden.routeDecision?.recommendedRoute).toBeNull();
  });
});

describe("requestMoreInfo", () => {
  it("sends a reviewable ticket back to the tenant", async () => {
    const reviewable = await reviewableTicket();

    const returned = await requestMoreInfo(deps, {
      ticketId: reviewable.id,
      reason: "누수 위치를 다시 확인해 주세요.",
      requestedQuestionIds: ["leak.location"],
    });

    expect(returned.status).toBe("NEEDS_MORE_INFO");
    expect(returned.moreInfoRequest).toEqual({
      action: "REQUEST_MORE_INFO",
      reason: "누수 위치를 다시 확인해 주세요.",
      requestedQuestionIds: ["leak.location"],
      requestedEvidenceTypes: undefined,
      actor: "LANDLORD",
      requestedAt: expect.any(String),
    });
  });

  it("is not recorded as a route decision", async () => {
    const reviewable = await reviewableTicket();

    const returned = await requestMoreInfo(deps, {
      ticketId: reviewable.id,
      reason: "누수 위치를 다시 확인해 주세요.",
    });

    expect(returned.routeDecision).toBeNull();
  });

  it("refuses to send back a ticket the tenant is still filling in", async () => {
    const buildingId = await officeManagedBuilding();
    const ticket = await createTicket(deps, {
      buildingId,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    });

    await expect(
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "정보가 더 필요합니다.",
      }),
    ).rejects.toThrowError(/cannot request more info/i);
  });

  it("returns the ticket to in progress once the tenant adds data", async () => {
    const reviewable = await reviewableTicket();
    await requestMoreInfo(deps, {
      ticketId: reviewable.id,
      reason: "누수 시점을 다시 확인해 주세요.",
    });

    const resumed = await submitTicketAnswer(deps, {
      ticketId: reviewable.id,
      questionId: "leak.firstObservedAt",
      value: "2026-09-14 아침",
    });

    expect(resumed.status).toBe("IN_PROGRESS");
  });

  it("increments the packet revision after the tenant refinalizes", async () => {
    const reviewable = await reviewableTicket();
    await requestMoreInfo(deps, {
      ticketId: reviewable.id,
      reason: "누수 시점을 다시 확인해 주세요.",
    });
    await submitTicketEvidence(deps, {
      ticketId: reviewable.id,
      evidenceType: "GENERAL_PHOTO",
      fixtureId: "synthetic:general",
    });

    const refinalized = await finalizeTicket(deps, {
      ticketId: reviewable.id,
    });

    expect(refinalized.status).toBe("READY_FOR_REVIEW");
    expect(refinalized.repairPacket?.revision).toBe(2);
  });
});

describe("listTickets and getTicket", () => {
  it("lists persisted tickets and filters by building", async () => {
    const firstBuilding = await officeManagedBuilding("DEMO 라온하우징");
    const secondBuilding = await officeManagedBuilding("DEMO 해솔빌라");
    const first = await createTicket(deps, {
      buildingId: firstBuilding,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    });
    const second = await createTicket(deps, {
      buildingId: secondBuilding,
      unitId: "demo-unit-a",
      issueType: "HEATING",
      rawUserText: "난방이 되지 않습니다.",
    });

    expect((await listTickets(deps, {})).map((entry) => entry.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(
      (await listTickets(deps, { buildingId: secondBuilding })).map(
        (entry) => entry.id,
      ),
    ).toEqual([second.id]);
  });

  it("returns a stored ticket and null for an unknown id", async () => {
    const reviewable = await reviewableTicket();

    expect(await getTicket(deps, { ticketId: reviewable.id })).toEqual(
      reviewable,
    );
    expect(await getTicket(deps, { ticketId: "missing" })).toBeNull();
  });
});

describe("finalize clears a fulfilled more-info request", () => {
  it("drops the current request once the ticket is refinalized", async () => {
    const reviewable = await reviewableTicket();
    const returned = await requestMoreInfo(deps, {
      ticketId: reviewable.id,
      reason: "누수 시점을 다시 확인해 주세요",
      requestedQuestionIds: ["leak.firstObservedAt"],
    });

    expect(returned.moreInfoRequest).not.toBeNull();

    const refinalized = await finalizeTicket(deps, {
      ticketId: reviewable.id,
    });

    expect(refinalized.moreInfoRequest).toBeNull();
    expect(refinalized.status).toBe("READY_FOR_REVIEW");
  });

  it("keeps the answer history the tenant added in response", async () => {
    const reviewable = await reviewableTicket();
    await requestMoreInfo(deps, {
      ticketId: reviewable.id,
      reason: "누수 시점을 다시 확인해 주세요",
      requestedQuestionIds: ["leak.firstObservedAt"],
    });
    await submitTicketAnswer(deps, {
      ticketId: reviewable.id,
      questionId: "leak.firstObservedAt",
      value: "2026-09-15 아침",
    });

    const refinalized = await finalizeTicket(deps, {
      ticketId: reviewable.id,
    });

    expect(refinalized.moreInfoRequest).toBeNull();
    expect(
      refinalized.answers.filter(
        (answer) => answer.questionId === "leak.firstObservedAt",
      ),
    ).toHaveLength(2);
  });
});
