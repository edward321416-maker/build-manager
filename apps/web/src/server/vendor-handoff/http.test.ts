import { createHash,randomUUID } from "node:crypto";
import { describe,expect,it } from "vitest";
import { VendorHandoffError,type VendorHandoffExternalPort,type VendorJobDto } from "@build-manager/application";
import sharp from "sharp";
import { VendorCompletionPhotoDtoSchema,VendorCompletionReportDtoSchema,VendorJobDtoSchema,VendorRedeemResultDtoSchema,VendorSessionStateDtoSchema } from "@build-manager/api-contracts";
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
  currentRound:null,appointment:null,activeBlocker:null,currentReport:null,effectiveMode:null,availability:null,proposal:null};
const roundId="44444444-4444-4444-8444-444444444444";

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
      accept:async()=>({...job,status:"ACTIVE",phase:"SCHEDULING",waitingOn:"TENANT",assignmentVersion:4,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",
        currentRound:{id:roundId,openedPacketRevisionId:packetId,purpose:"INITIAL",status:"OPEN",version:1,createdAt:"2026-10-07T00:00:00.000Z"}}),
      withdraw:async()=>({...job,status:"ENDED",endReason:"WITHDRAWN",phase:"ENDED",assignmentVersion:5}),
      proposeSlots:async()=>({...job,status:"ACTIVE",phase:"SCHEDULING",waitingOn:"TENANT",assignmentVersion:4}),
      selectPreauthorizedSlot:async()=>({...job,status:"ACTIVE",phase:"SCHEDULED",waitingOn:"VENDOR",assignmentVersion:4}),
      reschedule:async()=>({...job,status:"ACTIVE",phase:"SCHEDULING",waitingOn:"TENANT",assignmentVersion:4}),
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
function call(deps:VendorHTTPDependencies,path:string,init:{method?:string;headers?:Record<string,string>;body?:unknown;raw?:Uint8Array;base?:string}={}){
  const headers=new Headers(init.headers);
  if(init.body!==undefined&&!headers.has("content-type"))headers.set("content-type","application/json");
  const body=init.raw!==undefined?new Uint8Array(init.raw).buffer:init.body===undefined?undefined:JSON.stringify(init.body);
  const request=new Request(`${init.base??origin}/api/v2/vendor/${path}`,{method:init.method??"GET",headers,body});
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
  it("accepts and withdraws only with the presented CSRF and the exact command body",async()=>{
    const {deps,calls}=harness();
    const accept={clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId};
    const withdraw={clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:packetId,operationalNote:"합성 메모"};
    const noCsrf=Object.fromEntries(Object.entries(mutation).filter(([key])=>key!=="x-vendor-csrf"));
    expect((await call(deps,"job/accept",{method:"POST",headers:noCsrf,body:accept})).status).toBe(403);
    expect((await call(deps,"job/accept",{method:"POST",headers:mutation,body:{...accept,assignmentId:packetId}})).status).toBe(400);
    expect((await call(deps,"job/withdraw",{method:"POST",headers:mutation,body:{...withdraw,operationalNote:undefined}})).status).toBe(400);
    expect(calls).toEqual([]);
    const accepted=await call(deps,"job/accept",{method:"POST",headers:mutation,body:accept});
    expect(accepted.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await accepted.json())).toMatchObject({status:"ACTIVE",currentRound:{purpose:"INITIAL",status:"OPEN"}});
    const withdrawn=await call(deps,"job/withdraw",{method:"POST",headers:mutation,body:withdraw});
    expect(VendorJobDtoSchema.parse(await withdrawn.json())).toMatchObject({status:"ENDED",endReason:"WITHDRAWN"});
    expect(calls).toEqual([{method:"accept",csrf:sha(csrf),args:[sha(session),accept]},{method:"withdraw",csrf:sha(csrf),args:[sha(session),withdraw]}]);
  });
  it("dispatches Vendor scheduling commands only with the presented CSRF and exact bodies",async()=>{
    const {deps,calls}=harness();
    const g={clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedRoundVersion:2,expectedPacketRevisionId:packetId};
    const startAt="2026-10-10T05:00:00Z",endAt="2026-10-10T06:00:00Z";
    const rows=[
      ["scheduling/proposals",{...g,slots:[{startAt,endAt}]},"proposeSlots"],
      ["scheduling/preauthorized-appointment",{...g,availabilitySubmissionId:photoId,selectedWindowId:packetId,startAt,endAt},"selectPreauthorizedSlot"],
      ["scheduling/reschedule",{...g,expectedAppointmentId:photoId},"reschedule"],
    ] as const;
    const noCsrf=Object.fromEntries(Object.entries(mutation).filter(([key])=>key!=="x-vendor-csrf"));
    for(const [path,body] of rows){
      expect((await call(deps,path,{method:"POST",headers:noCsrf,body})).status).toBe(403);
      expect((await call(deps,path,{method:"POST",headers:mutation,body:{...body,assignmentId}})).status).toBe(400);
    }
    expect(calls).toEqual([]);
    for(const [path,body,method] of rows){
      const response=await call(deps,path,{method:"POST",headers:mutation,body});
      expect(response.status,path).toBe(200);
      VendorJobDtoSchema.parse(await response.json());
      expect(calls.at(-1)).toEqual({method,csrf:sha(csrf),args:[sha(session),body]});
    }
  });
  it("dispatches visit and blocker commands only with the presented CSRF, a UUID path identity and exact bodies",async()=>{
    const working={...job,status:"ACTIVE",phase:"IN_PROGRESS",waitingOn:"VENDOR",assignmentVersion:6};
    const {deps,calls}=harness({startVisit:async()=>working,recordBlocker:async()=>working,clearBlocker:async()=>working} as Partial<VendorHandoffExternalPort>);
    const g={clientRequestId:randomUUID(),expectedAssignmentVersion:5,expectedPacketRevisionId:packetId};
    const rows=[
      [`appointments/${photoId}/visit-start`,{...g,expectedRoundVersion:3},"startVisit",[photoId]],
      ["blockers",{...g,blockerCode:"PARTS_REQUIRED",operationalNote:"합성 부품 대기"},"recordBlocker",[]],
      [`blockers/${photoId}/clear`,{...g,operationalNote:null},"clearBlocker",[photoId]],
    ] as const;
    const noCsrf=Object.fromEntries(Object.entries(mutation).filter(([key])=>key!=="x-vendor-csrf"));
    for(const [path,body] of rows){
      expect((await call(deps,path,{method:"POST",headers:noCsrf,body})).status,path).toBe(403);
      expect((await call(deps,path,{method:"POST",headers:mutation,body:{...body,assignmentId}})).status,path).toBe(400);
      expect((await call(deps,path,{method:"GET",headers:authed})).status,path).toBe(404);
    }
    for(const path of ["appointments/not-a-uuid/visit-start","blockers/not-a-uuid/clear",`appointments/${photoId}/visit-start/extra`,`blockers/${photoId}`])
      expect((await call(deps,path,{method:"POST",headers:mutation,body:{...g,expectedRoundVersion:3}})).status,path).toBe(404);
    expect(calls).toEqual([]);
    for(const [path,body,method,ids] of rows){
      const response=await call(deps,path,{method:"POST",headers:mutation,body});
      expect(response.status,path).toBe(200);
      VendorJobDtoSchema.parse(await response.json());
      expect(calls.at(-1)).toEqual({method,csrf:sha(csrf),args:[sha(session),...ids,body]});
    }
  });
  it("exposes only the exact completion routes",async()=>{
    const {deps,calls}=harness();
    for(const path of ["completion-photos",`job/completion-photos/${photoId}/extra`,"completion-reports/extra"])
      expect((await call(deps,path,{method:"POST",headers:mutation,body:{clientRequestId:randomUUID()}})).status,path).toBe(404);
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

describe("Task8 completion photo and report routes",()=>{
  const appointmentId="44444444-4444-4444-8444-444444444444";
  const dto=(bytes:number,width=40,height=80)=>({photoId,mime:"image/jpeg" as const,byteSize:bytes,width,height,createdAt:"2026-10-07T00:00:00.000Z"});
  const command=(changes:Record<string,unknown>={})=>({clientRequestId:randomUUID(),expectedAssignmentVersion:6,expectedPacketRevisionId:packetId,expectedAppointmentId:appointmentId,expectedCorrectionRequestId:null,...changes});
  function uploader(){
    const seen:{input:unknown;sanitized:{bytes:Uint8Array;mime:string;byteSize:number;width:number;height:number;sha256:string}}[]=[];
    const h=harness({uploadCompletionPhoto:async(_session:string,input:unknown,sanitized:{bytes:Uint8Array;mime:string;byteSize:number;width:number;height:number;sha256:string})=>{
      seen.push({input,sanitized});return {...dto(sanitized.byteSize,sanitized.width,sanitized.height),mime:sanitized.mime};}} as unknown as Partial<VendorHandoffExternalPort>);
    return {...h,seen};
  }
  const send=(deps:VendorHTTPDependencies,bytes:Uint8Array,mime:string,input:{clientRequestId:string},extra:Record<string,string>={})=>call(deps,"job/completion-photos",
    {method:"POST",headers:{...mutation,"content-type":mime,"x-upload-id":input.clientRequestId,"x-vendor-upload-command":JSON.stringify(input),...extra},raw:bytes});
  const base=()=>sharp({create:{width:80,height:40,channels:3,background:"#16846b"}}).png().toBuffer();
  it("re-encodes a JPEG with EXIF/GPS and orientation before the port and keeps a stable sanitized SHA-256 for replay",async()=>{
    const {deps,seen}=uploader();
    const jpeg=await sharp(await base()).jpeg().withMetadata({orientation:6}).withExif({IFD0:{Artist:"SYNTHETIC_TEST"},IFD3:{GPSLatitudeRef:"N",GPSLatitude:"1/1 2/1 3/1"}}).toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();
    const input=command();
    const response=await send(deps,jpeg,"image/jpeg",input);
    expect(response.status).toBe(200);
    expect(VendorCompletionPhotoDtoSchema.parse(await response.json())).toMatchObject({width:40,height:80});
    const [{input:sentInput,sanitized}]=seen;
    expect(sentInput).toEqual(input);
    const meta=await sharp(sanitized.bytes).metadata();
    expect([meta.exif,meta.xmp,meta.icc,meta.orientation]).toEqual([undefined,undefined,undefined,undefined]);
    expect([sanitized.mime,sanitized.width,sanitized.height,sanitized.byteSize]).toEqual(["image/jpeg",40,80,sanitized.bytes.byteLength]);
    expect(sanitized.sha256).toBe(createHash("sha256").update(sanitized.bytes).digest("hex"));
    expect(Buffer.from(sanitized.bytes).equals(jpeg)).toBe(false);
    await send(deps,jpeg,"image/jpeg",input);
    expect(seen[1].sanitized.sha256).toBe(sanitized.sha256);
  });
  it("re-encodes a PNG carrying EXIF and XMP metadata",async()=>{
    const {deps,seen}=uploader();
    const png=await sharp(await base()).png().withExif({IFD0:{Artist:"SYNTHETIC_TEST"}}).withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>').toBuffer();
    const original=await sharp(png).metadata();expect([Boolean(original.exif),Boolean(original.xmp)]).toEqual([true,true]);
    expect((await send(deps,png,"image/png",command())).status).toBe(200);
    const meta=await sharp(seen[0].sanitized.bytes).metadata();
    expect([meta.format,meta.exif,meta.xmp,meta.width,meta.height]).toEqual(["png",undefined,undefined,80,40]);
  });
  it("rejects identity, command, CSRF and image problems before the port and before any persistence",async()=>{
    const {deps,calls}=uploader();
    const png=await base(),input=command();
    expect((await send(deps,png,"image/png",input,{"x-upload-id":randomUUID()})).status).toBe(400);
    expect((await send(deps,png,"image/png",{...input,unitId:randomUUID()} as never)).status).toBe(400);
    expect((await send(deps,png,"image/png",input,{"x-vendor-upload-command":"{not json"})).status).toBe(400);
    expect((await send(deps,png,"image/png",{...command(),expectedCorrectionRequestId:undefined} as never)).status).toBe(400);
    // Identity and command problems are refused before any port call, including the session preflight.
    expect(calls).toEqual([]);
    const noCsrf=await call(deps,"job/completion-photos",{method:"POST",headers:{...authed,origin,"content-type":"image/png","x-upload-id":input.clientRequestId,"x-vendor-upload-command":JSON.stringify(input)},raw:png});
    expect(noCsrf.status).toBe(403);
    expect((await send(deps,png,"image/svg+xml",command())).status).toBe(415);
    expect((await send(deps,Buffer.from("not an image"),"image/png",command())).status).toBe(415);
    expect((await send(deps,Buffer.from([137,80,78,71,13,10,26,10]),"image/png",command())).status).toBe(400);
    expect((await send(deps,Buffer.alloc(5*1024*1024+1),"image/png",command())).status).toBe(413);
    const huge=await sharp({create:{width:4500,height:4500,channels:3,background:"white"}}).png().toBuffer();
    expect((await send(deps,huge,"image/png",command())).status).toBe(413);
    // Image problems are refused after the read-only session preflight and before any persistence.
    expect(calls.filter(c=>c.method!=="session")).toEqual([]);
  });
  it("validates the Vendor session before reading or decoding any image (review M1)",async()=>{
    const h=harness({session:async()=>{throw new VendorHandoffError("UNAUTHENTICATED");}} as unknown as Partial<VendorHandoffExternalPort>);
    const oversized=Buffer.alloc(5*1024*1024+1);
    const response=await send(h.deps,oversized,"image/png",command());
    expect(response.status).toBe(401);
    expect(h.calls.map(c=>c.method)).toEqual(["session"]);
  });
  it("serves only the session's own completion photo bytes and hides malformed or unknown ids",async()=>{
    const bytes=new Uint8Array([255,216,255,0]);
    const {deps,calls}=harness({readCompletionPhoto:async(_session:string,id:string)=>{if(id!==photoId)throw new VendorHandoffError("NOT_FOUND");return {photo:dto(bytes.byteLength),bytes};}} as unknown as Partial<VendorHandoffExternalPort>);
    const served=await call(deps,`job/completion-photos/${photoId}`,{headers:authed});
    expect(served.status).toBe(200);
    expect([served.headers.get("content-type"),served.headers.get("cache-control")]).toEqual(["image/jpeg","no-store"]);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);
    expect((await call(deps,"job/completion-photos/not-a-uuid",{headers:authed})).status).toBe(404);
    expect((await call(deps,`job/completion-photos/${packetId}`,{headers:authed})).status).toBe(404);
    expect(calls.map(c=>c.method)).toEqual(["readCompletionPhoto","readCompletionPhoto"]);
  });
  it("dispatches a completion report only with the presented CSRF and an exact body",async()=>{
    const reportDto={id:photoId,assignmentId,appointmentId,packetRevisionId:packetId,revision:1,supersedesReportId:null,workSummary:"합성 작업 완료",
      componentOrPartNote:null,completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE",submittedAt:"2026-10-07T00:00:00.000Z"};
    const {deps,calls}=harness({submitCompletionReport:async()=>reportDto} as unknown as Partial<VendorHandoffExternalPort>);
    const body={...command(),supersedesReportId:null,workSummary:"합성 작업 완료",componentOrPartNote:null,completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE"};
    const noCsrf=Object.fromEntries(Object.entries(mutation).filter(([key])=>key!=="x-vendor-csrf"));
    expect((await call(deps,"completion-reports",{method:"POST",headers:noCsrf,body})).status).toBe(403);
    expect((await call(deps,"completion-reports",{method:"POST",headers:mutation,body:{...body,assignmentId}})).status).toBe(400);
    expect((await call(deps,"completion-reports",{method:"POST",headers:mutation,body:{...body,photoOmissionReason:null}})).status).toBe(400);
    expect(calls).toEqual([]);
    const response=await call(deps,"completion-reports",{method:"POST",headers:mutation,body});
    expect(response.status).toBe(200);
    expect(VendorCompletionReportDtoSchema.parse(await response.json())).toEqual(reportDto);
    expect(calls.at(-1)).toEqual({method:"submitCompletionReport",csrf:sha(csrf),args:[sha(session),body]});
  });
});
