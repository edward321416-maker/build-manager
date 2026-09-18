import {
  RouteCodeSchema,
  type BuildingPassportDto,
  type LandlordTicketDetailDto,
  type RouteCode,
} from "@build-manager/api-contracts";

/**
 * View policy for the landlord screens.
 *
 * Everything here decides what a control may offer. None of it decides an
 * outcome: safety, protocol, evidence completeness, the repair packet, the
 * recommendation, and every ticket transition arrive already settled on the
 * server's response, and are only read.
 */
export const ALL_ROUTE_CODES: readonly RouteCode[] = RouteCodeSchema.options;

const ROUTE_LABELS: Record<RouteCode, string> = {
  LANDLORD_REVIEW: "임대인 검토",
  MANAGEMENT_OFFICE: "관리사무소",
  THIRD_PARTY_MANAGER: "위탁관리",
  MANUFACTURER_AS: "제조사 A/S",
  GENERAL_VENDOR: "일반 수리업체",
};

export function routeLabel(routeCode: RouteCode): string {
  return ROUTE_LABELS[routeCode];
}

/**
 * Escalation is reported in three places on the response, and any one of them
 * is enough. Reading only `status` would let an escalated packet keep offering
 * ordinary routing controls.
 */
export function isSafetyEscalated(ticket: LandlordTicketDetailDto): boolean {
  return (
    ticket.status === "SAFETY_ESCALATED" ||
    ticket.evidenceStatus === "SAFETY_ESCALATED" ||
    ticket.repairPacket?.safetyEscalated === true
  );
}

export function canApprove(ticket: LandlordTicketDetailDto): boolean {
  return (
    ticket.status === "READY_FOR_REVIEW" &&
    ticket.repairPacket?.recommendation != null
  );
}

export function canRequestMoreInfo(ticket: LandlordTicketDetailDto): boolean {
  return ticket.status === "READY_FOR_REVIEW" || ticket.status === "PARTIAL";
}

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

export type RouteChoice = { routeCode: RouteCode; label: string };

/**
 * Manual choices come from the closed public vocabulary, minus the recommended
 * route — approving is the explicit path for that one. The packet's
 * `routeAlternatives` is a suggestion, not a narrower permission list, so it is
 * deliberately not used to restrict what a person may choose.
 */
export function overrideOptions(
  ticket: LandlordTicketDetailDto,
): RouteChoice[] {
  if (isSafetyEscalated(ticket)) {
    return [];
  }

  const recommended = ticket.repairPacket?.recommendation?.routeCode ?? null;

  return ALL_ROUTE_CODES.filter((routeCode) => routeCode !== recommended).map(
    (routeCode) => ({ routeCode, label: routeLabel(routeCode) }),
  );
}

export type RecommendationState =
  | "RECOMMENDED"
  | "SAFETY_ESCALATED"
  | "MISSING_REQUIRED"
  | "CONFLICTING"
  | "AWAITING_INTAKE";

/** Why there is or is not a recommendation, read from the response alone. */
export function recommendationState(
  ticket: LandlordTicketDetailDto,
): RecommendationState {
  if (ticket.repairPacket === null) {
    return "AWAITING_INTAKE";
  }
  if (isSafetyEscalated(ticket)) {
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

export type ContextRow = {
  key: string;
  label: string;
  value: string;
  routingEligible: boolean;
};

const CONTEXT_LABELS: Record<string, string> = {
  managementMode: "관리 방식",
  heatingType: "난방 방식",
  ownerSuppliedBoiler: "임대인 공급 보일러",
  primaryUse: "주용도",
  approvalYear: "사용승인 연도",
};

const VALUE_LABELS: Record<string, string> = {
  OWNER_DIRECT: "임대인 직접 관리",
  MANAGEMENT_OFFICE: "관리사무소",
  INDIVIDUAL: "개별난방",
  CENTRAL_SHARED: "중앙·공용난방",
};

function display(value: string | boolean): string {
  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }
  return VALUE_LABELS[value] ?? value;
}

/**
 * Which passport fields the server actually routes on, kept separate from the
 * ones shown for context only. The eligibility list comes from the response, so
 * this never asserts a field is routing-relevant on its own authority.
 *
 * An absent `ownerSuppliedBoiler` stays absent rather than becoming "아니오".
 */
export function contextRows(passport: BuildingPassportDto): ContextRow[] {
  const rows: { key: string; value: string }[] = [
    { key: "managementMode", value: display(passport.managementMode) },
    { key: "heatingType", value: display(passport.heatingType) },
    ...(passport.ownerSuppliedBoiler === undefined
      ? []
      : [
          {
            key: "ownerSuppliedBoiler",
            value: display(passport.ownerSuppliedBoiler),
          },
        ]),
    { key: "primaryUse", value: passport.primaryUse },
    { key: "approvalYear", value: passport.approvalYear },
  ];

  return rows.map((row) => ({
    ...row,
    label: CONTEXT_LABELS[row.key] ?? row.key,
    routingEligible: passport.routingEligibleFields.some(
      (field) => field === row.key,
    ),
  }));
}
