import { VendorHandoffError, type VendorHandoffManagerPort } from "@build-manager/application";
import { ManagerVendorHandoffDtoSchema, VendorCreateAssignmentCommandSchema, VendorPublishPacketCommandSchema, VendorIssueLinkCommandSchema, VendorReissueLinkCommandSchema, VendorRevokeCommandSchema, VendorLinkIssueDtoSchema } from "@build-manager/api-contracts";

export function isManagerVendorHandoffRoute(segments:string[]):boolean{
  return segments[0]==="manager"&&((segments[1]==="tickets"&&["vendor-handoff","vendor-assignment"].includes(segments[3]))||segments[1]==="vendor-assignments");
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
    }
    throw new VendorHandoffError("NOT_FOUND");
  }catch(error){
    const code=error instanceof VendorHandoffError?error.code:"DEPENDENCY_UNAVAILABLE";
    const status=code==="UNAUTHENTICATED"?401:code==="FORBIDDEN"?403:code==="NOT_FOUND"?404:code==="INVALID_INPUT"?400:code==="STATE_CONFLICT"?409:503;
    return json({error:{code,message:status===409?"최신 외부 업체 인계 상태를 확인해 주세요.":status===503?"외부 업체 인계 서비스에 연결하지 못했습니다.":"접근 권한이나 입력을 확인해 주세요."}},status);
  }
}
