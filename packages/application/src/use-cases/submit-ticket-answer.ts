import type { AnswerValue, Ticket } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";
import {
  assertIntakeAllowed,
  assessTicket,
  intakeStatus,
  loadBuilding,
  loadTicket,
} from "./ticket-assessment";

export type SubmitTicketAnswerInput = {
  ticketId: string;
  questionId: string;
  value: AnswerValue;
};

/**
 * Appends a tenant answer. Answers accumulate rather than overwrite, so a
 * contradicting answer surfaces through the domain evidence gate instead of
 * quietly replacing the earlier record.
 */
export async function submitTicketAnswer(
  deps: ApplicationDependencies,
  input: SubmitTicketAnswerInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);
  assertIntakeAllowed(ticket);

  const building = await loadBuilding(deps, ticket.buildingId);
  const submittedAt = deps.clock.now();

  const withAnswer: Ticket = {
    ...ticket,
    answers: [
      ...ticket.answers,
      {
        questionId: input.questionId,
        value: input.value,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      },
    ],
    updatedAt: submittedAt,
  };

  const assessment = assessTicket(withAnswer, building);
  const updated: Ticket = {
    ...withAnswer,
    protocolId: assessment.protocol.id,
    status: intakeStatus(assessment),
    safetyFlags: assessment.safety.flags,
  };

  await deps.tickets.save(updated);
  return updated;
}
