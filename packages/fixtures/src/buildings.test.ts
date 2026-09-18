import { getBuildingContext, routingEligibleContextKeys } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import { demoBuildingA, demoBuildingB, demoBuildings } from "./buildings";

describe("public demo building fixtures", () => {
  it("publishes exactly the two approved P0 demo buildings", () => {
    expect(demoBuildings.map((entry) => entry.id)).toEqual([
      "demo-building-a",
      "demo-building-b",
    ]);
  });

  it("carries no real address or external registry identifier", () => {
    for (const entry of demoBuildings) {
      expect(entry.demo).toBe(true);
      expect(entry.displayName.startsWith("DEMO ")).toBe(true);
      expect(entry.normalizedAddress).toBeNull();
      expect(Object.values(entry.sourceNativeIds)).toEqual([null, null, null]);
    }
  });

  it("keeps official Building A facts verified but informational", () => {
    expect(getBuildingContext(demoBuildingA, "primaryUse")).toMatchObject({
      value: "다가구주택",
      sourceType: "FIXTURE_OFFICIAL",
      verified: true,
      routingEligible: false,
    });
    expect(getBuildingContext(demoBuildingA, "approvalYear")).toMatchObject({
      value: "2011",
      sourceType: "FIXTURE_OFFICIAL",
      verified: true,
      routingEligible: false,
    });
  });

  it("routes Building A on owner-verified individual heating context", () => {
    expect(routingEligibleContextKeys(demoBuildingA)).toEqual([
      "managementMode",
      "heatingType",
      "ownerSuppliedBoiler",
    ]);
    expect(getBuildingContext(demoBuildingA, "managementMode")?.value).toBe(
      "OWNER_DIRECT",
    );
    expect(getBuildingContext(demoBuildingA, "heatingType")?.value).toBe(
      "INDIVIDUAL",
    );
    expect(getBuildingContext(demoBuildingA, "ownerSuppliedBoiler")?.value).toBe(
      true,
    );
  });

  it("routes Building B on shared management context and knows of no owner boiler", () => {
    expect(routingEligibleContextKeys(demoBuildingB)).toEqual([
      "managementMode",
      "heatingType",
    ]);
    expect(getBuildingContext(demoBuildingB, "managementMode")?.value).toBe(
      "MANAGEMENT_OFFICE",
    );
    expect(getBuildingContext(demoBuildingB, "heatingType")?.value).toBe(
      "CENTRAL_SHARED",
    );
    expect(getBuildingContext(demoBuildingB, "ownerSuppliedBoiler")).toBeUndefined();
  });

  it("gives Building B its own official facts so the two buildings diverge", () => {
    expect(getBuildingContext(demoBuildingB, "primaryUse")?.value).toBe("공동주택");
    expect(getBuildingContext(demoBuildingB, "approvalYear")?.value).toBe("2018");
  });
});
