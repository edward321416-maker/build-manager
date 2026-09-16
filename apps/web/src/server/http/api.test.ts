import {
  AddressSearchResponseSchema,
  ApiErrorSchema,
  BuildingPassportDtoSchema,
  BuildingPassportListSchema,
  LandlordTicketDetailDtoSchema,
  LandlordTicketListSchema,
  TenantTicketListSchema,
  TenantTicketStatusDtoSchema,
} from "@build-manager/api-contracts";
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

type ResponseSchema<T> = { parse(value: unknown): T };

/**
 * Reads a success body back through the same public contract the handler
 * promised, so the shape a test indexes into comes from the contract instead of
 * from assumption.
 */
async function payload<T>(
  schema: ResponseSchema<T>,
  response: Response,
): Promise<T> {
  return schema.parse(await response.json());
}

/** Reads the public error envelope, which is deliberately not a DTO. */
async function errorPayload(response: Response) {
  return ApiErrorSchema.parse(await response.json());
}

/** Fails loudly instead of casting when a nullable field must be present. */
function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected a value, got none");
  }
  return value;
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
  return (await payload(TenantTicketStatusDtoSchema, created)).ticketId;
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

    const buildings = await payload(BuildingPassportListSchema, response);
    expect(buildings.map((entry) => entry.buildingId).sort()).toEqual(
      [BUILDING_A, BUILDING_B].sort(),
    );
    expect(buildings.every((entry) => entry.demo === true)).toBe(true);
  });

  it("resets demo state and returns the reseeded buildings", async () => {
    const ticketId = await createLeakTicket();
    expect(ticketId).toBeTruthy();

    const response = await handleResetDemo(provider);

    expect(response.status).toBe(200);
    expect((await payload(BuildingPassportListSchema, response)).length).toBe(demoBuildings.length);

    const tickets = await handleListTickets(
      provider,
      url("/api/v1/tickets?view=landlord"),
    );
    expect(await payload(LandlordTicketListSchema, tickets)).toEqual([]);
  });

  it("searches the offline address fixture", async () => {
    const response = await handleSearchAddress(
      provider,
      url("/api/v1/address/search?query=DEMO%20%ED%95%B4%EC%86%94%EB%B9%8C%EB%9D%BC"),
    );

    expect(response.status).toBe(200);
    expect(await payload(AddressSearchResponseSchema, response)).toEqual({ result: null });
  });

  it("rejects a missing, blank, or repeated address query", async () => {
    for (const path of [
      "/api/v1/address/search",
      "/api/v1/address/search?query=",
      "/api/v1/address/search?query=a&query=b",
    ]) {
      const response = await handleSearchAddress(provider, url(path));
      expect(response.status).toBe(400);
      expect((await errorPayload(response)).error.code).toBe("INVALID_REQUEST");
    }
  });
});

describe("building endpoints", () => {
  it("returns a building passport", async () => {
    const response = await handleGetBuilding(provider, BUILDING_A);

    expect(response.status).toBe(200);
    const passport = await payload(BuildingPassportDtoSchema, response);
    expect(passport.buildingId).toBe(BUILDING_A);
    expect(passport.contextVerified).toBe(true);
    expect(passport.routingEligibleFields).toContain("heatingType");
  });

  it("reports an unknown building as not found", async () => {
    const response = await handleGetBuilding(provider, "missing-building");

    expect(response.status).toBe(404);
    expect((await errorPayload(response)).error.code).toBe("NOT_FOUND");
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
    const passport = await payload(BuildingPassportDtoSchema, response);
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
    const ticket = await payload(TenantTicketStatusDtoSchema, response);
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

    const ticket = await payload(TenantTicketStatusDtoSchema, created);
    expect(
      ticket.evidenceRequirements.map((item) => item.evidenceType),
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
    const ticket = await payload(TenantTicketStatusDtoSchema, response);
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
    expect((await payload(TenantTicketStatusDtoSchema, response)).submittedEvidence).toEqual([
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
    const detail = await payload(LandlordTicketDetailDtoSchema, response);

    expect(detail.status).toBe("READY_FOR_REVIEW");
    expect(detail.evidenceStatus).toBe("COMPLETE");
    expect(present(present(detail.repairPacket).recommendation).routeCode).toBe(
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
    const ticket = await payload(TenantTicketStatusDtoSchema, response);

    expect(ticket.status).toBe("PARTIAL");
    expect(ticket.evidenceStatus).toBe("MISSING_REQUIRED");
    expect(present(ticket.packet).safetyEscalated).toBe(false);
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
    const ticket = await payload(TenantTicketStatusDtoSchema, response);

    expect(ticket.status).toBe("SAFETY_ESCALATED");
    expect(ticket.evidenceStatus).toBe("SAFETY_ESCALATED");
    expect(present(ticket.packet).safetyEscalated).toBe(true);

    const landlord = await payload(
      LandlordTicketDetailDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticketId,
      ),
    );
    expect(present(landlord.repairPacket).recommendation).toBeNull();
  });

  it("increments the packet revision on refinalize", async () => {
    const ticketId = await reviewableTicket();

    const again = await handleFinalizeTicket(
      provider,
      jsonRequest({}),
      ticketId,
    );

    expect(
      present((await payload(TenantTicketStatusDtoSchema, again)).packet).revision,
    ).toBe(2);
  });
});

describe("role projection", () => {
  it("gives the landlord the review packet", async () => {
    const ticketId = await reviewableTicket();

    const detail = await payload(
      LandlordTicketDetailDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticketId,
      ),
    );

    expect(detail.building.buildingId).toBe(BUILDING_B);
    expect(present(detail.repairPacket).provenance).toContain("managementMode");
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
      "moreInfoRequest",
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
      LandlordTicketListSchema,
      await handleListTickets(provider, url("/api/v1/tickets?view=landlord")),
    );
    const tenant = await payload(
      TenantTicketListSchema,
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
      expect((await errorPayload(response)).error.code).toBe("INVALID_REQUEST");
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
    const detail = await payload(LandlordTicketDetailDtoSchema, response);
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
    expect((await errorPayload(response)).error.code).toBe("STATE_CONFLICT");
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
    const detail = await payload(LandlordTicketDetailDtoSchema, response);
    expect(detail.status).toBe("OVERRIDDEN");
    expect(detail.decision).toEqual({
      type: "OVERRIDE",
      routeCode: "GENERAL_VENDOR",
      reason: "현장 확인 결과 일반 업체가 적합함",
    });
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
    expect((await errorPayload(response)).error.code).toBe("INVALID_REQUEST");
  });

  it("requests more info without recording a route decision", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 위치를 다시 확인해 주세요",
        requestedQuestionIds: ["leak.location"],
      }),
      ticketId,
    );

    expect(response.status).toBe(200);
    const detail = await payload(LandlordTicketDetailDtoSchema, response);
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
    expect((await payload(TenantTicketStatusDtoSchema, response)).status).toBe("IN_PROGRESS");
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
    expect((await errorPayload(response)).error.code).toBe("STATE_CONFLICT");
  });
});

describe("request validation", () => {
  it("rejects a wrong content type with 415", async () => {
    const response = await handleCreateTicket(
      provider,
      rawRequest("buildingId=demo", "application/x-www-form-urlencoded"),
    );

    expect(response.status).toBe(415);
    expect((await errorPayload(response)).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
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
    expect((await errorPayload(response)).error.code).toBe("INVALID_REQUEST");
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
    const ticket = await payload(TenantTicketStatusDtoSchema, created);
    expect(ticket.status).toBe("SAFETY_ESCALATED");

    await handleFinalizeTicket(provider, jsonRequest({}), ticket.ticketId);

    const landlord = await payload(
      LandlordTicketDetailDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticket.ticketId,
      ),
    );

    expect(landlord.status).toBe("SAFETY_ESCALATED");
    expect(landlord.evidenceStatus).toBe("SAFETY_ESCALATED");
    expect(present(landlord.repairPacket).safetyEscalated).toBe(true);
    expect(present(landlord.repairPacket).recommendation).toBeNull();
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

    const ticket = await payload(TenantTicketStatusDtoSchema, created);
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

    expect((await payload(TenantTicketStatusDtoSchema, created)).status).toBe("SAFETY_ESCALATED");
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
      expect((await errorPayload(response)).error.code).toBe("INVALID_REQUEST");
    }
  });
});

describe("structured more-info over HTTP", () => {
  async function landlordView(ticketId: string) {
    return payload(
      LandlordTicketDetailDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=landlord"),
        ticketId,
      ),
    );
  }

  async function tenantView(ticketId: string) {
    return payload(
      TenantTicketStatusDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=tenant"),
        ticketId,
      ),
    );
  }

  it("offers the landlord the protocol's questions and evidence to ask for", async () => {
    const ticketId = await reviewableTicket();

    const detail = await landlordView(ticketId);

    expect(detail.followUpOptions.questions.length).toBeGreaterThan(0);
    expect(
      detail.followUpOptions.questions.map((q) => q.questionId),
    ).toContain("leak.location");
    expect(
      detail.followUpOptions.evidence.map((e) => e.evidenceType),
    ).toContain("LEAK_LOCATION");
  });

  it("gives every evidence requirement a server-provided demo fixture id", async () => {
    const ticketId = await reviewableTicket();
    const tenant = await tenantView(ticketId);

    for (const requirement of tenant.evidenceRequirements) {
      expect(typeof requirement.demoFixtureId).toBe("string");
      expect(requirement.demoFixtureId.length).toBeGreaterThan(0);
      expect(requirement.demoFixtureId).not.toContain("/");
      expect(requirement.demoFixtureId).not.toContain("\\");
    }
  });

  it("carries a requested question through to the tenant", async () => {
    const ticketId = await reviewableTicket();

    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 위치를 다시 확인해 주세요",
        requestedQuestionIds: ["leak.location"],
      }),
      ticketId,
    );

    const tenant = await tenantView(ticketId);
    expect(tenant.status).toBe("NEEDS_MORE_INFO");
    expect(present(tenant.moreInfoRequest).reason).toBe("누수 위치를 다시 확인해 주세요");
    expect(
      present(tenant.moreInfoRequest).requestedQuestions.map((q) => q.questionId),
    ).toEqual(["leak.location"]);
    expect(present(tenant.moreInfoRequest).requestedEvidence).toEqual([]);
  });

  it("carries a requested evidence type through to the tenant", async () => {
    const ticketId = await reviewableTicket();

    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 사진을 다시 올려 주세요",
        requestedEvidenceTypes: ["LEAK_LOCATION"],
      }),
      ticketId,
    );

    const tenant = await tenantView(ticketId);
    expect(present(tenant.moreInfoRequest).requestedQuestions).toEqual([]);
    expect(
      present(tenant.moreInfoRequest).requestedEvidence.map((e) => e.evidenceType),
    ).toEqual(["LEAK_LOCATION"]);
    expect(
      present(tenant.moreInfoRequest).requestedEvidence[0].demoFixtureId.length,
    ).toBeGreaterThan(0);
  });

  it("does not collapse an evidence request into a question request", async () => {
    const ticketId = await reviewableTicket();

    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "둘 다 확인해 주세요",
        requestedQuestionIds: ["leak.active"],
        requestedEvidenceTypes: ["LEAK_LOCATION"],
      }),
      ticketId,
    );

    const tenant = await tenantView(ticketId);
    expect(
      present(tenant.moreInfoRequest).requestedQuestions.map((q) => q.questionId),
    ).toEqual(["leak.active"]);
    expect(
      present(tenant.moreInfoRequest).requestedEvidence.map((e) => e.evidenceType),
    ).toEqual(["LEAK_LOCATION"]);
  });

  it("keeps a more-info request out of the route decision", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "확인 필요",
        requestedQuestionIds: ["leak.active"],
      }),
      ticketId,
    );

    expect((await payload(LandlordTicketDetailDtoSchema, response)).decision).toBeNull();
  });

  it("refuses a more-info request that asks for nothing", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({ type: "REQUEST_MORE_INFO", reason: "확인 필요" }),
      ticketId,
    );

    expect(response.status).toBe(400);
  });

  it("refuses a question the selected protocol never asks", async () => {
    const ticketId = await reviewableTicket();

    // Structurally valid, so this reaches the application's semantic guard
    // rather than being turned away by the transport contract.
    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "확인 필요",
        requestedQuestionIds: ["does.not.exist"],
      }),
      ticketId,
    );

    expect(response.status).toBe(409);
    expect((await errorPayload(response)).error).toEqual({
      code: "STATE_CONFLICT",
      message: "현재 상태에서는 처리할 수 없는 요청입니다.",
    });
  });

  it("refuses an evidence type the selected protocol never collects", async () => {
    const ticketId = await reviewableTicket();

    const response = await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "확인 필요",
        requestedEvidenceTypes: ["BOILER_DISPLAY"],
      }),
      ticketId,
    );

    expect(response.status).toBe(409);
    expect((await errorPayload(response)).error.code).toBe("STATE_CONFLICT");
  });

  it("refuses a finalize while the landlord's request is outstanding", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 시점을 다시 확인해 주세요",
        requestedQuestionIds: ["leak.firstObservedAt"],
      }),
      ticketId,
    );

    const response = await handleFinalizeTicket(
      provider,
      jsonRequest({}),
      ticketId,
    );

    expect(response.status).toBe(409);
    expect((await errorPayload(response)).error).toEqual({
      code: "STATE_CONFLICT",
      message: "현재 상태에서는 처리할 수 없는 요청입니다.",
    });

    // The refusal must not have consumed the request.
    expect(
      present((await tenantView(ticketId)).moreInfoRequest).requestedQuestions,
    ).toHaveLength(1);
  });

  it("drops an outstanding question once the tenant answers it", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 시점을 다시 확인해 주세요",
        requestedQuestionIds: ["leak.firstObservedAt"],
      }),
      ticketId,
    );

    expect(
      present((await tenantView(ticketId)).moreInfoRequest).requestedQuestions,
    ).toHaveLength(1);

    await handleSubmitAnswer(
      provider,
      jsonRequest({
        questionId: "leak.firstObservedAt",
        answer: "2026-09-15 아침",
      }),
      ticketId,
    );

    const after = await tenantView(ticketId);
    expect(present(after.moreInfoRequest).requestedQuestions).toEqual([]);
    expect(present(after.moreInfoRequest).reason).toBe("누수 시점을 다시 확인해 주세요");
  });

  it("drops outstanding evidence once the tenant submits it", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 사진을 다시 올려 주세요",
        requestedEvidenceTypes: ["LEAK_LOCATION"],
      }),
      ticketId,
    );

    expect(
      present((await tenantView(ticketId)).moreInfoRequest).requestedEvidence,
    ).toHaveLength(1);

    await handleSubmitEvidence(
      provider,
      jsonRequest({
        evidenceType: "LEAK_LOCATION",
        fixtureId: "demo-leak-location",
      }),
      ticketId,
    );

    const after = await tenantView(ticketId);
    expect(present(after.moreInfoRequest).requestedEvidence).toEqual([]);
    expect(present(after.moreInfoRequest).requestedQuestions).toEqual([]);
  });

  it("clears the request entirely once the ticket is refinalized", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "누수 시점을 다시 확인해 주세요",
        requestedQuestionIds: ["leak.firstObservedAt"],
      }),
      ticketId,
    );
    await handleSubmitAnswer(
      provider,
      jsonRequest({
        questionId: "leak.firstObservedAt",
        answer: "2026-09-14 아침",
      }),
      ticketId,
    );

    const finalized = await payload(
      TenantTicketStatusDtoSchema,
      await handleFinalizeTicket(provider, jsonRequest({}), ticketId),
    );

    expect(finalized.moreInfoRequest).toBeNull();
    expect(finalized.status).toBe("READY_FOR_REVIEW");
  });

  it("keeps landlord-only data out of the tenant more-info payload", async () => {
    const ticketId = await reviewableTicket();
    await handleTicketDecision(
      provider,
      jsonRequest({
        type: "REQUEST_MORE_INFO",
        reason: "확인 필요",
        requestedQuestionIds: ["leak.active"],
      }),
      ticketId,
    );

    const wire = await (
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=tenant"),
        ticketId,
      )
    ).text();

    expect(wire).not.toContain("LANDLORD");
    expect(wire).not.toContain("requestedAt");
    expect(wire).not.toContain("followUpOptions");
  });
});

describe("conditional evidence is only required when its condition holds", () => {
  it("does not ask a ceiling leak for appliance evidence", async () => {
    const ticketId = await createLeakTicket();
    for (const [questionId, answer] of CLEAN_LEAK_ANSWERS) {
      await handleSubmitAnswer(
        provider,
        jsonRequest({ questionId, answer }),
        ticketId,
      );
    }

    const tenant = await payload(
      TenantTicketStatusDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=tenant"),
        ticketId,
      ),
    );

    expect(
      tenant.evidenceRequirements.map((item) => item.evidenceType),
    ).toEqual(["LEAK_LOCATION"]);
  });

  it("asks an appliance leak for the fixture evidence as well", async () => {
    const ticketId = await createLeakTicket();
    for (const [questionId, answer] of CLEAN_LEAK_ANSWERS) {
      await handleSubmitAnswer(
        provider,
        jsonRequest({
          questionId,
          answer: questionId === "leak.location" ? "APPLIANCE" : answer,
        }),
        ticketId,
      );
    }

    const tenant = await payload(
      TenantTicketStatusDtoSchema,
      await handleGetTicket(
        provider,
        url("/api/v1/tickets?view=tenant"),
        ticketId,
      ),
    );

    expect(
      tenant.evidenceRequirements.map((item) => item.evidenceType).sort(),
    ).toEqual(["FIXTURE_VIEW", "LEAK_LOCATION"]);
  });
});
