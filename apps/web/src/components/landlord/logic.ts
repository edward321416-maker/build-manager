import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";

/**
 * Pure view decisions for the landlord demo.
 *
 * Nothing here decides safety, protocol, evidence, or routing — those come
 * from the API. This only decides what the screen may offer, so the UI never
 * presents an action the server would refuse.
 */
export type RouteOption = { routeCode: string; label: string };

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
 * The override choices are exactly the routes the server named for this
 * ticket. The browser never invents a route code, so an arbitrary string can
 * never be offered or submitted.
 */
export function overrideOptions(ticket: LandlordTicketDetailDto): RouteOption[] {
  const packet = ticket.repairPacket;
  if (packet === null) {
    return [];
  }

  const options: RouteOption[] = [];
  const seen = new Set<string>();

  for (const option of [
    ...(packet.recommendation === null
      ? []
      : [
          {
            routeCode: packet.recommendation.routeCode,
            label: packet.recommendation.label,
          },
        ]),
    ...packet.routeAlternatives,
  ]) {
    if (seen.has(option.routeCode)) {
      continue;
    }
    seen.add(option.routeCode);
    options.push({ routeCode: option.routeCode, label: option.label });
  }

  return options;
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
 * Splits the passport into routing-eligible and informational context.
 *
 * Approval year and primary use are always informational: the screen must not
 * suggest that changing them would move the route.
 */
export function contextRows(passport: BuildingPassportDto): ContextRow[] {
  const rows: ContextRow[] = [
    {
      key: "managementMode",
      value: display(passport.managementMode),
    },
    {
      key: "heatingType",
      value: display(passport.heatingType),
    },
    ...(passport.ownerSuppliedBoiler === undefined
      ? []
      : [
          {
            key: "ownerSuppliedBoiler",
            value: display(passport.ownerSuppliedBoiler),
          },
        ]),
    { key: "primaryUse", value: display(passport.primaryUse) },
    { key: "approvalYear", value: display(passport.approvalYear) },
  ].map((row) => {
    const routingEligible = passport.routingEligibleFields.some(
      (field) => field === row.key,
    );
    return {
      key: row.key,
      label: CONTEXT_LABELS[row.key] ?? row.key,
      value: row.value,
      routingEligible,
      provenance: routingEligible
        ? ("OWNER_VERIFIED" as const)
        : ("INFORMATIONAL" as const),
    };
  });

  return rows;
}
