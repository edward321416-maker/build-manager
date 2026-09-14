import {
  requestMoreInfo as applyMoreInfoRequest,
  type EvidenceType,
  type Ticket,
} from "@build-manager/domain";
import { asStateTransition } from "../errors";
import type { ApplicationDependencies } from "../ports";
import { loadTicket } from "./ticket-assessment";

export type RequestMoreInfoInput = {
  ticketId: string;
  reason: string;
  requestedQuestionIds?: string[];
  requestedEvidenceTypes?: EvidenceType[];
};

/**
 * Sends a reviewed ticket back to the tenant. This is a review-state change,
 * not a route decision, so no RouteDecision is recorded.
 */
export async function requestMoreInfo(
  deps: ApplicationDependencies,
  input: RequestMoreInfoInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);

  const returned = asStateTransition(() =>
    applyMoreInfoRequest(ticket, {
      action: "REQUEST_MORE_INFO",
      reason: input.reason,
      requestedQuestionIds: input.requestedQuestionIds,
      requestedEvidenceTypes: input.requestedEvidenceTypes,
      actor: "LANDLORD",
      requestedAt: deps.clock.now(),
    }),
  );

  await deps.tickets.save(returned);
  return returned;
}
