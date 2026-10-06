import { afterAll,beforeAll,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort,createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createVendorHandoffManagerPort } from "@build-manager/persistence-postgres/vendor-handoff";
import type { CoreAccessPort,VendorHandoffManagerPort } from "@build-manager/application";
import { handleCoreFlow } from "../../apps/web/src/server/core-flow/http";
import type { CoreHTTPDependencies } from "../../apps/web/src/server/core-flow/container";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
beforeAll(async()=>{
  f=await createVendorHandoffFixture();
  await f.p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[randomUUID(),f.data.orgB,f.data.accounts.manager.userId]);
});
afterAll(async()=>{await f?.close();});
const origin="http://127.0.0.1:3130";
function dependencies(database:ReturnType<typeof createPostgresDatabase>,access=createCoreAccessPort(database),wrap=(port:VendorHandoffManagerPort,_org:string)=>port):CoreHTTPDependencies{
  const manager={inOrganization:(org:string)=>wrap(createVendorHandoffManagerPort(database,org),org)};
  return {port:createCoreFlowPort(database),revoke:async()=>{},origins:[origin],vendorHandoff:manager,b1:{current:async()=>({digest:f.data.accounts.manager.digest,csrf:"synthetic-proof"}),access}} as unknown as CoreHTTPDependencies;
}
async function request(d:CoreHTTPDependencies,org:string,t:Awaited<ReturnType<typeof f.ticket>>){
  const path=`manager/tickets/${t.ticket.id}/vendor-assignment`;
  return handleCoreFlow(new Request(`${origin}/api/v2/core/${path}`,{method:"POST",headers:{Origin:origin,"X-Core-Organization":org,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json"},body:JSON.stringify({clientRequestId:randomUUID(),expectedTicketVersion:t.version,vendorLabel:"합성 업체"})}),path.split("/"),()=>d);
}
async function priorA(database:ReturnType<typeof createPostgresDatabase>){await createCoreAccessPort(database).inOrganization(f.data.orgA).run(f.data.accounts.manager.digest,s=>Promise.resolve(s.session.role));}
it("main HTTP performs selected B action after prior A binding with one pool slot",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:1,connectionTimeoutMillis:500});
  try{const t=await f.ticket("otherTenant");await priorA(database);expect((await request(dependencies(database),f.data.orgB,t)).status).toBe(201);}
  finally{await database.close();}
});
it("main HTTP denies A resource through selected B despite prior A binding",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:3});
  try{const t=await f.ticket();await priorA(database);expect((await request(dependencies(database),f.data.orgB,t)).status).toBe(404);}
  finally{await database.close();}
});
it("opposing concurrent selections reauthorize inside their actual Vendor transactions",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:3});
  try{
    const a=await f.ticket(),b=await f.ticket("otherTenant");await priorA(database);
    let releaseB:()=>void=()=>{};const bGuardFinished=new Promise<void>(resolve=>{releaseB=resolve;});
    const actual=createCoreAccessPort(database);
    const access:CoreAccessPort={organizations:digest=>actual.organizations(digest),inOrganization:org=>({run:async(digest,operation)=>{try{return await actual.inOrganization(org).run(digest,operation);}finally{if(org===f.data.orgB)releaseB();}}})};
    const d=dependencies(database,access,(port,org)=>({...port,createAssignment:async(...args)=>{if(org===f.data.orgA)await bGuardFinished;return port.createAssignment(...args);}}));
    const responses=await Promise.all([request(d,f.data.orgA,a),request(d,f.data.orgB,b)]);
    expect(responses.map(response=>response.status)).toEqual([201,201]);
  }finally{await database.close();}
});
it("Vendor transaction rejects membership ended after successful Core preflight",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:1});
  try{
    const t=await f.ticket("otherTenant");
    const d=dependencies(database,createCoreAccessPort(database),(port)=>({...port,createAssignment:async(...args)=>{
      await f.p.admin.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE org_id=$1 AND user_id=$2 AND status='ACTIVE'",[f.data.orgB,f.data.accounts.manager.userId]);
      return port.createAssignment(...args);
    }}));
    expect((await request(d,f.data.orgB,t)).status).toBe(403);
    const rows=await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1",[t.ticket.id]);
    expect(rows.rows[0].n).toBe(0);
  }finally{await database.close();}
});
