import { createHash,randomBytes,randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll,beforeAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import type { OnboardingAction,OnboardingResult } from "@build-manager/application";
import { createB1Fixture } from "./helpers/b1-fixture";
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const token=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);});
afterAll(async()=>{await db?.close();await f?.close();});
type View={invitationId:string;requestNumber:string|null;state:string;unitId:string;createdAt:string;expiresAt:string};
function value(r:OnboardingResult):View {expect(r).toHaveProperty("data");return (r as {data:View}).data;}
async function actor(){const digest=token(),userId=(await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour') id",["https://onboarding.synthetic.invalid/",randomUUID(),Buffer.from(digest,"hex")])).rows[0].id as string;return {digest,userId};}
async function unit(){const id=randomUUID();await f.p.admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",[id,data.orgA,data.propertyA,`Synthetic invitation ${id}`]);return id;}
const cmd=(action:OnboardingAction,input:Record<string,unknown>={},digest=data.accounts.manager.digest,org:string|null=data.orgA)=>createCoreOnboardingPort(db).execute(digest,action,org,input);
async function invitation(){const unitId=await unit(),tokenDigest=token();const view=value(await cmd("CREATE",{unitId,tokenDigest}));return {...view,tokenDigest};}
async function requested(){const invite=await invitation(),applicant=await actor();const view=value(await cmd("CLAIM",{tokenDigest:invite.tokenDigest},applicant.digest,null));return {...invite,...view,applicant};}
const decision=(i:View)=>({invitationId:i.invitationId,requestNumber:i.requestNumber});
async function raw(c:Client,action:OnboardingAction,input:Record<string,unknown>,digest=data.accounts.manager.digest,org:string|null=data.orgA):Promise<OnboardingResult>{return (await c.query("SELECT core_onboarding.command($1,$2,$3,$4) value",[Buffer.from(digest,"hex"),action,org,input])).rows[0].value;}
async function pair(first:(c:Client)=>Promise<OnboardingResult>,second:(c:Client)=>Promise<OnboardingResult>){
 const a=new Client(f.roles.b1.webConfig),b=new Client(f.roles.b1.webConfig);await a.connect();await b.connect();
 try{await a.query("BEGIN ISOLATION LEVEL READ COMMITTED");await b.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  const pid=(await b.query("SELECT pg_backend_pid() pid")).rows[0].pid;
  const one=await first(a),waiting=second(b);
  try{await expect.poll(async()=>(await f.p.admin.query("SELECT cardinality(pg_blocking_pids($1)) n",[pid])).rows[0].n).toBeGreaterThan(0);}finally{await a.query("COMMIT");}
  const two=await waiting;await b.query("COMMIT");return [one,two];
 }finally{await a.query("ROLLBACK");await b.query("ROLLBACK");await a.end();await b.end();}
}
it("uses current admin scope, a vacant unit, digest-only token and DB-clock 24h expiry",async()=>{
 const i=await invitation();expect(i.state).toBe("OPEN");expect(new Date(i.expiresAt).getTime()-new Date(i.createdAt).getTime()).toBe(86_400_000);
 expect(await cmd("CREATE",{unitId:i.unitId,tokenDigest:token()})).toEqual({code:"STATE_CONFLICT"});
 expect(await cmd("CREATE",{unitId:data.unitA,tokenDigest:token()})).toEqual({code:"STATE_CONFLICT"});
 expect(await cmd("CREATE",{unitId:i.unitId,tokenDigest:token()},data.accounts.staff.digest)).toEqual({code:"FORBIDDEN"});
 expect(await cmd("CREATE",{unitId:i.unitId,tokenDigest:token()},data.accounts.otherManager.digest)).toEqual({code:"NOT_FOUND"});
 const rows=(await f.p.admin.query("SELECT encode(token_digest,'hex') digest,state,applicant_id FROM core_onboarding.invitation WHERE id=$1",[i.invitationId])).rows;
 expect(rows).toEqual([{digest:i.tokenDigest,state:"OPEN",applicant_id:null}]);
});
it("allows zero-org applicant inspection without mutation; request alone grants no access; approval discovers normal units",async()=>{
 const i=await invitation(),a=await actor(),access=createCoreAccessPort(db);
 expect(await access.organizations(a.digest)).toEqual([]);
 expect(value(await cmd("INSPECT",{tokenDigest:i.tokenDigest},a.digest,null)).state).toBe("OPEN");
 expect((await f.p.admin.query("SELECT applicant_id FROM core_onboarding.invitation WHERE id=$1",[i.invitationId])).rows[0].applicant_id).toBeNull();
 const claim=value(await cmd("CLAIM",{tokenDigest:i.tokenDigest},a.digest,null));expect(claim.state).toBe("REQUESTED");
 expect(value(await cmd("CLAIM",{tokenDigest:i.tokenDigest},a.digest,null))).toEqual(claim);
 expect(await access.organizations(a.digest)).toEqual([]);
 await expect(access.inOrganization(data.orgA).run(a.digest,s=>s.units())).rejects.toMatchObject({code:"FORBIDDEN"});
 expect((await cmd("MINE",{},a.digest,null) as {data:{items:View[]}}).data.items).toEqual([claim]);
 expect(value(await cmd("APPROVE",decision(claim))).state).toBe("APPROVED");
 expect((await access.organizations(a.digest)).map(x=>x.role)).toEqual(["TENANT"]);
 expect((await access.inOrganization(data.orgA).run(a.digest,s=>s.units())).map(x=>x.id)).toEqual([i.unitId]);
 expect(value(await cmd("APPROVE",decision(claim))).state).toBe("APPROVED");
 expect((await f.p.admin.query("SELECT count(*)::int n FROM app.occupancy WHERE unit_id=$1",[i.unitId])).rows[0].n).toBe(1);
 expect(await cmd("REJECT",decision(claim))).toEqual({code:"STATE_CONFLICT"});
});
it("binds the first applicant, refuses other actors and client identity claims",async()=>{
 const i=await requested(),b=await actor();
 for(const action of ["INSPECT","CLAIM"] as const)expect(await cmd(action,{tokenDigest:i.tokenDigest},b.digest,null)).toEqual({code:"NOT_FOUND"});
 expect((await cmd("MINE",{},b.digest,null) as {data:{items:unknown[]}}).data.items).toEqual([]);
 expect(await cmd("CLAIM",{tokenDigest:i.tokenDigest,userId:b.userId},i.applicant.digest,null)).toEqual({code:"INVALID_INPUT"});
 expect(await cmd("APPROVE",{invitationId:i.invitationId,requestNumber:randomUUID()})).toEqual({code:"STATE_CONFLICT"});
});
it("reject/revoke preserve history; expiration releases the unique slot only for a new invitation",async()=>{
 for(const action of ["REJECT","REVOKE"] as const){const i=await requested();expect(value(await cmd(action,decision(i))).state).toBe(action==="REJECT"?"REJECTED":"REVOKED");expect(await cmd("CLAIM",{tokenDigest:i.tokenDigest},i.applicant.digest,null)).toEqual({code:"STATE_CONFLICT"});expect(await cmd("APPROVE",decision(i))).toEqual({code:"STATE_CONFLICT"});expect(value(await cmd("CREATE",{unitId:i.unitId,tokenDigest:token()})).state).toBe("OPEN");}
 const i=await requested();await f.p.admin.query("UPDATE core_onboarding.invitation SET created_at=clock_timestamp()-interval '25 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[i.invitationId]);
 expect(await cmd("APPROVE",decision(i))).toEqual({code:"STATE_CONFLICT"});expect(value(await cmd("CREATE",{unitId:i.unitId,tokenDigest:token()})).state).toBe("OPEN");
 expect((await f.p.admin.query("SELECT state FROM core_onboarding.invitation WHERE id=$1",[i.invitationId])).rows[0].state).toBe("EXPIRED");
});
it("limits actor token attempts across separate pools including unknown-token failures",async()=>{
 const a=await actor(),otherDb=createPostgresDatabase(f.roles.b1.webConfig);
 try{for(let n=0;n<20;n++)expect(await createCoreOnboardingPort(n%2?db:otherDb).execute(a.digest,"INSPECT",null,{tokenDigest:token()})).toEqual({code:"NOT_FOUND"});
 expect(await cmd("INSPECT",{tokenDigest:token()},a.digest,null)).toEqual({code:"RATE_LIMITED"});
 expect((await f.p.admin.query("SELECT cardinality(attempts) n FROM core_onboarding.token_attempt WHERE actor_id=$1",[a.userId])).rows[0].n).toBe(20);
 }finally{await otherDb.close();}
});
it("never permits self approval and does not require the applicant's old session to remain active",async()=>{
 const i=await invitation(),claim=value(await cmd("CLAIM",{tokenDigest:i.tokenDigest},data.accounts.manager.digest,null));
 expect(await cmd("APPROVE",decision(claim))).toEqual({code:"FORBIDDEN"});
 const j=await requested();await f.web.query("SELECT authn.revoke_session($1)",[Buffer.from(j.applicant.digest,"hex")]);
 expect(value(await cmd("APPROVE",decision(j))).state).toBe("APPROVED");
 const k=await requested();await f.p.admin.query("UPDATE app.app_user SET status='SUSPENDED' WHERE id=$1",[k.applicant.userId]);
 expect(await cmd("APPROVE",decision(k))).toEqual({code:"STATE_CONFLICT"});
});
it("two applicants serialize at the organization lock and exactly one owns the request",async()=>{
 const i=await invitation(),a=await actor(),b=await actor();
 const [one,two]=await pair(c=>raw(c,"CLAIM",{tokenDigest:i.tokenDigest},a.digest,null),c=>raw(c,"CLAIM",{tokenDigest:i.tokenDigest},b.digest,null));
 expect(value(one).state).toBe("REQUESTED");expect(two).toEqual({code:"NOT_FOUND"});
 expect((await f.p.admin.query("SELECT applicant_id FROM core_onboarding.invitation WHERE id=$1",[i.invitationId])).rows[0].applicant_id).toBe(a.userId);
});
it.each(["APPROVE","REJECT","REVOKE"] as const)("approve versus %s has a measured lock wait and one atomic result",async action=>{
 const i=await requested(),[one,two]=await pair(c=>raw(c,"APPROVE",decision(i)),c=>raw(c,action,decision(i)));
 expect(value(one).state).toBe("APPROVED");if(action==="APPROVE")expect(two).toEqual(one);else expect(two).toEqual({code:"STATE_CONFLICT"});
 const row=(await f.p.admin.query("SELECT i.state,count(m.id)::int n FROM core_onboarding.invitation i JOIN app.occupancy o ON o.org_id=i.org_id AND o.id=i.occupancy_id JOIN app.occupancy_member m ON m.org_id=i.org_id AND m.occupancy_id=o.id AND m.id=i.occupant_id WHERE i.id=$1 GROUP BY i.state",[i.invitationId])).rows[0];
 expect(row).toEqual({state:"APPROVED",n:1});
});
it.each(["REJECT","REVOKE"] as const)("%s committed before approval cannot be overwritten",async action=>{
 const i=await requested(),[one,two]=await pair(c=>raw(c,action,decision(i)),c=>raw(c,"APPROVE",decision(i)));
 expect(value(one).state).toBe(action==="REJECT"?"REJECTED":"REVOKED");expect(two).toEqual({code:"STATE_CONFLICT"});
 expect((await f.p.admin.query("SELECT count(*)::int n FROM app.occupancy WHERE unit_id=$1",[i.unitId])).rows[0].n).toBe(0);
});
it("creator B5 termination committed first invalidates approval and future claims",async()=>{
 const creator=await actor(),member=randomUUID();await f.p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[member,data.orgA,creator.userId]);
 const tokenDigest=token(),i=value(await cmd("CREATE",{unitId:await unit(),tokenDigest},creator.digest)),a=await actor();
 const claim=value(await cmd("CLAIM",{tokenDigest},a.digest,null));
 const [one,two]=await pair(async c=>{await c.query("SELECT authn.current_actor($1),authn.authorize_org($1,$2)",[Buffer.from(data.accounts.manager.digest,"hex"),data.orgA]);await c.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[data.orgA,data.accounts.manager.digest]);const r=await c.query("SELECT authn.b5_end_organization_membership($1,$2,$3) result",[Buffer.from(data.accounts.manager.digest,"hex"),data.orgA,member]);expect(r.rows[0].result).toBe("ENDED");return {data:r.rows[0].result};},c=>raw(c,"APPROVE",decision(claim)));
 expect(one).toEqual({data:"ENDED"});expect(two).toEqual({code:"NOT_FOUND"});expect(await cmd("INSPECT",{tokenDigest},a.digest,null)).toEqual({code:"NOT_FOUND"});
 expect((await f.p.admin.query("SELECT count(*)::int n FROM app.occupancy WHERE unit_id=$1",[i.unitId])).rows[0].n).toBe(0);
});
it("a concurrent external occupancy commits first, leaving no partial approval or replacement",async()=>{
 const i=await requested(),admin=new Client(f.p.adminConfig),web=new Client(f.roles.b1.webConfig);await admin.connect();await web.connect();
 try{await admin.query("BEGIN");const existing=(await admin.query("INSERT INTO app.occupancy(org_id,unit_id,starts_at,status) VALUES($1,$2,clock_timestamp(),'ACTIVE') RETURNING id",[data.orgA,i.unitId])).rows[0].id;
 const pid=(await web.query("SELECT pg_backend_pid() pid")).rows[0].pid,wait=raw(web,"APPROVE",decision(i));
 try{await expect.poll(async()=>(await f.p.admin.query("SELECT cardinality(pg_blocking_pids($1)) n",[pid])).rows[0].n).toBeGreaterThan(0);}finally{await admin.query("COMMIT");}
 expect(await wait).toEqual({code:"STATE_CONFLICT"});
 expect((await f.p.admin.query("SELECT id FROM app.occupancy WHERE unit_id=$1",[i.unitId])).rows).toEqual([{id:existing}]);
 expect((await f.p.admin.query("SELECT state,occupancy_id,occupant_id FROM core_onboarding.invitation WHERE id=$1",[i.invitationId])).rows[0]).toEqual({state:"REQUESTED",occupancy_id:null,occupant_id:null});
 }finally{await admin.query("ROLLBACK");await admin.end();await web.end();}
});
it("keeps exact owner, RLS, function ACLs and actual runtime SQL negatives",async()=>{
 const role=(await f.p.admin.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='bm_core_onboarding_owner'")).rows[0];expect(Object.values(role)).toEqual(Array(7).fill(false));
 expect((await f.p.admin.query("SELECT r.rolname member,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE a.roleid='bm_core_onboarding_owner'::regrole")).rows).toEqual([{member:"bm_pf02a_migrator",admin_option:false,inherit_option:false,set_option:true}]);
 const policies=(await f.p.admin.query("SELECT n.nspname,c.relname,p.polname,p.polpermissive,p.polcmd,pg_get_expr(p.polqual,p.polrelid) expression,p.polroles::oid[] roles FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE 'bm_core_onboarding_owner'::regrole=ANY(p.polroles) ORDER BY p.polname")).rows;
 expect(policies.map(p=>p.polname)).toEqual(["attempt_capability","invitation_capability","onboarding_context","onboarding_context_ceiling","onboarding_member_ceiling","onboarding_occupancy_ceiling","onboarding_org_ceiling","onboarding_property_ceiling","onboarding_resident_ceiling","onboarding_unit_ceiling"]);
 for(const p of policies){expect(p.roles).toHaveLength(1);expect(p.polcmd).toBe("*");expect(p.polpermissive).toBe(!p.polname.endsWith("ceiling"));expect(p.expression).toBe(p.nspname==="core_onboarding"?"true":p.relname==="organization"?"(id = app.current_org_id())":"(org_id = app.current_org_id())");}
 const funcs=(await f.p.admin.query("SELECT p.proname,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,coalesce(array_agg(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END ORDER BY a.grantee::regrole::text) FILTER(WHERE a.privilege_type='EXECUTE'),ARRAY[]::text[]) executors FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_onboarding'::regnamespace GROUP BY p.oid ORDER BY p.proname")).rows;
 expect(funcs.map(x=>({name:x.proname,owner:x.owner,definer:x.prosecdef,config:x.proconfig,executors:[...x.executors].sort()}))).toEqual(["command","is_admin","view_invitation"].map(name=>({name,owner:"bm_core_onboarding_owner",definer:true,config:["search_path=pg_catalog"],executors:(name==="command"?["bm_b1_web","bm_core_onboarding_owner"]:["bm_core_onboarding_owner"])})));
 expect((await f.p.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='core_onboarding'::regnamespace AND relkind='r' ORDER BY relname")).rows).toEqual(["invitation","token_attempt"].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:true})));
 for(const sql of ["SET ROLE bm_core_onboarding_owner","SELECT * FROM core_onboarding.invitation","SELECT core_onboarding.view_invitation(gen_random_uuid())","INSERT INTO app.occupancy(org_id,unit_id,starts_at,status) VALUES(gen_random_uuid(),gen_random_uuid(),clock_timestamp(),'ACTIVE')","UPDATE core_onboarding.invitation SET state='APPROVED'"])await expect(f.web.query(sql)).rejects.toMatchObject({code:"42501"});
 expect(await cmd("MINE",{},token(),null)).toEqual({code:"UNAUTHENTICATED"});
});
