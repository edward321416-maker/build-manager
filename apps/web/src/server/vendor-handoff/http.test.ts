import { createHash,randomUUID } from "node:crypto";
import { describe,expect,it } from "vitest";
import { VendorHandoffError,type VendorHandoffExternalPort,type VendorJobDto } from "@build-manager/application";
import { VendorJobDtoSchema,VendorRedeemResultDtoSchema,VendorSessionStateDtoSchema } from "@build-manager/api-contracts";
import { handleVendorHandoff,type VendorHTTPDependencies } from "./http";
import * as route from "../../app/api/v2/vendor/[...path]/route";

const origin="http://127.0.0.1:3140";
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const synthetic=(seed:string)=>createHash("sha256").update(seed).digest("base64url");
const assignmentId="11111111-1111-4111-8111-111111111111";
const packetId="22222222-2222-4222-8222-222222222222";
const photoId="33333333-3333-4333-8333-333333333333";
const expiresAt="2026-10-14T00:00:00.000Z";
const job:VendorJobDto={assignmentId,assignmentVersion:3,status:"OFFERED",endReason:null,phase:"OFFERED",waitingOn:"NONE",
  currentPacket:{id:packetId,assignmentId,jobReference:"JOB-1",vendorLabel:"합성 업체",revision:1,publishedAt:"2026-10-07T00:00:00.000Z",
    buildingName:"합성 건물",serviceAddress:"합성 주소",unitLabel:"101호",issueType:"LEAK",workSummary:"합성 누수 점검",sharedDetails:[],
    allowedPhotoIds:[photoId],safetyNotice:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null},
  currentRound:null,appointment:null,activeBlocker:null,currentReport:null};

function harness(overrides:Partial<VendorHandoffExternalPort>={},configured=origin){
  const calls:{method:string;csrf:string|undefined;args:unknown[]}[]=[];
  const record=<T,>(method:string,csrf:string|undefined,result:(...args:unknown[])=>Promise<T>)=>(...args:unknown[])=>{calls.push({method,csrf,args});return result(...args);};
  const external=(csrf?:string)=>{
    const port={
      redeem:async()=>({assignmentId,expiresAt}),
      logout:async()=>({revoked:true}),
      session:async()=>({assignmentId,expiresAt}),
      refreshSession:async()=>({assignmentId,expiresAt}),
      readJob:async()=>job,
      decline:async()=>({...job,status:"ENDED",endReason:"DECLINED",phase:"ENDED",assignmentVersion:4}),
      readSourcePhoto:async()=>({photo:{photoId,mime:"image/jpeg",byteSize:3,width:1,height:1},bytes:new Uint8Array([1,2,3])}),
      ...overrides,
    } as unknown as Record<string,(...args:unknown[])=>Promise<unknown>>;
    return Object.fromEntries(Object.entries(port).map(([name,fn])=>[name,record(name,csrf,fn)])) as unknown as VendorHandoffExternalPort;
  };
  const deps:VendorHTTPDependencies={external,origin:configured};
  return {calls,deps};
}
const session=synthetic("vendor-session");
const csrf=synthetic("vendor-csrf");
const token=synthetic("vendor-capability");
function call(deps:VendorHTTPDependencies,path:string,init:{method?:string;headers?:Record<string,string>;body?:unknown;base?:string}={}){
  const headers=new Headers(init.headers);
  if(init.body!==undefined&&!headers.has("content-type"))headers.set("content-type","application/json");
  const request=new Request(`${init.base??origin}/api/v2/vendor/${path}`,{method:init.method??"GET",headers,body:init.body===undefined?undefined:JSON.stringify(init.body)});
  return handleVendorHandoff(request,path.split("/"),()=>deps);
}
const authed={cookie:`vendor_session=${session}`};
const mutation={...authed,origin,"x-vendor-csrf":csrf};
async function text(response:Response){return response.text();}
const secretFree=(body:string)=>![token,session,csrf].some(raw=>body.includes(raw));

describe("Vendor HTTP response security",()=>{
  it.each([
    ["job",{headers:authed}],
    ["session",{}],
    ["job/accept",{method:"POST",headers:mutation,body:{clientRequestId:randomUUID()}}],
    ["unknown",{headers:authed}],
  ] as const)("applies no-store/no-referrer/nosniff/frame denial on %s",async(path,init)=>{
    const {deps}=harness();
    const response=await call(deps,path,init as Parameters<typeof call>[2]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
  it("rejects unsupported methods and cross-origin or origin-less mutations before persistence",async()=>{
    const {deps,calls}=harness();
    expect((await call(deps,"job",{method:"PUT",headers:authed})).status).toBe(405);
    expect((await call(deps,"job/decline",{method:"POST",headers:{...mutation,origin:"http://evil.example"},body:{}})).status).toBe(403);
    const noOrigin=Object.fromEntries(Object.entries(mutation).filter(([key])=>key!=="origin"));
    expect((await call(deps,"job/decline",{method:"POST",headers:noOrigin,body:{}})).status).toBe(403);
    expect((await call(deps,"session/redeem",{method:"POST",headers:{origin:"http://evil.example",authorization:`VendorCapability ${token}`},body:{clientRequestId:randomUUID()}})).status).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe("redeem",()=>{
  it("consumes the presented capability digest once and returns a fresh session cookie plus server CSRF",async()=>{
    const {deps,calls}=harness();
    const clientRequestId=randomUUID();
    const response=await call(deps,"session/redeem",{method:"POST",headers:{origin,authorization:`VendorCapability ${token}`},body:{clientRequestId}});
    expect(response.status).toBe(200);
    const raw=await text(response);
    expect(raw.includes(token)).toBe(false);
    const body=VendorRedeemResultDtoSchema.parse(JSON.parse(raw));
    const redeem=calls.find(c=>c.method==="redeem")!;
    const [tokenDigest,requestId,sessionDigest,csrfDigest]=redeem.args as string[];
    expect(tokenDigest).toBe(sha(token));
    expect(requestId).toBe(clientRequestId);
    expect(csrfDigest).toBe(sha(body.session.csrf));
    expect(redeem.csrf).toBe(csrfDigest);
    const cookie=response.headers.get("set-cookie")!;
    const sessionRaw=/^vendor_session=([A-Za-z0-9_-]{43});/.exec(cookie)?.[1];
    expect(sessionRaw!==undefined&&sha(sessionRaw)===sessionDigest).toBe(true);
    expect(raw.includes(sessionRaw!)).toBe(false);
    for(const part of ["HttpOnly","SameSite=Strict","Path=/api/v2/vendor"])expect(cookie.split("; ")).toContain(part);
    expect(calls.find(c=>c.method==="readJob")?.args).toEqual([sessionDigest]);
    expect(body.job.assignmentId).toBe(assignmentId);
  });
  it.each([
    ["missing capability",{origin},400],
    ["malformed capability",{origin,authorization:"VendorCapability short"},401],
  ] as const)("rejects %s without persistence",async(_label,headers,status)=>{
    const {deps,calls}=harness();
    expect((await call(deps,"session/redeem",{method:"POST",headers,body:{clientRequestId:randomUUID()}})).status).toBe(status);
    expect(calls).toEqual([]);
  });
  it("maps a consumed/expired capability to 401 with no cookie and no secret echo",async()=>{
    const {deps}=harness({redeem:async()=>{throw new VendorHandoffError("UNAUTHENTICATED");}});
    const response=await call(deps,"session/redeem",{method:"POST",headers:{origin,authorization:`VendorCapability ${token}`},body:{clientRequestId:randomUUID()}});
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(secretFree(await text(response))).toBe(true);
  });
  it("does not set a cookie when the job readback after redemption is unavailable",async()=>{
    const {deps}=harness({readJob:async()=>{throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");}});
    const response=await call(deps,"session/redeem",{method:"POST",headers:{origin,authorization:`VendorCapability ${token}`},body:{clientRequestId:randomUUID()}});
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects extra redeem body fields",async()=>{
    const {deps,calls}=harness();
    expect((await call(deps,"session/redeem",{method:"POST",headers:{origin,authorization:`VendorCapability ${token}`},body:{clientRequestId:randomUUID(),assignmentId}})).status).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe("session and CSRF",()=>{
  it("requires the session cookie",async()=>{
    const {deps,calls}=harness();
    expect((await call(deps,"session")).status).toBe(401);
    expect((await call(deps,"job")).status).toBe(401);
    expect(calls).toEqual([]);
  });
  it("rotates a fresh server CSRF without minting a new cookie",async()=>{
    const {deps,calls}=harness();
    const response=await call(deps,"session",{headers:authed});
    expect(response.status).toBe(200);
    const body=VendorSessionStateDtoSchema.parse(await response.json());
    expect(body).toMatchObject({assignmentId,expiresAt});
    expect(calls.map(c=>c.method)).toEqual(["refreshSession"]);
    expect(calls[0].args).toEqual([sha(session),sha(body.csrf)]);
    expect(body.csrf===csrf).toBe(false);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("binds the presented CSRF digest to the mutation port and refuses missing or malformed CSRF",async()=>{
    const {deps,calls}=harness();
    const input={clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId,reason:"NO_CAPACITY",operationalNote:null};
    const withoutCsrf=Object.fromEntries(Object.entries(mutation).filter(([key])=>key!=="x-vendor-csrf"));
    expect((await call(deps,"job/decline",{method:"POST",headers:withoutCsrf,body:input})).status).toBe(403);
    expect((await call(deps,"job/decline",{method:"POST",headers:{...mutation,"x-vendor-csrf":"short"},body:input})).status).toBe(403);
    expect(calls).toEqual([]);
    const response=await call(deps,"job/decline",{method:"POST",headers:mutation,body:input});
    expect(response.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await response.json())).toMatchObject({status:"ENDED",endReason:"DECLINED"});
    expect(calls).toEqual([{method:"decline",csrf:sha(csrf),args:[sha(session),input]}]);
  });
});

describe("logout",()=>{
  it("revokes through the exact request without a generic active-session precheck and clears the cookie",async()=>{
    const {deps,calls}=harness();
    const clientRequestId=randomUUID();
    for(let attempt=0;attempt<2;attempt++){
      const response=await call(deps,"session/logout",{method:"POST",headers:mutation,body:{clientRequestId}});
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({revoked:true});
      const cookie=response.headers.get("set-cookie")!.split("; ");
      expect(cookie[0]).toBe("vendor_session=");
      expect(cookie).toContain("Max-Age=0");
    }
    expect(calls).toEqual([{method:"logout",csrf:sha(csrf),args:[sha(session),clientRequestId]},{method:"logout",csrf:sha(csrf),args:[sha(session),clientRequestId]}]);
  });
  it("keeps expired or replaced authority denied and clears the dead cookie",async()=>{
    const {deps}=harness({logout:async()=>{throw new VendorHandoffError("UNAUTHENTICATED");}});
    const response=await call(deps,"session/logout",{method:"POST",headers:mutation,body:{clientRequestId:randomUUID()}});
    expect(response.status).toBe(401);
    const cleared=response.headers.get("set-cookie")?.split("; ")??[];
    expect(cleared[0]).toBe("vendor_session=");
    expect(cleared).toContain("Max-Age=0");
    expect(secretFree(await text(response))).toBe(true);
  });
  it("reports a stale CSRF on a live session as 403 and keeps its cookie",async()=>{
    const {deps}=harness({logout:async()=>{throw new VendorHandoffError("FORBIDDEN");}});
    const response=await call(deps,"session/logout",{method:"POST",headers:mutation,body:{clientRequestId:randomUUID()}});
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("configured Vendor origin",()=>{
  it("compares Origin with the configured Vendor origin rather than the request host",async()=>{
    const {deps,calls}=harness({},"http://localhost:3140");
    const input={clientRequestId:randomUUID()};
    expect((await call(deps,"session/logout",{method:"POST",headers:mutation,body:input})).status).toBe(403);
    expect(calls).toEqual([]);
    expect((await call(deps,"session/logout",{method:"POST",headers:{...mutation,origin:"http://localhost:3140"},body:input})).status).toBe(200);
  });
  it("derives the cookie Secure attribute from the configured https origin behind TLS termination",async()=>{
    const configured="https://127.0.0.1:3443";
    const {deps}=harness({},configured);
    const response=await call(deps,"session/redeem",{method:"POST",headers:{origin:configured,authorization:`VendorCapability ${token}`},body:{clientRequestId:randomUUID()}});
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")!.split("; ")).toContain("Secure");
  });
});

describe("route module",()=>{
  it.each(["OPTIONS","HEAD"] as const)("answers %s itself with the Vendor security headers",async method=>{
    const handler=(route as Record<string,unknown>)[method];
    expect(typeof handler).toBe("function");
    const response=await (handler as (request:Request,context:{params:Promise<{path:string[]}>})=>Promise<Response>)(new Request(`${origin}/api/v2/vendor/job`,{method}),{params:Promise.resolve({path:["job"]})});
    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("job ownership",()=>{
  it("reads only the session-owned job and projects away undeclared fields",async()=>{
    const {deps,calls}=harness();
    const response=await call(deps,"job",{headers:authed});
    expect(response.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await response.json()).assignmentId).toBe(assignmentId);
    expect(calls).toEqual([{method:"readJob",csrf:undefined,args:[sha(session)]}]);
    const leaky=harness({readJob:async()=>({...job,tenantPhone:"synthetic-private-contact-marker"}) as VendorJobDto});
    const failed=await call(leaky.deps,"job",{headers:authed});
    expect(failed.status).toBe(503);
    expect((await text(failed)).includes("synthetic-private-contact-marker")).toBe(false);
  });
  it("leaves Task 5 accept/withdraw unimplemented",async()=>{
    const {deps,calls}=harness();
    for(const path of ["job/accept","job/withdraw"])expect((await call(deps,path,{method:"POST",headers:mutation,body:{clientRequestId:randomUUID()}})).status).toBe(404);
    expect(calls).toEqual([]);
  });
  it("serves an allowlisted source photo and hides guessed, malformed or cross-assignment IDs identically",async()=>{
    const {deps,calls}=harness();
    const response=await call(deps,`job/source-photos/${photoId}`,{headers:authed});
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
    expect(calls).toEqual([{method:"readSourcePhoto",csrf:undefined,args:[sha(session),photoId]}]);
    const hidden=harness({readSourcePhoto:async()=>{throw new VendorHandoffError("NOT_FOUND");}});
    const guessed=await call(hidden.deps,`job/source-photos/${randomUUID()}`,{headers:authed});
    const malformed=await call(hidden.deps,"job/source-photos/not-a-photo",{headers:authed});
    expect([guessed.status,malformed.status]).toEqual([404,404]);
    expect(await text(guessed)).toBe(await text(malformed));
    expect(hidden.calls.length).toBe(1);
  });
});
