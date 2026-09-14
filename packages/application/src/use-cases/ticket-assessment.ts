import {
  evaluateEvidence,
  evaluateSafety,
  selectProtocol,
  type Building,
  type EvidenceState,
  type Protocol,
  type SafetyFlag,
  type SafetyInput,
  type SafetyResult,
  type Ticket,
  type TicketStatus,
} from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";

/** Adapter between a protocol's safety check flags and the safety gate input. */
const SAFETY_ANSWER_BY_FLAG: Record<
  SafetyFlag,
  "gasSmell" | "smokeOrFire" | "electricalWaterRisk" | "otherUrgentHazard"
> = {
  GAS_SMELL: "gasSmell",
  SMOKE_OR_FIRE: "smokeOrFire",
  ELECTRICAL_WATER_RISK: "electricalWaterRisk",
  OTHER_URGENT_HAZARD: "otherUrgentHazard",
};

export type TicketAssessment = {
  protocol: Protocol;
  safety: SafetyResult;
  evidenceState: EvidenceState;
};

export async function loadBuilding(
  deps: ApplicationDependencies,
  buildingId: string,
): Promise<Building> {
  const building = await deps.buildings.findById(buildingId);
  if (!building) {
    throw new Error(`Building ${buildingId} not found`);
  }
  return building;
}

export async function loadTicket(
  deps: ApplicationDependencies,
  ticketId: string,
): Promise<Ticket> {
  const ticket = await deps.tickets.findById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }
  return ticket;
}

/**
 * Reads the protocol's own safety checks rather than restating which questions
 * are hazardous, so the hazard mapping lives in the domain protocol only.
 */
function safetyInput(protocol: Protocol, ticket: Ticket): SafetyInput {
  const input: SafetyInput = { rawText: ticket.rawUserText };

  for (const check of protocol.safetyChecks) {
    const answeredYes = ticket.answers.some(
      (entry) => entry.questionId === check.questionId && entry.value === true,
    );
    if (answeredYes) {
      input[SAFETY_ANSWER_BY_FLAG[check.flag]] = true;
    }
  }

  return input;
}

/**
 * Runs the authoritative domain gates for a ticket. The application never
 * decides safety, protocol, or completeness itself; it only orchestrates.
 */
export function assessTicket(
  ticket: Ticket,
  building: Building,
): TicketAssessment {
  const protocol = selectProtocol(building, ticket.issueType);
  const safety = evaluateSafety(safetyInput(protocol, ticket));
  const evidenceState = evaluateEvidence({
    protocol,
    answers: ticket.answers,
    evidence: ticket.evidence,
    safety,
  });

  return { protocol, safety, evidenceState };
}

const DECIDED_STATUSES: readonly TicketStatus[] = ["APPROVED", "OVERRIDDEN"];

/** Intake stops once a landlord decision is on the record. */
export function assertIntakeAllowed(ticket: Ticket): void {
  if (DECIDED_STATUSES.includes(ticket.status)) {
    throw new Error(
      `Cannot add tenant data to ticket ${ticket.id}: a landlord decision is already recorded`,
    );
  }
}

/** Intake keeps a ticket open unless the safety gate has escalated it. */
export function intakeStatus(assessment: TicketAssessment): TicketStatus {
  return assessment.evidenceState === "SAFETY_ESCALATED"
    ? "SAFETY_ESCALATED"
    : "IN_PROGRESS";
}
