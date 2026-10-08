import { afterAll,beforeAll,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { ManagerVendorHandoffDtoSchema } from "@build-manager/api-contracts";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
beforeAll(async()=>{f=await createVendorHandoffFixture();});
afterAll(async()=>{await f?.close();});
it("previews canonical identity and only allowlisted provenance before a packet exists",async()=>{
  const {t}=await f.prepared();
  await f.p.admin.query("UPDATE core_flow.ticket SET body=body || $2::jsonb WHERE id=$1",[t.ticket.id,JSON.stringify({unitLabel:"FORGED_UNIT",answers:[{questionId:"leak.active",value:true},{questionId:"leak.location",value:"APPLIANCE"},{questionId:"leak.firstObservedAt",value:"PRIVATE_INPUT"},{questionId:"heating.hotWater",value:true}]})]);
  const h=await f.manager.readHandoff(f.data.accounts.staff.digest,t.ticket.id);
  expect(h.currentPacket).toBeNull();
  const source=(h as unknown as {packetSource?:unknown}).packetSource;
  expect(source).toMatchObject({jobReference:t.ticket.id,buildingName:"RC1 합성 건물 A",serviceAddress:"합성 테스트 주소",unitLabel:"합성 호실 1",issueType:"LEAK",safetyNotice:[],sharedDetails:[
    {key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED"},
    {key:"leak.location",label:"누수 위치",value:"특정 기기",sourceType:"TENANT_REPORTED"},
    {key:"heatingType",label:"난방 방식",value:"INDIVIDUAL",sourceType:"BUILDING_VERIFIED"},
    {key:"managementMode",label:"관리 방식",value:"OWNER_DIRECT",sourceType:"BUILDING_VERIFIED"},
  ]});
  expect(ManagerVendorHandoffDtoSchema.safeParse(h).success).toBe(true);
  for(const privateField of ["PRIVATE_INPUT","rawUserText","FORGED_UNIT","heating.hotWater"])expect(JSON.stringify(source).includes(privateField)).toBe(false);
});
it("lists same-ticket photo IDs for explicit selection without implicitly publishing them",async()=>{
  const {t,handoff}=await f.prepared(),other=await f.ticket(),photo=randomUUID(),hidden=randomUUID();
  for(const [id,ticket] of [[photo,t.ticket.id],[hidden,other.ticket.id]])await f.p.admin.query("INSERT INTO core_flow.ticket_photo(id,org_id,ticket_id,upload_id,mime,width,height,content,actor_id) VALUES($1,$2,$3,$4,'image/png',1,1,$5,$6)",[id,f.data.orgA,ticket,randomUUID(),Buffer.from("89504e470d0a1a0a","hex"),f.data.accounts.tenant.userId]);
  const h=await f.manager.readHandoff(f.data.accounts.manager.digest,t.ticket.id);
  expect((h as unknown as {packetSource:{sourcePhotoIds:string[]}}).packetSource?.sourcePhotoIds).toEqual([photo]);
  const packet=await f.manager.publishPacket(f.data.accounts.manager.digest,handoff.assignment!.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:1,expectedPacketRevisionId:null,workSummary:"합성 점검",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null});
  expect(packet.currentPacket!.allowedPhotoIds).toEqual([]);
});
it("reflects a missing canonical address without deriving it from private text",async()=>{
  const {t}=await f.prepared();
  await f.p.admin.query("UPDATE core_flow.building_context SET body=body-'serviceAddress' WHERE org_id=$1",[f.data.orgA]);
  try{const h=await f.manager.readHandoff(f.data.accounts.manager.digest,t.ticket.id);expect((h as unknown as {packetSource:{serviceAddress:string|null}}).packetSource?.serviceAddress).toBeNull();expect(JSON.stringify(h).includes("합성 비공개 접수 내용")).toBe(false);}
  finally{await f.p.admin.query("UPDATE core_flow.building_context SET body=body || jsonb_build_object('serviceAddress','합성 테스트 주소') WHERE org_id=$1",[f.data.orgA]);}
});
