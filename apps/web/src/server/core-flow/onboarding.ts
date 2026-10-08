import { createHash,randomBytes } from "node:crypto";
import type { CoreOnboardingPort,OnboardingAction } from "@build-manager/application";
import { CreateInvitationSchema,TokenInvitationSchema,InvitationDecisionSchema,InvitationSchema,InvitationPageSchema,InviteUnitsPageSchema } from "@build-manager/api-contracts";

/** Configured server origin only. Synthetic manager and live B1 may use different registered loopback origins. */
export function invitationOrigin(env:Record<string,string|undefined>=process.env):string {
 const raw=env.CORE_INVITE_APP_ORIGIN??env.B1_APP_BASE_URL;
 if(!raw)throw new Error("INVITATION_ORIGIN_REQUIRED");
 const url=new URL(raw);
 const local=url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 if(!(local||url.protocol==="https:")||url.origin!==raw||url.username||url.password)throw new Error("INVITATION_ORIGIN_INVALID");
 // An override must be an explicitly configured approved origin, never inferred from request headers.
 return url.origin;
}
const statuses={UNAUTHENTICATED:401,FORBIDDEN:403,NOT_FOUND:404,INVALID_INPUT:400,STATE_CONFLICT:409,RATE_LIMITED:429,DEPENDENCY_UNAVAILABLE:503} as const;
export async function handleOnboarding(request:Request,parts:string[],digest:string,port:CoreOnboardingPort,origin:()=>string,headers:Headers):Promise<Response>{
 headers.set("Referrer-Policy","no-referrer");
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
 const fail=(code:keyof typeof statuses)=>json({error:{code,message:code==="RATE_LIMITED"?"시도가 많습니다. 60초 뒤 상태를 확인해 주세요.":code==="STATE_CONFLICT"?"초대 또는 호실 상태가 변경되었습니다. 먼저 현재 상태를 확인해 주세요.":code==="UNAUTHENTICATED"?"다시 로그인한 뒤 원래 초대 링크를 열어 주세요.":code==="DEPENDENCY_UNAVAILABLE"?"응답을 확인하지 못했습니다. 다시 전송하기 전에 현재 상태를 확인해 주세요.":"초대 권한이나 입력을 확인해 주세요."}},statuses[code]);
 try{
  const route=parts.join("/"),url=new URL(request.url),get=request.method==="GET";
  const actions:Record<string,OnboardingAction>=get?{mine:"MINE",invitations:"LIST",units:"UNITS"}:{create:"CREATE",inspect:"INSPECT",claim:"CLAIM",approve:"APPROVE",reject:"REJECT",revoke:"REVOKE"};
  const action:OnboardingAction|undefined=Object.hasOwn(actions,route)?actions[route]:undefined;
  if(!action)return fail("NOT_FOUND");
  if([...url.searchParams.keys()].some(k=>!get||k!=="cursor")||url.searchParams.getAll("cursor").length>1)return fail("INVALID_INPUT");
  const cursor=url.searchParams.get("cursor"),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if(cursor!==null&&!uuid.test(cursor))return fail("INVALID_INPUT");
  const actorOnly=["MINE","INSPECT","CLAIM"].includes(action),org=actorOnly?null:request.headers.get("x-core-organization");
  if(!actorOnly&&(!org||!uuid.test(org)))return fail("INVALID_INPUT");
  let input:Record<string,unknown>=cursor?{cursor}:{},link:string|undefined;
  if(!get){
   if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")return fail("INVALID_INPUT");
   const reader=request.body?.getReader();if(!reader)return fail("INVALID_INPUT");
   let size=0,text="";const decoder=new TextDecoder();
   try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>4096){await reader.cancel();return fail("INVALID_INPUT");}text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();}
   finally{reader.releaseLock();}
   let body:unknown;try{body=JSON.parse(text);}catch{return fail("INVALID_INPUT");}
   if(action==="CREATE"){
    const parsed=CreateInvitationSchema.safeParse(body);if(!parsed.success)return fail("INVALID_INPUT");
    const target=origin(),token=randomBytes(32).toString("hex");
    input={unitId:parsed.data.unitId,tokenDigest:createHash("sha256").update(token).digest("hex")};link=`${target}/core/join#${token}`;
   }else if(action==="INSPECT"||action==="CLAIM"){
    const parsed=TokenInvitationSchema.safeParse(body);if(!parsed.success)return fail("INVALID_INPUT");
    input={tokenDigest:createHash("sha256").update(parsed.data.token).digest("hex")};
   }else{
    const parsed=InvitationDecisionSchema.safeParse(body);if(!parsed.success)return fail("INVALID_INPUT");input=parsed.data;
   }
  }
  const result=await port.execute(digest,action,org,input);
  if("code" in result)return fail(result.code);
  const data=(action==="MINE"||action==="LIST"?InvitationPageSchema:action==="UNITS"?InviteUnitsPageSchema:InvitationSchema).parse(result.data);
  return json(action==="CREATE"?{invitation:data,link}:data,action==="CREATE"?201:200);
 }catch{return fail("DEPENDENCY_UNAVAILABLE");}
}
