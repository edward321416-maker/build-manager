import {
  evaluateRuleExpression,
  type AnswerValue,
  type EvidenceType,
  type RuleField,
  type RuleValues,
  type Ticket,
} from "@build-manager/domain";
import { stateConflict } from "../errors";
import type { ApplicationDependencies } from "../ports";
import {
  assertIntakeAllowed,
  assessTicket,
  intakeStatus,
  loadBuilding,
  loadTicket,
} from "./ticket-assessment";

export type SubmitTicketPhotoEvidenceInput = {
  ticketId: string;
  evidenceType: EvidenceType;
  photoId: string;
};

/** Prefix of the storage reference of a photo kept with the ticket in the Core flow. */
export const CORE_PHOTO_REF_PREFIX = "core-photo:";

export function corePhotoRef(photoId: string): string {
  return `${CORE_PHOTO_REF_PREFIX}${photoId}`;
}

/**
 * Names one of the tenant's own photos as the evidence the protocol asks for now
 * (spec docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md).
 * The evidence gate is unchanged: it only sees that the required type is present.
 * One photo per type; choosing again replaces it, and the same choice changes nothing.
 * The caller must have checked that the photo belongs to this ticket.
 */
export async function submitTicketPhotoEvidence(
  deps: ApplicationDependencies,
  input: SubmitTicketPhotoEvidenceInput,
): Promise<{ ticket: Ticket; changed: boolean }> {
  const ticket = await loadTicket(deps, input.ticketId);
  assertIntakeAllowed(ticket);

  const building = await loadBuilding(deps, ticket.buildingId);
  const { protocol } = assessTicket(ticket, building);
  const values = ruleValues(ticket);
  const requested = protocol.evidence.some(
    (requirement) =>
      requirement.type === input.evidenceType &&
      (requirement.showWhen === undefined ||
        evaluateRuleExpression(requirement.showWhen, values)),
  );
  if (!requested) {
    throw stateConflict(
      `Ticket ${ticket.id} does not ask for ${input.evidenceType} evidence now`,
    );
  }

  const storageRef = corePhotoRef(input.photoId);
  const isChosen = (item: Ticket["evidence"][number]) =>
    item.source === "TENANT_UPLOAD" && item.type === input.evidenceType;
  const chosen = ticket.evidence.filter(isChosen);
  if (chosen.length === 1 && chosen[0]!.storageRef === storageRef) {
    return { ticket, changed: false };
  }

  const submittedAt = deps.clock.now();
  const withEvidence: Ticket = {
    ...ticket,
    evidence: [
      ...ticket.evidence.filter((item) => !isChosen(item)),
      {
        id: deps.ids.next("evidence"),
        type: input.evidenceType,
        fixtureRef: null,
        storageRef,
        source: "TENANT_UPLOAD",
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
  return { ticket: updated, changed: true };
}

function isMissing(value: AnswerValue): boolean {
  return (
    value === null ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** The rule values the evidence gate sees: the first answer per question, blanks left out. */
function ruleValues(ticket: Ticket): RuleValues {
  const values: RuleValues = {};
  const seen = new Set<string>();
  for (const answer of ticket.answers) {
    if (seen.has(answer.questionId)) continue;
    seen.add(answer.questionId);
    if (!isMissing(answer.value)) {
      values[`answer.${answer.questionId}` as RuleField] = answer.value as string | boolean;
    }
  }
  return values;
}
