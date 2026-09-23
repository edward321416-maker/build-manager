import { B1Error,type OrganizationReadPort,type PageQuery,type Page } from '@build-manager/application';
import type { PostgresDatabase } from '../database';
import { withTransaction } from '../transaction';
import { withB1OrgTransaction } from './org-transaction';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validate(digest:string,page?:PageQuery,...ids:string[]){
 if(!/^[a-f0-9]{64}$/.test(digest))throw new B1Error('UNAUTHENTICATED');
 if(ids.some(id=>!uuid.test(id)) || page && (!Number.isInteger(page.limit)||page.limit<1||page.limit>50||page.after!==undefined&&!uuid.test(page.after)))throw new B1Error('INVALID_INPUT');
}
function paginate<T extends {id:string}>(rows:T[],limit:number):Page<T>{const items=rows.slice(0,limit);return {items,nextCursor:rows.length>limit?items[items.length-1].id:null};}
async function safe<T>(run:()=>Promise<T>):Promise<T>{
 try{return await run();}catch(error){
 if(error instanceof B1Error)throw error;
 if(error && typeof error==='object' && 'code' in error && error.code==='28000')throw new B1Error('UNAUTHENTICATED');
 throw new B1Error('DEPENDENCY_UNAVAILABLE');}
}
export function createOrganizationReadPort(database:PostgresDatabase):OrganizationReadPort {
 return {
  async listMine(digest,page){validate(digest,page);return safe(()=>withTransaction(database,async c=>{
   const r=await c.query<{id:string;display_name:string}>('SELECT * FROM authn.list_my_organizations($1,$2,$3)',[Buffer.from(digest,'hex'),page.after??null,page.limit+1]);
   return paginate(r.rows.map(x=>({id:x.id,displayName:x.display_name})),page.limit);
  }));},
  async listProperties(digest,orgId,page){validate(digest,page,orgId);return safe(()=>withB1OrgTransaction(database,digest,orgId,async c=>{
   const r=await c.query<{id:string;org_id:string;address_reference:string|null}>('SELECT id,org_id,address_reference FROM app.property WHERE org_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[orgId,page.after??null,page.limit+1]);
   return paginate(r.rows.map(x=>({id:x.id,orgId:x.org_id,addressReference:x.address_reference})),page.limit);
  }));},
  async getProperty(digest,orgId,propertyId){validate(digest,undefined,orgId,propertyId);return safe(()=>withB1OrgTransaction(database,digest,orgId,async c=>{
   const r=await c.query<{id:string;org_id:string;address_reference:string|null}>('SELECT id,org_id,address_reference FROM app.property WHERE org_id=$1 AND id=$2',[orgId,propertyId]);
   const row=r.rows[0];if(!row)throw new B1Error('NOT_FOUND');return {id:row.id,orgId:row.org_id,addressReference:row.address_reference};
  }));},
 };
}
