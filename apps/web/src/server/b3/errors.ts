import { B1Error, B3Error, type B3ErrorCode } from "@build-manager/application";
import { NextResponse } from "next/server";
import { privateHeaders } from "../b1/errors";

const statusByCode: Record<B3ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  DEPENDENCY_UNAVAILABLE: 503,
  METHOD_NOT_ALLOWED: 405,
};

export function toB3ErrorResponse(error: unknown): NextResponse {
  let code: B3ErrorCode = "DEPENDENCY_UNAVAILABLE";
  if (error instanceof B3Error) code = error.code;
  else if (error instanceof B1Error) {
    code = error.code === "AUTHENTICATION_REJECTED" ? "UNAUTHENTICATED"
      : error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN" ||
        error.code === "NOT_FOUND" || error.code === "INVALID_INPUT" ||
        error.code === "DEPENDENCY_UNAVAILABLE"
        ? error.code
        : "DEPENDENCY_UNAVAILABLE";
  }
  return NextResponse.json({ error: code }, { status: statusByCode[code], headers: privateHeaders });
}
