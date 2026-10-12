import {
  activeEvidenceRequirements,
  type EvidenceType,
  type Ticket,
} from "@build-manager/domain";
import { notFound, stateConflict } from "../errors";
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

/** Core photo ids are lowercase UUIDs; nothing else can name one of the ticket's photos. */
const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Names one of the tenant's own photos as the evidence the protocol asks for now
 * (spec docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md).
 * The evidence gate is unchanged: it only sees that the required type is present.
 * What counts as asked for is read as the gate reads it (activeEvidenceRequirements).
 * One photo per type; choosing again replaces it, and the same choice changes nothing.
 * The caller must have checked that the photo belongs to this ticket.
 */
export async function submitTicketPhotoEvidence(
  deps: ApplicationDependencies,
  input: SubmitTicketPhotoEvidenceInput,
): Promise<{ ticket: Ticket; changed: boolean }> {
  if (!PHOTO_ID.test(input.photoId)) {
    throw notFound(`Photo for ticket ${input.ticketId} not found`);
  }
  const ticket = await loadTicket(deps, input.ticketId);
  assertIntakeAllowed(ticket);

  const building = await loadBuilding(deps, ticket.buildingId);
  const { protocol } = assessTicket(ticket, building);
  const requested = activeEvidenceRequirements(protocol, ticket.answers).some(
    (requirement) => requirement.type === input.evidenceType,
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
