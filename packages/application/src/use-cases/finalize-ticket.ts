import {
  buildRepairPacket,
  recommendRoute,
  type EvidenceState,
  type Ticket,
  type TicketStatus,
} from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";
import { assessTicket, loadBuilding, loadTicket } from "./ticket-assessment";

export type FinalizeTicketInput = {
  ticketId: string;
};

const STATUS_BY_EVIDENCE_STATE: Record<EvidenceState, TicketStatus> = {
  COMPLETE: "READY_FOR_REVIEW",
  MISSING_REQUIRED: "PARTIAL",
  CONFLICTING: "PARTIAL",
  SAFETY_ESCALATED: "SAFETY_ESCALATED",
};

/**
 * Produces the authoritative review packet. Every decision here comes from the
 * domain: the evidence gate governs whether a route may be recommended at all,
 * and each rebuild is a new packet revision.
 */
export async function finalizeTicket(
  deps: ApplicationDependencies,
  input: FinalizeTicketInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);
  const building = await loadBuilding(deps, ticket.buildingId);
  const assessment = assessTicket(ticket, building);

  const recommendation = recommendRoute({
    protocol: assessment.protocol,
    building,
    issueType: ticket.issueType,
    answers: ticket.answers,
    evidenceState: assessment.evidenceState,
  });

  const finalizedAt = deps.clock.now();
  const repairPacket = buildRepairPacket({
    ticket,
    building,
    evidenceState: assessment.evidenceState,
    safety: assessment.safety,
    recommendation,
    createdAt: finalizedAt,
  });

  const finalized: Ticket = {
    ...ticket,
    protocolId: assessment.protocol.id,
    status: STATUS_BY_EVIDENCE_STATE[assessment.evidenceState],
    safetyFlags: assessment.safety.flags,
    repairPacket,
    // Refinalizing answers the outstanding request, so it is no longer current.
    // The answers and evidence the tenant added in response are untouched.
    moreInfoRequest: null,
    updatedAt: finalizedAt,
  };

  await deps.tickets.save(finalized);
  return finalized;
}
