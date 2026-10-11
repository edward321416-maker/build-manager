import type { TenantTicketStatusDto } from "@build-manager/api-contracts";

/**
 * What the intake's evidence stage shows on /core (P1b, spec D5 and D6):
 * - STEP: a request that was never sent picks its photos;
 * - SENT: a request already sent without its photos stays as sent and only says so;
 * - SUBMIT: a sent request that was reopened another way gets the intake's own "수리 요청 제출" again.
 * A repair packet exists exactly when the request was submitted at least once, so the intake's own ticket decides at
 * once; `sentOnRecord` (a FINALIZED event on the screen's copy) covers the rest.
 */
export function evidenceStage(ticket: Pick<TenantTicketStatusDto, "packet" | "status">, sentOnRecord: boolean): "STEP" | "SENT" | "SUBMIT" {
  if (!sentOnRecord && ticket.packet === null) return "STEP";
  return ticket.status === "PARTIAL" ? "SENT" : "SUBMIT";
}
