import type { Building, Ticket } from "@build-manager/domain";

/**
 * Representative synthetic aggregates used across the persistence tests.
 *
 * They deliberately exercise the parts most likely to be lost in a round trip:
 * verified routing-eligible context alongside informational context, submitted
 * evidence, a repair packet with a non-first revision and a recommendation,
 * and a recorded human route decision.
 */
const AT = "2026-09-14T03:00:00.000Z";

export const representativeBuilding: Building = {
  id: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  normalizedAddress: null,
  sourceNativeIds: { jusoBdMgtSn: null, buildingHubId: null, kaptCode: null },
  context: [
    {
      key: "approvalYear",
      value: "2011",
      sourceType: "FIXTURE_OFFICIAL",
      sourceRef: "demo-fixture",
      verified: true,
      routingEligible: false,
      fetchedAt: null,
      updatedAt: AT,
    },
    {
      key: "managementMode",
      value: "OWNER_DIRECT",
      sourceType: "OWNER_VERIFIED",
      sourceRef: "owner:demo-building-a",
      verified: true,
      routingEligible: true,
      fetchedAt: null,
      updatedAt: AT,
    },
    {
      key: "ownerSuppliedBoiler",
      value: true,
      sourceType: "OWNER_VERIFIED",
      sourceRef: "owner:demo-building-a",
      verified: true,
      routingEligible: true,
      fetchedAt: null,
      updatedAt: AT,
    },
  ],
};

export const representativeTicket: Ticket = {
  id: "ticket-a",
  buildingId: "demo-building-a",
  unitId: "demo-unit-a",
  issueType: "HEATING",
  rawUserText: "난방이 되지 않습니다.",
  status: "APPROVED",
  protocolId: "HEATING_INDIVIDUAL_V1",
  answers: [
    { questionId: "safety.gasSmell", value: false, createdAt: AT, updatedAt: AT },
    { questionId: "heating.errorCode", value: "E1", createdAt: AT, updatedAt: AT },
  ],
  evidence: [
    {
      id: "evidence-1",
      type: "CONTROL_PANEL_PHOTO",
      fixtureRef: "synthetic:control-panel",
      storageRef: null,
      source: "DEMO_FIXTURE",
      createdAt: AT,
    },
  ],
  safetyFlags: [],
  repairPacket: {
    ticketId: "ticket-a",
    revision: 3,
    issueType: "HEATING",
    userReport: { rawText: "난방이 되지 않습니다." },
    structuredSymptoms: { "heating.errorCode": "E1" },
    contextSnapshot: {
      routingBasis: [representativeBuilding.context[1]!],
      informational: [representativeBuilding.context[0]!],
    },
    evidenceState: "COMPLETE",
    evidence: [],
    safety: { flags: [], escalated: false },
    recommendation: {
      primary: "LANDLORD_REVIEW",
      alternatives: ["MANUFACTURER_AS"],
      rationale: [
        {
          contextKey: "heatingType",
          protocolRuleId: "heating.individual.ownerDirect",
          explanation: "개별난방 및 임대인 직접 관리",
          sourceType: "OWNER_VERIFIED",
        },
      ],
      humanReviewRequired: true,
    },
    generatedSummary: { text: "난방 접수 건입니다.", source: "TEMPLATE" },
    createdAt: AT,
  },
  routeDecision: {
    action: "APPROVE_RECOMMENDATION",
    recommendedRoute: "LANDLORD_REVIEW",
    selectedRoute: "LANDLORD_REVIEW",
    actor: "LANDLORD",
    decidedAt: AT,
  },
  moreInfoRequest: null,
  createdAt: AT,
  updatedAt: AT,
};
