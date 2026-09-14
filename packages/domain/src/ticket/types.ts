import type { ContextSourceType, ContextValue } from "../building/types";
import type { SafetyFlag } from "../safety/evaluate-safety";

/** P0 issue scope. No third protocol until the P0 acceptance gates pass. */
export type IssueType = "HEATING" | "LEAK";

export type TicketStatus =
  | "IN_PROGRESS"
  | "PARTIAL"
  | "READY_FOR_REVIEW"
  | "NEEDS_MORE_INFO"
  | "SAFETY_ESCALATED"
  | "APPROVED"
  | "OVERRIDDEN";

export type AnswerValue = string | boolean | string[] | null;

export type Answer = {
  questionId: string;
  value: AnswerValue;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceType =
  | "CONTROL_PANEL_PHOTO"
  | "LEAK_AREA_PHOTO"
  | "FIXTURE_PHOTO"
  | "GENERAL_PHOTO";

export type Evidence = {
  id: string;
  type: EvidenceType;
  storageRef?: string | null;
  fixtureRef?: string | null;
  source: "TENANT_UPLOAD" | "DEMO_FIXTURE";
  createdAt: string;
};

export type EvidenceState =
  | "COMPLETE"
  | "MISSING_REQUIRED"
  | "CONFLICTING"
  | "SAFETY_ESCALATED";

export type RouteType =
  | "LANDLORD_REVIEW"
  | "MANAGEMENT_OFFICE"
  | "THIRD_PARTY_MANAGER"
  | "MANUFACTURER_AS"
  | "GENERAL_VENDOR";

export type RationaleItem = {
  contextKey?: string;
  protocolRuleId: string;
  explanation: string;
  sourceType?: ContextSourceType;
};

/**
 * A system recommendation is always a proposal for a human, never a dispatch.
 */
export type RouteRecommendation = {
  primary: RouteType;
  alternatives: RouteType[];
  rationale: RationaleItem[];
  humanReviewRequired: true;
};

export type RouteDecision =
  | {
      action: "APPROVE_RECOMMENDATION";
      recommendedRoute: RouteType;
      selectedRoute: RouteType;
      actor: "LANDLORD";
      decidedAt: string;
    }
  | {
      action: "OVERRIDE_ROUTE";
      recommendedRoute: RouteType | null;
      selectedRoute: RouteType;
      reason?: string | null;
      actor: "LANDLORD";
      decidedAt: string;
    };

export type MoreInfoRequest = {
  action: "REQUEST_MORE_INFO";
  reason: string;
  requestedQuestionIds?: string[];
  requestedEvidenceTypes?: EvidenceType[];
  actor: "LANDLORD";
  requestedAt: string;
};

export type RepairPacket = {
  ticketId: string;
  revision: number;
  issueType: IssueType;
  userReport: { rawText: string };
  structuredSymptoms: Record<string, unknown>;
  contextSnapshot: {
    routingBasis: ContextValue<unknown>[];
    informational: ContextValue<unknown>[];
  };
  evidenceState: EvidenceState;
  evidence: Evidence[];
  safety: {
    flags: SafetyFlag[];
    escalated: boolean;
  };
  recommendation: RouteRecommendation | null;
  generatedSummary: {
    text: string;
    source: "TEMPLATE" | "LLM";
  };
  createdAt: string;
};

export type Ticket = {
  id: string;
  buildingId: string;
  unitId: string;
  issueType: IssueType;
  rawUserText: string;
  status: TicketStatus;
  protocolId: string | null;
  answers: Answer[];
  evidence: Evidence[];
  safetyFlags: SafetyFlag[];
  repairPacket?: RepairPacket | null;
  routeDecision?: RouteDecision | null;
  moreInfoRequest?: MoreInfoRequest | null;
  createdAt: string;
  updatedAt: string;
};
