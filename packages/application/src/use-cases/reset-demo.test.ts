import type { Building } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import type { DemoStateResetter } from "../ports";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { resetDemo } from "./reset-demo";

const AT = "2026-09-14T00:00:00.000Z";

function demoBuilding(id: string, displayName: string): Building {
  return {
    id,
    displayName,
    demo: true,
    normalizedAddress: null,
    sourceNativeIds: { jusoBdMgtSn: null, buildingHubId: null, kaptCode: null },
    context: [
      {
        key: "heatingType",
        value: "INDIVIDUAL",
        sourceType: "OWNER_VERIFIED",
        sourceRef: `owner:${id}`,
        verified: true,
        routingEligible: true,
        fetchedAt: null,
        updatedAt: AT,
      },
    ],
  };
}

const baseline = [
  demoBuilding("demo-building-a", "DEMO 해솔빌라"),
  demoBuilding("demo-building-b", "DEMO 라온하우징"),
];

function countingResetter(buildings: Building[]): DemoStateResetter & {
  calls: number;
} {
  return {
    calls: 0,
    async reset() {
      this.calls += 1;
      return buildings;
    },
  };
}

describe("resetDemo", () => {
  it("delegates to the resetter exactly once", async () => {
    const resetter = countingResetter(baseline);
    const deps = createInMemoryDependencies({ demoState: resetter });

    await resetDemo(deps);

    expect(resetter.calls).toBe(1);
  });

  it("returns the reseeded buildings the resetter yields, unchanged", async () => {
    const resetter = countingResetter(baseline);
    const deps = createInMemoryDependencies({ demoState: resetter });

    expect(await resetDemo(deps)).toEqual(baseline);
  });

  it("stays idempotent across repeated resets", async () => {
    const resetter = countingResetter(baseline);
    const deps = createInMemoryDependencies({ demoState: resetter });

    const first = await resetDemo(deps);
    const second = await resetDemo(deps);

    expect(second).toEqual(first);
    expect(resetter.calls).toBe(2);
  });

  it("propagates a resetter failure rather than reporting a successful reset", async () => {
    const deps = createInMemoryDependencies({
      demoState: {
        async reset(): Promise<Building[]> {
          throw new Error("demo store unavailable");
        },
      },
    });

    await expect(resetDemo(deps)).rejects.toThrowError(
      /demo store unavailable/i,
    );
  });

  it("performs no reset logic of its own", async () => {
    const resetter = countingResetter([]);
    const deps = createInMemoryDependencies({ demoState: resetter });

    expect(await resetDemo(deps)).toEqual([]);
  });
});
