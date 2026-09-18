import type { RouteType } from "@build-manager/domain";

/**
 * The transport carries `routeCode` as an open string; the domain accepts only
 * its closed `RouteType` union. This is the one place the two meet.
 */
const ROUTE_TYPES = [
  "LANDLORD_REVIEW",
  "MANAGEMENT_OFFICE",
  "THIRD_PARTY_MANAGER",
  "MANUFACTURER_AS",
  "GENERAL_VENDOR",
] as const satisfies readonly RouteType[];

/**
 * Compile-time completeness. If a new RouteType is added to the domain without
 * being listed above, this assignment stops compiling instead of letting the
 * parser silently reject a legitimate route at runtime.
 */
type RouteTypesAreExhaustive =
  Exclude<RouteType, (typeof ROUTE_TYPES)[number]> extends never ? true : never;
const routeTypesAreExhaustive: RouteTypesAreExhaustive = true;
void routeTypesAreExhaustive;

/**
 * Narrows by lookup rather than by assertion: an unknown code returns null so
 * the caller answers 400, and no unchecked value can reach the domain.
 */
export function parseRouteCode(value: string): RouteType | null {
  return ROUTE_TYPES.find((route) => route === value) ?? null;
}
