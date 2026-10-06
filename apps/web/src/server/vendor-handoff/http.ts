import { VendorHandoffError,type VendorHandoffErrorCode,type VendorHandoffExternalPort } from "@build-manager/application";
import { VendorDeclineCommandSchema,VendorJobDtoSchema,VendorLogoutCommandSchema,VendorLogoutResultDtoSchema,VendorRedeemCommandSchema,VendorRedeemResultDtoSchema,VendorSessionStateDtoSchema } from "@build-manager/api-contracts";
import { getVendorHandoffContainer } from "./container";
import { capabilityFromAuthorization,clearVendorSessionCookie,createVendorSecret,readVendorSessionCookie,vendorSecretDigest,vendorSessionCookie } from "./token";

/** The request-local port binds only the presented CSRF digest; persistence verifies it against the session. */
export type VendorHTTPDependencies={external(csrfDigest?:string):VendorHandoffExternalPort};

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const STATUS:Record<VendorHandoffErrorCode,number>={UNAUTHENTICATED:401,FORBIDDEN:403,NOT_FOUND:404,INVALID_INPUT:400,STATE_CONFLICT:409,DEPENDENCY_UNAVAILABLE:503};
const MESSAGE:Record<number,string>={
  400:"요청 내용을 확인해 주세요.",
  401:"작업 화면에 접근할 수 없습니다. 관리자에게 새 링크를 요청해 주세요.",
  403:"허용되지 않은 요청입니다.",
  404:"요청한 내용을 찾을 수 없습니다.",
  405:"허용하지 않는 요청입니다.",
  409:"작업 요청 내용이 바뀌었습니다. 최신 내용을 확인해 주세요.",
  503:"작업 화면 서비스에 연결하지 못했습니다.",
};
const fail=(code:VendorHandoffErrorCode):never=>{throw new VendorHandoffError(code);};

async function readBody(request:Request):Promise<unknown>{
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")fail("INVALID_INPUT");
  const reader=request.body?.getReader();if(!reader)return fail("INVALID_INPUT");
  let size=0,text="";const decoder=new TextDecoder();
  try{
    for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>16_384){await reader.cancel();fail("INVALID_INPUT");}text+=decoder.decode(next.value,{stream:true});}
    return JSON.parse(text+decoder.decode());
  }catch{return fail("INVALID_INPUT");}
  finally{reader.releaseLock();}
}
function parse<T>(schema:{safeParse(value:unknown):{success:boolean;data?:T}},value:unknown):T{
  const parsed=schema.safeParse(value);if(!parsed.success)fail("INVALID_INPUT");return parsed.data as T;
}
function project<T>(schema:{safeParse(value:unknown):{success:boolean;data?:T}},value:unknown):T{
  // A persistence result outside the public contract is never forwarded.
  const parsed=schema.safeParse(value);if(!parsed.success)fail("DEPENDENCY_UNAVAILABLE");return parsed.data as T;
}

/** Standalone no-account Vendor boundary. It never consults B1/Auth0 identity or Core HTTP authority. */
export async function handleVendorHandoff(request:Request,segments:string[],resolve:()=>VendorHTTPDependencies=getVendorHandoffContainer):Promise<Response>{
  const headers=new Headers({
    "Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"DENY","Content-Security-Policy":"frame-ancestors 'none'",Vary:"Cookie",
  });
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
  const url=new URL(request.url),secure=url.protocol==="https:";
  try{
    if(request.method!=="GET"&&request.method!=="POST")return json({error:{code:"METHOD_NOT_ALLOWED",message:MESSAGE[405]}},405);
    if(request.method==="POST"&&request.headers.get("origin")!==url.origin)fail("FORBIDDEN");
    if([...url.searchParams.keys()].length)fail("INVALID_INPUT");
    const route=segments.join("/");
    if(request.method==="POST"&&route==="session/redeem"){
      const authorization=request.headers.get("authorization");
      if(!authorization?.startsWith("VendorCapability "))fail("INVALID_INPUT");
      const capability=capabilityFromAuthorization(authorization);
      if(!capability)fail("UNAUTHENTICATED");
      const body=parse(VendorRedeemCommandSchema,await readBody(request));
      const session=createVendorSecret(),csrf=createVendorSecret();
      const port=resolve().external(csrf.digest);
      const state=await port.redeem(vendorSecretDigest(capability!),body.clientRequestId,session.digest,csrf.digest);
      const result=project(VendorRedeemResultDtoSchema,{session:{...state,csrf:csrf.raw},job:await port.readJob(session.digest)});
      headers.set("Set-Cookie",vendorSessionCookie(session.raw,result.session.expiresAt,new Date(),secure));
      return json(result);
    }
    const presented=readVendorSessionCookie(request.headers.get("cookie"));
    if(!presented)fail("UNAUTHENTICATED");
    const sessionDigest=vendorSecretDigest(presented!);
    if(request.method==="GET"){
      if(route==="session"){
        const csrf=createVendorSecret();
        const state=await resolve().external().refreshSession(sessionDigest,csrf.digest);
        return json(project(VendorSessionStateDtoSchema,{...state,csrf:csrf.raw}));
      }
      if(route==="job")return json(project(VendorJobDtoSchema,await resolve().external().readJob(sessionDigest)));
      if(segments.length===3&&segments[0]==="job"&&segments[1]==="source-photos"){
        if(!UUID.test(segments[2]))fail("NOT_FOUND");
        const {photo,bytes}=await resolve().external().readSourcePhoto(sessionDigest,segments[2]);
        if(photo.mime!=="image/jpeg"&&photo.mime!=="image/png")fail("DEPENDENCY_UNAVAILABLE");
        headers.set("Content-Type",photo.mime);headers.set("Content-Length",String(bytes.byteLength));
        return new Response(new Uint8Array(bytes),{status:200,headers});
      }
      fail("NOT_FOUND");
    }
    // Task 4 owns only logout and decline. Task 5 adds accept/withdraw with their atomic scheduling transitions.
    if(route!=="session/logout"&&route!=="job/decline")fail("NOT_FOUND");
    const csrf=request.headers.get("x-vendor-csrf");
    if(!csrf||!/^[A-Za-z0-9_-]{43}$/.test(csrf))fail("FORBIDDEN");
    const port=resolve().external(vendorSecretDigest(csrf!));
    if(route==="session/logout"){
      // No generic active-session precheck: an exact logout replay must reach its own durable receipt.
      const result=project(VendorLogoutResultDtoSchema,await port.logout(sessionDigest,parse(VendorLogoutCommandSchema,await readBody(request)).clientRequestId));
      headers.set("Set-Cookie",clearVendorSessionCookie(secure));
      return json(result);
    }
    return json(project(VendorJobDtoSchema,await port.decline(sessionDigest,parse(VendorDeclineCommandSchema,await readBody(request)))));
  }catch(error){
    const code=error instanceof VendorHandoffError?error.code:"DEPENDENCY_UNAVAILABLE";
    const status=STATUS[code];
    headers.delete("Set-Cookie");headers.delete("Content-Type");headers.delete("Content-Length");
    return json({error:{code,message:MESSAGE[status]}},status);
  }
}
