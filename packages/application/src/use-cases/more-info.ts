import type { EvidenceType, Ticket } from "@build-manager/domain";

export type OutstandingMoreInfo = {
  requestedQuestionIds: string[];
  requestedEvidenceTypes: EvidenceType[];
};

/**
 * What an active more-info request is still waiting for.
 *
 * A submission answers the request only if it was created strictly after it.
 * Equal timestamps mean the submission was already on the ticket when the
 * landlord asked, so `>=` would let a pre-existing answer satisfy a request
 * the instant it was made.
 *
 * This is the single place that comparison is made. The finalize invariant and
 * the tenant projection both read it, so neither can drift from the other.
 */
export function getOutstandingMoreInfo(ticket: Ticket): OutstandingMoreInfo {
  const request = ticket.moreInfoRequest ?? null;
  if (request === null) {
    return { requestedQuestionIds: [], requestedEvidenceTypes: [] };
  }

  const requestedAt = Date.parse(request.requestedAt);

  const answeredSince = new Set(
    ticket.answers
      .filter((answer) => Date.parse(answer.createdAt) > requestedAt)
      .map((answer) => answer.questionId),
  );
  const suppliedSince = new Set(
    ticket.evidence
      .filter((item) => Date.parse(item.createdAt) > requestedAt)
      .map((item) => item.type),
  );

  return {
    requestedQuestionIds: (request.requestedQuestionIds ?? []).filter(
      (questionId) => !answeredSince.has(questionId),
    ),
    requestedEvidenceTypes: (request.requestedEvidenceTypes ?? []).filter(
      (evidenceType) => !suppliedSince.has(evidenceType),
    ),
  };
}

/** True while an active request is still waiting for something. */
export function hasOutstandingMoreInfo(ticket: Ticket): boolean {
  const outstanding = getOutstandingMoreInfo(ticket);

  return (
    outstanding.requestedQuestionIds.length > 0 ||
    outstanding.requestedEvidenceTypes.length > 0
  );
}
