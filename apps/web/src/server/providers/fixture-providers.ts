import type {
  AddressProvider,
  BuildingRegistryProvider,
  KaptProvider,
  ProviderContextRecord,
} from "@build-manager/application";
import type { ContextValue } from "@build-manager/domain";

/**
 * Offline P0 providers. No network, no API key, no real private address.
 *
 * Registry facts are recorded as informational, which is simply what they are:
 * only an explicit owner verification may make context routing eligible. This
 * is not a second copy of the application's demotion rule — the application
 * demotes provider context regardless of what a provider claims.
 */
const FIXTURE_UPDATED_AT = "2026-09-14T00:00:00.000Z";

function informational(
  sourceType: ContextValue<unknown>["sourceType"],
  sourceRef: string,
  key: string,
  value: unknown,
): ContextValue<unknown> {
  return {
    key,
    value,
    sourceType,
    sourceRef,
    verified: true,
    routingEligible: false,
    fetchedAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  };
}

/**
 * P0 demo buildings carry no address, so there is nothing to resolve. This
 * provider exists to satisfy the port and to keep the absence explicit rather
 * than leaving a hole a future caller might fill with a real lookup.
 */
export function createFixtureAddressProvider(): AddressProvider {
  return {
    async lookup() {
      return null;
    },
  };
}

export function createFixtureBuildingRegistryProvider(): BuildingRegistryProvider {
  return {
    async fetchContext(buildingId: string): Promise<ProviderContextRecord> {
      const sourceRef = `demo-hub:${buildingId}`;
      return {
        nativeId: sourceRef,
        context: [
          informational("BUILDING_HUB", sourceRef, "primaryUse", "다가구주택"),
          informational("BUILDING_HUB", sourceRef, "approvalYear", "2011"),
          informational("BUILDING_HUB", sourceRef, "groundFloors", 5),
        ],
      };
    },
  };
}

export function createFixtureKaptProvider(): KaptProvider {
  return {
    async fetchContext(buildingId: string): Promise<ProviderContextRecord> {
      const sourceRef = `demo-kapt:${buildingId}`;
      return {
        nativeId: sourceRef,
        context: [
          informational("KAPT", sourceRef, "householdCount", 14),
          informational("KAPT", sourceRef, "elevator", false),
        ],
      };
    },
  };
}
