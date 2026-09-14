import { ApiErrorSchema } from "@build-manager/api-contracts";
import { ApiClientError } from "./errors";

/**
 * Minimal structural shapes compatible with both browser and React Native
 * fetch. Deliberately not an HTTP abstraction layer — just enough surface for
 * the calls this client makes.
 */
export type RequestInitLike = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type ResponseLike = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type FetchLike = (
  input: string,
  init?: RequestInitLike,
) => Promise<ResponseLike>;

/** Parsed by the caller's own schema; only `safeParse` is required here. */
type ResponseSchema<T> = {
  safeParse(value: unknown): { success: boolean; data?: unknown };
};

export type ApiRequest<T> = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  schema: ResponseSchema<T>;
};

const NETWORK_ERROR_MESSAGE = "API 요청을 전송하지 못했습니다.";
const HTTP_ERROR_MESSAGE = "API 요청이 실패했습니다.";
const INVALID_RESPONSE_MESSAGE = "API 응답 형식이 올바르지 않습니다.";

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Composes the request URL. An empty base URL yields a root-relative path for
 * browser same-origin use; it is not a claim that relative fetch resolves in
 * every server runtime.
 *
 * `new URL(path, "")` is avoided: it throws on an empty base.
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  const entries = Object.entries(query ?? {});
  const search = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  return `${normalizedBase}${path}${search.length > 0 ? `?${search}` : ""}`;
}

function readErrorEnvelope(
  rawBody: string,
  status: number,
): ApiClientError {
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return new ApiClientError("HTTP_ERROR", HTTP_ERROR_MESSAGE, { status });
  }

  const envelope = ApiErrorSchema.safeParse(parsedBody);
  if (!envelope.success) {
    return new ApiClientError("HTTP_ERROR", HTTP_ERROR_MESSAGE, { status });
  }

  // Copied field by field: the raw body never reaches the error object.
  return new ApiClientError(envelope.data.error.code, envelope.data.error.message, {
    status,
    requestId: envelope.data.error.requestId,
  });
}

export async function sendRequest<T>(
  fetchImpl: FetchLike,
  baseUrl: string,
  request: ApiRequest<T>,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInitLike = { method: request.method, headers };

  if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(request.body);
  }

  let response: ResponseLike;
  try {
    response = await fetchImpl(buildUrl(baseUrl, request.path, request.query), init);
  } catch {
    // The underlying error is dropped: it can name internal hosts.
    throw new ApiClientError("NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }

  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    throw response.ok
      ? new ApiClientError("INVALID_RESPONSE", INVALID_RESPONSE_MESSAGE, {
          status: response.status,
        })
      : new ApiClientError("HTTP_ERROR", HTTP_ERROR_MESSAGE, {
          status: response.status,
        });
  }

  if (!response.ok) {
    throw readErrorEnvelope(rawBody, response.status);
  }

  if (rawBody.trim().length === 0) {
    throw new ApiClientError("INVALID_RESPONSE", INVALID_RESPONSE_MESSAGE, {
      status: response.status,
    });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new ApiClientError("INVALID_RESPONSE", INVALID_RESPONSE_MESSAGE, {
      status: response.status,
    });
  }

  const validated = request.schema.safeParse(parsedBody);
  if (!validated.success) {
    // The failing value and the ZodError are both discarded on purpose.
    throw new ApiClientError("INVALID_RESPONSE", INVALID_RESPONSE_MESSAGE, {
      status: response.status,
    });
  }

  return validated.data as T;
}
