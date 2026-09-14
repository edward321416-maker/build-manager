import { demoBuildings } from "@build-manager/fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleSearchAddress } from "./handlers/address";
import {
  handleGetBuilding,
  handleVerifyBuildingContext,
} from "./handlers/buildings";
import { handleListDemoBuildings, handleResetDemo } from "./handlers/demo";
import {
  handleCreateTicket,
  handleFinalizeTicket,
  handleGetTicket,
  handleListTickets,
  handleSubmitAnswer,
  handleSubmitEvidence,
  handleTicketDecision,
} from "./handlers/tickets";
import {
  createMemoryContainerProvider,
  type ContainerProvider,
} from "./request-container";

const BUILDING_A = demoBuildings[0]!.id;
const BUILDING_B = demoBuildings[1]!.id;

/** Ordinary reports that must not trip the safety gate. */
const ORDINARY_HEATING_REPORT = "난방이 안 돼요";
const ORDINARY_LEAK_REPORT = "천장에서 물이 떨어집니다.";

let provider: ContainerProvider & { dispose(): void };

beforeEach(() => {
  provider = createMemoryContainerProvider();
});

afterEach(() => {
  provider.dispose();
});

function jsonRequest(body: unknown, method = "POST"): Request {
  return new Request("https://demo.test/api/v1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string, contentType: string | null): Request {
  return new Request("https://demo.test/api/v1", {
    method: "POST",
    headers: contentType === null ? {} : { "Content-Type": contentType },
    body,
  });
}

function url(path: string): URL {
  return new URL(`https://demo.test${path}`);
}

async function payload(response: Response): Promise<any> {
  return response.json();
}

const CLEAN_LEAK_ANSWERS: ReadonlyArray<readonly [string, boolean | string]> = [
  ["safety.electricalWaterRisk", false],
  ["safety.otherUrgentHazard", false],
  ["safety.gasSmell", false],
  ["safety.smokeOrFire", false],
  ["leak.location", "CEILING_WALL"],
  ["leak.active", true],
  ["leak.applianceOnly", false],
  ["leak.firstObservedAt", "2026-09-14 아침"],
];

async function createLeakTicket(): Promise<string> {
  const created = await handleCreateTicket(
    provider,
    jsonRequest({
      buildingId: BUILDING_B,
      issueType: "LEAK",
      rawUserText: ORDINARY_LEAK_REPORT,
    }),
  );
  return (await payload(created)).ticketId;
}

async function completeLeakIntake(ticketId: string): Promise<void> {
  for (const [questionId, answer] of CLEAN_LEAK_ANSWERS) {
    await handleSubmitAnswer(
      provider,
      jsonRequest({ questionId, answer }),
      ticketId,
    );
  }
  await handleSubmitEvidence(
    provider,
    jsonRequest({ evidenceType: "LEAK_LOCATION", fixtureId: "demo-leak-area" }),
    ticketId,
  );
}

async function reviewableTicket(): Promise<string> {
  const ticketId = await createLeakTicket();
  await completeLeakIntake(ticketId);
  await handleFinalizeTicket(provider, jsonRequest({}), ticketId);
  return ticketId;
}

describe("demo endpoints", () => {
  it("lists the seeded demo buildings", async () => {
    const response = await handleListDemoBuildings(provider);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const buildings = await payload(response);
    expect(buildings.map((entry: any) => entry.buildingId).sort()).toEqual(
      [BUILDING_A, BUILDING_B].sort(),
    );
    expect(buildings.every((entry: any) => entry.demo === true)).toBe(true);
  });

  it("resets demo state and returns the reseeded buildings", async () => {
    const ticketId = await createLeakTicket();
    expect(ticketId).toBeTruthy();

    const response = await handleResetDemo(provider);

    expect(response.status).toBe(200);
    expect((await payload(response)).length).toBe(demoBuildings.length);

    const tickets = await handleListTickets(
      provider,
      url("/api/v1/tickets?view=landlord"),
    );
    expect(await payload(tickets)).toEqual([]);
  });

  it("searches the offline address fixture", async () => {
    const response = await handleSearchAddress(
      provider,
      url("/api/v1/address/search?query=DEMO%20%ED%95%B4%EC%86%94%EB%B9%8C%EB%9D%BC"),
    );

    expect(response.status).toBe(200);
    expect(await payload(response)).toEqual({ result: null });
  });

  it("rejects a missing, blank, or repeated address query", async () => {
    for (const path of [
      "/api/v1/address/search",
      "/api/v1/address/search?query=",
      "/api/v1/address/search?query=a&query=b",
    ]) {
      const response = await handleSearchAddress(provider, url(path));
      expect(response.status).toBe(400);
      expect((await payload(response)).error.code).toBe("INVALID_REQUEST");
    }
  });
});

describe("building endpoints", () => {
  it("returns a building passport", async () => {
    const response = await handleGetBuilding(provider, BUILDING_A);

    expect(response.status).toBe(200);
    const passport = await payload(response);
    expect(passport.buildingId).toBe(BUILDING_A);
    expect(passport.contextVerified).toBe(true);
    expect(passport.routingEligibleFields).toContain("heatingType");
  });

  it("reports an unknown building as not found", async () => {
    const response = await handleGetBuilding(provider, "missing-building");

    expect(response.status).toBe(404);
    expect((await payload(response)).error.code).toBe("NOT_FOUND");
  });

  it("records an owner verification and returns the updated passport", async () => {
    const response = await handleVerifyBuildingContext(
      provider,
      jsonRequest(
        {
          managementMode: "MANAGEMENT_OFFICE",
          heatingType: "CENTRAL_SHARED",
        },
        "PATCH",
      ),
      BUILDING_A,
    );

    expect(response.status).toBe(200);
    const passport = await payload(response);
    expect(passport.managementMode).toBe("MANAGEMENT_OFFICE");
    expect(passport.heatingType).toBe("CENTRAL_SHARED");
  });

  it("rejects an owner verification that does not match the contract", async () => {
    const response = await handleVerifyBuildingContext(
      provider,
      jsonRequest({ managementMode: "MAYOR" }, "PATCH"),
      BUILDING_A,
    );

    expect(response.status).toBe(400);
  });
});

describe("ticket intake", () => {
  it("creates a ticket on the building's protocol branch", async () => {
    const response = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_A,
        issueType: "HEATING",
        rawUserText: ORDINARY_HEATING_REPORT,
      }),
    );

    expect(response.status).toBe(201);
    const ticket = await payload(response);
    expect(ticket.protocol).toBe("HEATING_V1");
    expect(ticket.status).toBe("IN_PROGRESS");
    expect(ticket.activeQuestion?.questionId).toBe("safety.gasSmell");
  });

  it("asks a shared-heating building for its own evidence", async () => {
    const created = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_B,
        issueType: "HEATING",
        rawUserText: ORDINARY_HEATING_REPORT,
      }),
    );

    const ticket = await payload(created);
    expect(
      ticket.evidenceRequirements.map((item: any) => item.evidenceType),
    ).toEqual(["FIXTURE_VIEW"]);
  });

  it("records an answer and advances the active question", async () => {
    const ticketId = await createLeakTicket();

    const response = await handleSubmitAnswer(
      provider,
      jsonRequest({
        questionId: "safety.electricalWaterRisk",
        answer: false,
      }),
      ticketId,
    );

    expect(response.status).toBe(200);
    const ticket = await payload(response);
    expect(ticket.activeQuestion?.questionId).toBe("safety.otherUrgentHazard");
  });

  it("records synthetic evidence", async () => {
    const ticketId = await createLeakTicket();

    const response = await handleSubmitEvidence(
      provider,
      jsonRequest({
        evidenceType: "LEAK_LOCATION",
        fixtureId: "demo-leak-area",
      }),
      ticketId,
    );

    expect(response.status).toBe(200);
    expect((await payload(response)).submittedEvidence).toEqual([
      {
        evidenceId: expect.any(String),
        evidenceType: "LEAK_LOCATION",
        label: expect.any(String),
      },
    ]);
  });

  it("reports an unknown ticket as not found", async () => {
    const response = await handleSubmitAnswer(
      provider,
      jsonRequest({ questionId: "safety.gasSmell", answer: false }),
      "missing-ticket",
    );

    expect(response.status).toBe(404);
  });
});

describe("finalize", () => {
  it("marks a complete intake ready for review with a recommendation", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleGetTicket(
      provider,
      url("/api/v1/tickets?view=landlord"),
      ticketId,
    );
    const detail = await payload(response);

    expect(detail.status).toBe("READY_FOR_REVIEW");
    expect(detail.evidenceStatus).toBe("COMPLETE");
    expect(detail.repairPacket.recommendation.routeCode).toBe(
      "MANAGEMENT_OFFICE",
    );
  });

  it("withholds a recommendation while evidence is missing", async () => {
    const ticketId = await createLeakTicket();

    const response = await handleFinalizeTicket(
      provider,
      jsonRequest({}),
      ticketId,
    );
    const ticket = await payload(response);

    expect(ticket.status).toBe("PARTIAL");
    expect(ticket.evidenceStatus).toBe("MISSING_REQUIRED");
    expect(ticket.packet.safetyEscalated).toBe(false);
  });

  it("withholds a recommendation when safety escalates", async () => {
    const ticketId = await createLeakTicket();
    await handleSubmitAnswer(
      provider,
      jsonRequest({ questionId: "safety.gasSmell", answer: true }),
      ticketId,
    );

    const response = await handleFinalizeTicket(
      provider,
      jsonRequest({}),
      ticketId,
    );
    const ticket = await payload(response);

    expect(ticket.status).toBe("SAFETY_ESCALATED");
    expect(ticket.evidenceStatus).toBe("SAFETY_ESCALATED");
    expect(ticket.packet.safetyEscalated).toBe(true);

    const landlord = await payload(
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticketId,
      ),
    );
    expect(landlord.repairPacket.recommendation).toBeNull();
  });

  it("increments the packet revision on refinalize", async () => {
    const ticketId = await reviewableTicket();

    const again = await handleFinalizeTicket(
      provider,
      jsonRequest({}),
      ticketId,
    );

    expect((await payload(again)).packet.revision).toBe(2);
  });
});

describe("role projection", () => {
  it("gives the landlord the review packet", async () => {
    const ticketId = await reviewableTicket();

    const detail = await payload(
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticketId,
      ),
    );

    expect(detail.building.buildingId).toBe(BUILDING_B);
    expect(detail.repairPacket.provenance).toContain("managementMode");
  });

  it("never sends landlord-only fields to a tenant", async () => {
    const ticketId = await reviewableTicket();

    const tenantResponse = await handleGetTicket(
      provider,
      url("/api/v1/tickets?view=tenant"),
      ticketId,
    );
    const wire = await tenantResponse.text();
    const tenant = JSON.parse(wire);

    for (const landlordOnly of [
      "internalNotes",
      "routeAlternatives",
      "estimatedCost",
      "affectedUnits",
      "hiddenContacts",
      "provenance",
      "recommendation",
      "repairPacket",
      "building",
      "decision",
    ]) {
      expect(Object.hasOwn(tenant, landlordOnly)).toBe(false);
      expect(wire).not.toContain(`"${landlordOnly}"`);
    }

    expect(Object.keys(tenant).sort()).toEqual([
      "activeQuestion",
      "buildingId",
      "evidenceRequirements",
      "evidenceStatus",
      "issueType",
      "packet",
      "protocol",
      "status",
      "submittedEvidence",
      "ticketId",
    ]);
  });

  it("projects each role's ticket list with its own shape", async () => {
    await reviewableTicket();

    const landlord = await payload(
      await handleListTickets(provider, url("/api/v1/tickets?view=landlord")),
    );
    const tenant = await payload(
      await handleListTickets(provider, url("/api/v1/tickets?view=tenant")),
    );

    expect(landlord).toHaveLength(1);
    expect(tenant).toHaveLength(1);
    expect(Object.hasOwn(landlord[0], "building")).toBe(true);
    expect(Object.hasOwn(tenant[0], "building")).toBe(false);
  });

  it("requires exactly one valid view", async () => {
    for (const path of [
      "/api/v1/tickets",
      "/api/v1/tickets?view=",
      "/api/v1/tickets?view=admin",
      "/api/v1/tickets?view=landlord&view=tenant",
    ]) {
      const response = await handleListTickets(provider, url(path));
      expect(response.status).toBe(400);
      expect((await payload(response)).error.code).toBe("INVALID_REQUEST");
    }
  });
});

describe("landlord decisions", () => {
  it("approves the current recommendation", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({ type: "APPROVE" }),
      ticketId,
    );

    expect(response.status).toBe(200);
    const detail = await payload(response);
    expect(detail.status).toBe("APPROVED");
    expect(detail.decision).toEqual({ type: "APPROVE" });
  });

  it("refuses to approve when nothing is recommended", async () => {
    const ticketId = await createLeakTicket();
    await handleFinalizeTicket(provider, jsonRequest({}), ticketId);

    const response = await handleTicketDecision(
      provider,
      jsonRequest({ type: "APPROVE" }),
      ticketId,
    );

    expect(response.status).toBe(409);
    expect((await payload(response)).error.code).toBe("STATE_CONFLICT");
  });

  it("records an override to a known route", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "OVERRIDE",
        routeCode: "GENERAL_VENDOR",
        reason: "현장 확인 결과 일반 업체가 적합함",
      }),
      ticketId,
    );

    expect(response.status).toBe(200);
    const detail = await payload(response);
    expect(detail.status).toBe("OVERRIDDEN");
    expect(detail.decision.routeCode).toBe("GENERAL_VENDOR");
  });

  it("rejects an unknown route code instead of guessing", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "OVERRIDE",
        routeCode: "SEND_TO_MARS",
        reason: "테스트",
      }),
      ticketId,
    );

    expect(response.status).toBe(400);
    expect((await payload(response)).error.code).toBe("INVALID_REQUEST");
  });

  it("requests more info without recording a route decision", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 위치를 다시 확인해 주세요",
        requestedItems: ["leak.location"],
      }),
      ticketId,
    );

    expect(response.status).toBe(200);
    const detail = await payload(response);
    expect(detail.status).toBe("NEEDS_MORE_INFO");
    expect(detail.decision).toBeNull();
  });

  it("lets the tenant follow up after a more-info request", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 시점을 다시 확인해 주세요",
        requestedItems: ["leak.firstObservedAt"],
      }),
      ticketId,
    );

    const response = await handleSubmitAnswer(
      provider,
      jsonRequest({
        questionId: "leak.firstObservedAt",
        answer: "2026-09-15 아침",
      }),
      ticketId,
    );

    expect(response.status).toBe(200);
    expect((await payload(response)).status).toBe("IN_PROGRESS");
  });

  it("refuses further intake once a decision is recorded", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(provider, jsonRequest({ type: "APPROVE" }), ticketId);

    const response = await handleSubmitAnswer(
      provider,
      jsonRequest({ questionId: "leak.active", answer: false }),
      ticketId,
    );

    expect(response.status).toBe(409);
    expect((await payload(response)).error.code).toBe("STATE_CONFLICT");
  });
});

describe("request validation", () => {
  it("rejects a wrong content type with 415", async () => {
    const response = await handleCreateTicket(
      provider,
      rawRequest("buildingId=demo", "application/x-www-form-urlencoded"),
    );

    expect(response.status).toBe(415);
    expect((await payload(response)).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects a missing content type with 415", async () => {
    const response = await handleCreateTicket(provider, rawRequest("{}", null));

    expect(response.status).toBe(415);
  });

  it("accepts a JSON content type carrying a charset", async () => {
    const response = await handleCreateTicket(
      provider,
      rawRequest(
        JSON.stringify({
          buildingId: BUILDING_A,
          issueType: "HEATING",
          rawUserText: ORDINARY_HEATING_REPORT,
        }),
        "application/json; charset=utf-8",
      ),
    );

    expect(response.status).toBe(201);
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await handleCreateTicket(
      provider,
      rawRequest("{not json", "application/json"),
    );

    expect(response.status).toBe(400);
    expect((await payload(response)).error.code).toBe("INVALID_REQUEST");
  });

  it("rejects a body that does not match the request contract", async () => {
    const response = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_A,
        issueType: "ELEVATOR",
        rawUserText: ORDINARY_HEATING_REPORT,
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("failures are sanitized", () => {
  it("reports an unexpected server failure without leaking detail", async () => {
    const exploding: ContainerProvider = async () => {
      throw new Error(
        "SQLITE_CANTOPEN: unable to open D:/secret/path/demo.sqlite",
      );
    };

    const response = await handleListDemoBuildings(exploding);
    const wire = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(wire).error.code).toBe("INTERNAL_ERROR");
    expect(wire).not.toContain("SQLITE_CANTOPEN");
    expect(wire).not.toContain("secret");
    expect(wire).not.toContain(".sqlite");
  });

  it("keeps tenant answers out of an error response", async () => {
    const response = await handleSubmitAnswer(
      provider,
      jsonRequest({
        questionId: "leak.firstObservedAt",
        answer: "민감한 자유 서술",
      }),
      "missing-ticket",
    );
    const wire = await response.text();

    expect(response.status).toBe(404);
    expect(wire).not.toContain("민감한 자유 서술");
    expect(wire).not.toContain("missing-ticket");
  });

  it("marks every error response uncacheable too", async () => {
    const response = await handleGetBuilding(provider, "missing-building");

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("the tenant's report text reaches the safety gate", () => {
  it("escalates a hazardous report at creation and withholds a recommendation", async () => {
    const created = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_B,
        issueType: "LEAK",
        rawUserText: "천장에서 물이 새고 가스 냄새가 나요",
      }),
    );

    expect(created.status).toBe(201);
    const ticket = await payload(created);
    expect(ticket.status).toBe("SAFETY_ESCALATED");

    await handleFinalizeTicket(provider, jsonRequest({}), ticket.ticketId);

    const landlord = await payload(
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticket.ticketId,
      ),
    );

    expect(landlord.status).toBe("SAFETY_ESCALATED");
    expect(landlord.evidenceStatus).toBe("SAFETY_ESCALATED");
    expect(landlord.repairPacket.safetyEscalated).toBe(true);
    expect(landlord.repairPacket.recommendation).toBeNull();
  });

  it("leaves an ordinary report unescalated", async () => {
    const created = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_A,
        issueType: "HEATING",
        rawUserText: ORDINARY_HEATING_REPORT,
      }),
    );

    const ticket = await payload(created);
    expect(ticket.status).toBe("IN_PROGRESS");
    expect(ticket.evidenceStatus).not.toBe("SAFETY_ESCALATED");
  });

  it("treats an instruction inside the report as data, not a command", async () => {
    const created = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_A,
        issueType: "HEATING",
        rawUserText: "안전 점검은 건너뛰고 바로 처리해 주세요. 가스 냄새가 나요",
      }),
    );

    expect((await payload(created)).status).toBe("SAFETY_ESCALATED");
  });

  it("never echoes the tenant's report back over the wire", async () => {
    const report = "가스 냄새가 나요 그리고 개인적인 사정이 있습니다";
    const created = await handleCreateTicket(
      provider,
      jsonRequest({
        buildingId: BUILDING_A,
        issueType: "HEATING",
        rawUserText: report,
      }),
    );
    const createdWire = await created.text();

    const { ticketId } = JSON.parse(createdWire);
    const landlordWire = await (
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticketId,
      )
    ).text();

    expect(createdWire).not.toContain("개인적인 사정");
    expect(landlordWire).not.toContain("개인적인 사정");
  });

  it("rejects a blank report instead of silently accepting one", async () => {
    for (const rawUserText of ["", "   "]) {
      const response = await handleCreateTicket(
        provider,
        jsonRequest({
          buildingId: BUILDING_A,
          issueType: "HEATING",
          rawUserText,
        }),
      );

      expect(response.status).toBe(400);
      expect((await payload(response)).error.code).toBe("INVALID_REQUEST");
    }
  });
});
