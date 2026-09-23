import { afterAll,beforeAll,expect,it } from 'vitest';
import { randomBytes,randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createPostgresDatabase,withTransaction } from '@build-manager/persistence-postgres';
import { createIdentityBootstrapPort,createOrganizationReadPort } from '@build-manager/persistence-postgres/b1';
import { createB1Fixture } from './helpers/b1-fixture';
let f:Awaited<ReturnType<typeof createB1Fixture>>,loginDb:ReturnType<typeof createPostgresDatabase>,webDb:ReturnType<typeof createPostgresDatabase>,reader:ReturnType<typeof createOrganizationReadPort>;
let a:Awaited<ReturnType<typeof actor>>,b:Awaited<ReturnType<typeof actor>>,none:Awaited<ReturnType<typeof actor>>,staff:Awaited<ReturnType<typeof actor>>;
let orgA:string,orgB:string,propertyA:string,propertyB:string;
async function actor(){const digest=randomBytes(32).toString('hex');const user=await createIdentityBootstrapPort(loginDb).begin({identity:{issuer:'https://synthetic.invalid/',subject:'auth0|'+randomUUID()},digest,expiresAt:new Date(Date.now()+3590000)});return {digest,userId:user.userId};}
async function organization(userId:string){
 const orgId=randomUUID(),propertyId=randomUUID();await f.migration.query('BEGIN');
 try{
 await f.migration.query("SELECT set_config('app.org_id',$1,true)",[orgId]);
 await f.migration.query("INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','Synthetic organization')",[orgId]);
 await f.migration.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')",[orgId,userId]);
 await f.migration.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[propertyId,orgId]);await f.migration.query('COMMIT');
 }catch(e){await f.migration.query('ROLLBACK');throw e;}
 return {orgId,propertyId};
}
async function change(orgId:string,sql:string,args:unknown[]){await f.migration.query('BEGIN');try{await f.migration.query("SELECT set_config('app.org_id',$1,true)",[orgId]);await f.migration.query(sql,args);await f.migration.query('COMMIT');}catch(e){await f.migration.query('ROLLBACK');throw e;}}
beforeAll(async()=>{
 f=await createB1Fixture();loginDb=createPostgresDatabase(f.roles.b1.loginConfig);webDb=createPostgresDatabase({...f.roles.b1.webConfig,max:1});reader=createOrganizationReadPort(webDb);
 a=await actor();b=await actor();none=await actor();staff=await actor();
 ({orgId:orgA,propertyId:propertyA}=await organization(a.userId));({orgId:orgB,propertyId:propertyB}=await organization(b.userId));
 await change(orgA,"INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'PROPERTY_STAFF','ACTIVE')",[orgA,staff.userId]);
 for(const [org,property,user] of [[orgA,propertyA,none.userId],[orgB,propertyB,b.userId]])await change(org,`WITH u AS (
 INSERT INTO app.unit(org_id,property_id,label,status) VALUES($1,$2,'Synthetic unit','ACTIVE') RETURNING id),o AS (
 INSERT INTO app.occupancy(org_id,unit_id,starts_at,status) SELECT $1,id,clock_timestamp(),'ACTIVE' FROM u RETURNING id)
 INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) SELECT $1,id,$3,clock_timestamp(),'ACTIVE' FROM o`,[org,property,user]);
},120000);
afterAll(async()=>{await loginDb?.close();await webDb?.close();await f?.close();});
it('R01 active ORG_ADMIN discovers only own organization and property',async()=>{
 const organizations=await reader.listMine(a.digest,{limit:20});expect(organizations.items.map(x=>x.id)).toEqual([orgA]);
 expect((await reader.listProperties(a.digest,orgA,{limit:20})).items.map(x=>x.id)).toEqual([propertyA]);
 expect((await reader.getProperty(a.digest,orgA,propertyA)).id).toBe(propertyA);
});
it('R02 occupancy-only identity remains empty without automatic admin membership',async()=>{expect(await reader.listMine(none.digest,{limit:20})).toEqual({items:[],nextCursor:null});await expect(reader.getProperty(none.digest,orgA,propertyA)).rejects.toMatchObject({code:'NOT_FOUND'});});
it('R03 known foreign organization/property IDs never disclose data',async()=>{
 await expect(reader.getProperty(a.digest,orgB,propertyB)).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(reader.getProperty(a.digest,orgA,propertyB)).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(reader.listProperties(a.digest,orgB,{limit:20})).rejects.toMatchObject({code:'NOT_FOUND'});
});
it('R04 PROPERTY_STAFF cannot gain organization-wide administrator reads',async()=>{expect((await reader.listMine(staff.digest,{limit:20})).items).toEqual([]);await expect(reader.getProperty(staff.digest,orgA,propertyA)).rejects.toMatchObject({code:'NOT_FOUND'});});
it('R05 committed organization suspension denies new reads',async()=>{
 await change(orgA,"UPDATE app.organization SET status='SUSPENDED' WHERE id=$1",[orgA]);
 try{expect((await reader.listMine(a.digest,{limit:20})).items).toEqual([]);await expect(reader.getProperty(a.digest,orgA,propertyA)).rejects.toMatchObject({code:'NOT_FOUND'});}
 finally{await change(orgA,"UPDATE app.organization SET status='ACTIVE' WHERE id=$1",[orgA]);}
});
it('R05 committed membership termination denies new reads',async()=>{
 await change(orgA,"UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[a.userId]);
 try{await expect(reader.listProperties(a.digest,orgA,{limit:20})).rejects.toMatchObject({code:'NOT_FOUND'});}
 finally{await change(orgA,"UPDATE app.organization_membership SET status='ACTIVE',ended_at=NULL WHERE user_id=$1",[a.userId]);}
});
it('R03 archived property is not exposed',async()=>{
 await change(orgA,"UPDATE app.property SET status='ARCHIVED' WHERE id=$1",[propertyA]);
 try{await expect(reader.getProperty(a.digest,orgA,propertyA)).rejects.toMatchObject({code:'NOT_FOUND'});expect((await reader.listProperties(a.digest,orgA,{limit:20})).items).toEqual([]);}
 finally{await change(orgA,"UPDATE app.property SET status='ACTIVE' WHERE id=$1",[propertyA]);}
});
it('R03 forged digest and arbitrary org GUC cannot authorize',async()=>{
 await expect(reader.listMine(randomBytes(32).toString('hex'),{limit:20})).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 await withTransaction(webDb,async c=>{await c.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[orgB,a.digest]);expect((await c.query('SELECT id FROM app.property')).rows).toHaveLength(0);});
});
it('R05 membership ended between guard and SELECT is denied by current RLS',async()=>{
 await f.web.query('BEGIN');try{
 expect((await f.web.query('SELECT authn.authorize_org($1,$2) AS allowed',[Buffer.from(a.digest,'hex'),orgA])).rows[0].allowed).toBe(true);
 await f.web.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[orgA,a.digest]);
 await change(orgA,"UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[a.userId]);
 expect((await f.web.query('SELECT id FROM app.property')).rows).toHaveLength(0);
 }finally{await f.web.query('ROLLBACK');await change(orgA,"UPDATE app.organization_membership SET status='ACTIVE',ended_at=NULL WHERE user_id=$1",[a.userId]);}
});
it('R03 nested discovery restores caller context and a max-one pool never leaks tenant state',async()=>{
 await withTransaction(webDb,async c=>{
  await c.query("SELECT set_config('app.b1_session_digest',$1,true)",[b.digest]);
  expect((await c.query('SELECT id FROM authn.list_my_organizations($1,NULL,20)',[Buffer.from(a.digest,'hex')])).rows.map(x=>x.id)).toEqual([orgA]);
  expect((await c.query("SELECT current_setting('app.b1_session_digest',true)=$1 AS restored",[b.digest])).rows[0].restored).toBe(true);
 });
 await expect(withTransaction(webDb,async c=>{await c.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[orgA,a.digest]);throw new Error('SYNTHETIC_ROLLBACK');})).rejects.toThrow('SYNTHETIC_ROLLBACK');
 expect((await reader.listProperties(b.digest,orgB,{limit:20})).items.map(x=>x.id)).toEqual([propertyB]);
 await withTransaction(webDb,async c=>{expect((await c.query('SELECT * FROM app.property')).rows).toHaveLength(0);for(const value of ['', 'not-hex','a'.repeat(63),'a'.repeat(65)]){await c.query("SELECT set_config('app.b1_session_digest',$1,true)",[value]);expect((await c.query('SELECT authn.context_session_digest() IS NULL AS absent')).rows[0].absent).toBe(true);}});
});
it('R03 bounded pagination does not widen scope through a foreign cursor',async()=>{
 expect((await reader.listProperties(a.digest,orgA,{after:propertyB,limit:1})).items.every(x=>x.orgId===orgA)).toBe(true);
 await expect(reader.listProperties(a.digest,orgA,{limit:51})).rejects.toMatchObject({code:'INVALID_INPUT'});
});
it('R12 capability owner cannot use old permissive org GUC to widen discovery',async()=>{
 await f.migration.query('BEGIN');try{
  await f.migration.query('SET LOCAL ROLE bm_b1_capability_owner');
  await f.migration.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[orgB,a.digest]);
  expect((await f.migration.query('SELECT id FROM app.organization')).rows.map(x=>x.id)).toEqual([orgA]);
  expect((await f.migration.query('SELECT org_id FROM app.organization_membership')).rows.map(x=>x.org_id)).toEqual([orgA]);
 }finally{await f.migration.query('ROLLBACK');}
});
it('PF02-A runtime grant matrix and six-table isolation survive B1 policies',async()=>{
 const runtime=new Client(f.roles.runtimeConfig);await runtime.connect();
 try{
  for(const table of ['organization','organization_membership','property','unit','occupancy','occupancy_member']){
   const privileges=(await runtime.query("SELECT has_table_privilege(current_user,$1,'SELECT') AS s,has_table_privilege(current_user,$1,'INSERT') AS i,has_table_privilege(current_user,$1,'UPDATE') AS u,has_table_privilege(current_user,$1,'DELETE') AS d",['app.'+table])).rows[0];
   expect(privileges).toEqual({s:true,i:!['organization','organization_membership'].includes(table),u:!['organization','organization_membership'].includes(table),d:false});
   for(const org of [orgA,orgB]){await runtime.query('BEGIN');try{await runtime.query("SELECT set_config('app.org_id',$1,true)",[org]);const column=table==='organization'?'id':'org_id';const rows=(await runtime.query(`SELECT ${column} AS org FROM app.${table}`)).rows;expect(rows.every(x=>x.org===org)).toBe(true);expect(rows.length).toBeGreaterThan(0);}finally{await runtime.query('COMMIT');}}
   expect((await runtime.query(`SELECT * FROM app.${table}`)).rows).toHaveLength(0);
  }
  expect((await runtime.query("SELECT pg_has_role(current_user,'bm_b1_capability_owner','USAGE') AS inherited")).rows[0].inherited).toBe(false);
 }finally{await runtime.end();}
});
it('R12 policy scope is exactly SELECT and B1-only; widening negative control is detectable',async()=>{
 const read=()=>f.migration.query("SELECT polname,polcmd,polpermissive,ARRAY(SELECT rolname::text FROM pg_roles WHERE oid=ANY(p.polroles) ORDER BY rolname) AS roles,0=ANY(polroles) AS public FROM pg_policy p WHERE polname LIKE 'b1_%' ORDER BY polname");
 const rows=(await read()).rows;expect(rows).toHaveLength(5);
 for(const r of rows){expect(r.polcmd).toBe('r');expect(r.public).toBe(false);expect(r.roles).toEqual([r.polname==='b1_property_ceiling'?'bm_b1_web':'bm_b1_capability_owner']);expect(r.polpermissive).toBe(r.polname.endsWith('discovery'));}
 await f.migration.query('BEGIN');try{await f.migration.query('ALTER POLICY b1_member_ceiling ON app.organization_membership TO PUBLIC');expect((await read()).rows.some(r=>r.public)).toBe(true);}finally{await f.migration.query('ROLLBACK');}
 expect((await read()).rows.some(r=>r.public)).toBe(false);
});
