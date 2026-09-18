import { invalidRequest } from "../errors";
import { errorResponse } from "../json";

export type TicketView = "landlord" | "tenant";

/**
 * Single funnel for handler failures, so no handler can accidentally return a
 * raw error or an unsanitised body.
 */
export async function respond(
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * `view` selects a response projection. It is not authentication and not
 * authorization; all P0 data is synthetic.
 *
 * Exactly one valid value is required — missing, repeated, and unknown are all
 * client mistakes rather than something to guess a default for.
 */
export function requireTicketView(url: URL): TicketView {
  const values = url.searchParams.getAll("view");
  if (values.length !== 1) {
    throw invalidRequest();
  }

  const value = values[0];
  if (value !== "landlord" && value !== "tenant") {
    throw invalidRequest();
  }
  return value;
}

/** Requires exactly one non-blank occurrence of a query parameter. */
export function requireSingleQueryValue(url: URL, name: string): string {
  const values = url.searchParams.getAll(name);
  if (values.length !== 1) {
    throw invalidRequest();
  }
  return values[0]!;
}
