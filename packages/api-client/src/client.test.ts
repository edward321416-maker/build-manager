import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createApiClient, type ApiClient, type TicketView } from "./client";
import { ApiClientError } from "./errors";
import type { FetchLike, RequestInitLike } from "./http";

const passport = {
  buildingId: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  primaryUse: "다가구주택",
  approvalYear: "2011",
  managementMode: "OWNER_DIRECT",
  heatingType: "INDIVIDUAL",
  ownerSuppliedBoiler: true,
  contextVerified: true,
  routingEligibleFields: [
    "managementMode",
    "heatingType",
    "ownerSuppliedBoiler",
  ],
};

const tenantStatus = {
  ticketId: "ticket-a",
  buildingId: "demo-building-a",
  issueType: "HEATING",
  protocol: "HEATING_V1",
  status: "IN_PROGRESS",
  evidenceStatus: "MISSING_REQUIRED",
  activeQuestion: null,
  evidenceRequirements: [],
  submittedEvidence: [],
  packet: null,
  moreInfoRequest: null,
};

const landlordDetail = {
  ticketId: "ticket-a",
  building: passport,
  issueType: "HEATING",
  protocol: "HEATING_V1",
  status: "READY_FOR_REVIEW",
  evidenceStatus: "COMPLETE",
  activeQuestion: null,
  repairPacket: null,
  decision: null,
  followUpOptions: { questions: [], evidence: [] },
};

type RecordedCall = { url: string; init: RequestInitLike | undefined };

type Stub = {
  fetchImpl: FetchLike;
  calls: RecordedCall[];
};

function respondWith(body: string, status = 200): Stub {
  const calls: RecordedCall[] = [];

  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
          return body;
        },
      };
    },
  };
}

function rejectWith(error: unknown): Stub {
  const calls: RecordedCall[] = [];

  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      throw error;
    },
  };
}

function clientWith(stub: Stub, baseUrl = ""): ApiClient {
  return createApiClient({ baseUrl, fetchImpl: stub.fetchImpl });
}

async function captured(
  stub: Stub,
  invoke: (client: ApiClient) => Promise<unknown>,
  baseUrl = "",
): Promise<RecordedCall> {
  await invoke(clientWith(stub, baseUrl));
  return stub.calls[0]!;
}

describe("base URL composition", () => {
  it("keeps a browser same-origin base URL as an absolute path", async () => {
    const stub = respondWith(JSON.stringify([passport]));

    const call = await captured(stub, (client) => client.listDemoBuildings());

    expect(call.url).toBe("/api/v1/demo/buildings");
  });

  it("prefixes an absolute base URL", async () => {
    const stub = respondWith(JSON.stringify([passport]));

    const call = await captured(
      stub,
      (client) => client.listDemoBuildings(),
      "https://example.test",
    );

    expect(call.url).toBe("https://example.test/api/v1/demo/buildings");
  });

  it("normalises a trailing slash instead of doubling it", async () => {
    const stub = respondWith(JSON.stringify([passport]));

    const call = await captured(
      stub,
      (client) => client.listDemoBuildings(),
      "https://example.test/",
    );

    expect(call.url).toBe("https://example.test/api/v1/demo/buildings");
  });

  it("encodes path identifiers", async () => {
    const stub = respondWith(JSON.stringify(passport));

    const call = await captured(stub, (client) =>
      client.getBuilding("demo/building a"),
    );

    expect(call.url).toBe("/api/v1/buildings/demo%2Fbuilding%20a");
  });

  it("encodes a ticket identifier alongside the view query", async () => {
    const stub = respondWith(JSON.stringify(landlordDetail));

    const call = await captured(stub, (client) =>
      client.getLandlordTicket("ticket a/1"),
    );

    expect(call.url).toBe("/api/v1/tickets/ticket%20a%2F1?view=landlord");
  });
});

describe("endpoint mapping", () => {
  const cases = [
    {
      name: "listDemoBuildings",
      invoke: (client: ApiClient) => client.listDemoBuildings(),
      response: JSON.stringify([passport]),
      method: "GET",
      url: "/api/v1/demo/buildings",
      body: undefined,
    },
    {
      name: "resetDemo",
      invoke: (client: ApiClient) => client.resetDemo(),
      response: JSON.stringify([passport]),
      method: "POST",
      url: "/api/v1/demo/reset",
      body: undefined,
    },
    {
      name: "getBuilding",
      invoke: (client: ApiClient) => client.getBuilding("demo-building-a"),
      response: JSON.stringify(passport),
      method: "GET",
      url: "/api/v1/buildings/demo-building-a",
      body: undefined,
    },
    {
      name: "verifyBuildingContext",
      invoke: (client: ApiClient) =>
        client.verifyBuildingContext("demo-building-a", {
          managementMode: "OWNER_DIRECT",
          heatingType: "INDIVIDUAL",
          ownerSuppliedBoiler: true,
        }),
      response: JSON.stringify(passport),
      method: "PATCH",
      url: "/api/v1/buildings/demo-building-a/context",
      body: {
        managementMode: "OWNER_DIRECT",
        heatingType: "INDIVIDUAL",
        ownerSuppliedBoiler: true,
      },
    },
    {
      name: "createTicket",
      invoke: (client: ApiClient) =>
        client.createTicket({
          buildingId: "demo-building-a",
          issueType: "HEATING",
          rawUserText: "난방이 안 돼요",
        }),
      response: JSON.stringify(tenantStatus),
      method: "POST",
      url: "/api/v1/tickets",
      body: {
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방이 안 돼요",
      },
    },
    {
      name: "submitAnswer",
      invoke: (client: ApiClient) =>
        client.submitAnswer("ticket-a", {
          questionId: "heating.powerOn",
          answer: true,
        }),
      response: JSON.stringify(tenantStatus),
      method: "POST",
      url: "/api/v1/tickets/ticket-a/answers",
      body: { questionId: "heating.powerOn", answer: true },
    },
    {
      name: "submitEvidence",
      invoke: (client: ApiClient) =>
        client.submitEvidence("ticket-a", {
          evidenceType: "BOILER_DISPLAY",
          fixtureId: "demo-boiler-display-on",
        }),
      response: JSON.stringify(tenantStatus),
      method: "POST",
      url: "/api/v1/tickets/ticket-a/evidence",
      body: {
        evidenceType: "BOILER_DISPLAY",
        fixtureId: "demo-boiler-display-on",
      },
    },
    {
      name: "finalizeTicket",
      invoke: (client: ApiClient) => client.finalizeTicket("ticket-a"),
      response: JSON.stringify(tenantStatus),
      method: "POST",
      url: "/api/v1/tickets/ticket-a/finalize",
      body: {},
    },
    {
      name: "listTickets landlord",
      invoke: (client: ApiClient) => client.listTickets({ view: "landlord" }),
      response: JSON.stringify([landlordDetail]),
      method: "GET",
      url: "/api/v1/tickets?view=landlord",
      body: undefined,
    },
    {
      name: "listTickets tenant",
      invoke: (client: ApiClient) => client.listTickets({ view: "tenant" }),
      response: JSON.stringify([tenantStatus]),
      method: "GET",
      url: "/api/v1/tickets?view=tenant",
      body: undefined,
    },
    {
      name: "getLandlordTicket",
      invoke: (client: ApiClient) => client.getLandlordTicket("ticket-a"),
      response: JSON.stringify(landlordDetail),
      method: "GET",
      url: "/api/v1/tickets/ticket-a?view=landlord",
      body: undefined,
    },
    {
      name: "getTenantTicketStatus",
      invoke: (client: ApiClient) => client.getTenantTicketStatus("ticket-a"),
      response: JSON.stringify(tenantStatus),
      method: "GET",
      url: "/api/v1/tickets/ticket-a?view=tenant",
      body: undefined,
    },
    {
      name: "approveRoute",
      invoke: (client: ApiClient) => client.approveRoute("ticket-a"),
      response: JSON.stringify(landlordDetail),
      method: "POST",
      url: "/api/v1/tickets/ticket-a/decision",
      body: { type: "APPROVE" },
    },
    {
      name: "overrideRoute",
      invoke: (client: ApiClient) =>
        client.overrideRoute("ticket-a", {
          routeCode: "GENERAL_VENDOR",
          reason: "현장 확인 결과 일반 수리가 적합함",
        }),
      response: JSON.stringify(landlordDetail),
      method: "POST",
      url: "/api/v1/tickets/ticket-a/decision",
      body: {
        type: "OVERRIDE",
        routeCode: "GENERAL_VENDOR",
        reason: "현장 확인 결과 일반 수리가 적합함",
      },
    },
    {
      name: "requestMoreInfo",
      invoke: (client: ApiClient) =>
        client.requestMoreInfo("ticket-a", {
          reason: "누수 위치 확인 필요",
          requestedQuestionIds: ["leak.location"],
        }),
      response: JSON.stringify(landlordDetail),
      method: "POST",
      url: "/api/v1/tickets/ticket-a/decision",
      body: {
        type: "REQUEST_MORE_INFO",
        reason: "누수 위치 확인 필요",
        requestedQuestionIds: ["leak.location"],
      },
    },
  ] as const;

  it.each(cases)("maps $name to its verb and path", async (testCase) => {
    const stub = respondWith(testCase.response);

    const call = await captured(stub, testCase.invoke);

    expect(call.init?.method).toBe(testCase.method);
    expect(call.url).toBe(testCase.url);
    expect(call.init?.body).toBe(
      testCase.body === undefined ? undefined : JSON.stringify(testCase.body),
    );
  });

  it.each(cases)("never sends a body on a GET for $name", async (testCase) => {
    const stub = respondWith(testCase.response);

    const call = await captured(stub, testCase.invoke);

    if (call.init?.method === "GET") {
      expect(call.init?.body).toBeUndefined();
    }
  });
});

describe("request headers", () => {
  it("always asks for JSON", async () => {
    const stub = respondWith(JSON.stringify([passport]));

    const call = await captured(stub, (client) => client.listDemoBuildings());

    expect(call.init?.headers).toEqual({ Accept: "application/json" });
  });

  it("declares a JSON content type only when it sends a body", async () => {
    const withBody = respondWith(JSON.stringify(tenantStatus));
    const withoutBody = respondWith(JSON.stringify([passport]));

    const bodyCall = await captured(withBody, (client) =>
      client.createTicket({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방이 안 돼요",
      }),
    );
    const bodylessCall = await captured(withoutBody, (client) =>
      client.resetDemo(),
    );

    expect(bodyCall.init?.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(bodylessCall.init?.headers).toEqual({
      Accept: "application/json",
    });
    expect(bodylessCall.init?.body).toBeUndefined();
  });
});

describe("role projection typing", () => {
  it("narrows the list result on a literal view", async () => {
    const landlord = clientWith(respondWith(JSON.stringify([landlordDetail])));
    const tenant = clientWith(respondWith(JSON.stringify([tenantStatus])));

    const landlordTickets = await landlord.listTickets({ view: "landlord" });
    const tenantTickets = await tenant.listTickets({ view: "tenant" });

    expectTypeOf(landlordTickets).toEqualTypeOf<LandlordTicketDetailDto[]>();
    expectTypeOf(tenantTickets).toEqualTypeOf<TenantTicketStatusDto[]>();
    expect(landlordTickets).toHaveLength(1);
    expect(tenantTickets).toHaveLength(1);
  });

  it("narrows each ticket detail reader to its role DTO", async () => {
    const landlord = clientWith(respondWith(JSON.stringify(landlordDetail)));
    const tenant = clientWith(respondWith(JSON.stringify(tenantStatus)));

    expectTypeOf(
      await landlord.getLandlordTicket("ticket-a"),
    ).toEqualTypeOf<LandlordTicketDetailDto>();
    expectTypeOf(
      await tenant.getTenantTicketStatus("ticket-a"),
    ).toEqualTypeOf<TenantTicketStatusDto>();
  });

  it("closes the view type against an arbitrary role string", () => {
    // @ts-expect-error an arbitrary role is not a TicketView
    const rejected: TicketView = "admin";

    expect(rejected).toBe("admin");
  });
});

describe("successful responses are validated", () => {
  it("returns a parsed building passport", async () => {
    const client = clientWith(respondWith(JSON.stringify(passport)));

    const result = await client.getBuilding("demo-building-a");

    expect(result).toEqual(passport);
    expectTypeOf(result).toEqualTypeOf<BuildingPassportDto>();
  });

  it("rejects a success body that is not JSON", async () => {
    const client = clientWith(respondWith("<html>not json</html>"));

    await expect(client.getBuilding("demo-building-a")).rejects.toMatchObject({
      name: "ApiClientError",
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects a success body that does not match the schema", async () => {
    const client = clientWith(
      respondWith(JSON.stringify({ ...passport, demo: false })),
    );

    await expect(client.getBuilding("demo-building-a")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects an empty success body for every method that expects a DTO", async () => {
    const invocations: Array<(client: ApiClient) => Promise<unknown>> = [
      (client) => client.listDemoBuildings(),
      (client) => client.resetDemo(),
      (client) => client.getBuilding("demo-building-a"),
      (client) =>
        client.verifyBuildingContext("demo-building-a", {
          managementMode: "OWNER_DIRECT",
          heatingType: "INDIVIDUAL",
        }),
      (client) =>
        client.createTicket({
          buildingId: "demo-building-a",
          issueType: "HEATING",
          rawUserText: "난방이 안 돼요",
        }),
      (client) =>
        client.submitAnswer("ticket-a", {
          questionId: "heating.powerOn",
          answer: true,
        }),
      (client) =>
        client.submitEvidence("ticket-a", {
          evidenceType: "BOILER_DISPLAY",
          fixtureId: "demo-boiler-display-on",
        }),
      (client) => client.finalizeTicket("ticket-a"),
      (client) => client.listTickets({ view: "landlord" }),
      (client) => client.listTickets({ view: "tenant" }),
      (client) => client.getLandlordTicket("ticket-a"),
      (client) => client.getTenantTicketStatus("ticket-a"),
      (client) => client.approveRoute("ticket-a"),
      (client) =>
        client.overrideRoute("ticket-a", {
          routeCode: "GENERAL_VENDOR",
          reason: "현장 확인",
        }),
      (client) =>
        client.requestMoreInfo("ticket-a", {
          reason: "확인 필요",
          requestedQuestionIds: ["leak.location"],
        }),
    ];

    for (const invoke of invocations) {
      await expect(invoke(clientWith(respondWith("")))).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    }
  });
});

describe("error responses are sanitized", () => {
  it("preserves a valid API error envelope without its raw body", async () => {
    const client = clientWith(
      respondWith(
        JSON.stringify({
          error: {
            code: "TICKET_NOT_FOUND",
            message: "요청을 확인해 주세요.",
            requestId: "request-a",
          },
        }),
        404,
      ),
    );

    const failure = await client.getBuilding("missing").catch((error) => error);

    expect(failure).toBeInstanceOf(ApiClientError);
    expect({ ...failure, message: failure.message }).toEqual({
      name: "ApiClientError",
      code: "TICKET_NOT_FOUND",
      message: "요청을 확인해 주세요.",
      requestId: "request-a",
      status: 404,
    });
  });

  it("falls back to a generic HTTP error for a malformed error body", async () => {
    const client = clientWith(respondWith("<html>500</html>", 500));

    const failure = await client.getBuilding("missing").catch((error) => error);

    expect(failure.code).toBe("HTTP_ERROR");
    expect(failure.status).toBe(500);
    expect(JSON.stringify(failure)).not.toContain("html");
    expect(failure.message).not.toContain("html");
  });

  it("reports a fetch rejection without leaking the underlying error", async () => {
    const client = clientWith(
      rejectWith(new Error("getaddrinfo ENOTFOUND internal.corp.example")),
    );

    const failure = await client
      .listDemoBuildings()
      .catch((error) => error);

    expect(failure.code).toBe("NETWORK_ERROR");
    expect(failure.message).not.toContain("ENOTFOUND");
    expect(failure.message).not.toContain("internal.corp.example");
    expect("cause" in failure && failure.cause !== undefined).toBe(false);
  });

  it("keeps request payloads out of the error object", async () => {
    const client = clientWith(respondWith("<html>500</html>", 500));

    const failure = await client
      .submitAnswer("ticket-a", {
        questionId: "heating.errorCode",
        answer: "E1 텍스트",
      })
      .catch((error) => error);

    expect(JSON.stringify(failure)).not.toContain("E1");
    expect(failure.message).not.toContain("E1");
  });

  it("keeps schema-invalid response data out of the error object", async () => {
    // approvalYear must be four digits, so this body fails validation while
    // carrying a recognisable value the error must not echo back.
    const client = clientWith(
      respondWith(JSON.stringify({ ...passport, approvalYear: "LEAKED VALUE" })),
    );

    const failure = await client
      .getBuilding("demo-building-a")
      .catch((error) => error);

    expect(failure.code).toBe("INVALID_RESPONSE");
    expect(JSON.stringify(failure)).not.toContain("LEAKED VALUE");
    expect(failure.message).not.toContain("LEAKED VALUE");
  });
});

describe("client construction", () => {
  it("creates independent clients rather than a shared singleton", async () => {
    const first = respondWith(JSON.stringify([passport]));
    const second = respondWith(JSON.stringify([passport]));

    await clientWith(first, "https://one.test").listDemoBuildings();
    await clientWith(second, "https://two.test").listDemoBuildings();

    expect(first.calls[0]?.url).toBe("https://one.test/api/v1/demo/buildings");
    expect(second.calls[0]?.url).toBe("https://two.test/api/v1/demo/buildings");
  });
});
