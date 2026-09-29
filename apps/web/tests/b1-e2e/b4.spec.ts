import { expect,test,type APIResponse } from "@playwright/test";
import { createB4Fixture,assignmentPath,assignmentSnapshot,b4Mutation } from "./b4-fixture";
import { request as rawRequest } from "node:http";
import { baseURL } from "./fixture-session";
import { propertiesPath,propertyPath,unitsPath,unitPath,seedUnit } from "./b3-fixture";

async function check(response: APIResponse,status: number,body?: unknown) {
  expect(response.status()).toBe(status);
  expect(response.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  // Next adds its own RSC cache dimensions on the wire; Cookie must remain present.
  expect(response.headers().vary.split(",").map(value => value.trim())).toContain("Cookie");
  if (status === 204) expect(await response.text()).toBe("");
  else if (body !== undefined) expect(await response.json()).toEqual(body);
}

test("B4 AC05-09 adminAssignmentLifecycle",async ({ browser }) => {
  const f = await createB4Fixture(browser);
  try {
    const path = assignmentPath(f,f.staff.membershipId);
    await check(await f.context.request.get(path),404,{ error: "NOT_FOUND" });
    const created = await b4Mutation(f,"PUT",path);
    expect(created.headers().location).toBe(path);
    await check(created,201,{ assigned: true });
    const first = await assignmentSnapshot(f);
    expect(first).toHaveLength(1); expect(first[0].status).toBe("ACTIVE");
    await check(await f.context.request.get(path),200,{ assigned: true });
    await check(await b4Mutation(f,"PUT",path),200,{ assigned: true });
    expect(await assignmentSnapshot(f)).toEqual(first);
    await check(await b4Mutation(f,"DELETE",path),204);
    const ended = await assignmentSnapshot(f);
    expect(ended).toHaveLength(1); expect(ended[0].id).toBe(first[0].id);
    expect(ended[0].status).toBe("ENDED"); expect(ended[0].ended_at).not.toBeNull();
    await check(await f.context.request.get(path),404,{ error: "NOT_FOUND" });
    await check(await b4Mutation(f,"DELETE",path),204);
    expect(await assignmentSnapshot(f)).toEqual(ended);
    await check(await b4Mutation(f,"PUT",path),201,{ assigned: true });
    const current = await assignmentSnapshot(f);
    expect(current).toHaveLength(2); expect(current.find(r => r.id === ended[0].id)).toEqual(ended[0]);
    expect(current.filter(r => r.status === "ACTIVE")).toHaveLength(1);
    expect(current.find(r => r.status === "ACTIVE")?.id).not.toBe(first[0].id);
  } finally { await f.close(); }
});

test("B4 AC03 targetMembershipBoundary",async ({ browser }) => {
  const f = await createB4Fixture(browser);
  try {
    await check(await b4Mutation(f,"PUT",assignmentPath(f,f.staff.membershipId)),201,{ assigned: true });
    await f.change("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[f.staff.membershipId]);
    const before = await assignmentSnapshot(f);
    for (const membership of [f.membershipId,f.staff.membershipId,f.foreign.membershipId]) {
      const path = assignmentPath(f,membership);
      await check(await f.context.request.get(path),404,{ error: "NOT_FOUND" });
      for (const method of ["PUT","DELETE"] as const) await check(await b4Mutation(f,method,path),404,{ error: "NOT_FOUND" });
      expect(await assignmentSnapshot(f)).toEqual(before);
    }
  } finally { await f.close(); }
});

test("B4 AC04 propertyBoundary",async ({ browser }) => {
  const f = await createB4Fixture(browser);
  try {
    await f.change("UPDATE app.property SET status='ARCHIVED' WHERE id=$1",[f.propertyB]);
    const before = await assignmentSnapshot(f);
    for (const property of [f.propertyB,f.foreign.propertyId]) {
      const path = assignmentPath(f,f.staff.membershipId,property);
      await check(await f.context.request.get(path),404,{ error: "NOT_FOUND" });
      for (const method of ["PUT","DELETE"] as const) await check(await b4Mutation(f,method,path),404,{ error: "NOT_FOUND" });
      expect(await assignmentSnapshot(f)).toEqual(before);
    }
  } finally { await f.close(); }
});

test("B4 AC02 staffVisibilityPrecedence",async ({ browser }) => {
  const f = await createB4Fixture(browser);
  try {
    for (const tuple of [f.foreign,f.inactive]) {
      const path = assignmentPath(f,tuple.membershipId,tuple.propertyId,tuple.orgId);
      const before = await assignmentSnapshot(f,tuple.orgId);
      expect(before).toHaveLength(2);
      await check(await f.context.request.get(path),404,{ error: "NOT_FOUND" });
      for (const method of ["PUT","DELETE"] as const) {
        await check(await b4Mutation(f,method,path),404,{ error: "NOT_FOUND" });
        expect(await assignmentSnapshot(f,tuple.orgId)).toEqual(before);
      }
    }
    await check(await b4Mutation(f,"PUT",assignmentPath(f,f.staff.membershipId)),201,{ assigned: true });
    for (const [property,status,code] of [[f.propertyId,403,"FORBIDDEN"],[f.propertyB,404,"NOT_FOUND"]] as const) {
      const path = assignmentPath(f,f.staff.membershipId,property);
      await check(await f.staff.context.request.get(path),status,{ error: code });
      for (const method of ["PUT","DELETE"] as const) await check(await b4Mutation(f.staff,method,path),status,{ error: code });
    }
  } finally { await f.close(); }
});

test("B4 AC13-14 staffReadThroughScope",async ({ browser }) => {
  const f = await createB4Fixture(browser);
  try {
    const unit = await seedUnit(f),path = assignmentPath(f,f.staff.membershipId);
    const verifyScope = async (assigned: boolean) => {
      const list = await f.staff.context.request.get(propertiesPath(f));
      expect(list.status()).toBe(200);
      expect((await list.json()).items.map((p: { id: string }) => p.id)).toEqual(assigned ? [f.propertyId] : []);
      const property = await f.staff.context.request.get(propertyPath(f));
      const detail = await f.staff.context.request.get(unitPath(f,unit));
      const units = await f.staff.context.request.get(unitsPath(f));
      if (assigned) {
        expect(property.status()).toBe(200); expect((await property.json()).id).toBe(f.propertyId);
        expect(detail.status()).toBe(200); expect((await detail.json()).id).toBe(unit);
        expect(units.status()).toBe(200); expect((await units.json()).items.map((u: { id: string }) => u.id)).toEqual([unit]);
      } else {
        for (const response of [property,detail,units]) await check(response,404,{ error: "NOT_FOUND" });
      }
      await check(await f.staff.context.request.get(propertyPath(f,f.propertyB)),404,{ error: "NOT_FOUND" });
    };
    await verifyScope(false);
    await check(await b4Mutation(f,"PUT",path),201,{ assigned: true }); await verifyScope(true);
    await check(await b4Mutation(f,"DELETE",path),204); await verifyScope(false);
    await check(await b4Mutation(f,"PUT",path),201,{ assigned: true }); await verifyScope(true);
  } finally { await f.close(); }
});

test("B4 AC20 transportAndMethodBoundaries",async ({ browser }) => {
  const f = await createB4Fixture(browser),anonymous = await browser.newContext({ baseURL });
  try {
    const path = assignmentPath(f,f.staff.membershipId),valid = { origin: baseURL,"x-b1-csrf": f.csrf };
    await check(await anonymous.request.get(path),401,{ error: "UNAUTHENTICATED" });
    for (const method of ["PUT","DELETE"] as const) {
      await check(await anonymous.request.fetch(path,{ method,headers: valid }),401,{ error: "UNAUTHENTICATED" });
      for (const headers of [{}, { origin: baseURL+"/" }] as Record<string,string>[]) await check(await f.context.request.fetch(path,{ method,headers }),403,{ error: "FORBIDDEN" });
      for (const headers of [{ origin: baseURL },{ origin: baseURL,"x-b1-csrf": f.staff.csrf }] as Record<string,string>[]) await check(await f.context.request.fetch(path,{ method,headers }),403,{ error: "FORBIDDEN" });
      await check(await f.context.request.fetch(path,{ method,headers: valid,data: {} }),400,{ error: "INVALID_INPUT" });
      await check(await f.context.request.fetch(path,{ method,headers: valid,data: "x".repeat(8193) }),413,{ error: "PAYLOAD_TOO_LARGE" });
      await check(await f.context.request.fetch(path+"?role=a&role=b",{ method,headers: valid }),400,{ error: "INVALID_INPUT" });
      await check(await f.context.request.fetch(assignmentPath(f,"invalid"),{ method,headers: valid }),400,{ error: "INVALID_INPUT" });
    }
    await check(await f.context.request.get(path+"?q=a&q=b"),400,{ error: "INVALID_INPUT" });
    await check(await f.context.request.get(assignmentPath(f,"invalid")),400,{ error: "INVALID_INPUT" });
    for (const method of ["POST","PATCH","HEAD","OPTIONS"]) {
      const response = await f.context.request.fetch(path,{ method });
      await check(response,405,method === "HEAD" ? undefined : { error: "METHOD_NOT_ALLOWED" });
      expect(response.headers().allow).toBe("GET, PUT, DELETE");
      if (method === "HEAD") expect(await response.text()).toBe("");
    }
    // L04: PROPFIND is Fetch-allowed but unrecognized by pinned Next.js.
    const unsupported = await new Promise<{ status: number | undefined; body: string }>((resolve,reject) => {
      const req = rawRequest(baseURL+path,{ method: "PROPFIND" },response => {
        let body = ""; response.setEncoding("utf8"); response.on("data",chunk => { body += chunk; });
        response.on("end",() => resolve({ status: response.statusCode,body })); response.on("error",reject);
      }); req.on("error",reject); req.end();
    });
    expect(unsupported).toEqual({ status: 400,body: "" }); // Framework-owned; no B4 headers/body/Allow claim.
    await check(await b4Mutation(f,"PUT",path),201,{ assigned: true });
    const state = await f.context.request.get(path),text = await state.text();
    expect(JSON.parse(text)).toEqual({ assigned: true });
    for (const hidden of [f.staff.userId,f.staff.membershipId,...(await assignmentSnapshot(f)).map(row => row.id),"SELECT","role","status","ended_at"]) expect(text).not.toContain(hidden);
    const page = await f.context.newPage(); await page.goto(`/workspace/organizations/${f.orgId}/properties/${f.propertyId}`);
    await expect(page.locator('a[href*="staff-assignments"],a[href*="roster"],a[href*="staff-search"]')).toHaveCount(0);
    expect((await f.context.request.get(`/workspace/organizations/${f.orgId}/properties/${f.propertyId}/staff-assignments`)).status()).toBe(404);
    expect((await f.context.request.get(path.slice(0,path.lastIndexOf("/")))).status()).toBe(404);
  } finally { await anonymous.close(); await f.close(); }
});
