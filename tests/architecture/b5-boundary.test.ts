import { readFile,readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { expect,it } from "vitest";
import { moduleEdges,scanB1ProductionGraph } from "./b1-graph";
type DependencyLock = { packages: Record<string, Record<string, unknown>> };
const expoPatchFixture="tests/architecture/expo-sdk57-patch-lock.json";
const expoPatchPaths=["@expo/cli","@expo/config","@expo/config-plugins","@expo/image-utils","@expo/metro-config","@expo/metro-file-map","@expo/prebuild-config","@expo/require-utils","@expo/router-server","@expo/ui","babel-preset-expo","expo","expo-asset","expo-constants","expo-linking","expo-modules-autolinking","expo-modules-core","expo-router"].map(name=>`node_modules/${name}`);
function sha256(source:string) { return createHash("sha256").update(source).digest("hex"); }
function projectExpoSdk57Patch(lock:DependencyLock,fixtureSource:string) {
  expect(sha256(fixtureSource),"reviewed exact Expo patch fixture").toBe("527ac6476c9d7f49a65ae819d7761f86778b0632e42e0abf142521c53249554a");
  const fixture=JSON.parse(fixtureSource) as {path:string;before:Record<string,unknown>;successorSha256:string}[];
  expect(fixture.map(entry=>entry.path)).toEqual(expoPatchPaths);
  for(const entry of fixture) {
    expect(lock.packages[entry.path],entry.path).toBeDefined();
    expect(sha256(JSON.stringify(lock.packages[entry.path])),entry.path).toBe(entry.successorSha256);
    lock.packages[entry.path]=structuredClone(entry.before);
  }
}
function projectSharpLock(lock:DependencyLock) {
  const web=lock.packages["apps/web"].dependencies as Record<string,string>;
  expect(web.sharp).toBe("0.35.4");delete web.sharp;
  const codec=lock.packages["node_modules/sharp"];expect(codec.version).toBe("0.35.4");
  expect(codec.resolved).toBe("https://registry.npmjs.org/sharp/-/sharp-0.35.4.tgz");
  expect(codec.integrity).toBe("sha512-n++8XWcj+jCOr2IOl7h8LbKnGBDY4aPbmprMONBNFdn0ImXqpGVv5zliDs0V9HbmbCQLpbuo2ej9rAoOQTvMDA==");
  delete codec.resolved;delete codec.integrity;
  for(const key of ["node_modules/sharp","node_modules/@img/colour","node_modules/sharp/node_modules/semver"]){
    expect(lock.packages[key].optional).toBeUndefined();
    lock.packages[key]=Object.fromEntries(Object.entries(lock.packages[key]).flatMap(([k,v])=>k==="license"?[[k,v],["optional",true]]:[[k,v]]));
  }
}
// Operator decision 2026-10-10 on Dependabot advisories: next and eslint-config-next 16.3.8, sharp 0.35.5.
// The reviewed fixture holds every lock entry that update changed or added; reverse exactly those entries.
const securityUpdateFixture="tests/architecture/security-update-20261010-lock.json";
function projectSecurityUpdate20261010(lock:DependencyLock,fixtureSource:string) {
  expect(sha256(fixtureSource),"reviewed security update fixture").toBe("317dbea345c275ebef2b534180dfdd72846fe37a057339856a9b70e98096784c");
  const fixture=JSON.parse(fixtureSource) as {path:string;before:Record<string,unknown>|null;successorSha256:string}[];
  for(const entry of fixture) {
    expect(lock.packages[entry.path],entry.path).toBeDefined();
    expect(sha256(JSON.stringify(lock.packages[entry.path])),entry.path).toBe(entry.successorSha256);
    if(entry.before===null) delete lock.packages[entry.path];
    else lock.packages[entry.path]=structuredClone(entry.before);
  }
}
function projectSecurityUpdateManifest(manifest:{dependencies:Record<string,string>;devDependencies:Record<string,string>}) {
  for(const [section,name,successor,original] of [["dependencies","next","16.3.8","16.3.4"],["devDependencies","eslint-config-next","16.3.8","16.3.4"],["dependencies","sharp","0.35.5","0.35.4"]] as const) {
    expect(manifest[section][name],name).toBe(successor);manifest[section][name]=original;
  }
}
const task12RootScripts = {
  "test:e2e:core": "node --experimental-transform-types scripts/core-browser-run.mjs core",
  "test:e2e:sdk": "node --experimental-transform-types scripts/core-browser-run.mjs sdk",
  "test:e2e:vendor": "npm --workspace @build-manager/web run test:e2e:vendor --",
};
function projectTask12Scripts(manifest: { scripts: Record<string,string> }, scripts: Record<string,string>) {
  for(const [name,command] of Object.entries(scripts)) {
    expect(manifest.scripts[name],name).toBe(command);
    delete manifest.scripts[name];
  }
}
function projectTask12Workflow(source: string) {
  const build=(name:string)=>`      - name: ${name}\n        shell: bash\n        run: npm run build:web\n`;
  const step=(name:string,command:string,log?:string)=>`      - name: ${name}\n        env:\n          BUILD_MANAGER_E2E_PREBUILT: "1"\n        shell: bash\n        run: |\n${log ? '          set -o pipefail\n' : ''}          npm run ${command}${log ? ` 2>&1 | tee "$RUNNER_TEMP/${log}"` : ''}\n`;
  const web="Run Web E2E with existing synthetic-state configuration", b1="Run B1 Web with PostgreSQL and synthetic SDK sessions";
  const check="          node apps/web/tests/b1-e2e/check-results.mjs\n";
  const successor=build("Build Web once for Core SDK Web B1 and Vendor browser suites")
    +step("Run Core browser regressions with synthetic access","test:e2e:core","core-browser.log")
    +step("Run SDK browser regressions with B1 authority","test:e2e:sdk","sdk-browser.log")
    +step(web,"test:e2e:web","web-browser.log")+step(b1,"test:e2e:b1","b1-browser.log")+check
    +step("Run standalone Vendor browser acceptance with separate runtime authority","test:e2e:vendor","vendor-browser.log");
  const predecessor=build("Build Web once for both browser suites")+step(web,"test:e2e:web")+step(b1,"test:e2e:b1")+check;
  // Require the exact accepted commands, order, environment and raw log capture,
  // then reverse only that contiguous additive delta. Every other byte is hashed.
  expect(source.split(successor),"exact Task12 browser workflow successor").toHaveLength(2);
  return source.replace(successor,predecessor);
}
const frozen: Record<string,string> = {
  ".github/workflows/app-check.yml": "ab681452c8acb317fc2d00bd43d07b23b3f4c048c9799341be70812e701dd6f3",
  ".github/workflows/repository-check.yml": "392407bd74e65887dfb68ebea5a0fa0d3cba1bbdd631905a4d28dc1f91f8bf8c",
  "apps/mobile/package.json": "1946dbc04a065a94ccbb2498f0059cc538dd29a327a376fe3045bdf51ca24ce7",
  "apps/web/package.json": "b9281baa310f2772de79d47fe9f31bb74dbdf25798259db9732940830162c7b0",
  "apps/web/tests/b1-e2e/global-setup.ts": "05c7fbcca8b2cbe5d0ea67d557ecd85ce1707311ddd03ef16caf5d4e14a377ad",
  "apps/web/tests/b1-e2e/package.json": "609158e6c5fbc237939fa3ddf7faab80ab690bdc0c8d584414a885130103c4e8",
  "package-lock.json": "772e2956bfd8689bb382a2d8c4a9103f8a126d72dcb05449f9863d176d2d450f",
  "package.json": "5a5a3a6cc5f9b3c07eeff23e47543d4752c7f2dd7b32e6492f7b1c5bf8a275e6",
  "packages/api-client/package.json": "b772b240f83f7a4e0c3d69fefdbd0304fc65b3bb725477d684bb45815020a8d7",
  "packages/api-contracts/package.json": "41c581d5c36031b053dcd560249f57615e00238cf52fa1d75b699ee538803909",
  "packages/application/package.json": "b33dfa76f99cab1b7918c76870a86c570efcd8b3fec4f4751c949a416865b666",
  "packages/application/src/b1/begin-web-session.test.ts": "aea33b8dd1c32ed850dc3787ea38122292b68d083783f1df239e91a5e1c7e49a",
  "packages/application/src/b1/begin-web-session.ts": "472c024acb85ef14c4a0b3d1ebcdf80570bfddec716a944e119982758f1a9ab7",
  "packages/application/src/b1/errors.ts": "46d57fcbdba62e7d5e3f970679d1d75f516f983c409d3f0410001f6b55c9dc78",
  "packages/application/src/b1/organization-access.test.ts": "e3851985eadbf024607d99081a483ddc3ed49b9b53211c0e0d74e926d506888b",
  "packages/application/src/b1/organization-access.ts": "816d304b33931340651fed3e37a97a1d029f7ecc1b53c088896db686f143ef34",
  "packages/application/src/b1/ports.ts": "c38afd51df63f20be6ac38331404cf256e5e88f15d6accdf4608ef1140b7ec1c",
  "packages/application/src/b3/building-registration.test.ts": "154bcc57f3542207ed9ba7b54b19556008823b261cea66d859df106d40666b51",
  "packages/application/src/b3/building-registration.ts": "1f908a1f22d330782aa4171a376773099783526bb558b5982e81db6599cab4af",
  "packages/application/src/b3/errors.ts": "71b61ebe381b9922798e1efd181d8780963c699d89fa886cc29115c0aa9440ca",
  "packages/application/src/b3/ports.ts": "ddab0a49936c4ee1fe708d8a404b679a87a016c54b7df2ee6e2f6db78d818482",
  "packages/application/src/b3/validation.ts": "149350a3433536c738a97caa4ec39b0d6af5a192153420c9d78368f403bd35fa",
  "packages/application/src/b4/errors.ts": "f1fa1ac75325d9e61366d4946a8d4a460bfffed6a22cb5e294a1a202c3ee9ab2",
  "packages/application/src/b4/ports.ts": "3265269f1151eec9260866eb16a84f2cca6c6fe789629b8ec5e2c88683bcbaa2",
  "packages/application/src/b4/property-assignment.test.ts": "c7c53ed8b01db8161f3c630db968aec51c81a74c0911cc8c08f07d5d1d5eb115",
  "packages/application/src/b4/property-assignment.ts": "d8db1398e39f557cc483018ae8415aa277bc35023bbe8b0754eddc2cda00ef0d",
  "packages/application/src/b4/validation.ts": "79b13c056c0bce1d753c0ee644ec7865a393a74c157b18d122ba9a741706610e",
  "packages/domain/package.json": "3b359724db73605f995822daf587e4275451611118c714341a7725a3f96fa2e8",
  "packages/fixtures/package.json": "72dd44b9619b255fcf46c27315bbbd32a2a7d0c5c56ca90841390dfd3ad07065",
  "packages/persistence-postgres/migrations/0001_core_identity_organization.sql": "e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql": "1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "packages/persistence-postgres/migrations/0003_runtime_isolation.sql": "649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "packages/persistence-postgres/migrations/0004_b1_identity_sessions.sql": "2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "packages/persistence-postgres/migrations/0005_b1_auth_capabilities.sql": "22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "packages/persistence-postgres/migrations/0006_b1_organization_access.sql": "a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
  "packages/persistence-postgres/migrations/0007_b2_property_assignment_scope.sql": "4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2",
  "packages/persistence-postgres/migrations/0008_b3_building_registration.sql": "c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986",
  "packages/persistence-postgres/migrations/0009_b4_property_assignment_mutation.sql": "021ce7b36282e3a8a1ae12a4daecb944a9400a04825c2f65646944756b537fd4",
  "packages/persistence-postgres/src/b1/identity-session.ts": "9d4c0299aad456131640a038b0a968fa8271e28503327e0eb705530458bcec16",
  "packages/persistence-postgres/src/b1/index.ts": "f19498ec6a1a16d47ce1d6cb0d86ff24a98b882040e6aa100e74866563c9cde0",
  "packages/persistence-postgres/src/b1/org-transaction.ts": "e52ec6ea86aa314526481ca8ffff507129b7d9f6b57bbe6dc9decc8c38670c21",
  "packages/persistence-postgres/src/b1/organization-reader.ts": "22d1eedc03d6ed4eb2122d4c6f8453c68b16289641a8c7d905041cdc42fa58a4",
  "packages/persistence-postgres/src/b3/common.ts": "86a27505464292e5dd655d86450760ade91ca04999fc3de7800be86663b6db5b",
  "packages/persistence-postgres/src/b3/index.ts": "bde82b8dd9204f51fc11012602b3d68baef7d2fa092c9321d0256e9eb192edde",
  "packages/persistence-postgres/src/b3/registration.ts": "0d77fcbf0d1507701112b48bafda9adc3f0d87589f03bf0e82c04137932c0266",
  "packages/persistence-postgres/src/b3/unit-reader.ts": "0d1fc9cf91874170b4b1e9007f60a2edc35604f050d7128ed80ac3068e1774a3",
  "packages/persistence-postgres/src/b4/index.ts": "636a98026058a60bb73a90cf66f397053be284004f428710fe8924f4fdfc437c",
  "packages/persistence-postgres/src/b4/property-assignment.ts": "745918c0b9d05e8d6b2d5f145ea433c5308d98d02bbb0cbfa43430761eecf5a9",
  "packages/persistence-postgres/src/database.ts": "9d91a433248712d6c1b5f9715990c73814f1b71b0161c718a0049af16f79971f",
  "packages/persistence-postgres/src/testing/migrate.ts": "7d857ffa6cb2f846430d9a6976e341d6ae568f764ca3b125bcf14e6d8b1dd925",
  "packages/persistence-postgres/src/transaction.ts": "cccd4e77294fd92e2f61857d3d7a80543eff413525018c11561346881e442a60",
  "tests/postgres/foundation.test.ts": "09b40e3d8c383f11eec9a769e6a26533701a2f7a798f66013e1089d023eefd90",
  "tests/postgres/helpers/idle-pool-worker.ts": "44b7ce7430fdc08f7a730c6407f16000d3d803170c36fc9c2e5b165bdf81a169"
};
it("AC17 frozen foundation, dependency and workflow inventory retains canonical bytes",async()=>{
  for(const [path,expected] of Object.entries(frozen)) {
    let canonical=(await readFile(path,"utf8")).replaceAll("\r\n","\n");
    if(path===".github/workflows/app-check.yml")canonical=projectTask12Workflow(canonical);
    if(path==="package.json"){
      const manifest=JSON.parse(canonical);projectTask12Scripts(manifest,task12RootScripts);
      canonical=JSON.stringify(manifest,null,2)+"\n";
    }
    // The operator's RC1 photo directive explicitly permits only this existing
    // codec as a pinned direct dependency. Reverse that exact additive delta,
    // then retain every original B5 hash and all other dependency bytes.
    if(path==="apps/web/package.json"){
      const manifest=JSON.parse(canonical);
      projectTask12Scripts(manifest,{"test:e2e:vendor":"playwright test --config playwright.vendor.config.ts"});
      projectSecurityUpdateManifest(manifest);
      expect(manifest.dependencies.sharp).toBe("0.35.4");delete manifest.dependencies.sharp;
      canonical=JSON.stringify(manifest,null,2)+"\n";
    }
    if(path==="package-lock.json"){
      const lock=JSON.parse(canonical);
      // Reverse only the reviewed existing SDK57 patch entries, then the original
      // Sharp directive. Every untouched entry and original frozen hash remains.
      projectExpoSdk57Patch(lock,(await readFile(expoPatchFixture,"utf8")).replaceAll("\r\n","\n"));
      projectSecurityUpdate20261010(lock,(await readFile(securityUpdateFixture,"utf8")).replaceAll("\r\n","\n"));
      projectSharpLock(lock);
      canonical=JSON.stringify(lock,null,2)+"\n";
    }
    expect(createHash("sha256").update(canonical).digest("hex"),path).toBe(expected);
  }
  const manifest=JSON.parse(await readFile("packages/persistence-postgres/package.json","utf8"));
  expect(manifest.exports["./b5"]).toBe("./src/b5/index.ts"); delete manifest.exports["./b5"];
  // Successor scope issue69 adds an isolated entry; the original public root stays frozen.
  expect(manifest.exports["./core-flow"]).toBe("./src/core-flow.ts"); delete manifest.exports["./core-flow"];
  // PR70 authorization5969526294 adds only this successor capability entry.
  expect(manifest.exports["./core-onboarding"]).toBe("./src/core-onboarding.ts"); delete manifest.exports["./core-onboarding"];
  expect(manifest.exports["./vendor-handoff"]).toBe("./src/vendor-handoff/index.ts");
  delete manifest.exports["./vendor-handoff"];
  expect(manifest).toEqual({"name": "@build-manager/persistence-postgres", "version": "0.0.0", "private": true, "type": "module", "exports": {".": "./src/index.ts", "./testing": "./src/testing/index.ts", "./b1": "./src/b1/index.ts", "./b3": "./src/b3/index.ts", "./b4": "./src/b4/index.ts"}, "dependencies": {"pg": "8.23.0", "@build-manager/application": "0.0.0"}, "devDependencies": {"@testcontainers/postgresql": "12.1.0", "@types/pg": "8.23.1", "node-pg-migrate": "9.0.0"}});
});
it("AC17 exact Expo SDK57 projection rejects package, fixture and unrelated lock drift",async()=>{
  const lock=JSON.parse(await readFile("package-lock.json","utf8")) as DependencyLock;
  const fixture=(await readFile(expoPatchFixture,"utf8")).replaceAll("\r\n","\n");
  const security=(await readFile(securityUpdateFixture,"utf8")).replaceAll("\r\n","\n");
  const inventory=(candidate:DependencyLock,source=fixture,securitySource=security)=>{
    projectExpoSdk57Patch(candidate,source);projectSecurityUpdate20261010(candidate,securitySource);projectSharpLock(candidate);
    expect(sha256(JSON.stringify(candidate,null,2)+"\n")).toBe(frozen["package-lock.json"]);
  };
  inventory(structuredClone(lock));
  for(const mutate of [
    (candidate:DependencyLock)=>{candidate.packages["node_modules/expo"].version="57.0.28";},
    (candidate:DependencyLock)=>{candidate.packages["node_modules/@expo/ui"].integrity="sha512-unreviewed";},
    (candidate:DependencyLock)=>{(candidate.packages["node_modules/expo"].dependencies as Record<string,string>)["expo-constants"]="*";},
    (candidate:DependencyLock)=>{candidate.packages["node_modules/@expo/cli"].hasInstallScript=true;},
    (candidate:DependencyLock)=>{delete candidate.packages["node_modules/expo-linking"];},
    (candidate:DependencyLock)=>{candidate.packages["node_modules/unreviewed"]={version:"1.0.0"};},
    (candidate:DependencyLock)=>{candidate.packages["node_modules/typescript"].version="0.0.0";},
    (candidate:DependencyLock)=>{candidate.packages["node_modules/@expo/devcert"].version="1.2.2";},
  ]) {
    const candidate=structuredClone(lock);mutate(candidate);
    expect(()=>inventory(candidate)).toThrow();
  }
  const changedFixture=JSON.parse(fixture);changedFixture[0].before.version="57.0.26";
  expect(()=>inventory(structuredClone(lock),JSON.stringify(changedFixture,null,2)+"\n")).toThrow();
  const removedFixture=JSON.parse(fixture);removedFixture.pop();
  expect(()=>inventory(structuredClone(lock),JSON.stringify(removedFixture,null,2)+"\n")).toThrow();
  // The security update projection rejects an unreviewed version, a tampered fixture and a dropped entry.
  for(const mutate of [
    (candidate:DependencyLock)=>{candidate.packages["node_modules/next"].version="16.3.9";},
    (candidate:DependencyLock)=>{candidate.packages["node_modules/sharp"].integrity="sha512-unreviewed";},
    (candidate:DependencyLock)=>{delete candidate.packages["node_modules/@img/sharp-wasm32"];},
  ]) {
    const candidate=structuredClone(lock);mutate(candidate);
    expect(()=>inventory(candidate)).toThrow();
  }
  const changedSecurity=JSON.parse(security);changedSecurity[0].before.version="9.9.9";
  expect(()=>inventory(structuredClone(lock),fixture,JSON.stringify(changedSecurity,null,2)+"\n")).toThrow();
  const removedSecurity=JSON.parse(security);removedSecurity.pop();
  expect(()=>inventory(structuredClone(lock),fixture,JSON.stringify(removedSecurity,null,2)+"\n")).toThrow();
});
it("AC17 Task12 projection rejects changed commands, order, log capture and unrelated workflow gates",async()=>{
  const source=(await readFile(".github/workflows/app-check.yml","utf8")).replaceAll("\r\n","\n");
  const inventory=(candidate:string)=>expect(createHash("sha256").update(projectTask12Workflow(candidate)).digest("hex")).toBe(frozen[".github/workflows/app-check.yml"]);
  inventory(source);
  for(const [before,after] of [
    ["npm run test:e2e:core 2>&1","npm run test:e2e:core -- --retries=1 2>&1"],
    ["npm run test:e2e:sdk 2>&1","npm run test:e2e:vendor 2>&1"],
    ['tee "$RUNNER_TEMP/vendor-browser.log"','tee "$RUNNER_TEMP/other.log"'],
    ["          set -o pipefail\n          npm run test:e2e:vendor","          npm run test:e2e:vendor"],
    ["timeout-minutes: 30","timeout-minutes: 31"],
    ["          npm run lint\n","          npm run lint -- --quiet\n"],
    ["          node apps/web/tests/b1-e2e/check-results.mjs\n",""],
  ]) {
    expect(source.includes(before),"negative fixture targets a real gate").toBe(true);
    expect(()=>inventory(source.replace(before,after))).toThrow();
  }
  const coreStart=source.indexOf("      - name: Run Core browser regressions"), sdkStart=source.indexOf("      - name: Run SDK browser regressions"), webStart=source.indexOf("      - name: Run Web E2E");
  expect(coreStart<sdkStart&&sdkStart<webStart).toBe(true);
  expect(()=>inventory(source.slice(0,coreStart)+source.slice(sdkStart,webStart)+source.slice(coreStart,sdkStart)+source.slice(webStart))).toThrow();
  const manifest=JSON.parse(await readFile("package.json","utf8"));
  const manifestInventory=(candidate:typeof manifest)=>{
    projectTask12Scripts(candidate,task12RootScripts);
    expect(createHash("sha256").update(JSON.stringify(candidate,null,2)+"\n").digest("hex")).toBe(frozen["package.json"]);
  };
  manifestInventory(structuredClone(manifest));
  for(const [name,command] of [
    ["test:e2e:vendor","npm --workspace @build-manager/web run test:e2e:vendor"],
    ["test:e2e:core","node --experimental-transform-types scripts/core-browser-run.mjs sdk"],
    ["test:e2e:b1","echo skipped"],
    ["unexpected-successor","echo extra script"],
  ]) {
    const changed=structuredClone(manifest);changed.scripts[name]=command;
    expect(()=>manifestInventory(changed)).toThrow();
  }
  const webManifest=JSON.parse(await readFile("apps/web/package.json","utf8"));
  webManifest.scripts["test:e2e:vendor"]="playwright test --config playwright.b1.config.ts";
  expect(()=>projectTask12Scripts(webManifest,{"test:e2e:vendor":"playwright test --config playwright.vendor.config.ts"})).toThrow();
});
it("AC01 B5 server graph excludes raw driver/demo/testing and exposes only the exact individual route",async()=>{
  const entries=(await readdir("apps/web/src/server/b5")).filter(p=>p.endsWith(".ts")&&!p.endsWith(".test.ts")).map(p=>join("apps/web/src/server/b5",p));
  for(const path of entries) {
    const imports=moduleEdges(await readFile(path,"utf8")).map(e=>e.specifier);
    expect(imports.some(i=>/^(?:pg|node:sqlite)$|fixture|testing|demo|persistence-postgres/.test(i))).toBe(false);
  }
  expect(await scanB1ProductionGraph(process.cwd(),entries)).toEqual([]);
  async function files(dir:string):Promise<string[]> { return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(r=>r.isDirectory()?files(join(dir,r.name)):[join(dir,r.name).replaceAll("\\","/")]))).flat(); }
  const appFiles=await files("apps/web/src/app");
  expect(appFiles.filter(p=>/memberships|roster|profile|reactivat|role-mutation|staff-search/.test(p))).toEqual(["apps/web/src/app/api/v2/organizations/[orgId]/memberships/[membershipId]/route.ts"]);
  expect((await files("apps/web/src/components")).some(p=>/\/b5\//.test(p))).toBe(false);
  const route=await readFile(appFiles.find(p=>p.includes("/memberships/"))!,"utf8");
  expect(route).toContain('export const runtime = "nodejs";'); expect(route).toContain('export const dynamic = "force-dynamic";');
  for(const method of ["GET","PUT","DELETE","POST","PATCH","HEAD","OPTIONS"]) expect(route).toContain(`export async function ${method}(`);
});
it("B5 uses one existing pool and one command with no alternate membership DML",async()=>{
  const port=await readFile("packages/persistence-postgres/src/b5/membership-termination.ts","utf8");
  expect(port.match(/SELECT authn\.b5_end_organization_membership/g)).toHaveLength(1);
  expect(port).not.toMatch(/app\.organization_membership|\b(?:INSERT|UPDATE|DELETE)\b|new Pool|new Client/);
  const container=await readFile("apps/web/src/server/b1/container.ts","utf8");
  expect(container.match(/createPostgresDatabase\(/g)).toHaveLength(1);
  expect(container).toContain("createOrganizationMembershipTerminationPort(database)");
  const transaction=await readFile("packages/persistence-postgres/src/b5/transaction.ts","utf8");
  expect(transaction).not.toMatch(/new Pool|new Client|NODE_OPTIONS/);
});
