import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { Client } from 'pg';
import type { TestRoleCredentials } from '@build-manager/persistence-postgres/testing';
import { generateSessionCookie } from '@auth0/nextjs-auth0/testing';
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { NextRequest } from 'next/server.js';
import type { Browser } from '@playwright/test';
export const baseURL='http://localhost:3124';
export async function fixtureSession(browser:Browser,role:'ORG_ADMIN'|'PROPERTY_STAFF'|'RESIDENT'|'NONE'='ORG_ADMIN',register=true){
 const {roles,secret}=JSON.parse(process.env.B1_E2E_PRIVATE??'{}') as {roles:TestRoleCredentials;secret:string};
 const migration=new Client(roles.migrationConfig),login=new Client(roles.b1.loginConfig);await migration.connect();await login.connect();
 const subject='auth0|'+randomUUID(),handle=randomBytes(32).toString('hex'),digest=createHash('sha256').update(handle).digest(),csrf=randomBytes(32).toString('hex'),issuedAt=Math.floor(Date.now()/1000);
 let userId:string|undefined;const orgId=randomUUID(),propertyId=randomUUID();
 if(register)userId=(await login.query('SELECT authn.begin_session($1,$2,$3,$4) AS id',['https://b1.synthetic.invalid/',subject,digest,new Date((issuedAt+3600)*1000)])).rows[0].id;
 async function change(sql:string,args:unknown[]=[]){await migration.query('BEGIN');try{await migration.query("SELECT set_config('app.org_id',$1,true)",[orgId]);await migration.query(sql,args);await migration.query('COMMIT');}catch(e){await migration.query('ROLLBACK');throw e;}}
 if(register){
  await change("INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','Synthetic organization')",[orgId]);
  await change("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[propertyId,orgId]);
  if(role==='ORG_ADMIN'||role==='PROPERTY_STAFF')await change("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,$3,'ACTIVE')",[orgId,userId,role]);
  if(role==='RESIDENT')await change(`WITH u AS (INSERT INTO app.unit(org_id,property_id,label,status) VALUES($1,$2,'Synthetic unit','ACTIVE') RETURNING id),o AS (INSERT INTO app.occupancy(org_id,unit_id,starts_at,status) SELECT $1,id,clock_timestamp(),'ACTIVE' FROM u RETURNING id) INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) SELECT $1,id,$3,clock_timestamp(),'ACTIVE' FROM o`,[orgId,propertyId,userId]);
 }
 const cookie=await generateSessionCookie({user:{sub:subject},tokenSet:{accessToken:randomBytes(32).toString('hex'),expiresAt:issuedAt+3600},internal:{sid:randomUUID(),createdAt:issuedAt},b1:{handle,csrf,issuedAt,expiresAt:issuedAt+3600}},{secret});
 const sdk=new Auth0Client({domain:'b1.synthetic.invalid',clientId:'synthetic',clientSecret:randomBytes(32).toString('hex'),secret,appBaseUrl:baseURL});
 const read=await sdk.getSession(new NextRequest(baseURL,{headers:{cookie:'__session='+cookie}}));if(!read || read.user.sub!==subject)throw new Error('SYNTHETIC_COOKIE_READBACK_FAILED');
 const context=await browser.newContext({baseURL});await context.addCookies([{name:'__session',value:cookie,url:baseURL,httpOnly:true,sameSite:'Lax'}]);
 return {context,migration,change,orgId,propertyId,userId,csrf,digest,async close(){try{if(browser.isConnected())await context.close();}finally{await login.end();await migration.end();}}};
}
