import type { Answer, AnswerValue, Building, Ticket } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import { representativeBuilding } from "../testing/aggregates";
import { presentLandlordTicket, presentTenantTicket } from "./presenters";

// P1b review: the screens must list exactly the evidence the photo evidence action accepts.
const AT = "2026-10-11T03:00:00.000Z";
const building: Building = {
  ...representativeBuilding,
  context: [
    ...representativeBuilding.context,
    { key: "primaryUse", value: "다세대주택", sourceType: "FIXTURE_OFFICIAL", sourceRef: "demo-fixture", verified: true, routingEligible: false, fetchedAt: null, updatedAt: AT },
    { key: "heatingType", value: "INDIVIDUAL", sourceType: "OWNER_VERIFIED", sourceRef: "owner:demo-building-a", verified: true, routingEligible: true, fetchedAt: null, updatedAt: AT },
  ],
};
const answer = (questionId: string, value: AnswerValue): Answer => ({ questionId, value, createdAt: AT, updatedAt: AT });
const leakTicket = (locations: AnswerValue[]): Ticket => ({
  id: "ticket-leak", buildingId: building.id, unitId: "demo-unit-a", issueType: "LEAK", rawUserText: "합성 천장 누수",
  status: "IN_PROGRESS", protocolId: "LEAK_V1",
  answers: [answer("safety.gasSmell", false), ...locations.map((value) => answer("leak.location", value))],
  evidence: [], safetyFlags: [], repairPacket: null, routeDecision: null, moreInfoRequest: null, createdAt: AT, updatedAt: AT,
});
const types = (requirements: { evidenceType: string }[]) => requirements.map((requirement) => requirement.evidenceType);

describe("evidence requirements in ticket views", () => {
  it.each([
    [["CEILING_WALL", "APPLIANCE"], ["LEAK_LOCATION"]],
    [["APPLIANCE", "CEILING_WALL"], ["LEAK_LOCATION", "FIXTURE_VIEW"]],
    [["  "], ["LEAK_LOCATION"]],
  ])("reads the first leak location answer %j, as the evidence gate does", (locations, expected) => {
    const ticket = leakTicket(locations);
    expect(types(presentTenantTicket(ticket, building).evidenceRequirements)).toEqual(expected);
    expect(types(presentLandlordTicket(ticket, building).followUpOptions.evidence)).toEqual(expected);
  });
});

describe("P1b evidence screens", () => {
  const photoId = "0b6f7d1e-2c3a-4d5e-8f90-1a2b3c4d5e6f";

  it("gives each requirement the protocol's photo instruction", () => {
    const requirements = presentTenantTicket(leakTicket(["APPLIANCE"]), building).evidenceRequirements;
    expect(requirements.map((item) => [item.evidenceType, item.instruction])).toEqual([
      ["LEAK_LOCATION", "안전한 거리에서 누수 부위와 주변 위치가 함께 보이도록 촬영해 주세요."],
      ["FIXTURE_VIEW", "안전한 거리에서 누수와 관련된 기기가 보이도록 촬영해 주세요."],
    ]);
    expect(presentLandlordTicket(leakTicket(["APPLIANCE"]), building).followUpOptions.evidence.map((item) => item.instruction)).toEqual(
      requirements.map((item) => item.instruction),
    );
  });

  it("shows the manager which photo the tenant named, as the tenant sees it", () => {
    const ticket: Ticket = {
      ...leakTicket(["CEILING_WALL"]),
      evidence: [{ id: "evidence-core", type: "LEAK_AREA_PHOTO", storageRef: `core-photo:${photoId}`, fixtureRef: null, source: "TENANT_UPLOAD", createdAt: AT }],
    };
    expect(presentLandlordTicket(ticket, building).submittedEvidence).toEqual(presentTenantTicket(ticket, building).submittedEvidence);
    expect(presentLandlordTicket(ticket, building).submittedEvidence).toEqual([
      { evidenceId: "evidence-core", evidenceType: "LEAK_LOCATION", label: "DEMO 누수 위치 이미지", photoId },
    ]);
  });
});

describe("submitted evidence in the tenant view", () => {
  it("names the chosen Core photo and nothing for other evidence", () => {
    const photoId = "0b6f7d1e-2c3a-4d5e-8f90-1a2b3c4d5e6f";
    const ticket: Ticket = {
      ...leakTicket(["CEILING_WALL"]),
      evidence: [
        { id: "evidence-core", type: "LEAK_AREA_PHOTO", storageRef: `core-photo:${photoId}`, fixtureRef: null, source: "TENANT_UPLOAD", createdAt: AT },
        { id: "evidence-other", type: "FIXTURE_PHOTO", storageRef: `upload:${photoId}`, fixtureRef: null, source: "TENANT_UPLOAD", createdAt: AT },
        { id: "evidence-demo", type: "GENERAL_PHOTO", storageRef: null, fixtureRef: "demo-general-view", source: "DEMO_FIXTURE", createdAt: AT },
        { id: "evidence-demo-ref", type: "GENERAL_PHOTO", storageRef: `core-photo:${photoId}`, fixtureRef: "demo-general-view", source: "DEMO_FIXTURE", createdAt: AT },
      ],
    };
    expect(presentTenantTicket(ticket, building).submittedEvidence).toEqual([
      { evidenceId: "evidence-core", evidenceType: "LEAK_LOCATION", label: "DEMO 누수 위치 이미지", photoId },
      { evidenceId: "evidence-other", evidenceType: "FIXTURE_VIEW", label: "DEMO 세대 설비 화면 이미지" },
      { evidenceId: "evidence-demo", evidenceType: "GENERAL_VIEW", label: "DEMO 일반 참고 이미지" },
      { evidenceId: "evidence-demo-ref", evidenceType: "GENERAL_VIEW", label: "DEMO 일반 참고 이미지" },
    ]);
  });
});
