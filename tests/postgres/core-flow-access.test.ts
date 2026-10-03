import { randomUUID,randomBytes } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { createB1Fixture } from "./helpers/b1-fixture";
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,port:ReturnType<typeof createCoreAccessPort>;
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);port=createCoreAccessPort(db);});
afterAll(async()=>{await db?.close();await f?.close();});
it("discovers tenant-only associations and binds a newly registered session without trusted scope insertion",async()=>{
 const a=data.accounts.tenant,identity=(await f.p.admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1",[a.userId])).rows[0];
 const digest=randomBytes(32);await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour')",[identity.issuer,identity.subject,digest]);
 expect(await port.organizations(digest.toString("hex"))).toEqual([{id:data.orgA,name:"RC1 합성 개발 조직",role:"TENANT"}]);
 expect((await port.inOrganization(data.orgA).run(digest.toString("hex"),s=>s.units())).map(u=>u.id)).toEqual([data.unitA]);
 await expect(port.inOrganization(data.orgB).run(digest.toString("hex"),s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("returns no associations for unassigned actor and rejects a revoked registry session",async()=>{
 const digest=randomBytes(32);await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour')",["https://rc1.synthetic.invalid/",randomUUID(),digest]);
 expect(await port.organizations(digest.toString("hex"))).toEqual([]);
 await expect(port.inOrganization(data.orgA).run(digest.toString("hex"),s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
 await f.web.query("SELECT authn.revoke_session($1)",[digest]);await expect(port.organizations(digest.toString("hex"))).rejects.toMatchObject({code:"UNAUTHENTICATED"});
});
it("serializes same-session organization binding through the whole transaction",async()=>{
 const a=data.accounts.manager;await f.p.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')",[data.orgB,a.userId]);
 expect((await port.organizations(a.digest)).map(o=>o.id).sort()).toEqual([data.orgA,data.orgB].sort());
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>{enter=r;}),hold=new Promise<void>(r=>{release=r;});
 const first=port.inOrganization(data.orgA).run(a.digest,async s=>{enter();await hold;return (await s.units()).map(u=>u.buildingId);});await entered;
 const second=port.inOrganization(data.orgB).run(a.digest,async s=>(await s.units()).map(u=>u.buildingId));
 try{await expect.poll(async()=>(await f.p.admin.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].n).toBeGreaterThan(0);}finally{release();}
 expect(await first).toEqual([data.propertyA,data.propertyA]);expect(await second).toEqual([data.propertyB]);
});
it("rechecks ended occupancy, membership and property assignment",async()=>{
 await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[data.accounts.tenantOther.userId]);
 expect(await port.organizations(data.accounts.tenantOther.digest)).toEqual([]);
 await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);
 expect(await port.inOrganization(data.orgA).run(data.accounts.staff.digest,s=>s.units())).toEqual([]);
 await f.p.admin.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[data.accounts.staff.membershipId]);
 expect(await port.organizations(data.accounts.staff.digest)).toEqual([]);
 await expect(port.inOrganization(data.orgA).run(data.accounts.staff.digest,s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("exposes only bounded capabilities, never direct runtime tables or discovery role membership",async()=>{
 const role=(await f.p.admin.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='bm_core_access_owner'")).rows[0];expect(Object.values(role)).toEqual(Array(7).fill(false));
 expect((await f.p.admin.query("SELECT r.rolname member,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE a.roleid='bm_core_access_owner'::regrole")).rows).toEqual([{member:"bm_pf02a_migrator",admin_option:false,inherit_option:false,set_option:true}]);
 expect((await f.p.admin.query("SELECT polname,polpermissive FROM pg_policy WHERE polname LIKE 'core_access_%' ORDER BY polname")).rows).toEqual(["member","occupancy","org","resident"].flatMap(n=>[{polname:`core_access_${n}`,polpermissive:true},{polname:`core_access_${n}_ceiling`,polpermissive:false}]).sort((a,b)=>a.polname.localeCompare(b.polname)));
 for(const sql of ["SELECT * FROM core_flow.session_scope","INSERT INTO core_flow.session_scope VALUES(decode(repeat('aa',32),'hex'),gen_random_uuid())","SET ROLE bm_core_access_owner"])await expect(f.web.query(sql)).rejects.toMatchObject({code:"42501"});
 const funcs=(await f.p.admin.query("SELECT proname,pg_get_userbyid(proowner) owner,proconfig,prosecdef FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname IN ('access_organizations','bind_organization') ORDER BY proname")).rows;
 expect(funcs).toEqual([{proname:"access_organizations",owner:"bm_core_access_owner",proconfig:["search_path=pg_catalog"],prosecdef:true},{proname:"bind_organization",owner:"bm_core_flow_owner",proconfig:["search_path=pg_catalog"],prosecdef:true}]);
});
