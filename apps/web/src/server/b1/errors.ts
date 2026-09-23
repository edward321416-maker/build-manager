import { B1Error } from '@build-manager/application';
import { NextResponse } from 'next/server';
export const privateHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
export function toB1ErrorResponse(error:unknown){
 const code=error instanceof B1Error?error.code:'DEPENDENCY_UNAVAILABLE';
 const status={UNAUTHENTICATED:401,AUTHENTICATION_REJECTED:401,FORBIDDEN:403,NOT_FOUND:404,INVALID_INPUT:400,DEPENDENCY_UNAVAILABLE:503}[code];
 return NextResponse.json({error:code},{status,headers:privateHeaders});
}
