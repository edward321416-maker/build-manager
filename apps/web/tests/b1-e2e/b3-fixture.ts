import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { Browser,APIResponse } from '@playwright/test';
import { baseURL } from './fixture-session';
import { fixtureB2Session,type B2WebFixture } from './b2-fixture';

export type B3WebFixture=B2WebFixture;

export async function fixtureB3Session(
  browser:Browser,
  role:'ORG_ADMIN'|'PROPERTY_STAFF'='ORG_ADMIN',
  assigned=role==='PROPERTY_STAFF',
):Promise<B3WebFixture>{
  return fixtureB2Session(browser,role,assigned);
}

export function propertiesPath(f:B3WebFixture,orgId:string=f.orgId){
  return `/api/v2/organizations/${orgId}/properties`;
}
export function propertyPath(f:B3WebFixture,propertyId:string=f.propertyId,orgId:string=f.orgId){
  return `${propertiesPath(f,orgId)}/${propertyId}`;
}
export function unitsPath(f:B3WebFixture,propertyId:string=f.propertyId,orgId:string=f.orgId){
  return `${propertyPath(f,propertyId,orgId)}/units`;
}
export function unitPath(f:B3WebFixture,unitId:string,propertyId:string=f.propertyId,orgId:string=f.orgId){
  return `${unitsPath(f,propertyId,orgId)}/${unitId}`;
}
export function mutationHeaders(f:B3WebFixture,extra:Record<string,string>={}){
  return {origin:baseURL,'x-b1-csrf':f.csrf,'content-type':'application/json',...extra};
}
export async function postProperty(
  f:B3WebFixture,
  addressReference:string,
  orgId:string=f.orgId,
  extraHeaders:Record<string,string>={},
):Promise<APIResponse>{
  return f.context.request.post(propertiesPath(f,orgId),{
    headers:mutationHeaders(f,extraHeaders),
    data:{addressReference},
  });
}
export async function postUnit(
  f:B3WebFixture,
  label:string,
  propertyId:string=f.propertyId,
  orgId:string=f.orgId,
  extraHeaders:Record<string,string>={},
):Promise<APIResponse>{
  return f.context.request.post(unitsPath(f,propertyId,orgId),{
    headers:mutationHeaders(f,extraHeaders),
    data:{label},
  });
}
export async function seedUnit(
  f:B3WebFixture,
  propertyId:string=f.propertyId,
  label='SYNTHETIC-UNIT',
  id:string=randomUUID(),
  status:'ACTIVE'|'ARCHIVED'='ACTIVE',
):Promise<string>{
  await f.change(
    "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,$5)",
    [id,f.orgId,propertyId,label,status],
  );
  return id;
}
// Diagnostic reads use the existing fixture owner with transaction-local scope.
// FORCE RLS remains enabled; never leave a tenant GUC on the shared connection.
export async function queryFixture<Row extends QueryResultRow>(
  f:B3WebFixture,
  sql:string,
  args:unknown[]=[],
){
  await f.migration.query('BEGIN READ ONLY');
  try{
    await f.migration.query("SELECT set_config('app.org_id',$1,true)",[f.orgId]);
    const result=await f.migration.query<Row>(sql,args);
    await f.migration.query('COMMIT');
    return result;
  }catch(error){
    await f.migration.query('ROLLBACK');
    throw error;
  }
}
export async function countRows(f:B3WebFixture,sql:string,args:unknown[]=[]):Promise<number>{
  const result=await queryFixture<{count:string}>(f,sql,args);
  const count=Number(result.rows[0]?.count);
  if(result.rows.length!==1 || !Number.isSafeInteger(count) || count<0){
    throw new Error('B3_FIXTURE_COUNT_INVALID');
  }
  return count;
}
export async function jsonError(response:APIResponse,status:number,code:string){
  if(response.status()!==status)throw new Error(`EXPECTED_${status}_GOT_${response.status()}`);
  const body=await response.json();
  if(JSON.stringify(body)!==JSON.stringify({error:code}))throw new Error('UNEXPECTED_ERROR_BODY');
  return body;
}
