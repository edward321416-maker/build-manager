import { access,readFile,readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect,it } from "vitest";
import { moduleEdges,scanB1ProductionGraph } from "./b1-graph";

it("B4 server graph excludes raw drivers, demo data and test-only authentication",async () => {
  for (const file of (await readdir("apps/web/src/server/b4")).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    const source = await readFile(join("apps/web/src/server/b4",file),"utf8");
    const imports = moduleEdges(source).map(edge => edge.specifier);
    for (const blocked of ["pg","node:sqlite","@build-manager/fixtures","@auth0/nextjs-auth0/testing"]) expect(imports).not.toContain(blocked);
    expect(imports.some(i => /fixture|demo|testing|persistence-postgres/.test(i))).toBe(false);
  }
  expect(await scanB1ProductionGraph(process.cwd())).toEqual([]);
});

it("B4 persistence has exactly the three command calls and no alternate raw assignment path",async () => {
  const source = await readFile("packages/persistence-postgres/src/b4/property-assignment.ts","utf8");
  expect(source.match(/SELECT authn\.b4_\w+\([^"\n]+/g)).toEqual([
    "SELECT authn.b4_get_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",
    "SELECT authn.b4_ensure_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",
    "SELECT authn.b4_end_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",
  ]);
  expect(source).not.toMatch(/app\.property_assignment|\b(?:INSERT|UPDATE|DELETE)\b|\.connect\(|new Pool|new Client/);
  expect(source.match(/client\.query\(/g)).toHaveLength(1);
  expect(source.match(/withB1OrgTransaction\(database/g)).toHaveLength(1);
  const manifest = JSON.parse(await readFile("packages/persistence-postgres/package.json","utf8"));
  expect(manifest.exports["./b4"]).toBe("./src/b4/index.ts");
});

it("B4 uses the single existing pool and exact route with all recognized dispatchers",async () => {
  const container = await readFile("apps/web/src/server/b1/container.ts","utf8");
  expect(container.match(/createPostgresDatabase\(/g)).toHaveLength(1);
  expect(container).toContain("assignments:createPropertyAssignmentMutationPort(database)");
  expect(container).not.toMatch(/B4_.*DATABASE_URL/);
  const route = await readFile("apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/staff-assignments/[membershipId]/route.ts","utf8");
  expect(route).toContain('export const runtime = "nodejs";');
  expect(route).toContain('export const dynamic = "force-dynamic";');
  for (const method of ["GET","PUT","DELETE","POST","PATCH","HEAD","OPTIONS"]) expect(route).toContain(`export async function ${method}(`);
  expect(route).not.toMatch(/property_assignment|\b(?:SELECT|INSERT|UPDATE)\b/);
});

it("B4 adds no management page, component, collection or roster handler",async () => {
  for (const path of ["apps/web/src/components/b4","apps/web/src/app/workspace/staff","apps/web/src/app/workspace/b4",
    "apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/staff-assignments/route.ts"]) {
    await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
  }
  async function files(dir: string): Promise<string[]> {
    return (await Promise.all((await readdir(dir,{ withFileTypes: true })).map(row => row.isDirectory()
      ? files(join(dir,row.name)) : [join(dir,row.name)]))).flat();
  }
  for (const path of await files("apps/web/src/app/api/v2")) {
    expect(path).not.toMatch(/roster|staff-search|staff-selector/);
    expect(await readFile(path,"utf8")).not.toMatch(/app\.property_assignment/);
  }
});
