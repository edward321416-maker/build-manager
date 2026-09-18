import type { EvidenceType, Ticket } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";
import {
  assertIntakeAllowed,
  assessTicket,
  intakeStatus,
  loadBuilding,
  loadTicket,
} from "./ticket-assessment";

export type SubmitTicketEvidenceInput = {
  ticketId: string;
  evidenceType: EvidenceType;
  fixtureId: string;
};

/**
 * Attaches synthetic demo evidence. Public P0 references a fixture only; there
 * is no upload path and no storage reference is ever written.
 */
export async function submitTicketEvidence(
  deps: ApplicationDependencies,
  input: SubmitTicketEvidenceInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);
  assertIntakeAllowed(ticket);

  const building = await loadBuilding(deps, ticket.buildingId);
  const submittedAt = deps.clock.now();

  const withEvidence: Ticket = {
    ...ticket,
    evidence: [
      ...ticket.evidence,
      {
        id: deps.ids.next("evidence"),
        type: input.evidenceType,
        fixtureRef: input.fixtureId,
        storageRef: null,
        source: "DEMO_FIXTURE",
        createdAt: submittedAt,
      },
    ],
    updatedAt: submittedAt,
  };

  const assessment = assessTicket(withEvidence, building);
  const updated: Ticket = {
    ...withEvidence,
    protocolId: assessment.protocol.id,
    status: intakeStatus(assessment),
    safetyFlags: assessment.safety.flags,
  };

  await deps.tickets.save(updated);
  return updated;
}
