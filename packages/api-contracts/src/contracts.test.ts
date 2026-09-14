import { describe, expect, it } from "vitest";
import * as contracts from "./index";

type RuntimeSchema = {
  safeParse(value: unknown): { success: boolean };
};

function schema(name: string): RuntimeSchema {
  const candidate = (contracts as Record<string, unknown>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as RuntimeSchema;
}

const passport = {
  buildingId: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  primaryUse: "MULTI_FAMILY_HOUSE",
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

const activeQuestion = {
  questionId: "heating-power",
  protocol: "HEATING_V1",
  prompt: "보일러 전원이 켜져 있나요?",
  responseType: "YES_NO",
  required: true,
  evidenceRequirements: [
    {
      evidenceType: "BOILER_DISPLAY",
      label: "DEMO 보일러 표시창 이미지",
      required: true,
    },
  ],
};

describe("public API contracts", () => {
  it("accepts a server-produced building passport", () => {
    expect(schema("BuildingPassportDtoSchema").safeParse(passport).success).toBe(
      true,
    );
  });

  it("rejects client-controlled routing eligibility during owner verification", () => {
    const request = {
      managementMode: "OWNER_DIRECT",
      heatingType: "INDIVIDUAL",
      ownerSuppliedBoiler: true,
      routingEligibleFields: ["approvalYear"],
    };

    expect(schema("OwnerVerificationRequestSchema").safeParse(request).success).toBe(
      false,
    );
  });

  it("validates an active tenant question and its synthetic evidence requirement", () => {
    expect(schema("TenantQuestionDtoSchema").safeParse(activeQuestion).success).toBe(
      true,
    );
  });

  it("requires selectable questions to provide choices", () => {
    const malformedQuestion = {
      ...activeQuestion,
      responseType: "SINGLE_SELECT",
    };

    expect(
      schema("TenantQuestionDtoSchema").safeParse(malformedQuestion).success,
    ).toBe(false);
  });

  it("accepts synthetic evidence references without upload or storage controls", () => {
    const evidence = {
      evidenceType: "BOILER_DISPLAY",
      fixtureId: "demo-boiler-display-on",
    };

    expect(
      schema("SubmitSyntheticEvidenceRequestSchema").safeParse(evidence).success,
    ).toBe(true);
    expect(
      schema("SubmitSyntheticEvidenceRequestSchema").safeParse({
        ...evidence,
        storageKey: "tenant/private/image.jpg",
        base64: "binary-data",
      }).success,
    ).toBe(false);
  });

  it("validates tenant workflow commands without accepting server decisions", () => {
    expect(
      schema("CreateTicketRequestSchema").safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방이 안 돼요",
      }).success,
    ).toBe(true);
    expect(
      schema("SubmitTenantAnswerRequestSchema").safeParse({
        questionId: "heating-power",
        answer: true,
      }).success,
    ).toBe(true);
    expect(schema("FinalizeTicketRequestSchema").safeParse({}).success).toBe(true);
    expect(
      schema("FinalizeTicketRequestSchema").safeParse({
        recommendation: { routeCode: "CLIENT_SELECTED" },
      }).success,
    ).toBe(false);
  });

  it("keeps landlord-only review data out of the tenant status payload", () => {
    const landlordDetail = {
      ticketId: "ticket-a",
      building: passport,
      issueType: "HEATING",
      protocol: "HEATING_V1",
      status: "READY_FOR_REVIEW",
      evidenceStatus: "COMPLETE",
      activeQuestion: null,
      repairPacket: {
        revision: 1,
        summary: "보일러는 작동하지만 세대 난방이 되지 않습니다.",
        safetyEscalated: false,
        recommendation: {
          routeCode: "OWNER_BOILER_TECHNICIAN",
          label: "임대인 지정 보일러 기사",
          reasons: ["임대인 공급 개별 보일러"],
        },
        routeAlternatives: [
          { routeCode: "GENERAL_REPAIR", label: "일반 수리" },
        ],
        provenance: ["managementMode", "heatingType", "ownerSuppliedBoiler"],
        internalNotes: ["DEMO landlord note"],
        estimatedCost: { currency: "KRW", minimum: 100000, maximum: 200000 },
        affectedUnits: ["DEMO unit-a"],
        hiddenContacts: ["DEMO vendor desk"],
      },
      decision: null,
    };

    expect(
      schema("LandlordTicketDetailDtoSchema").safeParse(landlordDetail).success,
    ).toBe(true);

    const tenantStatus = {
      ticketId: landlordDetail.ticketId,
      buildingId: passport.buildingId,
      issueType: landlordDetail.issueType,
      protocol: landlordDetail.protocol,
      status: landlordDetail.status,
      evidenceStatus: landlordDetail.evidenceStatus,
      activeQuestion: landlordDetail.activeQuestion,
      evidenceRequirements: [],
      submittedEvidence: [],
      packet: {
        revision: 1,
        summary: landlordDetail.repairPacket.summary,
        safetyEscalated: false,
      },
    };

    expect(schema("TenantTicketStatusDtoSchema").safeParse(tenantStatus).success).toBe(
      true,
    );
    expect(
      schema("TenantTicketStatusDtoSchema").safeParse({
        ...tenantStatus,
        internalNotes: landlordDetail.repairPacket.internalNotes,
        routeAlternatives: landlordDetail.repairPacket.routeAlternatives,
        estimatedCost: landlordDetail.repairPacket.estimatedCost,
        affectedUnits: landlordDetail.repairPacket.affectedUnits,
        hiddenContacts: landlordDetail.repairPacket.hiddenContacts,
      }).success,
    ).toBe(false);
  });

  it("discriminates approve, override, and more-info decisions", () => {
    const decisionSchema = schema("DecisionRequestSchema");

    expect(decisionSchema.safeParse({ type: "APPROVE" }).success).toBe(true);
    expect(
      decisionSchema.safeParse({
        type: "OVERRIDE",
        routeCode: "GENERAL_REPAIR",
        reason: "현장 확인 결과 일반 수리가 적합함",
      }).success,
    ).toBe(true);
    expect(
      decisionSchema.safeParse({
        type: "REQUEST_MORE_INFO",
        reason: "누수 위치 확인 필요",
        requestedItems: ["누수 위치를 다시 확인해 주세요"],
      }).success,
    ).toBe(true);
  });

  it("rejects incomplete or client-state-bearing decisions", () => {
    const decisionSchema = schema("DecisionRequestSchema");

    expect(
      decisionSchema.safeParse({ type: "OVERRIDE", reason: "route missing" }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        type: "REQUEST_MORE_INFO",
        requestedItems: ["reason missing"],
      }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        type: "APPROVE",
        status: "APPROVED",
        recommendation: { routeCode: "CLIENT_SELECTED" },
      }).success,
    ).toBe(false);
  });

  it("accepts the API error envelope and rejects raw exception details", () => {
    const errorSchema = schema("ApiErrorSchema");

    expect(
      errorSchema.safeParse({
        error: {
          code: "INVALID_REQUEST",
          message: "요청을 확인해 주세요.",
          requestId: "request-a",
        },
      }).success,
    ).toBe(true);
    expect(
      errorSchema.safeParse({
        error: {
          code: "INTERNAL_ERROR",
          message: "오류가 발생했습니다.",
          stack: "Error: private server path",
        },
      }).success,
    ).toBe(false);
  });
});

describe("role-safe list responses", () => {
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
  };

  const tenantStatus = {
    ticketId: "ticket-a",
    buildingId: passport.buildingId,
    issueType: "HEATING",
    protocol: "HEATING_V1",
    status: "READY_FOR_REVIEW",
    evidenceStatus: "COMPLETE",
    activeQuestion: null,
    evidenceRequirements: [],
    submittedEvidence: [],
    packet: null,
  };

  it("accepts a list of building passports and rejects a bare object", () => {
    const listSchema = schema("BuildingPassportListSchema");

    expect(listSchema.safeParse([passport]).success).toBe(true);
    expect(listSchema.safeParse([]).success).toBe(true);
    expect(listSchema.safeParse(passport).success).toBe(false);
  });

  it("accepts a landlord ticket list", () => {
    const listSchema = schema("LandlordTicketListSchema");

    expect(listSchema.safeParse([landlordDetail]).success).toBe(true);
    expect(listSchema.safeParse([{ ...landlordDetail, ticketId: "" }]).success).toBe(
      false,
    );
  });

  it("accepts a tenant ticket list", () => {
    const listSchema = schema("TenantTicketListSchema");

    expect(listSchema.safeParse([tenantStatus]).success).toBe(true);
    expect(listSchema.safeParse([]).success).toBe(true);
  });

  it("keeps landlord-only entries out of a tenant ticket list", () => {
    expect(
      schema("TenantTicketListSchema").safeParse([landlordDetail]).success,
    ).toBe(false);
    expect(
      schema("TenantTicketListSchema").safeParse([
        { ...tenantStatus, internalNotes: ["DEMO landlord note"] },
      ]).success,
    ).toBe(false);
  });
});

describe("address search contract", () => {
  it("requires a single non-empty query", () => {
    const querySchema = schema("AddressSearchQuerySchema");

    expect(querySchema.safeParse({ query: "DEMO 해솔빌라" }).success).toBe(true);
    expect(querySchema.safeParse({ query: "" }).success).toBe(false);
    expect(querySchema.safeParse({ query: "   " }).success).toBe(false);
    expect(querySchema.safeParse({}).success).toBe(false);
    expect(
      querySchema.safeParse({ query: ["one", "two"] }).success,
    ).toBe(false);
  });

  it("rejects extra query parameters instead of ignoring them", () => {
    expect(
      schema("AddressSearchQuerySchema").safeParse({
        query: "DEMO 해솔빌라",
        view: "landlord",
      }).success,
    ).toBe(false);
  });

  it("accepts a resolved synthetic address and an unresolved search", () => {
    const responseSchema = schema("AddressSearchResponseSchema");

    expect(
      responseSchema.safeParse({
        result: { normalizedAddress: "DEMO 합성 주소", jusoBdMgtSn: "demo-juso-1" },
      }).success,
    ).toBe(true);
    expect(
      responseSchema.safeParse({
        result: { normalizedAddress: null, jusoBdMgtSn: null },
      }).success,
    ).toBe(true);
    expect(responseSchema.safeParse({ result: null }).success).toBe(true);
  });

  it("rejects an address result carrying fields the provider never returns", () => {
    expect(
      schema("AddressSearchResponseSchema").safeParse({
        result: {
          normalizedAddress: "DEMO 합성 주소",
          jusoBdMgtSn: "demo-juso-1",
          residentName: "홍길동",
        },
      }).success,
    ).toBe(false);
  });
});

describe("synthetic evidence types cover every P0 protocol requirement", () => {
  it("accepts each public synthetic evidence type", () => {
    const typeSchema = schema("SyntheticEvidenceTypeSchema");

    for (const value of [
      "BOILER_DISPLAY",
      "LEAK_LOCATION",
      "FIXTURE_VIEW",
      "GENERAL_VIEW",
    ]) {
      expect(typeSchema.safeParse(value).success).toBe(true);
    }
  });

  it("still rejects an unknown evidence type", () => {
    expect(schema("SyntheticEvidenceTypeSchema").safeParse("RAW_UPLOAD").success).toBe(
      false,
    );
  });

  it("describes a shared-heating controller requirement", () => {
    expect(
      schema("SyntheticEvidenceRequirementDtoSchema").safeParse({
        evidenceType: "FIXTURE_VIEW",
        label: "DEMO 세대 조절기 화면",
        required: true,
      }).success,
    ).toBe(true);
  });

  it("accepts submitting the newly expressible evidence types", () => {
    for (const evidenceType of ["FIXTURE_VIEW", "GENERAL_VIEW"]) {
      expect(
        schema("SubmitSyntheticEvidenceRequestSchema").safeParse({
          evidenceType,
          fixtureId: "demo-fixture-view",
        }).success,
      ).toBe(true);
    }
  });
});

describe("tenant report text is part of the create contract", () => {
  it("requires the tenant's own report text", () => {
    const createSchema = schema("CreateTicketRequestSchema");

    expect(
      createSchema.safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방이 안 돼요",
      }).success,
    ).toBe(true);
    expect(
      createSchema.safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
      }).success,
    ).toBe(false);
  });

  it("rejects a blank report rather than accepting an empty one", () => {
    const createSchema = schema("CreateTicketRequestSchema");

    for (const rawUserText of ["", "   ", "　 "]) {
      expect(
        createSchema.safeParse({
          buildingId: "demo-building-a",
          issueType: "HEATING",
          rawUserText,
        }).success,
      ).toBe(false);
    }
  });

  it("accepts an untrusted report without imposing a length ceiling of its own", () => {
    const createSchema = schema("CreateTicketRequestSchema");

    expect(
      createSchema.safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "가스 냄새가 나요",
      }).success,
    ).toBe(true);
    expect(
      createSchema.safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방".repeat(500),
      }).success,
    ).toBe(true);
  });

  it("still refuses a client-supplied unit or decision", () => {
    const createSchema = schema("CreateTicketRequestSchema");

    expect(
      createSchema.safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방이 안 돼요",
        unitId: "203호",
      }).success,
    ).toBe(false);
    expect(
      createSchema.safeParse({
        buildingId: "demo-building-a",
        issueType: "HEATING",
        rawUserText: "난방이 안 돼요",
        status: "SAFETY_ESCALATED",
      }).success,
    ).toBe(false);
  });
});
