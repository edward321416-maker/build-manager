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
      demoFixtureId: "demo-boiler-display",
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
          routeCode: "MANUFACTURER_AS",
          label: "제조사 A/S",
          reasons: ["임대인 공급 개별 보일러"],
        },
        routeAlternatives: [
          { routeCode: "GENERAL_VENDOR", label: "일반 수리업체" },
        ],
        provenance: ["managementMode", "heatingType", "ownerSuppliedBoiler"],
        internalNotes: ["DEMO landlord note"],
        estimatedCost: { currency: "KRW", minimum: 100000, maximum: 200000 },
        affectedUnits: ["DEMO unit-a"],
        hiddenContacts: ["DEMO vendor desk"],
      },
      decision: null,
      followUpOptions: { questions: [], evidence: [] },
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
      moreInfoRequest: null,
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
        routeCode: "GENERAL_VENDOR",
        reason: "현장 확인 결과 일반 수리가 적합함",
      }).success,
    ).toBe(true);
    expect(
      decisionSchema.safeParse({
        type: "REQUEST_MORE_INFO",
        reason: "누수 위치 확인 필요",
        requestedQuestionIds: ["leak.location"],
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
        requestedQuestionIds: ["leak.location"],
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
    followUpOptions: { questions: [], evidence: [] },
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
    moreInfoRequest: null,
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
        demoFixtureId: "demo-fixture-view",
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

describe("route code is a closed public vocabulary", () => {
  const ROUTE_CODES = [
    "LANDLORD_REVIEW",
    "MANAGEMENT_OFFICE",
    "THIRD_PARTY_MANAGER",
    "MANUFACTURER_AS",
    "GENERAL_VENDOR",
  ];

  it("accepts every approved route code", () => {
    const routeSchema = schema("RouteCodeSchema");

    for (const routeCode of ROUTE_CODES) {
      expect(routeSchema.safeParse(routeCode).success).toBe(true);
    }
  });

  it("rejects an arbitrary route string", () => {
    const routeSchema = schema("RouteCodeSchema");

    for (const routeCode of ["", "GENERAL_REPAIR", "SEND_TO_MARS", "landlord_review"]) {
      expect(routeSchema.safeParse(routeCode).success).toBe(false);
    }
  });

  it("refuses an override request carrying an unknown route code", () => {
    const decisionSchema = schema("DecisionRequestSchema");

    expect(
      decisionSchema.safeParse({
        type: "OVERRIDE",
        routeCode: "GENERAL_VENDOR",
        reason: "현장 확인 결과",
      }).success,
    ).toBe(true);
    expect(
      decisionSchema.safeParse({
        type: "OVERRIDE",
        routeCode: "SEND_TO_MARS",
        reason: "현장 확인 결과",
      }).success,
    ).toBe(false);
  });

  it("refuses a route option carrying an unknown route code", () => {
    const optionSchema = schema("RouteOptionDtoSchema");

    expect(
      optionSchema.safeParse({
        routeCode: "MANAGEMENT_OFFICE",
        label: "관리사무소",
      }).success,
    ).toBe(true);
    expect(
      optionSchema.safeParse({ routeCode: "GENERAL_REPAIR", label: "일반 수리" })
        .success,
    ).toBe(false);
  });

  it("refuses an unknown route code inside a landlord packet", () => {
    const landlordSchema = schema("LandlordTicketDetailDtoSchema");
    const base = {
      ticketId: "ticket-a",
      building: passport,
      issueType: "HEATING",
      protocol: "HEATING_V1",
      status: "READY_FOR_REVIEW",
      evidenceStatus: "COMPLETE",
      activeQuestion: null,
      decision: null,
      followUpOptions: { questions: [], evidence: [] },
    };
    const packet = {
      revision: 1,
      summary: "요약",
      safetyEscalated: false,
      recommendation: null,
      routeAlternatives: [{ routeCode: "GENERAL_REPAIR", label: "일반 수리" }],
      provenance: [],
      internalNotes: [],
      estimatedCost: null,
      affectedUnits: [],
      hiddenContacts: [],
    };

    expect(
      landlordSchema.safeParse({ ...base, repairPacket: packet }).success,
    ).toBe(false);
    expect(
      landlordSchema.safeParse({
        ...base,
        repairPacket: {
          ...packet,
          routeAlternatives: [
            { routeCode: "GENERAL_VENDOR", label: "일반 수리업체" },
          ],
        },
      }).success,
    ).toBe(true);
  });
});

describe("structured more-info request", () => {
  const base = { type: "REQUEST_MORE_INFO", reason: "누수 위치를 다시 확인해 주세요" };

  it("accepts requested question ids alone", () => {
    expect(
      schema("DecisionRequestSchema").safeParse({
        ...base,
        requestedQuestionIds: ["leak.location"],
      }).success,
    ).toBe(true);
  });

  it("accepts requested evidence types alone", () => {
    expect(
      schema("DecisionRequestSchema").safeParse({
        ...base,
        requestedEvidenceTypes: ["LEAK_LOCATION"],
      }).success,
    ).toBe(true);
  });

  it("accepts both together", () => {
    expect(
      schema("DecisionRequestSchema").safeParse({
        ...base,
        requestedQuestionIds: ["leak.location"],
        requestedEvidenceTypes: ["LEAK_LOCATION"],
      }).success,
    ).toBe(true);
  });

  it("rejects a request that asks for nothing at all", () => {
    const decisionSchema = schema("DecisionRequestSchema");

    expect(decisionSchema.safeParse(base).success).toBe(false);
    expect(
      decisionSchema.safeParse({
        ...base,
        requestedQuestionIds: [],
        requestedEvidenceTypes: [],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown evidence type", () => {
    expect(
      schema("DecisionRequestSchema").safeParse({
        ...base,
        requestedEvidenceTypes: ["RAW_UPLOAD"],
      }).success,
    ).toBe(false);
  });

  it("no longer accepts the generic requested items field", () => {
    expect(
      schema("DecisionRequestSchema").safeParse({
        ...base,
        requestedItems: ["leak.location"],
      }).success,
    ).toBe(false);
  });
});

describe("synthetic evidence carries a server-provided demo fixture", () => {
  it("requires a demo fixture id on an evidence requirement", () => {
    const requirementSchema = schema("SyntheticEvidenceRequirementDtoSchema");

    expect(
      requirementSchema.safeParse({
        evidenceType: "LEAK_LOCATION",
        label: "DEMO 누수 위치 이미지",
        required: true,
        demoFixtureId: "demo-leak-location",
      }).success,
    ).toBe(true);
    expect(
      requirementSchema.safeParse({
        evidenceType: "LEAK_LOCATION",
        label: "DEMO 누수 위치 이미지",
        required: true,
      }).success,
    ).toBe(false);
  });

  it("rejects anything that looks like a file path", () => {
    const requirementSchema = schema("SyntheticEvidenceRequirementDtoSchema");

    for (const demoFixtureId of ["", "   "]) {
      expect(
        requirementSchema.safeParse({
          evidenceType: "LEAK_LOCATION",
          label: "DEMO 누수 위치 이미지",
          required: true,
          demoFixtureId,
        }).success,
      ).toBe(false);
    }
  });
});

describe("tenant sees its own actionable more-info request", () => {
  const requirement = {
    evidenceType: "LEAK_LOCATION",
    label: "DEMO 누수 위치 이미지",
    required: true,
    demoFixtureId: "demo-leak-location",
  };
  const question = {
    questionId: "leak.location",
    protocol: "LEAK_V1",
    prompt: "물이 어디에서 보이나요?",
    responseType: "SINGLE_SELECT",
    required: true,
    evidenceRequirements: [requirement],
    options: [
      { value: "CEILING_WALL", label: "천장 또는 벽" },
      { value: "APPLIANCE", label: "특정 기기" },
    ],
  };
  const tenantStatus = {
    ticketId: "ticket-a",
    buildingId: "demo-building-a",
    issueType: "LEAK",
    protocol: "LEAK_V1",
    status: "NEEDS_MORE_INFO",
    evidenceStatus: "COMPLETE",
    activeQuestion: null,
    evidenceRequirements: [requirement],
    submittedEvidence: [],
    packet: null,
  };

  it("accepts a tenant status carrying a current more-info request", () => {
    expect(
      schema("TenantTicketStatusDtoSchema").safeParse({
        ...tenantStatus,
        moreInfoRequest: {
          reason: "누수 위치를 다시 확인해 주세요",
          requestedQuestions: [question],
          requestedEvidence: [requirement],
        },
      }).success,
    ).toBe(true);
  });

  it("accepts a tenant status with no outstanding request", () => {
    expect(
      schema("TenantTicketStatusDtoSchema").safeParse({
        ...tenantStatus,
        moreInfoRequest: null,
      }).success,
    ).toBe(true);
  });

  it("accepts a fulfilled request that still shows its reason", () => {
    expect(
      schema("TenantTicketStatusDtoSchema").safeParse({
        ...tenantStatus,
        moreInfoRequest: {
          reason: "누수 위치를 다시 확인해 주세요",
          requestedQuestions: [],
          requestedEvidence: [],
        },
      }).success,
    ).toBe(true);
  });

  it("keeps landlord-only fields out of the tenant more-info request", () => {
    expect(
      schema("TenantTicketStatusDtoSchema").safeParse({
        ...tenantStatus,
        moreInfoRequest: {
          reason: "누수 위치를 다시 확인해 주세요",
          requestedQuestions: [],
          requestedEvidence: [],
          actor: "LANDLORD",
          requestedAt: "2026-09-15T00:00:00.000Z",
        },
      }).success,
    ).toBe(false);
  });
});

describe("landlord follow-up options", () => {
  it("exposes the protocol's questions and evidence to the landlord form", () => {
    const optionsSchema = schema("FollowUpOptionsDtoSchema");

    expect(
      optionsSchema.safeParse({
        questions: [],
        evidence: [],
      }).success,
    ).toBe(true);
    expect(
      optionsSchema.safeParse({
        questions: [
          {
            questionId: "leak.active",
            protocol: "LEAK_V1",
            prompt: "현재도 계속 새고 있나요?",
            responseType: "YES_NO",
            required: true,
            evidenceRequirements: [],
          },
        ],
        evidence: [
          {
            evidenceType: "LEAK_LOCATION",
            label: "DEMO 누수 위치 이미지",
            required: true,
            demoFixtureId: "demo-leak-location",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects follow-up options that omit either list", () => {
    expect(schema("FollowUpOptionsDtoSchema").safeParse({ questions: [] }).success).toBe(
      false,
    );
  });
});
