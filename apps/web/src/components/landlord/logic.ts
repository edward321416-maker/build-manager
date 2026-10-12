import {
  RouteCodeSchema,
  type BuildingPassportDto,
  type LandlordTicketDetailDto,
  type RouteCode,
} from "@build-manager/api-contracts";
import { ROUTE_NAMES, buildingFieldName, buildingValueName } from "../status-names";

/**
 * Pure view decisions for the landlord demo.
 *
 * Nothing here decides safety, protocol, evidence, or routing — those come
 * from the API. This only decides what the screen may offer, so the UI never
 * presents an action the server would refuse.
 */
export type RouteOption = { routeCode: RouteCode; label: string };

/** Derived from the contract, so the UI cannot drift from the wire vocabulary. */
export const ALL_ROUTE_CODES: readonly RouteCode[] = RouteCodeSchema.options;

/**
 * Presentation only. The name table is a total record, so adding a route code
 * to the contract without a Korean name stops the build.
 */
export function routeLabel(routeCode: RouteCode): string {
  return ROUTE_NAMES[routeCode];
}

/**
 * Whether the landlord is choosing an alternative to a recommendation, or
 * recording a purely manual route because the server recommended none.
 */
export type ManualRouteMode = "NONE" | "ALTERNATIVE" | "MANUAL_ONLY";

export function manualRouteMode(
  ticket: LandlordTicketDetailDto,
): ManualRouteMode {
  if (isSafetyEscalated(ticket)) {
    return "NONE";
  }
  return ticket.repairPacket?.recommendation == null
    ? "MANUAL_ONLY"
    : "ALTERNATIVE";
}

function isSafetyEscalated(ticket: LandlordTicketDetailDto): boolean {
  return (
    ticket.status === "SAFETY_ESCALATED" ||
    ticket.evidenceStatus === "SAFETY_ESCALATED" ||
    ticket.repairPacket?.safetyEscalated === true
  );
}

export type RecommendationState =
  | "RECOMMENDED"
  | "SAFETY_ESCALATED"
  | "MISSING_REQUIRED"
  | "CONFLICTING"
  | "AWAITING_INTAKE";

const REVIEW_STATUSES = ["READY_FOR_REVIEW", "PARTIAL"] as const;

function isReviewStatus(ticket: LandlordTicketDetailDto): boolean {
  return REVIEW_STATUSES.some((status) => status === ticket.status);
}

export function canApprove(ticket: LandlordTicketDetailDto): boolean {
  return (
    ticket.status === "READY_FOR_REVIEW" &&
    ticket.repairPacket?.recommendation != null
  );
}

export function canRequestMoreInfo(ticket: LandlordTicketDetailDto): boolean {
  return isReviewStatus(ticket);
}

/**
 * The manual override choices.
 *
 * The domain already lets a landlord record a route when nothing was
 * recommended, so the UI offers the whole closed vocabulary in that case rather
 * than only the server's alternatives. Where a recommendation does exist, it is
 * excluded — approving it is the separate, clearer action.
 *
 * A safety-escalated ticket offers none: that is a Web operational safeguard,
 * not a domain rule.
 */
export function overrideOptions(ticket: LandlordTicketDetailDto): RouteOption[] {
  if (isSafetyEscalated(ticket)) {
    return [];
  }

  const recommended = ticket.repairPacket?.recommendation?.routeCode ?? null;

  return ALL_ROUTE_CODES.filter((routeCode) => routeCode !== recommended).map(
    (routeCode) => ({ routeCode, label: routeLabel(routeCode) }),
  );
}

/**
 * Safety outranks every other explanation, so an escalated ticket is never
 * described merely as "missing evidence".
 */
export function recommendationState(
  ticket: LandlordTicketDetailDto,
): RecommendationState {
  if (ticket.repairPacket === null) {
    return "AWAITING_INTAKE";
  }
  if (
    ticket.repairPacket.safetyEscalated ||
    ticket.evidenceStatus === "SAFETY_ESCALATED"
  ) {
    return "SAFETY_ESCALATED";
  }
  if (ticket.repairPacket.recommendation !== null) {
    return "RECOMMENDED";
  }
  if (ticket.evidenceStatus === "CONFLICTING") {
    return "CONFLICTING";
  }
  return "MISSING_REQUIRED";
}

export type ContextProvenance = "OWNER_VERIFIED" | "INFORMATIONAL";

export type ContextRow = {
  key: string;
  label: string;
  value: string;
  routingEligible: boolean;
  provenance: ContextProvenance;
};

function display(key: string, value: string | boolean): string {
  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }
  return buildingValueName(key, value);
}

/**
 * Splits the passport into routing-eligible and informational context.
 *
 * Approval year and primary use are always informational: the screen must not
 * suggest that changing them would move the route.
 */
export function contextRows(passport: BuildingPassportDto): ContextRow[] {
  const rows: ContextRow[] = [
    {
      key: "managementMode",
      value: display("managementMode", passport.managementMode),
    },
    {
      key: "heatingType",
      value: display("heatingType", passport.heatingType),
    },
    ...(passport.ownerSuppliedBoiler === undefined
      ? []
      : [
          {
            key: "ownerSuppliedBoiler",
            value: display("ownerSuppliedBoiler", passport.ownerSuppliedBoiler),
          },
        ]),
    { key: "primaryUse", value: display("primaryUse", passport.primaryUse) },
    { key: "approvalYear", value: display("approvalYear", passport.approvalYear) },
  ].map((row) => {
    const routingEligible = passport.routingEligibleFields.some(
      (field) => field === row.key,
    );
    return {
      key: row.key,
      label: buildingFieldName(row.key),
      value: row.value,
      routingEligible,
      provenance: routingEligible
        ? ("OWNER_VERIFIED" as const)
        : ("INFORMATIONAL" as const),
    };
  });

  return rows;
}
