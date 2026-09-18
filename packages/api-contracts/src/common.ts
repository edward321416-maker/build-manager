import { z } from "zod";

export const IssueTypeSchema = z.enum(["HEATING", "LEAK"]);
export type IssueType = z.infer<typeof IssueTypeSchema>;

export const ProtocolSchema = z.enum(["HEATING_V1", "LEAK_V1"]);
export type Protocol = z.infer<typeof ProtocolSchema>;

/**
 * The closed P0 route vocabulary, mirroring the domain's `RouteType` without
 * importing it. Public `routeCode` is never an arbitrary string: a landlord may
 * record a manual route, but only one of these.
 *
 * A server-side parity test keeps this list and the domain list compatible.
 */
export const RouteCodeSchema = z.enum([
  "LANDLORD_REVIEW",
  "MANAGEMENT_OFFICE",
  "THIRD_PARTY_MANAGER",
  "MANUFACTURER_AS",
  "GENERAL_VENDOR",
]);
export type RouteCode = z.infer<typeof RouteCodeSchema>;

export const TicketStatusSchema = z.enum([
  "IN_PROGRESS",
  "PARTIAL",
  "READY_FOR_REVIEW",
  "NEEDS_MORE_INFO",
  "SAFETY_ESCALATED",
  "APPROVED",
  "OVERRIDDEN",
]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const EvidenceStatusSchema = z.enum([
  "COMPLETE",
  "MISSING_REQUIRED",
  "CONFLICTING",
  "SAFETY_ESCALATED",
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
