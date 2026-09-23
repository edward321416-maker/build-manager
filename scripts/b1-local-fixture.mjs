import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Client } from 'pg';
const reject=()=>new Error('LOCAL_FIXTURE_PRECONDITION_FAILED');
/** Test-only CLI. Never an application import, seed, or authentication fallback. */
export async function attachSyntheticOrganization(client,{databaseUrl,userId,intent}) {
  let url;try{url=new URL(databaseUrl);}catch{throw reject();}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||intent!=='ATTACH_SYNTHETIC_ORG_ADMIN'||! /^[a-f0-9-]{36}$/i.test(userId??''))throw reject();
  const preflight=await client.query(`SELECT current_user AS role,
    pg_catalog.shobj_description(oid,'pg_database') AS marker
    FROM pg_catalog.pg_database WHERE datname=current_database()`);
  if(preflight.rows[0]?.marker!=='B1_DISPOSABLE_LOCAL_VALIDATION'||preflight.rows[0]?.role!=='bm_pf02a_migrator')throw reject();
  const orgId=randomUUID(),propertyId=randomUUID();
  await client.query('BEGIN');
  try {
    const actor=await client.query(`SELECT u.id FROM app.app_user u WHERE u.id=$1 AND u.status='ACTIVE'
      AND EXISTS(SELECT 1 FROM authn.external_identity e WHERE e.user_id=u.id AND e.status='ACTIVE') FOR UPDATE`,[userId]);
    if(actor.rowCount!==1)throw reject();
    await client.query("SELECT set_config('app.org_id',$1,true)",[orgId]);
    await client.query("INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','Synthetic B1 validation organization')",[orgId]);
    await client.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[propertyId,orgId]);
    await client.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')",[orgId,userId]);
    await client.query('COMMIT');
    return {orgId,propertyId};
  }catch(error){await client.query('ROLLBACK');throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const client=new Client({connectionString:process.env.B1_LOCAL_FIXTURE_DATABASE_URL});
  try {
    // Validate endpoint/intent before connecting; do not print configuration or IDs.
    const target=new URL(process.env.B1_LOCAL_FIXTURE_DATABASE_URL??'');
    if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||process.env.B1_LOCAL_FIXTURE_INTENT!=='ATTACH_SYNTHETIC_ORG_ADMIN')throw reject();
    await client.connect();
    await attachSyntheticOrganization(client,{databaseUrl:target.href,userId:process.env.B1_LOCAL_FIXTURE_USER_ID,intent:process.env.B1_LOCAL_FIXTURE_INTENT});
    console.log('B1_LOCAL_SYNTHETIC_FIXTURE_ATTACHED');
  }catch{console.error('B1_LOCAL_FIXTURE_REJECTED');process.exitCode=1;}
  finally{await client.end().catch(()=>undefined);}
}
