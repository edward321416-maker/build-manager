import { randomUUID } from "node:crypto";
import { request as rawRequest } from "node:http";
import { expect, test, type APIResponse } from "@playwright/test";
import { createB5Fixture, membershipPath, b5Headers } from "./b5-fixture";
import { assignmentPath, assignmentSnapshot, b4Mutation } from "./b4-fixture";
import { baseURL } from "./fixture-session";
async function check(r:APIResponse,status:number,error?:string) {
  expect(r.status()).toBe(status);expect(r.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  expect(r.headers().vary.split(",").map(value=>value.trim().toLowerCase())).toContain("cookie");
  if(status===204) expect(await r.text()).toBe(""); else if(error) expect(await r.json()).toEqual({error});
}
test("B5 AC02-06 membershipTerminationAndLastAdmin",async({browser})=>{
  const f=await createB5Fixture(browser);
  const end=(id:string)=>f.context.request.delete(membershipPath(f,id),{headers:b5Headers(f)});
  try {
    await check(await end(f.membershipId),409,"CONFLICT");
    const other=await f.addAdmin();
    for(const status of ["SUSPENDED","DELETION_PENDING"]) {
      await f.change("UPDATE app.app_user SET status=$1 WHERE id=$2",[status,other.userId]);
      await check(await end(f.membershipId),409,"CONFLICT");
    }
    await f.change("UPDATE app.app_user SET status='ACTIVE' WHERE id=$1",[other.userId]);
    const before=(await f.members()).find(r=>r.id===f.staff.membershipId);
    await check(await end(f.staff.membershipId),204);
    const ended=(await f.members()).find(r=>r.id===f.staff.membershipId);
    expect(ended).toEqual({...before,status:"ENDED",version:before.version+1,ended_at:expect.any(String)});
    await check(await end(f.staff.membershipId),404,"NOT_FOUND");
    expect((await f.members()).find(r=>r.id===f.staff.membershipId)).toEqual(ended);
    await check(await end(other.membershipId),204);
    await check(await end(f.membershipId),409,"CONFLICT");
    for(const hidden of [f.foreign.membershipId,randomUUID()]) await check(await end(hidden),404,"NOT_FOUND");
  } finally {await f.close();}
});
test("B5 AC03 AC13 transportAndNonDisclosure",async({browser})=>{
  const f=await createB5Fixture(browser),anonymous=await browser.newContext({baseURL});
  try {
    const path=membershipPath(f,f.staff.membershipId),valid=b5Headers(f),before=await f.members();
    for(const method of ["GET","POST","PUT","PATCH","HEAD","OPTIONS"]) {
      const r=await f.context.request.fetch(path,{method});await check(r,405,method==='HEAD'?undefined:"METHOD_NOT_ALLOWED");
      expect(r.headers().allow).toBe("DELETE");if(method==='HEAD')expect(await r.text()).toBe("");
    }
    for(const headers of [{},{origin:baseURL+"/"}] as Record<string,string>[]) await check(await anonymous.request.delete(path+"?q=x",{headers}),403,"FORBIDDEN");
    await check(await anonymous.request.delete(path,{headers:valid}),401,"UNAUTHENTICATED");
    for(const headers of [{origin:baseURL},{origin:baseURL,"x-b1-csrf":f.staff.csrf}] as Record<string,string>[]) await check(await f.context.request.delete(path+"?q=x",{headers,data:{}}),403,"FORBIDDEN");
    await check(await f.context.request.delete(path+"?q=x",{headers:valid}),400,"INVALID_INPUT");
    await check(await f.context.request.delete(membershipPath(f,"invalid"),{headers:valid}),400,"INVALID_INPUT");
    await check(await f.context.request.delete(path,{headers:valid,data:{}}),400,"INVALID_INPUT");
    await check(await f.context.request.delete(path,{headers:valid,data:"x".repeat(8193)}),413,"PAYLOAD_TOO_LARGE");
    await check(await f.staff.context.request.delete(path,{headers:b5Headers(f.staff)}),403,"FORBIDDEN");
    for(const boundary of [f.foreign,f.inactive]) await check(await f.context.request.delete(membershipPath(boundary,boundary.membershipId),{headers:valid}),404,"NOT_FOUND");
    const diagnostic=await new Promise<{status:number|undefined;body:string}>((resolve,reject)=>{
      const r=rawRequest(baseURL+path,{method:"PROPFIND"},response=>{let body="";response.setEncoding("utf8");response.on("data",chunk=>{body+=chunk;});response.on("end",()=>resolve({status:response.statusCode,body}));response.on("error",reject);});r.on("error",reject);r.end();
    });
    expect(diagnostic).toEqual({status:400,body:""});
    expect(await f.members()).toEqual(before);
    await check(await f.context.request.delete(path,{headers:valid}),204);
    const denied=await f.context.request.delete(path,{headers:valid});await check(denied,404,"NOT_FOUND");
    const body=await denied.text();for(const hidden of [f.staff.userId,f.staff.membershipId,"role","version","ended_at","SELECT"])expect(body).not.toContain(hidden);
    expect((await f.context.request.get(`/api/v2/organizations/${f.orgId}/memberships`)).status()).toBe(404);
  } finally {await anonymous.close();await f.close();}
});
test("B5 AC10-12 membershipRevocationAndSessionSeparation",async({browser})=>{
  const f=await createB5Fixture(browser);
  try {
    const assignment=assignmentPath(f,f.staff.membershipId);
    await check(await b4Mutation(f,"PUT",assignment),201);
    const property=`/api/v2/organizations/${f.orgId}/properties/${f.propertyId}`;
    const foreign=`/api/v2/organizations/${f.foreign.orgId}/properties/${f.foreign.propertyId}`;
    await check(await f.staff.context.request.get(property),200);
    await check(await f.staff.context.request.get(property+"/units"),200);
    await check(await f.staff.context.request.get(foreign),200);
    await check(await f.staff.context.request.get(assignment),403,"FORBIDDEN");
    await check(await f.staff.context.request.post(`/api/v2/organizations/${f.orgId}/properties`,{headers:{...b5Headers(f.staff),"content-type":"application/json"},data:{addressReference:"Synthetic"}}),403,"FORBIDDEN");
    const history=await assignmentSnapshot(f);
    await check(await f.context.request.delete(membershipPath(f,f.staff.membershipId),{headers:b5Headers(f)}),204);
    expect(await assignmentSnapshot(f)).toEqual(history);
    for(const path of [property,property+"/units",assignment])await check(await f.staff.context.request.get(path),404,"NOT_FOUND");
    await check(await f.staff.context.request.post(`/api/v2/organizations/${f.orgId}/properties`,{headers:{...b5Headers(f.staff),"content-type":"application/json"},data:{addressReference:"Synthetic"}}),404,"NOT_FOUND");
    await check(await b4Mutation(f,"PUT",assignment),404,"NOT_FOUND");
    await check(await f.staff.context.request.get(foreign),200);
    const orgs=await f.staff.context.request.get("/api/v2/me/organizations");await check(orgs,200);
    const text=await orgs.text();expect(text).not.toContain(f.orgId);expect(text).toContain(f.foreign.orgId);
    expect(await assignmentSnapshot(f)).toEqual(history);
  } finally {await f.close();}
});
