import type { Ticket } from "@build-manager/domain";
import type { ApplicationDependencies, TicketListFilter } from "../ports";

/**
 * Minimal repository read. Role-specific DTO mapping belongs to the API layer,
 * not here.
 */
export async function listTickets(
  deps: ApplicationDependencies,
  filter: TicketListFilter,
): Promise<Ticket[]> {
  return deps.tickets.list(filter);
}
