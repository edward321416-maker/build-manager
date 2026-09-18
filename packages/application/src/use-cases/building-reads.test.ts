import type { Building } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { createDemoBuilding } from "./create-demo-building";
import { getBuilding } from "./get-building";
import { listBuildings } from "./list-buildings";
import { searchAddress } from "./search-address";

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

describe("listBuildings", () => {
  it("returns nothing for an empty store", async () => {
    const deps = createInMemoryDependencies();

    expect(await listBuildings(deps)).toEqual([]);
  });

  it("returns exactly what the repository holds", async () => {
    const deps = createInMemoryDependencies();
    const first = demoBuilding("demo-building-a", "DEMO 해솔빌라");
    const second = demoBuilding("demo-building-b", "DEMO 라온하우징");
    await deps.buildings.save(first);
    await deps.buildings.save(second);

    const listed = await listBuildings(deps);

    expect(
      [...listed].sort((left, right) => left.id.localeCompare(right.id)),
    ).toEqual([first, second]);
  });

  it("preserves verified routing-eligible context", async () => {
    const deps = createInMemoryDependencies();
    await deps.buildings.save(demoBuilding("demo-building-a", "DEMO 해솔빌라"));

    const [listed] = await listBuildings(deps);

    expect(listed?.context[0]).toMatchObject({
      key: "heatingType",
      verified: true,
      routingEligible: true,
    });
  });
});

describe("getBuilding", () => {
  it("returns the building stored under the exact id", async () => {
    const deps = createInMemoryDependencies();
    const building = demoBuilding("demo-building-a", "DEMO 해솔빌라");
    await deps.buildings.save(building);

    expect(await getBuilding(deps, { buildingId: "demo-building-a" })).toEqual(
      building,
    );
  });

  it("reports a missing building as null rather than throwing", async () => {
    const deps = createInMemoryDependencies();

    await expect(
      getBuilding(deps, { buildingId: "missing" }),
    ).resolves.toBeNull();
  });

  it("does not fall back to another building for a near-miss id", async () => {
    const deps = createInMemoryDependencies();
    await deps.buildings.save(demoBuilding("demo-building-a", "DEMO 해솔빌라"));

    expect(await getBuilding(deps, { buildingId: "demo-building-" })).toBeNull();
    expect(await getBuilding(deps, { buildingId: "DEMO-BUILDING-A" })).toBeNull();
  });

  it("reads through the repository the create path wrote to", async () => {
    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    expect(await getBuilding(deps, { buildingId: created.id })).toEqual(created);
  });
});

describe("searchAddress", () => {
  it("delegates the exact query to the address provider", async () => {
    const deps = createInMemoryDependencies();

    await searchAddress(deps, { query: "DEMO 해솔빌라" });

    expect(deps.addresses.lookups).toEqual(["DEMO 해솔빌라"]);
  });

  it("returns whatever the provider resolves, including nothing", async () => {
    const deps = createInMemoryDependencies();

    expect(await searchAddress(deps, { query: "DEMO 해솔빌라" })).toBeNull();
  });

  it("returns the provider result unchanged", async () => {
    const deps = createInMemoryDependencies();
    const resolved = {
      normalizedAddress: "DEMO 합성 주소",
      jusoBdMgtSn: "demo-juso-1",
    };

    const result = await searchAddress(
      {
        ...deps,
        addresses: {
          async lookup() {
            return resolved;
          },
        },
      },
      { query: "DEMO 해솔빌라" },
    );

    expect(result).toEqual(resolved);
  });

  it("never reaches a repository for an address lookup", async () => {
    const deps = createInMemoryDependencies();
    await deps.buildings.save(demoBuilding("demo-building-a", "DEMO 해솔빌라"));

    expect(await searchAddress(deps, { query: "demo-building-a" })).toBeNull();
  });
});
