import { B1Error, B5Error, type B5ErrorCode } from "@build-manager/application";
import { NextResponse } from "next/server";
import { privateHeaders } from "../b1/errors";
const status: Record<B5ErrorCode,number> = {
  UNAUTHENTICATED:401, FORBIDDEN:403, NOT_FOUND:404, INVALID_INPUT:400, CONFLICT:409,
  PAYLOAD_TOO_LARGE:413, DEPENDENCY_UNAVAILABLE:503, METHOD_NOT_ALLOWED:405,
};
export function toB5ErrorResponse(error: unknown): NextResponse {
  let code: B5ErrorCode="DEPENDENCY_UNAVAILABLE";
  if(error instanceof B5Error) code=error.code;
  else if(error instanceof B1Error) {
    if(error.code==="AUTHENTICATION_REJECTED") code="UNAUTHENTICATED";
    else if(error.code==="UNAUTHENTICATED"||error.code==="FORBIDDEN"||error.code==="NOT_FOUND"||error.code==="INVALID_INPUT") code=error.code;
  }
  return NextResponse.json({error:code},{status:status[code],headers:{...privateHeaders,...(code==="METHOD_NOT_ALLOWED"?{Allow:"DELETE"}:{})}});
}
