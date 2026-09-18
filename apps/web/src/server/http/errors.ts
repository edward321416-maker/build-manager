import { isApplicationError } from "@build-manager/application";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "STATE_CONFLICT"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
};

/**
 * Fixed public wording per code.
 *
 * Nothing internal is ever echoed back: not an Error message, not a Zod issue,
 * not a SQL string, not a filesystem path, not a tenant answer. The server logs
 * nothing of the payload either, so a caller sees only which category of
 * failure occurred.
 */
const MESSAGE_BY_CODE: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: "요청을 확인해 주세요.",
  NOT_FOUND: "요청한 리소스를 찾을 수 없습니다.",
  STATE_CONFLICT: "현재 상태에서는 처리할 수 없는 요청입니다.",
  UNSUPPORTED_MEDIA_TYPE: "지원하지 않는 요청 형식입니다.",
  INTERNAL_ERROR: "오류가 발생했습니다.",
};

export class HttpError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode) {
    super(MESSAGE_BY_CODE[code]);
    this.name = "HttpError";
    this.code = code;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export const invalidRequest = (): HttpError => new HttpError("INVALID_REQUEST");
export const notFound = (): HttpError => new HttpError("NOT_FOUND");
export const unsupportedMediaType = (): HttpError =>
  new HttpError("UNSUPPORTED_MEDIA_TYPE");

export type ApiErrorOutcome = {
  status: number;
  code: ApiErrorCode;
  message: string;
};

/**
 * Classifies a failure by type, never by matching message text.
 *
 * Anything unrecognised is an internal error: an unexpected failure is never
 * reported as a client mistake.
 */
export function classifyError(error: unknown): ApiErrorOutcome {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      code: error.code,
      message: MESSAGE_BY_CODE[error.code],
    };
  }

  if (isApplicationError(error)) {
    const code: ApiErrorCode =
      error.code === "NOT_FOUND" ? "NOT_FOUND" : "STATE_CONFLICT";
    return {
      status: STATUS_BY_CODE[code],
      code,
      message: MESSAGE_BY_CODE[code],
    };
  }

  return {
    status: STATUS_BY_CODE.INTERNAL_ERROR,
    code: "INTERNAL_ERROR",
    message: MESSAGE_BY_CODE.INTERNAL_ERROR,
  };
}
