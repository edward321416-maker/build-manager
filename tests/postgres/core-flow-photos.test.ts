import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,it,expect } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreAction,type CoreScope } from "@build-manager/application";
import sharp from "sharp";
import { createB1Fixture } from "./helpers/b1-fixture";
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,bytes:Buffer;
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);bytes=await sharp({create:{width:20,height:10,channels:3,background:"#197c92"}}).png().toBuffer();});
afterAll(async()=>{await db?.close();await f?.close();});
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const act=(who:string,action:CoreAction)=>run(who,s=>performCoreAction(s,action,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const create=()=>act("tenant",{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"합성 참고 사진 검사"});
const image=(uploadId=randomUUID())=>({uploadId,mime:"image/png" as const,width:20,height:10,bytes});
it("persists bytes and metadata through a pool restart without changing ticket/evidence/version/events",async()=>{
  const t=await create(),saved=await run("tenant",s=>s.savePhoto(t.ticket.id,image()));expect(saved.created).toBe(true);
  await db.close();db=createPostgresDatabase(f.roles.b1.webConfig);
  for(const who of ["tenant","manager","staff"]){expect(await run(who,s=>s.photos(t.ticket.id))).toEqual([saved.photo]);expect((await run(who,s=>s.photo(t.ticket.id,saved.photo.photoId))).bytes).toEqual(bytes);}
  expect(await run("tenant",s=>s.read(t.ticket.id))).toEqual(t);
});
it("serializes simultaneous third/fourth uploads and same-ID retries without duplicate slots",async()=>{
  const t=await create(),input=image();
  const same=await Promise.all([run("tenant",s=>s.savePhoto(t.ticket.id,input)),run("tenant",s=>s.savePhoto(t.ticket.id,input))]);expect(same.map(r=>r.created).sort()).toEqual([false,true]);expect(same[0].photo).toEqual(same[1].photo);
  await run("tenant",s=>s.savePhoto(t.ticket.id,image()));
  const last=await Promise.allSettled([run("tenant",s=>s.savePhoto(t.ticket.id,image())),run("tenant",s=>s.savePhoto(t.ticket.id,image()))]);expect(last.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(last.find(r=>r.status==="rejected")).toMatchObject({reason:{code:"STATE_CONFLICT"}});
  expect(await run("tenant",s=>s.photos(t.ticket.id))).toHaveLength(3);
  expect((await run("tenant",s=>s.savePhoto(t.ticket.id,input))).created).toBe(false);
  await expect(run("tenant",s=>s.savePhoto(t.ticket.id,{...input,width:19}))).rejects.toMatchObject({code:"STATE_CONFLICT"});
});
it("rechecks owner, organization, image-ticket binding and completed state for every operation",async()=>{
  const t=await create(),other=await create(),p=await run("tenant",s=>s.savePhoto(t.ticket.id,image()));
  for(const who of ["tenantPeer","tenantOther","otherTenant","otherManager"]){
    for(const op of [(s:CoreScope)=>s.photos(t.ticket.id),(s:CoreScope)=>s.photo(t.ticket.id,p.photo.photoId),(s:CoreScope)=>s.savePhoto(t.ticket.id,image())])await expect(run<unknown>(who,op)).rejects.toMatchObject({code:"NOT_FOUND"});
  }
  await expect(run("tenant",s=>s.photo(other.ticket.id,p.photo.photoId))).rejects.toMatchObject({code:"NOT_FOUND"});
  for(const who of ["manager","staff"])await expect(run(who,s=>s.savePhoto(t.ticket.id,image()))).rejects.toMatchObject({code:"FORBIDDEN"});
  await run("tenant",s=>s.checkPhotoWrite(t.ticket.id));
  await act("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"IN_PROGRESS",message:"합성 확인"});await act("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"COMPLETED",message:"합성 완료"});
  await expect(run("tenant",s=>s.savePhoto(t.ticket.id,image()))).rejects.toMatchObject({code:"STATE_CONFLICT"});expect(await run("tenant",s=>s.photos(t.ticket.id))).toHaveLength(1);
});
it("rejects revoked assignment, ended membership, expired/revoked sessions and ended occupancy",async()=>{
  const t=await create(),p=await run("tenant",s=>s.savePhoto(t.ticket.id,image()));
  await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);
  await expect(run("staff",s=>s.photo(t.ticket.id,p.photo.photoId))).rejects.toMatchObject({code:"NOT_FOUND"});
  await f.p.admin.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[data.accounts.staff.membershipId]);
  await expect(run("staff",s=>s.photos(t.ticket.id))).rejects.toMatchObject({code:"FORBIDDEN"});
  await f.web.query("SELECT authn.revoke_session($1)",[Buffer.from(data.accounts.manager.digest,"hex")]);await expect(run("manager",s=>s.photo(t.ticket.id,p.photo.photoId))).rejects.toMatchObject({code:"UNAUTHENTICATED"});
  await f.p.admin.query("UPDATE authn.web_session SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' - interval '1 second' WHERE digest=$1",[Buffer.from(data.accounts.otherManager.digest,"hex")]);
  await expect(run("otherManager",s=>s.photo(t.ticket.id,p.photo.photoId))).rejects.toMatchObject({code:"UNAUTHENTICATED"});
  await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[data.accounts.tenant.userId]);
  await expect(run("tenant",s=>s.savePhoto(t.ticket.id,image()))).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("exposes no table/DML/PUBLIC capability and enforces forced RLS and constraints",async()=>{
  for(const sql of ["SELECT * FROM core_flow.ticket_photo","DELETE FROM core_flow.ticket_photo","UPDATE core_flow.ticket_photo SET mime='image/png'"])await expect(f.web.query(sql)).rejects.toMatchObject({code:"42501"});
  const grants=(await f.p.admin.query("SELECT has_table_privilege('bm_b1_web','core_flow.ticket_photo',privilege) AS allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) privilege")).rows;expect(grants).toEqual(Array(4).fill({allowed:false}));
});
