import type { Building } from "../building/types";
import type { SafetyResult } from "../safety/evaluate-safety";
import type {
  EvidenceState,
  RepairPacket,
  RouteRecommendation,
  Ticket,
} from "../ticket/types";

export type RepairPacketInput = {
  ticket: Ticket;
  building: Building;
  evidenceState: EvidenceState;
  safety: SafetyResult;
  recommendation: RouteRecommendation | null;
  createdAt: string;
};

const EVIDENCE_STATE_TEXT: Record<EvidenceState, string> = {
  COMPLETE: "필수 정보와 증빙이 모두 확인되었습니다.",
  MISSING_REQUIRED: "필수 정보 또는 증빙이 아직 부족합니다.",
  CONFLICTING: "제출된 정보가 서로 어긋나 확인이 필요합니다.",
  SAFETY_ESCALATED: "안전 위험 신호가 있어 일반 진단을 중단했습니다.",
};

/** Safety answers stay in the safety field; they are not symptoms. */
function structuredSymptoms(ticket: Ticket): Record<string, unknown> {
  const symptoms: Record<string, unknown> = {};
  for (const answer of ticket.answers) {
    if (answer.questionId.startsWith("safety.") || answer.value === null) {
      continue;
    }
    symptoms[answer.questionId] = answer.value;
  }
  return symptoms;
}

/** Deterministic template wording. P0 core runs without a model. */
function summaryText(input: RepairPacketInput): string {
  const issue = input.ticket.issueType === "HEATING" ? "난방" : "누수";
  const escalation = input.safety.escalated
    ? " 안전 확인이 우선입니다."
    : "";
  return `${issue} 접수 건입니다. ${EVIDENCE_STATE_TEXT[input.evidenceState]}${escalation}`;
}

/**
 * Builds the authoritative review packet. Each rebuild is a new revision, so a
 * more-info round trip is visible to the reviewer rather than overwriting the
 * record silently.
 */
export function buildRepairPacket(input: RepairPacketInput): RepairPacket {
  const routingBasis = input.building.context.filter(
    (entry) => entry.verified && entry.routingEligible && entry.value !== null,
  );
  const informational = input.building.context.filter(
    (entry) => !routingBasis.includes(entry),
  );

  return {
    ticketId: input.ticket.id,
    revision: (input.ticket.repairPacket?.revision ?? 0) + 1,
    issueType: input.ticket.issueType,
    userReport: { rawText: input.ticket.rawUserText },
    structuredSymptoms: structuredSymptoms(input.ticket),
    contextSnapshot: {
      routingBasis: [...routingBasis],
      informational: [...informational],
    },
    evidenceState: input.evidenceState,
    evidence: [...input.ticket.evidence],
    safety: {
      flags: [...input.safety.flags],
      escalated: input.safety.escalated,
    },
    recommendation: input.recommendation,
    generatedSummary: { text: summaryText(input), source: "TEMPLATE" },
    createdAt: input.createdAt,
  };
}
