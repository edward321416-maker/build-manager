import type {
  SyntheticEvidenceRequirementDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";

/**
 * Which step of the tenant flow to show.
 *
 * This decides presentation order and nothing else. Safety, completeness,
 * protocol choice, routing, and every state transition are decided by the
 * server and arrive already settled on each response.
 */
export type IntakeStage =
  | "SAFETY"
  | "DECIDED"
  | "MORE_INFO"
  | "QUESTION"
  | "EVIDENCE"
  | "READY_TO_FINALIZE";

function isSafetyEscalated(ticket: TenantTicketStatusDto): boolean {
  return (
    ticket.status === "SAFETY_ESCALATED" ||
    ticket.evidenceStatus === "SAFETY_ESCALATED" ||
    ticket.packet?.safetyEscalated === true
  );
}

/** Required evidence the server still lists and the tenant has not supplied. */
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

/** The landlord's request is answered, but the tenant has not resubmitted. */
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
 * intake. A landlord decision closes the flow. An outstanding follow-up comes
 * before ordinary questions, because the landlord is waiting on those items.
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
