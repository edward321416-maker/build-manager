import { createHash,randomUUID } from "node:crypto";
import { B1Error,CoreFlowError,isApplicationError,performCoreAction,type CoreRecord,type CoreSession,type CoreAction } from "@build-manager/application";
import { CoreAccessSchema,CoreSessionSchema,CoreUnitsSchema,CoreTicketSchema,CoreTicketsSchema,CoreCreateSchema,CoreHandlingSchema,CoreLoginSchema,SubmitTenantAnswerRequestSchema,DecisionRequestSchema,FinalizeTicketRequestSchema } from "@build-manager/api-contracts";
import { presentTenantTicket,presentLandlordTicket } from "../http/presenters";
import { parseRouteCode } from "../http/route-code";
import { getCoreFlowContainer,type CoreHTTPDependencies } from "./container";
import { handlePhotoRequest,PhotoRequestError } from "./photos";
import { handleOnboarding } from "./onboarding";
import { CoreManagerWorkItemsSchema,CoreManagerWorkItemSchema,CoreManagerWorkUpdateSchema,CoreManagerInternalNotesSchema,CoreManagerInternalNoteSchema,CoreManagerInternalNoteCreateSchema } from "@build-manager/api-contracts";
import { sendCoreCommunication } from "@build-manager/application";
import { CoreCommunicationPageSchema,CoreCommunicationSendSchema,CorePublicMessageSchema,CoreCommunicationSummariesSchema } from "@build-manager/api-contracts";
import { confirmCoreResolved,createCoreFollowUp } from "@build-manager/application";
import { CoreTicketOutcomeSchema,CoreConfirmResolvedSchema,CoreCreateFollowUpSchema,CoreFollowUpResultSchema,CoreOutcomeReceiptSchema,CoreFollowUpSourceSchema } from "@build-manager/api-contracts";

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
  const headers=new Headers({"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer",Vary:"Cookie, Authorization, Origin, X-Core-Organization","X-Content-Type-Options":"nosniff"});
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
  try {
    const d=resolve(),origin=request.headers.get("origin"),bearer=request.headers.get("authorization");
    if(origin){if(!d.origins.includes(origin))fail("FORBIDDEN");headers.set("Access-Control-Allow-Origin",origin);headers.set("Access-Control-Allow-Credentials","true");}
    if(request.method==="OPTIONS"){
      if(!origin)fail("FORBIDDEN");headers.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");headers.set("Access-Control-Allow-Headers","Content-Type, Authorization, X-Upload-Id");return new Response(null,{status:204,headers});
    }
    if(!["GET","POST"].includes(request.method))return json({error:{code:"METHOD_NOT_ALLOWED",message:"허용하지 않는 요청입니다."}},405);
    if(request.method==="POST" && !origin && (!bearer||d.b1))fail("FORBIDDEN");
    const url=new URL(request.url),route=segments.join("/");
    if(segments[0]==="onboarding"){
      if(!d.b1)fail("UNAUTHENTICATED");
      const current=await d.b1.current(request);
      if(!d.b1.onboarding||!d.b1.inviteOrigin)fail("DEPENDENCY_UNAVAILABLE");
      return await handleOnboarding(request,segments.slice(1),current.digest,d.b1.onboarding,d.b1.inviteOrigin,headers);
    }
    const communicationPage=request.method==="GET"&&segments[0]==="tickets"&&segments.length===3&&segments[2]==="communication";
    const communicationSummaries=request.method==="GET"&&route==="communication-summaries";
    const positiveQuery=(name:string,max:number)=>{
      const values=url.searchParams.getAll(name);if(!values.length)return undefined;
      if(values.length!==1||!/^\d+$/.test(values[0])||!Number.isSafeInteger(Number(values[0]))||Number(values[0])<1||Number(values[0])>max)fail("INVALID_INPUT");return Number(values[0]);
    };
    let beforeSequence:number|undefined,limit=50;
    const summaryIds=url.searchParams.getAll("ticketId");
    if(communicationPage){
      if([...url.searchParams.keys()].some(k=>k!=="beforeSequence"&&k!=="limit"))fail("INVALID_INPUT");
      beforeSequence=positiveQuery("beforeSequence",Number.MAX_SAFE_INTEGER);limit=positiveQuery("limit",50)??50;
    }else if(communicationSummaries){
      if([...url.searchParams.keys()].some(k=>k!=="ticketId")||summaryIds.length>50||summaryIds.some(id=>!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)))fail("INVALID_INPUT");
    }else if([...url.searchParams.keys()].some(k=>k!=="unitId" || route!=="tickets" || request.method!=="GET") || url.searchParams.getAll("unitId").length>1)fail("INVALID_INPUT");
    let hash:string,port=d.port;
    if(d.b1){
      const current=await d.b1.current(request);
      if(route==="access"&&request.method==="GET")return json(CoreAccessSchema.parse({authentication:"B1",synthetic:true,csrf:current.csrf,organizations:await d.b1.access.organizations(current.digest)}));
      if(route==="login"||route==="logout")fail("NOT_FOUND");
      const org=request.headers.get("x-core-organization");
      if(!org||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(org))fail("INVALID_INPUT");
      hash=current.digest;port=d.b1.access.inOrganization(org);
      if(route==="organization"&&request.method==="POST"){
        parse(FinalizeTicketRequestSchema,await body(request));
        return await port.run(hash,s=>Promise.resolve(json(CoreSessionSchema.parse({role:s.session.role,synthetic:true}))));
      }
    }else {
    if(route==="login" && request.method==="POST"){
      const input=parse(CoreLoginSchema,await body(request));
      const session=await d.port.run(digest(input.accessCode),s=>Promise.resolve(s.session));
      headers.set("Set-Cookie",`${cookie}=${input.accessCode}; HttpOnly; SameSite=Strict; Path=/api/v2/core; Max-Age=3300${url.protocol==="https:"?"; Secure":""}`);
      return json(CoreSessionSchema.parse({role:session.role,synthetic:true}));
    }
    const raw=bearer ? (/^Bearer ([a-f0-9]{64})$/.exec(bearer)?.[1]??"") : (request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookie+"="))?.slice(cookie.length+1);
    if(!raw || !/^[a-f0-9]{64}$/.test(raw))fail("UNAUTHENTICATED");
    hash=digest(raw);
    }
    if(segments[0]==="tickets"&&segments[2]==="photos")return await handlePhotoRequest(request,segments,hash,port,headers);
    return await port.run(hash,async scope=>{
      if(communicationSummaries)return json(CoreCommunicationSummariesSchema.parse(await scope.communication.summaries(summaryIds)));
      if(segments[0]==="manager"){
        if(scope.session.role!=="ORG_ADMIN"&&scope.session.role!=="PROPERTY_STAFF")fail("FORBIDDEN");
        if(route==="manager/work-items"&&request.method==="GET")return json(CoreManagerWorkItemsSchema.parse(await scope.manager.list()));
        const id=segments[2];
        if(segments[1]!=="tickets"||segments.length!==4)fail("NOT_FOUND");
        if(!id||!/^[a-f0-9-]{36}$/.test(id))fail("INVALID_INPUT");
        if(segments[3]==="work"){
          if(request.method==="GET")return json(CoreManagerWorkItemSchema.parse(await scope.manager.read(id)));
          return json(CoreManagerWorkItemSchema.parse(await scope.manager.update(id,parse(CoreManagerWorkUpdateSchema,await body(request)))));
        }
        if(segments[3]==="internal-notes"){
          if(request.method==="GET")return json(CoreManagerInternalNotesSchema.parse(await scope.manager.notes(id)));
          const input=parse(CoreManagerInternalNoteCreateSchema,await body(request));
          return json(CoreManagerInternalNoteSchema.parse(await scope.manager.appendNote(id,input.body)),201);
        }
        fail("NOT_FOUND");
      }
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
      if(id&&segments[2]==="outcome"){
        if(segments.length===3&&request.method==="GET")return json(CoreTicketOutcomeSchema.parse(await scope.outcome.read(id)));
        if(segments.length===4&&segments[3]==="resolved"&&request.method==="POST"){
          const result=await confirmCoreResolved(scope,id,parse(CoreConfirmResolvedSchema,await body(request)));
          return json(CoreTicketOutcomeSchema.parse(result.outcome),result.created?201:200);
        }
        if(segments.length===5&&segments[3]==="requests"&&request.method==="GET"){
          const key=segments[4];if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key))fail("INVALID_INPUT");
          return json(CoreOutcomeReceiptSchema.parse(await scope.outcome.receipt(id,key)));
        }
        fail("NOT_FOUND");
      }
      if(id&&segments.length===3&&segments[2]==="follow-up"){
        if(request.method==="GET")return json(CoreFollowUpSourceSchema.parse(await scope.outcome.source(id)));
        const result=await createCoreFollowUp(scope,id,parse(CoreCreateFollowUpSchema,await body(request)));
        return json(CoreFollowUpResultSchema.parse({sourceOutcome:result.sourceOutcome,ticket:project(result.ticket,scope.session)}),result.created?201:200);
      }
      if(id&&segments[2]==="communication"){
        if(communicationPage)return json(CoreCommunicationPageSchema.parse(await scope.communication.read(id,beforeSequence,limit)));
        if(segments.length===4&&segments[3]==="messages"&&request.method==="POST"){
          const result=await sendCoreCommunication(scope,id,parse(CoreCommunicationSendSchema,await body(request)));
          return json(CorePublicMessageSchema.parse(result.message),result.created?201:200);
        }
        if(segments.length===5&&segments[3]==="requests"&&request.method==="GET"){
          const key=segments[4];if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key))fail("INVALID_INPUT");
          return json(CorePublicMessageSchema.parse(await scope.communication.receipt(id,key)));
        }
        fail("NOT_FOUND");
      }
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
    if(error instanceof PhotoRequestError)return json({error:{code:error.status===413?"PHOTO_TOO_LARGE":error.status===415?"PHOTO_UNSUPPORTED":"PHOTO_INVALID",message:error.status===413?"사진은 5 MiB 이하, 20메가픽셀 이하로 선택해 주세요.":error.status===415?"정상적인 JPEG 또는 PNG 사진만 첨부할 수 있습니다.":"사진 파일을 읽을 수 없습니다. 다른 샘플 사진을 선택해 주세요."}},error.status);
    const code=error instanceof CoreFlowError||error instanceof B1Error?error.code:isApplicationError(error)?error.code:"DEPENDENCY_UNAVAILABLE";
    const status=code==="UNAUTHENTICATED"?401:code==="FORBIDDEN"?403:code==="NOT_FOUND"?404:code==="INVALID_INPUT"?400:code==="STATE_CONFLICT"?409:503;
    return json({error:{code,message:status===503?"서비스에 연결하지 못했습니다.":status===409?"현재 상태에서 처리할 수 없습니다.":"접근 권한이나 입력을 확인해 주세요."}},status);
  }
}
