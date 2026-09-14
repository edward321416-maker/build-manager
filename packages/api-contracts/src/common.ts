import { z } from "zod";

export const IssueTypeSchema = z.enum(["HEATING", "LEAK"]);
export type IssueType = z.infer<typeof IssueTypeSchema>;

export const ProtocolSchema = z.enum(["HEATING_V1", "LEAK_V1"]);
export type Protocol = z.infer<typeof ProtocolSchema>;

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
