import type { Ticket } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";

export type GetTicketInput = {
  ticketId: string;
};

/**
 * Minimal repository read. Returns null rather than throwing so callers can
 * map a missing ticket to their own not-found response.
 */
export async function getTicket(
  deps: ApplicationDependencies,
  input: GetTicketInput,
): Promise<Ticket | null> {
  return deps.tickets.findById(input.ticketId);
}
