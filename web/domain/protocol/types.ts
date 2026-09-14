import type { BuildingContextKey } from "@/domain/building/types";
import type {
  EvidenceType,
  IssueType,
  RouteType,
  SafetyFlag,
} from "@/domain/ticket/types";

export type RuleField =
  | "issueType"
  | `context.${BuildingContextKey}`
  | "answer.gasSmell"
  | "answer.smokeOrFire"
  | "answer.electricalWaterRisk"
  | "answer.otherUrgentHazard"
  | "answer.heating.hotWater"
  | "answer.heating.allRooms"
  | "answer.heating.powerOn"
  | "answer.heating.errorCode"
  | "answer.heating.unitOnly"
  | "answer.heating.type"
  | "answer.leak.location"
  | "answer.leak.active"
  | "answer.leak.applianceOnly"
  | "answer.leak.firstObservedAt";

export type RuleExpression =
  | {
      op: "eq";
      field: RuleField;
      value: string | boolean | number;
    }
  | {
      op: "and";
      rules: RuleExpression[];
    }
  | {
      op: "or";
      rules: RuleExpression[];
    };

export type SafetyCheck = {
  id: string;
  flag: SafetyFlag;
  questionId: string;
  hardStop: true;
};

export type RouteRule = {
  id: string;
  when: RuleExpression;
  primary: RouteType;
  alternatives: RouteType[];
  rationaleTemplate: string;
};

export type QuestionType = "YES_NO" | "SINGLE_SELECT" | "SHORT_TEXT";

export type ProtocolQuestion = {
  id: string;
  prompt: string;
  type: QuestionType;
  choices?: { value: string; label: string }[];
  required: boolean;
  showWhen?: RuleExpression;
};

export type EvidenceRequirement = {
  type: EvidenceType;
  required: boolean;
  showWhen?: RuleExpression;
  instruction: string;
  why: string;
};

export type Protocol = {
  id: string;
  version: string;
  issueType: IssueType;
  match: RuleExpression;
  safetyChecks: SafetyCheck[];
  questions: ProtocolQuestion[];
  evidence: EvidenceRequirement[];
  routeRules: RouteRule[];
};
