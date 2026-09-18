import { describe, expect, it } from "vitest";
import { ApplicationError, isApplicationError } from "./errors";
import type { ApplicationDependencies } from "./ports";
import { createInMemoryDependencies } from "./testing/in-memory-adapters";
import { approveRecommendation } from "./use-cases/approve-recommendation";
import { createDemoBuilding } from "./use-cases/create-demo-building";
import { createTicket } from "./use-cases/create-ticket";
import { finalizeTicket } from "./use-cases/finalize-ticket";
import { overrideRoute } from "./use-cases/override-route";
import { requestMoreInfo } from "./use-cases/request-more-info";
import { resetDemo } from "./use-cases/reset-demo";
import { submitTicketAnswer } from "./use-cases/submit-ticket-answer";
import { submitTicketEvidence } from "./use-cases/submit-ticket-evidence";
import { verifyBuildingContext } from "./use-cases/verify-building-context";

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

async function reviewableTicket(deps: ApplicationDependencies) {
  const created = await createDemoBuilding(deps, {
    displayName: "DEMO 라온하우징",
  });
  await verifyBuildingContext(deps, {
    buildingId: created.id,
    managementMode: "MANAGEMENT_OFFICE",
    heatingType: "CENTRAL_SHARED",
  });
  const ticket = await createTicket(deps, {
    buildingId: created.id,
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

async function captured(operation: Promise<unknown>): Promise<unknown> {
  return operation.then(
    () => null,
    (error: unknown) => error,
  );
}

describe("not-found is machine readable", () => {
  it("tags a missing building on ticket creation", async () => {
    const deps = createInMemoryDependencies();

    const failure = await captured(
      createTicket(deps, {
        buildingId: "missing",
        unitId: "demo-unit-a",
        issueType: "HEATING",
        rawUserText: "난방이 되지 않습니다.",
      }),
    );

    expect(isApplicationError(failure)).toBe(true);
    expect((failure as ApplicationError).code).toBe("NOT_FOUND");
  });

  it("tags a missing building on owner verification", async () => {
    const deps = createInMemoryDependencies();

    const failure = await captured(
      verifyBuildingContext(deps, {
        buildingId: "missing",
        managementMode: "OWNER_DIRECT",
        heatingType: "INDIVIDUAL",
      }),
    );

    expect((failure as ApplicationError).code).toBe("NOT_FOUND");
  });

  it("tags a missing ticket on intake", async () => {
    const deps = createInMemoryDependencies();

    const failure = await captured(
      submitTicketAnswer(deps, {
        ticketId: "missing",
        questionId: "safety.gasSmell",
        value: false,
      }),
    );

    expect((failure as ApplicationError).code).toBe("NOT_FOUND");
  });
});

describe("state conflict is machine readable", () => {
  it("tags intake after a landlord decision", async () => {
    const deps = createInMemoryDependencies();
    const reviewable = await reviewableTicket(deps);
    await approveRecommendation(deps, {
      ticketId: reviewable.id,
      selectedRoute: "MANAGEMENT_OFFICE",
    });

    const failure = await captured(
      submitTicketAnswer(deps, {
        ticketId: reviewable.id,
        questionId: "leak.active",
        value: false,
      }),
    );

    expect((failure as ApplicationError).code).toBe("STATE_CONFLICT");
  });

  it("tags a more-info request from a ticket still being filled in", async () => {
    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 라온하우징",
    });
    await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "MANAGEMENT_OFFICE",
      heatingType: "CENTRAL_SHARED",
    });
    const ticket = await createTicket(deps, {
      buildingId: created.id,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    });

    const failure = await captured(
      requestMoreInfo(deps, {
        ticketId: ticket.id,
        reason: "정보가 더 필요합니다.",
      }),
    );

    expect((failure as ApplicationError).code).toBe("STATE_CONFLICT");
  });

  it("tags approving a route the packet did not recommend", async () => {
    const deps = createInMemoryDependencies();
    const reviewable = await reviewableTicket(deps);

    const failure = await captured(
      approveRecommendation(deps, {
        ticketId: reviewable.id,
        selectedRoute: "GENERAL_VENDOR",
      }),
    );

    expect((failure as ApplicationError).code).toBe("STATE_CONFLICT");
  });

  it("tags approving when no recommendation exists", async () => {
    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 라온하우징",
    });
    await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "MANAGEMENT_OFFICE",
      heatingType: "CENTRAL_SHARED",
    });
    const ticket = await createTicket(deps, {
      buildingId: created.id,
      unitId: "demo-unit-b",
      issueType: "LEAK",
      rawUserText: "천장 누수가 있고 가스 냄새도 납니다.",
    });
    await finalizeTicket(deps, { ticketId: ticket.id });

    const failure = await captured(
      approveRecommendation(deps, {
        ticketId: ticket.id,
        selectedRoute: "MANAGEMENT_OFFICE",
      }),
    );

    expect((failure as ApplicationError).code).toBe("STATE_CONFLICT");
  });

  it("leaves a successful override untagged", async () => {
    const deps = createInMemoryDependencies();
    const reviewable = await reviewableTicket(deps);

    const overridden = await overrideRoute(deps, {
      ticketId: reviewable.id,
      selectedRoute: "GENERAL_VENDOR",
      reason: "현장 확인",
    });

    expect(overridden.status).toBe("OVERRIDDEN");
  });
});

describe("unexpected failures stay unexpected", () => {
  it("does not disguise an infrastructure failure as a state conflict", async () => {
    const deps = createInMemoryDependencies({
      demoState: {
        async reset() {
          throw new TypeError("database handle exploded");
        },
      },
    });

    const failure = await captured(resetDemo(deps));

    expect(isApplicationError(failure)).toBe(false);
    expect(failure).toBeInstanceOf(TypeError);
  });

  it("recognises only its own tagged errors", () => {
    expect(isApplicationError(new Error("plain"))).toBe(false);
    expect(isApplicationError(null)).toBe(false);
    expect(isApplicationError({ code: "NOT_FOUND" })).toBe(false);
    expect(isApplicationError(new ApplicationError("NOT_FOUND", "x"))).toBe(true);
  });

  it("carries no tenant payload on the error object", () => {
    const error = new ApplicationError("STATE_CONFLICT", "conflict");

    expect(Object.keys({ ...error }).sort()).toEqual(["code", "name"]);
  });
});
