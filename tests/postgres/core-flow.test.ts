import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { createOrganizationMembershipTerminationPort } from "@build-manager/persistence-postgres/b5";
import { performCoreAction,type CoreAction } from "@build-manager/application";
import { createB1Fixture } from "./helpers/b1-fixture";

let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
beforeAll(async()=>{
  f=await createB1Fixture();
  await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
  data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);
});
afterAll(async()=>{await db?.close();await f?.close();});
const act=(who:string,action:CoreAction)=>createCoreFlowPort(db).run(data.accounts[who].digest,s=>performCoreAction(s,action,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const create=(who="tenant")=>act(who,{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"합성 개발 누수 접수"});

it("persists tenant-manager-tenant handling and history across pool restart, separately from route decisions",async()=>{
  const ticket=await create();expect(ticket.workStatus).toBe("OPEN");
  const started=await act("manager",{type:"HANDLING",ticketId:ticket.ticket.id,status:"IN_PROGRESS",message:"합성 현장 확인 기록"});
  expect(started.ticket.status).toBe(ticket.ticket.status);
  await act("manager",{type:"HANDLING",ticketId:ticket.ticket.id,status:"COMPLETED",message:"관리자가 완료로 기록한 합성 처리"});
  await db.close();db=createPostgresDatabase(f.roles.b1.webConfig);
  const result=await createCoreFlowPort(db).run(data.accounts.tenant.digest,s=>s.read(ticket.ticket.id));
  expect(result.workStatus).toBe("COMPLETED");expect(result.version).toBe(3);
  expect(result.events.map(e=>e.kind)).toEqual(["CREATED","HANDLING","HANDLING"]);
  expect(result.events.map(e=>e.actorRole)).toEqual(["TENANT","ORG_ADMIN","ORG_ADMIN"]);
  expect(result.ticket.routeDecision).toBeNull();
});
it("denies another tenant including co-occupants, other organizations, and tenant manager actions",async()=>{
  const ticket=await create();
  for(const who of ["tenantPeer","tenantOther","otherTenant","otherManager"])
    await expect(createCoreFlowPort(db).run(data.accounts[who].digest,s=>s.read(ticket.ticket.id))).rejects.toMatchObject({code:"NOT_FOUND"});
  await expect(act("tenant",{type:"HANDLING",ticketId:ticket.ticket.id,status:"IN_PROGRESS",message:"forbidden"})).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(act("manager",{type:"CREATE",unitId:data.unitA,issueType:"HEATING",rawUserText:"invalid role"})).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(act("tenant",{type:"CREATE",unitId:data.unitB,issueType:"HEATING",rawUserText:"invalid unit"})).rejects.toMatchObject({code:"NOT_FOUND"});
});
it("lists only authorized units and tenant-owned history",async()=>{
  const tenant=await createCoreFlowPort(db).run(data.accounts.tenant.digest,async s=>({units:await s.units(),list:await s.list()}));
  expect(tenant.units.map(u=>u.id)).toEqual([data.unitA]);expect(tenant.list.length).toBeGreaterThan(0);
  const peer=await createCoreFlowPort(db).run(data.accounts.tenantPeer.digest,s=>s.list());expect(peer).toEqual([]);
  const manager=await createCoreFlowPort(db).run(data.accounts.manager.digest,s=>s.units());expect(manager).toHaveLength(2);
});
it("uses existing safety protocol and refuses automatic completion without a handling record",async()=>{
  const ticket=await act("tenant",{type:"CREATE",unitId:data.unitA,issueType:"HEATING",rawUserText:"가스 냄새가 나요"});
  expect(ticket.ticket.status).toBe("SAFETY_ESCALATED");
  await expect(act("manager",{type:"HANDLING",ticketId:ticket.ticket.id,status:"COMPLETED",message:"too soon"})).rejects.toMatchObject({code:"STATE_CONFLICT"});
});
it("denies direct tables and public capabilities; runtime cannot create org scope",async()=>{
  for(const table of ["session_scope","ticket","ticket_event","ticket_photo","building_context"])
    await expect(f.web.query(`SELECT * FROM core_flow.${table}`)).rejects.toMatchObject({code:"42501"});
  const publicFunctions=(await f.p.admin.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='core_flow' AND EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0)")).rows;
  expect(publicFunctions).toEqual([]);
});
it("rechecks assignment withdrawal and B5 membership termination on the same session",async()=>{
  const t=await create();
  await createCoreFlowPort(db).run(data.accounts.staff.digest,s=>s.read(t.ticket.id));
  await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);
  await expect(createCoreFlowPort(db).run(data.accounts.staff.digest,s=>s.read(t.ticket.id))).rejects.toMatchObject({code:"NOT_FOUND"});
  await createOrganizationMembershipTerminationPort(db).endCurrent(data.accounts.manager.digest,data.orgA,data.accounts.staff.membershipId!);
  await expect(createCoreFlowPort(db).run(data.accounts.staff.digest,s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("rejects revoked sessions and ended occupancy without disclosing stored tickets",async()=>{
  await f.p.admin.query("UPDATE app.occupancy_member SET joined_at=clock_timestamp()+interval '1 day' WHERE user_id=$1",[data.accounts.tenantOther.userId]);
  await expect(createCoreFlowPort(db).run(data.accounts.tenantOther.digest,s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
  await f.p.admin.query("UPDATE app.occupancy_member SET joined_at=clock_timestamp()-interval '1 minute' WHERE user_id=$1",[data.accounts.tenantOther.userId]);
  await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[data.accounts.tenantOther.userId]);
  await expect(createCoreFlowPort(db).run(data.accounts.tenantOther.digest,s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
  await f.web.query("SELECT authn.revoke_session($1)",[Buffer.from(data.accounts.tenantPeer.digest,"hex")]);
  await expect(createCoreFlowPort(db).run(data.accounts.tenantPeer.digest,s=>s.units())).rejects.toMatchObject({code:"UNAUTHENTICATED"});
});

it("pins RC1 owner, membership, FORCE RLS and exact capability exposure",async()=>{
  const role=(await f.p.admin.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='bm_core_flow_owner'")).rows[0];
  expect(Object.values(role)).toEqual(Array(7).fill(false));
  const grants=(await f.p.admin.query("SELECT r.rolname AS member,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE a.roleid='bm_core_flow_owner'::regrole")).rows;
  expect(grants).toEqual([{member:"bm_pf02a_migrator",admin_option:false,inherit_option:false,set_option:true}]);
  const tables=(await f.p.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='core_flow'::regnamespace AND relkind='r' ORDER BY relname")).rows;
  expect(tables).toEqual(["building_context","session_scope","ticket","ticket_communication_thread","ticket_event","ticket_follow_up","ticket_internal_note","ticket_outcome_assertion","ticket_photo","ticket_public_message","ticket_work","unit_maintenance_fact"].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:true})));
  const funcs=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) AS owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') AS web FROM pg_proc WHERE pronamespace='core_flow'::regnamespace ORDER BY proname")).rows;
  // Exact approved 0019/0023 additions are owner-only bridges. Preserve the original Core capability baseline below.
  const vendorBridges=new Set(["vendor_handoff_complete","vendor_handoff_lock_ticket","vendor_handoff_manager_context","vendor_handoff_mark_offered","vendor_handoff_recheck_occupancy","vendor_handoff_source","vendor_handoff_source_photo","vendor_handoff_tenant_context"]);
  expect(funcs.filter(f=>vendorBridges.has(f.proname))).toEqual([...vendorBridges].sort().map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:false})));
  const baselineFuncs=funcs.filter(f=>!vendorBridges.has(f.proname));
  expect(baselineFuncs).toEqual(["access_organizations","append_internal_note","bind_organization","building","can_unit","check_photo_write","communication_message_json","communication_receipt","communication_summaries","communication_ticket","communication_valid_body","confirm_ticket_resolved","correct_unit_maintenance_fact","create_ticket_follow_up","create_unit_maintenance_fact","guard_communication_completion","list_internal_notes","list_manager_work","list_photos","list_tickets","maintenance_current_fact","maintenance_fact_json","maintenance_request_fingerprint","maintenance_ticket","maintenance_valid_component","manager_ticket","manager_work_json","outcome_assertion_json","outcome_fingerprint","outcome_receipt","outcome_ticket","read_communication","read_follow_up_source","read_manager_work","read_photo","read_ticket","read_ticket_maintenance_fact","read_ticket_outcome","read_unit_maintenance_facts","save_photo","send_communication","session","store_ticket","units","update_manager_work","validate_ticket_follow_up"].map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:proname==="access_organizations"?"bm_core_access_owner":"bm_core_flow_owner",web:!["can_unit","maintenance_current_fact","maintenance_fact_json","maintenance_request_fingerprint","maintenance_ticket","maintenance_valid_component","manager_ticket","manager_work_json","communication_message_json","communication_ticket","communication_valid_body","outcome_assertion_json","outcome_fingerprint","outcome_ticket","validate_ticket_follow_up"].includes(proname)})));
});
