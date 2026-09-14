import { isTicketStateError } from "@build-manager/domain";

/**
 * Machine-readable outcomes the HTTP layer must be able to distinguish.
 *
 * These exist so a caller never has to classify a failure by matching
 * human-readable message text, which breaks the moment wording changes.
 */
export type ApplicationErrorCode = "NOT_FOUND" | "STATE_CONFLICT";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode, message: string) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
  }
}

export function isApplicationError(value: unknown): value is ApplicationError {
  return value instanceof ApplicationError;
}

export function notFound(message: string): ApplicationError {
  return new ApplicationError("NOT_FOUND", message);
}

export function stateConflict(message: string): ApplicationError {
  return new ApplicationError("STATE_CONFLICT", message);
}

/**
 * Runs a domain transition and re-tags only a refused transition.
 *
 * Anything else — a bug, a failing adapter — propagates untouched, so an
 * unexpected failure is never disguised as a state conflict the caller would
 * report as a 409.
 */
export function asStateTransition<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (isTicketStateError(error)) {
      throw stateConflict(error.message);
    }
    throw error;
  }
}
