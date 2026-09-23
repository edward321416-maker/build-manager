import { B1Error } from '@build-manager/application';
import type { PostgresDatabase } from '../database';
import { withTransaction,type SqlClient } from '../transaction';
/** Establish tenant context only after current session + relationship authorization. */
export function withB1OrgTransaction<T>(database:PostgresDatabase,digest:string,orgId:string,operation:(client:SqlClient)=>Promise<T>){
 return withTransaction(database,async c=>{
  const proof=Buffer.from(digest,'hex');
  if(!(await c.query('SELECT authn.current_actor($1) AS id',[proof])).rows[0]?.id)throw new B1Error('UNAUTHENTICATED');
  if(!(await c.query('SELECT authn.authorize_org($1,$2) AS allowed',[proof,orgId])).rows[0]?.allowed)throw new B1Error('NOT_FOUND');
  await c.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[orgId,digest]);
  return operation(c);
 });
}
