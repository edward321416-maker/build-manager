import { beforeAll,afterAll,it,expect } from 'vitest';
import { randomBytes,randomUUID } from 'node:crypto';
import { createB1Fixture } from './helpers/b1-fixture';
import { attachSyntheticOrganization } from '../../scripts/b1-local-fixture.mjs';
let f:Awaited<ReturnType<typeof createB1Fixture>>;
let userId:string;
beforeAll(async()=>{
 f=await createB1Fixture();
 userId=(await f.login.query('SELECT authn.begin_session($1,$2,$3,$4) AS id',['https://fixture.invalid/','auth0|'+randomUUID(),randomBytes(32),new Date(Date.now()+3500000)])).rows[0].id;
});
afterAll(async()=>{await f?.close();});
const options=()=>({databaseUrl:'postgresql://localhost/disposable',userId,intent:'ATTACH_SYNTHETIC_ORG_ADMIN'});
it('R12 fixture rejects a non-loopback target before any SQL',async()=>{
 await expect(attachSyntheticOrganization({query:()=>{throw new Error('SQL_MUST_NOT_EXECUTE');}},{...options(),databaseUrl:'postgresql://external.invalid/db'})).rejects.toThrow('LOCAL_FIXTURE_PRECONDITION_FAILED');
});
it('R12 fixture requires explicit intent',async()=>{
 await expect(attachSyntheticOrganization(f.migration,{...options(),intent:''})).rejects.toThrow('LOCAL_FIXTURE_PRECONDITION_FAILED');
});
it('R12 fixture rejects an unmarked database',async()=>{
 await expect(attachSyntheticOrganization(f.migration,options())).rejects.toThrow('LOCAL_FIXTURE_PRECONDITION_FAILED');
});
it('R12 marked disposable fixture attaches only an existing active callback identity',async()=>{
 const database=(await f.migration.query('SELECT current_database() AS name')).rows[0].name;
 await f.p.admin.query(`COMMENT ON DATABASE "${database.replaceAll('"','""')}" IS 'B1_DISPOSABLE_LOCAL_VALIDATION'`);
 const result=await attachSyntheticOrganization(f.migration,options());
 await f.migration.query('BEGIN');
 try {
  await f.migration.query("SELECT set_config('app.org_id',$1,true)",[result.orgId]);
  expect((await f.migration.query('SELECT role,status FROM app.organization_membership WHERE user_id=$1',[userId])).rows).toEqual([{role:'ORG_ADMIN',status:'ACTIVE'}]);
  expect((await f.migration.query('SELECT count(*)::int AS n FROM app.property WHERE org_id=$1',[result.orgId])).rows[0].n).toBe(1);
 }finally{await f.migration.query('ROLLBACK');}
 await expect(attachSyntheticOrganization(f.migration,{...options(),userId:randomUUID()})).rejects.toThrow('LOCAL_FIXTURE_PRECONDITION_FAILED');
});
