import {
  applyRouteDecision,
  type RouteType,
  type Ticket,
} from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";
import { loadTicket } from "./ticket-assessment";

export type ApproveRecommendationInput = {
  ticketId: string;
  selectedRoute: RouteType;
};

/**
 * Approves the current packet recommendation. The domain decides whether the
 * approval is legitimate, so a missing or mismatched recommendation is
 * rejected there and nothing is persisted.
 */
export async function approveRecommendation(
  deps: ApplicationDependencies,
  input: ApproveRecommendationInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);

  const approved = applyRouteDecision(ticket, {
    action: "APPROVE_RECOMMENDATION",
    recommendedRoute:
      ticket.repairPacket?.recommendation?.primary ?? input.selectedRoute,
    selectedRoute: input.selectedRoute,
    actor: "LANDLORD",
    decidedAt: deps.clock.now(),
  });

  await deps.tickets.save(approved);
  return approved;
}
