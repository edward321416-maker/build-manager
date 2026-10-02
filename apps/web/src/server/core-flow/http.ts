import { createHash,randomUUID } from "node:crypto";
import { CoreFlowError,isApplicationError,performCoreAction,type CoreRecord,type CoreSession,type CoreAction } from "@build-manager/application";
import { CoreSessionSchema,CoreUnitsSchema,CoreTicketSchema,CoreTicketsSchema,CoreCreateSchema,CoreHandlingSchema,CoreLoginSchema,SubmitTenantAnswerRequestSchema,DecisionRequestSchema,FinalizeTicketRequestSchema } from "@build-manager/api-contracts";
import { presentTenantTicket,presentLandlordTicket } from "../http/presenters";
import { parseRouteCode } from "../http/route-code";
import { getCoreFlowContainer,type CoreHTTPDependencies } from "./container";

const cookie="rc1_session";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
function fail(code:CoreFlowError["code"]):never {throw new CoreFlowError(code);}
function project(record:CoreRecord,session:CoreSession){
  return CoreTicketSchema.parse({ticketId:record.ticket.id,unitId:record.ticket.unitId,buildingId:record.ticket.buildingId,
    workStatus:record.workStatus,version:record.version,events:record.events,
    detail:session.role==="TENANT"?presentTenantTicket(record.ticket,record.building):presentLandlordTicket(record.ticket,record.building)});
}
async function body(request:Request):Promise<unknown>{
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")fail("INVALID_INPUT");
  const reader=request.body?.getReader();if(!reader)fail("INVALID_INPUT");
  let text="",size=0;const decoder=new TextDecoder();
  try {for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>16_384){await reader.cancel();fail("INVALID_INPUT");}text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
  catch{fail("INVALID_INPUT");}finally{reader.releaseLock();}
}
function parse<T>(schema:{safeParse(v:unknown):{success:boolean;data?:T}},value:unknown):T {
  const result=schema.safeParse(value);if(!result.success)fail("INVALID_INPUT");return result.data as T;
}

export async function handleCoreFlow(request:Request,segments:string[],resolve:()=>CoreHTTPDependencies=getCoreFlowContainer):Promise<Response>{
  const headers=new Headers({"Cache-Control":"private, no-store",Vary:"Cookie, Authorization, Origin","X-Content-Type-Options":"nosniff"});
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
  try {
    const d=resolve(),origin=request.headers.get("origin"),bearer=request.headers.get("authorization");
    if(origin){if(!d.origins.includes(origin))fail("FORBIDDEN");headers.set("Access-Control-Allow-Origin",origin);headers.set("Access-Control-Allow-Credentials","true");}
    if(request.method==="OPTIONS"){
      if(!origin)fail("FORBIDDEN");headers.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");headers.set("Access-Control-Allow-Headers","Content-Type, Authorization");return new Response(null,{status:204,headers});
    }
    if(!["GET","POST"].includes(request.method))return json({error:{code:"METHOD_NOT_ALLOWED",message:"허용하지 않는 요청입니다."}},405);
    if(request.method==="POST" && !origin && !bearer)fail("FORBIDDEN");
    const url=new URL(request.url),route=segments.join("/");
    if([...url.searchParams.keys()].some(k=>k!=="unitId" || route!=="tickets" || request.method!=="GET") || url.searchParams.getAll("unitId").length>1)fail("INVALID_INPUT");
    if(route==="login" && request.method==="POST"){
      const input=parse(CoreLoginSchema,await body(request));
      const session=await d.port.run(digest(input.accessCode),s=>Promise.resolve(s.session));
      headers.set("Set-Cookie",`${cookie}=${input.accessCode}; HttpOnly; SameSite=Strict; Path=/api/v2/core; Max-Age=3300${url.protocol==="https:"?"; Secure":""}`);
      return json(CoreSessionSchema.parse({role:session.role,synthetic:true}));
    }
    const raw=bearer ? (/^Bearer ([a-f0-9]{64})$/.exec(bearer)?.[1]??"") : (request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookie+"="))?.slice(cookie.length+1);
    if(!raw || !/^[a-f0-9]{64}$/.test(raw))fail("UNAUTHENTICATED");
    const hash=digest(raw);
    return await d.port.run(hash,async scope=>{
      if(route==="session" && request.method==="GET")return json(CoreSessionSchema.parse({role:scope.session.role,synthetic:true}));
      if(route==="logout" && request.method==="POST"){
        parse(FinalizeTicketRequestSchema,await body(request));await d.revoke(hash);
        headers.set("Set-Cookie",`${cookie}=; HttpOnly; SameSite=Strict; Path=/api/v2/core; Max-Age=0`);
        return json({role:scope.session.role,synthetic:true});
      }
      if(route==="units" && request.method==="GET")return json(CoreUnitsSchema.parse(await scope.units()));
      if(route==="tickets" && request.method==="GET"){
        const unit=url.searchParams.get("unitId")??undefined;if(unit && !/^[a-f0-9-]{36}$/.test(unit))fail("INVALID_INPUT");
        return json(CoreTicketsSchema.parse((await scope.list(unit)).map(t=>project(t,scope.session))));
      }
      if(segments[0]!=="tickets")fail("NOT_FOUND");
      const id=segments[1];if(id && !/^[a-f0-9-]{36}$/.test(id))fail("INVALID_INPUT");
      if(id && segments.length===2 && request.method==="GET")return json(project(await scope.read(id),scope.session));
      if(request.method!=="POST")fail("NOT_FOUND");
      let action:CoreAction;
      if(segments.length===1){const input=parse(CoreCreateSchema,await body(request));action={type:"CREATE",...input};}
      else if(id && segments.length===3){
        const input=await body(request);
        switch(segments[2]){
          case "answers":{const a=parse(SubmitTenantAnswerRequestSchema,input);action={type:"ANSWER",ticketId:id,questionId:a.questionId,value:a.answer};break;}
          case "finalize":parse(FinalizeTicketRequestSchema,input);action={type:"FINALIZE",ticketId:id};break;
          case "handling":action={type:"HANDLING",ticketId:id,...parse(CoreHandlingSchema,input)};break;
          case "decision":{
            const a=parse(DecisionRequestSchema,input);
            if(a.type==="APPROVE")action={type:"APPROVE",ticketId:id};
            else if(a.type==="OVERRIDE"){const route=parseRouteCode(a.routeCode);if(!route)fail("INVALID_INPUT");action={type:"OVERRIDE",ticketId:id,route,reason:a.reason};}
            else {if(a.requestedEvidenceTypes?.length)fail("INVALID_INPUT");action={type:"MORE_INFO",ticketId:id,reason:a.reason,requestedQuestionIds:a.requestedQuestionIds??[]};}break;
          }
          default:fail("NOT_FOUND");
        }
      }else return fail("NOT_FOUND");
      const result=await performCoreAction(scope,action,{now:()=>new Date().toISOString()},{next:()=>randomUUID()});
      return json(project(result,scope.session),action.type==="CREATE"?201:200);
    });
  }catch(error){
    const code=error instanceof CoreFlowError?error.code:isApplicationError(error)?error.code:"DEPENDENCY_UNAVAILABLE";
    const status=code==="UNAUTHENTICATED"?401:code==="FORBIDDEN"?403:code==="NOT_FOUND"?404:code==="INVALID_INPUT"?400:code==="STATE_CONFLICT"?409:503;
    return json({error:{code,message:status===503?"서비스에 연결하지 못했습니다.":status===409?"현재 상태에서 처리할 수 없습니다.":"접근 권한이나 입력을 확인해 주세요."}},status);
  }
}
