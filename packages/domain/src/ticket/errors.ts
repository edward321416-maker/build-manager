/**
 * Raised when a ticket transition is refused because the ticket is not in a
 * state that allows it.
 *
 * It exists so callers can distinguish a refused transition from an unexpected
 * failure without matching human-readable message text. The messages stay
 * exactly as they were; only the type is now recognisable.
 */
export class TicketStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketStateError";
  }
}

export function isTicketStateError(value: unknown): value is TicketStateError {
  return value instanceof TicketStateError;
}
