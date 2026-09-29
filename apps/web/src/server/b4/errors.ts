import { B1Error, B4Error, type B4ErrorCode } from "@build-manager/application";
import { NextResponse } from "next/server";
import { privateHeaders } from "../b1/errors";

const status: Record<B4ErrorCode,number> = {
  UNAUTHENTICATED: 401,FORBIDDEN: 403,NOT_FOUND: 404,INVALID_INPUT: 400,
  PAYLOAD_TOO_LARGE: 413,DEPENDENCY_UNAVAILABLE: 503,METHOD_NOT_ALLOWED: 405,
};
export function toB4ErrorResponse(error: unknown): NextResponse {
  let code: B4ErrorCode = "DEPENDENCY_UNAVAILABLE";
  if (error instanceof B4Error) code = error.code;
  else if (error instanceof B1Error) {
    if (error.code === "AUTHENTICATION_REJECTED") code = "UNAUTHENTICATED";
    else if (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN" || error.code === "NOT_FOUND" || error.code === "INVALID_INPUT") code = error.code;
  }
  return NextResponse.json({ error: code },{ status: status[code],headers: {
    ...privateHeaders,...(code === "METHOD_NOT_ALLOWED" ? { Allow: "GET, PUT, DELETE" } : {}),
  } });
}
