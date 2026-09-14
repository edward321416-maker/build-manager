import { describe, expect, it } from "vitest";
import type { Building, ContextValue } from "../building/types";
import { selectProtocol } from "../protocol/select-protocol";
import type { Answer, EvidenceState } from "../ticket/types";
import { recommendRoute } from "./recommend-route";

const AT = "2026-09-14T00:00:00.000Z";

function owner(key: string, value: unknown): ContextValue<unknown> {
  return {
    key,
    value,
    sourceType: "OWNER_VERIFIED",
    sourceRef: "demo-fixture:owner",
    verified: true,
    routingEligible: true,
    fetchedAt: null,
    updatedAt: AT,
  };
}

function official(key: string, value: unknown): ContextValue<unknown> {
  return {
    key,
    value,
    sourceType: "FIXTURE_OFFICIAL",
    sourceRef: "demo-fixture",
    verified: true,
    routingEligible: false,
    fetchedAt: null,
    updatedAt: AT,
  };
}

function building(id: string, context: ContextValue<unknown>[]): Building {
  return {
    id,
    displayName: `DEMO ${id}`,
    demo: true,
    normalizedAddress: null,
    sourceNativeIds: { jusoBdMgtSn: null, buildingHubId: null, kaptCode: null },
    context,
  };
}

const buildingA = building("demo-building-a", [
  official("approvalYear", "2011"),
  owner("managementMode", "OWNER_DIRECT"),
  owner("heatingType", "INDIVIDUAL"),
  owner("ownerSuppliedBoiler", true),
]);

const buildingB = building("demo-building-b", [
  official("approvalYear", "2018"),
  owner("managementMode", "MANAGEMENT_OFFICE"),
  owner("heatingType", "CENTRAL_SHARED"),
]);

function answer(questionId: string, value: Answer["value"]): Answer {
  return { questionId, value, createdAt: AT, updatedAt: AT };
}

function heatingRoute(
  subject: Building,
  evidenceState: EvidenceState = "COMPLETE",
) {
  return recommendRoute({
    protocol: selectProtocol(subject, "HEATING"),
    building: subject,
    issueType: "HEATING",
    answers: [],
    evidenceState,
  });
}

describe("building-aware routing", () => {
  it("recommends landlord review for owner-managed individual heating", () => {
    expect(heatingRoute(buildingA)).toEqual({
      primary: "LANDLORD_REVIEW",
      alternatives: ["MANUFACTURER_AS"],
      rationale: [
        expect.objectContaining({
          contextKey: "heatingType",
          protocolRuleId: "heating.individual.ownerDirect",
          sourceType: "OWNER_VERIFIED",
        }),
        expect.objectContaining({
          contextKey: "managementMode",
          protocolRuleId: "heating.individual.ownerDirect",
          sourceType: "OWNER_VERIFIED",
        }),
      ],
      humanReviewRequired: true,
    });
  });

  it("recommends the management office for shared heating in an office-managed building", () => {
    expect(heatingRoute(buildingB)).toEqual(
      expect.objectContaining({
        primary: "MANAGEMENT_OFFICE",
        alternatives: ["LANDLORD_REVIEW"],
        humanReviewRequired: true,
      }),
    );
  });

  it("gives the two demo buildings different routes for the same heating report", () => {
    expect(heatingRoute(buildingA)?.primary).not.toBe(
      heatingRoute(buildingB)?.primary,
    );
  });

  it("cites only routing-eligible context in the rationale", () => {
    const rationale = heatingRoute(buildingA)?.rationale ?? [];
    const citedKeys = rationale
      .map((item) => item.contextKey)
      .filter((key): key is string => key !== undefined);

    expect(citedKeys).toContain("heatingType");
    expect(citedKeys).toContain("managementMode");
    expect(citedKeys).not.toContain("approvalYear");
  });
});

describe("informational context never moves a route", () => {
  it("keeps the same route when the approval year changes", () => {
    const relisted = building("demo-building-a", [
      official("approvalYear", "1998"),
      owner("managementMode", "OWNER_DIRECT"),
      owner("heatingType", "INDIVIDUAL"),
      owner("ownerSuppliedBoiler", true),
    ]);

    expect(heatingRoute(relisted)).toEqual(heatingRoute(buildingA));
  });

  it("changes the route when the routing-eligible heating type changes", () => {
    const shared = building("demo-building-a", [
      official("approvalYear", "2011"),
      owner("managementMode", "OWNER_DIRECT"),
      owner("heatingType", "CENTRAL_SHARED"),
    ]);

    expect(heatingRoute(shared)).not.toEqual(heatingRoute(buildingA));
  });

  it("recommends nothing rather than inventing a route when no rule matches", () => {
    const incoherent = building("demo-building-a", [
      owner("managementMode", "OWNER_DIRECT"),
      owner("heatingType", "CENTRAL_SHARED"),
    ]);

    expect(heatingRoute(incoherent)).toBeNull();
  });
});

describe("the evidence gate governs automatic recommendation", () => {
  it.each(["MISSING_REQUIRED", "CONFLICTING", "SAFETY_ESCALATED"] as const)(
    "recommends nothing while evidence is %s",
    (evidenceState) => {
      expect(heatingRoute(buildingA, evidenceState)).toBeNull();
    },
  );

  it("recommends only once evidence is COMPLETE", () => {
    expect(heatingRoute(buildingA, "COMPLETE")).not.toBeNull();
  });
});

describe("answers may narrow a leak route without overriding context", () => {
  it("routes a ceiling leak in an office-managed building to the management office", () => {
    expect(
      recommendRoute({
        protocol: selectProtocol(buildingB, "LEAK"),
        building: buildingB,
        issueType: "LEAK",
        answers: [answer("leak.location", "CEILING_WALL")],
        evidenceState: "COMPLETE",
      })?.primary,
    ).toBe("MANAGEMENT_OFFICE");
  });

  it("falls back to landlord review for a leak the first rule does not cover", () => {
    expect(
      recommendRoute({
        protocol: selectProtocol(buildingB, "LEAK"),
        building: buildingB,
        issueType: "LEAK",
        answers: [answer("leak.location", "APPLIANCE")],
        evidenceState: "COMPLETE",
      })?.primary,
    ).toBe("LANDLORD_REVIEW");
  });

  it("ignores an answer that names a building context key", () => {
    const withHostileAnswer = recommendRoute({
      protocol: selectProtocol(buildingA, "HEATING"),
      building: buildingA,
      issueType: "HEATING",
      answers: [answer("context.managementMode", "MANAGEMENT_OFFICE")],
      evidenceState: "COMPLETE",
    });

    expect(withHostileAnswer?.primary).toBe("LANDLORD_REVIEW");
  });
});
