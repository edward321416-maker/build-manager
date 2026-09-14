import type {
  MoreInfoRequest,
  RouteDecision,
  Ticket,
  TicketStatus,
} from "./types";

const MORE_INFO_ALLOWED_FROM: readonly TicketStatus[] = [
  "READY_FOR_REVIEW",
  "PARTIAL",
];

/**
 * Sends a reviewed ticket back to the tenant for more data. Only a ticket that
 * has actually reached review may be sent back, so the request cannot skip the
 * intake the tenant has not finished yet.
 */
export function requestMoreInfo(
  ticket: Ticket,
  request: MoreInfoRequest,
): Ticket {
  if (!MORE_INFO_ALLOWED_FROM.includes(ticket.status)) {
    throw new Error(
      `Cannot request more info from status ${ticket.status}; expected one of ${MORE_INFO_ALLOWED_FROM.join(", ")}`,
    );
  }

  return {
    ...ticket,
    status: "NEEDS_MORE_INFO",
    moreInfoRequest: request,
    updatedAt: request.requestedAt,
  };
}

/**
 * Records the landlord's decision. Approval is only available for the exact
 * route the current packet recommended; any other choice is an override, which
 * stays available even when the system recommended nothing.
 */
export function applyRouteDecision(
  ticket: Ticket,
  decision: RouteDecision,
): Ticket {
  if (decision.action === "APPROVE_RECOMMENDATION") {
    const recommendation = ticket.repairPacket?.recommendation ?? null;
    if (recommendation === null) {
      throw new Error(
        "Cannot approve: the current repair packet carries no recommendation",
      );
    }
    if (
      decision.recommendedRoute !== recommendation.primary ||
      decision.selectedRoute !== recommendation.primary
    ) {
      throw new Error(
        `Cannot approve: selected route does not match the recommended route ${recommendation.primary}`,
      );
    }
  }

  return {
    ...ticket,
    status:
      decision.action === "APPROVE_RECOMMENDATION" ? "APPROVED" : "OVERRIDDEN",
    routeDecision: decision,
    updatedAt: decision.decidedAt,
  };
}
