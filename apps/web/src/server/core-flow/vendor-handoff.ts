import { VendorHandoffError, type VendorHandoffManagerPort, type VendorHandoffTenantPort } from "@build-manager/application";
import { ManagerVendorHandoffDtoSchema, VendorCreateAssignmentCommandSchema, VendorPublishPacketCommandSchema, VendorIssueLinkCommandSchema, VendorReissueLinkCommandSchema, VendorRevokeCommandSchema, VendorLinkIssueDtoSchema,
  VendorManagerRescheduleCommandSchema, VendorAvailabilityCommandSchema, VendorEntryAuthorizationCommandSchema, VendorConfirmSlotCommandSchema, VendorTenantRescheduleCommandSchema, VendorTenantSchedulingDtoSchema, VendorCompletionPhotoDtoSchema } from "@build-manager/api-contracts";

export function isManagerVendorHandoffRoute(segments:string[]):boolean{
  return segments[0]==="manager"&&((segments[1]==="tickets"&&["vendor-handoff","vendor-assignment","vendor-completion-photos"].includes(segments[3]))||segments[1]==="vendor-assignments");
}
async function readBody(request:Request):Promise<unknown>{
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")throw new VendorHandoffError("INVALID_INPUT");
  const reader=request.body?.getReader();if(!reader)throw new VendorHandoffError("INVALID_INPUT");
  let size=0,text="";const decoder=new TextDecoder();
  try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>16_384){await reader.cancel();throw new VendorHandoffError("INVALID_INPUT");}text+=decoder.decode(next.value,{stream:true});}return JSON.parse(text+decoder.decode());}
  catch{throw new VendorHandoffError("INVALID_INPUT");}finally{reader.releaseLock();}
}
function parse<T>(schema:{safeParse(value:unknown):{success:boolean;data?:T}},value:unknown):T{
  const parsed=schema.safeParse(value);if(!parsed.success)throw new VendorHandoffError("INVALID_INPUT");return parsed.data as T;
}
/** Authentication/Origin/CSRF/organization selection remain owned by Core HTTP. */
export async function handleManagerVendorHandoff(request:Request,segments:string[],digest:string,port:VendorHandoffManagerPort|undefined,headers:Headers):Promise<Response>{
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
  try{
    const id=segments[2];
    if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw new VendorHandoffError("INVALID_INPUT");
    const route=segments.slice(3).join("/");
    if(!port)throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    // Manager review of ATTACHED report photos only; persistence returns the same NOT_FOUND for every other id.
    if(segments[1]==="tickets"&&segments[3]==="vendor-completion-photos"){
      const photoId=segments[4];
      if(segments.length!==5||request.method!=="GET"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(photoId))throw new VendorHandoffError("NOT_FOUND");
      const {photo,bytes}=await port.completionPhoto(digest,id,photoId);
      const safe=VendorCompletionPhotoDtoSchema.safeParse(photo);
      if(!safe.success||safe.data.photoId!==photoId||bytes.byteLength!==safe.data.byteSize)throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
      headers.set("Content-Type",safe.data.mime);headers.set("Content-Length",String(bytes.byteLength));
      return new Response(new Uint8Array(bytes),{status:200,headers});
    }
    if(segments[1]==="tickets"&&segments.length===4){
      if(route==="vendor-handoff"&&request.method==="GET")return json(ManagerVendorHandoffDtoSchema.parse(await port.readHandoff(digest,id)));
      if(route==="vendor-assignment"&&request.method==="POST")return json(ManagerVendorHandoffDtoSchema.parse(await port.createAssignment(digest,id,parse(VendorCreateAssignmentCommandSchema,await readBody(request)))),201);
    }
    if(segments[1]==="vendor-assignments"&&request.method==="POST"){
      if(route==="packet-revisions")return json(ManagerVendorHandoffDtoSchema.parse(await port.publishPacket(digest,id,parse(VendorPublishPacketCommandSchema,await readBody(request)))),201);
      if(route==="link"||route==="link/reissue"){
        const body=parse(route==="link"?VendorIssueLinkCommandSchema:VendorReissueLinkCommandSchema,await readBody(request));
        const result=VendorLinkIssueDtoSchema.parse(await (route==="link"?port.issueLink(digest,id,body):port.reissueLink(digest,id,body)));
        return json(result,result.created?201:200);
      }
      if(route==="revoke")return json(ManagerVendorHandoffDtoSchema.parse(await port.revoke(digest,id,parse(VendorRevokeCommandSchema,await readBody(request)))));
      if(route==="reschedule")return json(ManagerVendorHandoffDtoSchema.parse(await port.reschedule(digest,id,parse(VendorManagerRescheduleCommandSchema,await readBody(request)))));
    }
    throw new VendorHandoffError("NOT_FOUND");
  }catch(error){
    const code=error instanceof VendorHandoffError?error.code:"DEPENDENCY_UNAVAILABLE";
    const status=code==="UNAUTHENTICATED"?401:code==="FORBIDDEN"?403:code==="NOT_FOUND"?404:code==="INVALID_INPUT"?400:code==="STATE_CONFLICT"?409:503;
    return json({error:{code,message:status===409?"최신 외부 업체 인계 상태를 확인해 주세요.":status===503?"외부 업체 인계 서비스에 연결하지 못했습니다.":"접근 권한이나 입력을 확인해 주세요."}},status);
  }
}

const TENANT_ACTIONS=["availability","entry-authorization","confirm","reschedule"];
/** `tickets/:ticketId/vendor-scheduling[/action]` only; every other ticket route stays with Core. */
export function isTenantVendorSchedulingRoute(segments:string[]):boolean{
  return segments[0]==="tickets"&&segments[2]==="vendor-scheduling"&&(segments.length===3||(segments.length===4&&TENANT_ACTIONS.includes(segments[3])));
}
/**
 * Tenant scheduling over the B1 Core boundary. Authority is only the request-scoped digest: the port derives the
 * current Tenant/occupancy in SQL; no client-supplied organization, unit or occupancy value is accepted.
 */
export async function handleTenantVendorScheduling(request:Request,segments:string[],digest:string,port:VendorHandoffTenantPort|undefined,headers:Headers):Promise<Response>{
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
  try{
    const id=segments[1];
    if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw new VendorHandoffError("INVALID_INPUT");
    if(!port)throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    const action=segments[3];
    const respond=async(value:unknown)=>json(VendorTenantSchedulingDtoSchema.parse(await value));
    if(action===undefined&&request.method==="GET")return await respond(port.readScheduling(digest,id));
    if(request.method==="POST"){
      if(action==="availability")return await respond(port.submitAvailability(digest,id,parse(VendorAvailabilityCommandSchema,await readBody(request))));
      if(action==="entry-authorization")return await respond(port.authorizeEntry(digest,id,parse(VendorEntryAuthorizationCommandSchema,await readBody(request))));
      if(action==="confirm")return await respond(port.confirmSlot(digest,id,parse(VendorConfirmSlotCommandSchema,await readBody(request))));
      if(action==="reschedule")return await respond(port.reschedule(digest,id,parse(VendorTenantRescheduleCommandSchema,await readBody(request))));
    }
    throw new VendorHandoffError("NOT_FOUND");
  }catch(error){
    const code=error instanceof VendorHandoffError?error.code:"DEPENDENCY_UNAVAILABLE";
    const status=code==="UNAUTHENTICATED"?401:code==="FORBIDDEN"?403:code==="NOT_FOUND"?404:code==="INVALID_INPUT"?400:code==="STATE_CONFLICT"?409:503;
    return json({error:{code,message:status===409?"방문 일정이 바뀌었습니다. 최신 일정을 확인해 주세요.":status===503?"방문 일정 서비스에 연결하지 못했습니다.":"접근 권한이나 입력을 확인해 주세요."}},status);
  }
}
