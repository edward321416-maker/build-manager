import { ApiErrorSchema } from "@build-manager/api-contracts";
import { classifyError, invalidRequest, unsupportedMediaType } from "./errors";

/**
 * Every API response is uncacheable: all P0 state is mutable demo state, and
 * relying on framework defaults would leave that to configuration.
 */
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export function errorResponse(error: unknown): Response {
  const outcome = classifyError(error);

  return jsonResponse(
    ApiErrorSchema.parse({
      error: { code: outcome.code, message: outcome.message },
    }),
    outcome.status,
  );
}

/** Accepts `application/json` with any parameters, such as a charset. */
function hasJsonContentType(request: Request): boolean {
  const header = request.headers.get("content-type");
  if (header === null) {
    return false;
  }
  const mediaType = header.split(";")[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

/**
 * Reads a JSON body as `unknown`. The caller validates it against the public
 * request contract; nothing here trusts the shape.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (!hasJsonContentType(request)) {
    throw unsupportedMediaType();
  }

  const raw = await request.text();
  if (raw.trim().length === 0) {
    throw invalidRequest();
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw invalidRequest();
  }
}

type SafeParseResult<T> = { success: true; data: T } | { success: false };

type RequestSchema<T> = {
  safeParse(value: unknown): SafeParseResult<T>;
};

/** A schema failure is a client mistake; the issues never leave the server. */
export function parseRequest<T>(schema: RequestSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw invalidRequest();
  }
  return parsed.data;
}

type ResponseSchema<T> = {
  parse(value: unknown): T;
};

/**
 * Validates the server's own output against its public contract before
 * sending. A violation is an internal fault, not a client one, so the thrown
 * error is left to the caller's error mapping and becomes a 500.
 */
export function validateResponse<T>(schema: ResponseSchema<T>, value: unknown): T {
  return schema.parse(value);
}
