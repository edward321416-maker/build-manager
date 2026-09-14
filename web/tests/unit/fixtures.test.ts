import { describe, expect, it } from "vitest";

import { getBuildingContext } from "@/domain/building/types";
import { demoBuildingA, demoBuildingB } from "@/fixtures/buildings";
import { demoUnitA, demoUnitB } from "@/fixtures/units";

describe("building fixtures", () => {
  it("marks both public fixtures as synthetic demo data without private addresses", () => {
    expect([demoBuildingA.demo, demoBuildingB.demo]).toEqual([true, true]);
    expect([demoBuildingA.normalizedAddress, demoBuildingB.normalizedAddress]).toEqual([
      null,
      null,
    ]);
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

  it("uses routing-eligible verified owner context only where intended for Building A", () => {
    expect(getBuildingContext(demoBuildingA, "managementMode")).toMatchObject({
      value: "OWNER_DIRECT",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
    });
    expect(getBuildingContext(demoBuildingA, "heatingType")).toMatchObject({
      value: "INDIVIDUAL",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
    });
    expect(getBuildingContext(demoBuildingA, "ownerSuppliedBoiler")).toMatchObject({
      value: true,
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
    });
  });

  it("uses the exact shared-management context for Building B", () => {
    expect(getBuildingContext(demoBuildingB, "primaryUse")?.value).toBe("공동주택");
    expect(getBuildingContext(demoBuildingB, "approvalYear")?.value).toBe("2018");
    expect(getBuildingContext(demoBuildingB, "managementMode")?.value).toBe(
      "MANAGEMENT_OFFICE",
    );
    expect(getBuildingContext(demoBuildingB, "heatingType")?.value).toBe(
      "CENTRAL_SHARED",
    );
  });
});

describe("unit fixtures", () => {
  it("uses synthetic units with opaque tenant tokens", () => {
    expect([demoUnitA.buildingId, demoUnitB.buildingId]).toEqual([
      "demo-building-a",
      "demo-building-b",
    ]);
    expect([demoUnitA.unitLabel, demoUnitB.unitLabel]).toEqual(["203호", "203호"]);

    for (const unit of [demoUnitA, demoUnitB]) {
      expect(unit.tenantToken).toMatch(/^dt_[A-Za-z0-9]{12}$/);
      expect(unit.tenantToken).not.toContain(unit.buildingId);
      expect(unit.tenantToken).not.toContain(unit.unitLabel);
    }
  });
});
