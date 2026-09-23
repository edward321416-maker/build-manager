import { NextRequest,NextResponse } from "next/server";
import { getB1Auth0 } from "./server/b1/auth0";
import { authRequestStatus } from "./server/b1/auth-transport";
import { parseApplicationMode } from "./runtime/application-mode";
export async function proxy(request:NextRequest){
  const mode=parseApplicationMode(process.env.BUILD_MANAGER_MODE);
  if(mode==='DEMO') return NextResponse.next();
  if(mode!=='B1') return NextResponse.json({error:"CONFIGURATION_UNAVAILABLE"},{status:503});
  const status=authRequestStatus(request.nextUrl.pathname,request.method,request.nextUrl.searchParams);
  if(status) return NextResponse.json({error:"AUTH_REQUEST_REJECTED"},{status,headers:{"Cache-Control":"private, no-store"}});
  try {return await getB1Auth0().middleware(request);}
  catch {return NextResponse.json({error:"AUTHENTICATION_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"private, no-store"}});}
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"]};
