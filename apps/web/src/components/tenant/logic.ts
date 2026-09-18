import type {
  SyntheticEvidenceRequirementDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";

/**
 * Pure view decisions for the tenant demo.
 *
 * Nothing here judges safety, completeness, or routing — those come from the
 * server on every response. This only decides which step to show.
 */
export type IntakeStage =
  | "SAFETY"
  | "MORE_INFO"
  | "QUESTION"
  | "EVIDENCE"
  | "READY_TO_FINALIZE"
  | "DECIDED";

function isSafetyEscalated(ticket: TenantTicketStatusDto): boolean {
  return (
    ticket.status === "SAFETY_ESCALATED" ||
    ticket.evidenceStatus === "SAFETY_ESCALATED" ||
    ticket.packet?.safetyEscalated === true
  );
}

/** Required evidence the tenant has not supplied yet. */
export function outstandingEvidence(
  ticket: TenantTicketStatusDto,
): SyntheticEvidenceRequirementDto[] {
  const submitted = new Set(
    ticket.submittedEvidence.map((item) => item.evidenceType),
  );

  return ticket.evidenceRequirements.filter(
    (requirement) =>
      requirement.required && !submitted.has(requirement.evidenceType),
  );
}

/** The landlord's request is answered, but the tenant has not resubmitted yet. */
export function moreInfoFulfilled(ticket: TenantTicketStatusDto): boolean {
  const request = ticket.moreInfoRequest;
  return (
    request !== null &&
    request.requestedQuestions.length === 0 &&
    request.requestedEvidence.length === 0
  );
}

/**
 * Safety outranks everything: an escalated ticket never continues ordinary
 * intake. An outstanding follow-up outranks ordinary questions, because the
 * landlord is waiting on exactly those items.
 */
export function intakeStage(ticket: TenantTicketStatusDto): IntakeStage {
  if (isSafetyEscalated(ticket)) {
    return "SAFETY";
  }
  if (ticket.status === "APPROVED" || ticket.status === "OVERRIDDEN") {
    return "DECIDED";
  }
  if (ticket.moreInfoRequest !== null) {
    return "MORE_INFO";
  }
  if (ticket.activeQuestion !== null) {
    return "QUESTION";
  }
  if (outstandingEvidence(ticket).length > 0) {
    return "EVIDENCE";
  }
  return "READY_TO_FINALIZE";
}
