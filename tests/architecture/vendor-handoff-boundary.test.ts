import { readFile,readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { moduleEdges,resolveLocal } from "./b1-graph";

const root=join(import.meta.dirname,"..","..");
const entries=[
  "apps/web/src/app/api/v2/vendor/[...path]/route.ts",
  "apps/web/src/app/vendor/job/page.tsx",
];
const forbiddenModules=[/^@auth0\//,/^jose$/,/^@build-manager\/persistence-postgres\/(b1|core-flow|core-onboarding|testing)$/,/^@build-manager\/fixtures/,/^node:sqlite$/,/analytics|tracking|telemetry|sentry|posthog|segment|amplitude|mixpanel|googletagmanager/i];
const forbiddenLocal=[/^apps\/web\/src\/server\/(b1|b3|b4|b5|core-flow|http|persistence)\//,/^apps\/web\/src\/server\/container\./,/^apps\/web\/src\/proxy\./,/^apps\/web\/src\/app\/(core|workspace|demo)\//,/^packages\/persistence-postgres\/src\/(b1|core-flow|core-onboarding|testing)/];

// Plan Task8 requires the Vendor upload to reuse the accepted Core photo sanitizer unchanged. Exactly that module is
// allowed; the walker still descends into its imports, so B1/Auth0, Core routing/persistence and fixtures stay forbidden.
const allowedLocal=["apps/web/src/server/core-flow/photos.ts"];
async function graph(entry:string){
  const seen=new Set<string>(),bare=new Set<string>(),specifiers=new Set<string>(),violations:string[]=[];
  async function walk(file:string){
    if(seen.has(file))return;seen.add(file);
    const source=await readFile(join(root,file),"utf8");
    for(const edge of moduleEdges(source)){
      specifiers.add(edge.specifier);
      if(edge.dynamic){violations.push(`${file} -> dynamic`);continue;}
      const local=await resolveLocal(root,file,edge.specifier);
      if(local===null){bare.add(edge.specifier);if(forbiddenModules.some(x=>x.test(edge.specifier)))violations.push(`${file} -> ${edge.specifier}`);continue;}
      if(local.startsWith("<")){violations.push(`${file} -> ${edge.specifier} ${local}`);continue;}
      if(forbiddenModules.some(x=>x.test(edge.specifier))||(forbiddenLocal.some(x=>x.test(local))&&!allowedLocal.includes(local)))violations.push(`${file} -> ${local}`);
      if(local.startsWith("apps/web/src/")||local.startsWith("packages/"))await walk(local);
    }
  }
  await walk(entry);
  return {seen,bare,specifiers,violations};
}
async function files(dir:string):Promise<string[]>{
  const rows=await readdir(join(root,dir),{withFileTypes:true});const out:string[]=[];
  for(const row of rows){const path=`${dir}/${row.name}`;if(row.isDirectory())out.push(...await files(path));else out.push(path);}
  return out;
}

describe("standalone Vendor Web boundary",()=>{
  it.each(entries)("%s never reaches B1/Auth0, Core HTTP, Core persistence or fixtures",async entry=>{
    const {seen,violations}=await graph(entry);
    expect(violations).toEqual([]);
    expect(seen.has(entry)).toBe(true);
  });
  it("the API route reaches only the external Vendor port through the Vendor container",async()=>{
    const {seen,specifiers}=await graph(entries[0]);
    expect(seen.has("apps/web/src/server/vendor-handoff/container.ts")).toBe(true);
    expect(seen.has("apps/web/src/server/vendor-handoff/http.ts")).toBe(true);
    expect([...specifiers].filter(x=>x.startsWith("@build-manager/persistence-postgres")).sort()).toEqual(["@build-manager/persistence-postgres","@build-manager/persistence-postgres/vendor-handoff"]);
    expect(seen.has("packages/persistence-postgres/src/vendor-handoff/external.ts")).toBe(true);
    // The only Core module reachable is the reused sanitizer; never the Core router, container or persistence.
    expect([...seen].filter(x=>x.startsWith("apps/web/src/server/core-flow/"))).toEqual(["apps/web/src/server/core-flow/photos.ts"]);
    const container=await readFile(join(root,"apps/web/src/server/vendor-handoff/container.ts"),"utf8");
    expect(container).toContain("createVendorHandoffExternalPort");
    expect(container).toContain("VENDOR_HANDOFF_DATABASE_CONFIG");
    for(const forbidden of ["createVendorHandoffManagerPort","createVendorHandoffTenantPort","CORE_FLOW_DATABASE_CONFIG","bm_b1_web","SET ROLE","getB1Auth0","requireCoreB1Session"])expect(container.includes(forbidden),forbidden).toBe(false);
    expect(/user\s*!==\s*"bm_vendor_web"/.test(container)).toBe(true);
  });
  it("the page graph is client-delivered without server persistence",async()=>{
    const {seen}=await graph(entries[1]);
    expect([...seen].some(x=>x.startsWith("packages/persistence-postgres/")||x.startsWith("apps/web/src/server/"))).toBe(false);
    const screen=await readFile(join(root,"apps/web/src/app/vendor/job/vendor-job-screen.tsx"),"utf8");
    expect(screen.startsWith('"use client";')).toBe(true);
  });
  it("loads no third-party scripts, styles, fonts or analytics on the Vendor surface",async()=>{
    const surface=[...await files("apps/web/src/app/vendor"),...await files("apps/web/src/server/vendor-handoff"),"apps/web/src/app/api/v2/vendor/[...path]/route.ts","packages/api-client/src/vendor-job.ts"]
      .filter(x=>!/\.test\.[jt]sx?$/.test(x));
    for(const file of surface){
      const source=await readFile(join(root,file),"utf8");
      expect(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(source),file).toBe(false);
      expect(/next\/script|googletagmanager|gtag\(|analytics|sentry|@vercel\/analytics/i.test(source),file).toBe(false);
    }
  });
  it("T11-A01 the complete external server graph imports no analytics or third-party tracking module",async()=>{
    const {seen,bare,violations}=await graph(entries[0]);expect(violations).toEqual([]);
    for(const module of [...seen,...bare])expect(/analytics|tracking|telemetry|sentry|posthog|segment|amplitude|mixpanel|googletagmanager/i.test(module),module).toBe(false);
  });
  it("T11-A02 only the standalone Vendor API owns external dispatch, and Tenant paths cannot expose raw Vendor photos",async()=>{
    const routes=(await files("apps/web/src/app/api")).filter(path=>path.endsWith("/route.ts"));
    const external=[];
    for(const path of routes){const source=await readFile(join(root,path),"utf8");if(source.includes("handleVendorHandoff"))external.push(path);}
    expect(external).toEqual([entries[0]]);
    const source=await readFile(join(root,entries[0]),"utf8");expect(source).not.toMatch(/handleCoreFlow|requireCoreB1Session|getB1Container/);
    const {isManagerVendorHandoffRoute,isTenantVendorSchedulingRoute}=await import("../../apps/web/src/server/core-flow/vendor-handoff");
    for(const path of [["tickets","id","vendor-completion-photos","photo"],["tenant","tickets","id","vendor-completion-photos","photo"]]){
      expect(isManagerVendorHandoffRoute(path)).toBe(false);expect(isTenantVendorSchedulingRoute(path)).toBe(false);
    }
    const manager=await readFile(join(root,"apps/web/src/server/core-flow/http.ts"),"utf8");
    expect(manager).toContain('scope.session.role!=="ORG_ADMIN"&&scope.session.role!=="PROPERTY_STAFF"');
  });
  it("T11-A03 Vendor migrations grant runtime EXECUTE and schema USAGE only; runtime role escalation is never granted",async()=>{
    const migrations=(await files("packages/persistence-postgres/migrations")).filter(path=>/00(?:19|2[0-3])_vendor_handoff_/.test(path));
    expect(migrations).toHaveLength(5);
    for(const path of migrations){
      const source=(await readFile(join(root,path),"utf8")).replace(/--[^\n]*/g,"");
      for(const grant of source.match(/\bGRANT\b[^;]*;/gis)??[])if(/\bTO\s+[^;]*\bbm_(?:vendor|b1)_web\b/i.test(grant))expect(grant,path).toMatch(/^GRANT\s+(?:EXECUTE ON FUNCTION|USAGE ON SCHEMA)\b/i);
    }
    // Actual catalog and denied SET ROLE/DML probes are executed separately in the PostgreSQL security suite.
  });
  it("adds Vendor page headers without changing the existing Core join headers",async()=>{
    const config=(await import("../../apps/web/next.config")).default;
    const rules=await config.headers!();
    const join=rules.find(r=>r.source==="/core/join");
    expect(join?.headers).toEqual([{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}]);
    const vendor=rules.find(r=>r.source==="/vendor/job");
    const headers=Object.fromEntries((vendor?.headers??[]).map(h=>[h.key.toLowerCase(),h.value]));
    expect(headers).toMatchObject({"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff","x-frame-options":"DENY"});
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});
