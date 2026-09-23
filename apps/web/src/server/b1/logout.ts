import type { SessionData } from "@auth0/nextjs-auth0/types";
import type { IdentitySessionPort } from "@build-manager/application";
import { NextRequest,NextResponse } from "next/server";
import { timingSafeEqual } from 'node:crypto';
import { requireCurrentSession } from './session';
import { privateHeaders,toB1ErrorResponse } from './errors';
export async function executeB1Logout(request:NextRequest,session:SessionData|null,registry:Omit<IdentitySessionPort,'begin'>,provider:(request:NextRequest)=>Promise<NextResponse>,baseUrl:string){
 if(request.method!=='POST')return NextResponse.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:privateHeaders});
 if(request.headers.get('origin')!==baseUrl)return NextResponse.json({error:'FORBIDDEN'},{status:403,headers:privateHeaders});
 try{
  const current=await requireCurrentSession(session,registry),submitted=request.headers.get('x-b1-csrf');
  if(!submitted || !/^[a-f0-9]{64}$/.test(submitted) || !timingSafeEqual(Buffer.from(submitted),Buffer.from(current.csrf)))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers:privateHeaders});
  await registry.revoke(current.digest);
  const internal=new NextRequest(new URL('/auth/logout',baseUrl),{headers:{cookie:request.headers.get('cookie')??''}});
  const response=await provider(internal);
  if(response.status>=400)throw new Error('PROVIDER_LOGOUT_UNAVAILABLE');
  const result=new NextResponse(response.body,{status:response.status===307?303:response.status,headers:response.headers});
  for(const [name,value] of Object.entries(privateHeaders))result.headers.set(name,value);
  return result;
 }catch(error){return toB1ErrorResponse(error);}
}
