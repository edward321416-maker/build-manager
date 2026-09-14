/** P0 issue scope. No third protocol until the P0 acceptance gates pass. */
export type IssueType = "HEATING" | "LEAK";

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
