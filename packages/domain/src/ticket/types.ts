/** P0 issue scope. No third protocol until the P0 acceptance gates pass. */
export type IssueType = "HEATING" | "LEAK";

export type EvidenceType =
  | "CONTROL_PANEL_PHOTO"
  | "LEAK_AREA_PHOTO"
  | "FIXTURE_PHOTO"
  | "GENERAL_PHOTO";

export type RouteType =
  | "LANDLORD_REVIEW"
  | "MANAGEMENT_OFFICE"
  | "THIRD_PARTY_MANAGER"
  | "MANUFACTURER_AS"
  | "GENERAL_VENDOR";
