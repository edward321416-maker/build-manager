import {
  applyRouteDecision,
  type RouteType,
  type Ticket,
} from "@build-manager/domain";
import { asStateTransition } from "../errors";
import type { ApplicationDependencies } from "../ports";
import { loadTicket } from "./ticket-assessment";

export type OverrideRouteInput = {
  ticketId: string;
  selectedRoute: RouteType;
  reason?: string;
};

/**
 * Records a landlord's own route choice as a human decision, distinct from a
 * system recommendation. It stays available when nothing was recommended.
 */
export async function overrideRoute(
  deps: ApplicationDependencies,
  input: OverrideRouteInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);

  const overridden = asStateTransition(() =>
    applyRouteDecision(ticket, {
      action: "OVERRIDE_ROUTE",
      recommendedRoute: ticket.repairPacket?.recommendation?.primary ?? null,
      selectedRoute: input.selectedRoute,
      reason: input.reason ?? null,
      actor: "LANDLORD",
      decidedAt: deps.clock.now(),
    }),
  );

  await deps.tickets.save(overridden);
  return overridden;
}
