import {
  requestMoreInfo as applyMoreInfoRequest,
  type EvidenceType,
  type Protocol,
  type Ticket,
} from "@build-manager/domain";
import { asStateTransition, stateConflict } from "../errors";
import type { ApplicationDependencies } from "../ports";
import { assessTicket, loadBuilding, loadTicket } from "./ticket-assessment";

export type RequestMoreInfoInput = {
  ticketId: string;
  reason: string;
  requestedQuestionIds?: string[];
  requestedEvidenceTypes?: EvidenceType[];
};

function firstDuplicate<T>(values: readonly T[]): T | null {
  const seen = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
  }
  return null;
}

/**
 * A request has to be answerable. The public contract only checks shape, so a
 * direct call could otherwise ask for a question the selected protocol never
 * asks — which the tenant would never see and could never clear.
 *
 * Nothing is silently dropped, deduplicated, or coerced: an unanswerable
 * request is refused whole, so the landlord finds out rather than waiting on a
 * request that cannot be satisfied.
 */
function assertRequestIsAnswerable(
  protocol: Protocol,
  input: RequestMoreInfoInput,
): void {
  const questionIds = input.requestedQuestionIds ?? [];
  const evidenceTypes = input.requestedEvidenceTypes ?? [];

  if (questionIds.length + evidenceTypes.length === 0) {
    throw stateConflict(
      `Cannot request more info on ticket ${input.ticketId}: no question or evidence was requested`,
    );
  }

  const askable = new Set(protocol.questions.map((question) => question.id));
  for (const questionId of questionIds) {
    if (!askable.has(questionId)) {
      throw stateConflict(
        `Cannot request more info on ticket ${input.ticketId}: protocol ${protocol.id} does not ask ${questionId}`,
      );
    }
  }

  const collectable = new Set(protocol.evidence.map((item) => item.type));
  for (const evidenceType of evidenceTypes) {
    if (!collectable.has(evidenceType)) {
      throw stateConflict(
        `Cannot request more info on ticket ${input.ticketId}: protocol ${protocol.id} does not collect ${evidenceType}`,
      );
    }
  }

  const duplicateQuestion = firstDuplicate(questionIds);
  if (duplicateQuestion !== null) {
    throw stateConflict(
      `Cannot request more info on ticket ${input.ticketId}: question ${duplicateQuestion} was requested twice`,
    );
  }

  const duplicateEvidence = firstDuplicate(evidenceTypes);
  if (duplicateEvidence !== null) {
    throw stateConflict(
      `Cannot request more info on ticket ${input.ticketId}: evidence ${duplicateEvidence} was requested twice`,
    );
  }
}

/**
 * Sends a reviewed ticket back to the tenant. This is a review-state change,
 * not a route decision, so no RouteDecision is recorded.
 */
export async function requestMoreInfo(
  deps: ApplicationDependencies,
  input: RequestMoreInfoInput,
): Promise<Ticket> {
  const ticket = await loadTicket(deps, input.ticketId);
  const building = await loadBuilding(deps, ticket.buildingId);

  assertRequestIsAnswerable(assessTicket(ticket, building).protocol, input);

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
