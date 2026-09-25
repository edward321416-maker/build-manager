import { mkdir,mkdtemp,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach,expect,it } from 'vitest';
import { scanRouteRuntimes } from './import-boundaries';
import { resolveLocal,scanB1ProductionGraph } from './b1-graph';
const routes=['session/complete','session','me/organizations','organizations/[orgId]/properties','organizations/[orgId]/properties/[propertyId]','organizations/[orgId]/properties/[propertyId]/units','organizations/[orgId]/properties/[propertyId]/units/[unitId]','session/logout'].map(x=>'apps/web/src/app/api/v2/'+x+'/route.ts');
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(files:Record<string,string>){const root=await mkdtemp(join(tmpdir(),'b1-graph-'));roots.push(root);for(const [path,body] of Object.entries(files)){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),body);}return root;}
it('eight actual v2 handlers have literal runtime and dynamic and all are discovered',async()=>{
 async function inventory(path:string):Promise<string[]>{let rows;try{rows=await readdir(path,{withFileTypes:true});}catch{return [];};return (await Promise.all(rows.map(async x=>x.isDirectory()?inventory(join(path,x.name)):x.name==='route.ts'?[join(path,x.name)]:[]))).flat();}
 expect((await inventory(join(process.cwd(),'apps/web/src/app/api/v2'))).length).toBe(8);
 for(const path of routes){const body=await readFile(path,'utf8');expect(body).toMatch(/export const runtime = "nodejs";/);expect(body).toMatch(/export const dynamic = "force-dynamic";/);}
 const missingRuntime=await fixture(Object.fromEntries(await Promise.all(routes.map(async p=>[p,(await readFile(p,'utf8')).replace('export const runtime = "nodejs";','')]))));
 expect((await scanRouteRuntimes(missingRuntime)).filter(x=>x.rule==='missing-node-runtime').map(x=>x.file).sort()).toEqual([...routes].sort());
 const missingDynamic=await fixture(Object.fromEntries(await Promise.all(routes.map(async p=>[p,(await readFile(p,'utf8')).replace('export const dynamic = "force-dynamic";','')]))));
 expect((await scanRouteRuntimes(missingDynamic)).filter(x=>x.rule==='missing-dynamic').map(x=>x.file).sort()).toEqual([...routes].sort());
});
it.each([
 'import "../../../../../scripts/b1-local-fixture.mjs";',
 'export * from "./facade";',
 'import "@/server/b1/facade";',
 'const x=require("./facade");',
 'const x=import("./facade");',
 'import type {X} from "./facade";',
 'type X=import("./facade").X;',
 'const x=import(target);',
 'const x=require(target);',
 'import "@build-manager/evil";',
 'import "@auth0/nextjs-auth0/testing";',
])('R12 production graph rejects fixture traversal: %s',async source=>{
 const root=await fixture({'apps/web/src/server/b1/http.ts':source,'apps/web/src/server/b1/facade.ts':'export * from "../../../tests/b1-e2e/fixture-session";','apps/web/tests/b1-e2e/fixture-session.ts':'export {};','scripts/b1-local-fixture.mjs':'export {};','packages/evil/package.json':JSON.stringify({name:'@build-manager/evil',exports:'./index.ts'}),'packages/evil/index.ts':'export * from "../../scripts/b1-local-fixture.mjs";'});
 expect((await scanB1ProductionGraph(root,['apps/web/src/server/b1/http.ts'])).length).toBeGreaterThan(0);
});
it('R12 actual production graph excludes test/demo/SQLite identity fallbacks',async()=>{expect(await scanB1ProductionGraph(process.cwd())).toEqual([]);});
it.each(['tests/postgres/helpers/b2-fixture.ts','apps/web/tests/b1-e2e/b2-fixture.ts'])('B2 fixtures cannot enter production graph: %s',async target=>{
 const fromSrc=target.startsWith('tests/')?'../../../'+target:'../tests/b1-e2e/b2-fixture.ts';
 const fromPackage=target.startsWith('tests/')?'../../'+target:'../../apps/web/tests/b1-e2e/b2-fixture.ts';
 const sources=[
  'import "../../fixture-facade";',
  'import "@/fixture-facade";',
  'export * from "@/fixture-facade";',
  'const x=require("@/fixture-facade");',
  'const x=import("@/fixture-facade");',
  'import type {X} from "@/fixture-facade";',
  'type X=import("@/fixture-facade").X;',
  'import "@build-manager/b2-test-support";',
  'const x=import(target);',
  'const x=require(target);',
 ];
 for(const entry of ['apps/web/src/server/b1/http.ts','apps/web/src/app/workspace/page.tsx']){
  for(const source of sources){
   const root=await fixture({
    [entry]:source,
    'apps/web/src/fixture-facade.ts':`export * from "${fromSrc}";`,
    'packages/b2-test-support/package.json':JSON.stringify({name:'@build-manager/b2-test-support',exports:'./index.ts'}),
    'packages/b2-test-support/index.ts':`export * from "${fromPackage}";`,
    [target]:'export type X = string;',
   });
   expect(await resolveLocal(root,'apps/web/src/fixture-facade.ts',fromSrc)).toBe(target);
   expect(await resolveLocal(root,'packages/b2-test-support/index.ts',fromPackage)).toBe(target);
   const findings=await scanB1ProductionGraph(root,[entry]);
   expect(findings.length,entry+': '+source+' -> '+target).toBeGreaterThan(0);
   expect(findings.some(x=>x.specifier.startsWith('<unresolved')),source).toBe(false);
  }
 }
});
it('R12 business request graph cannot acquire the completion login capability',async()=>{
 const root=await fixture({'apps/web/src/server/b1/http.ts':'export * from "./complete-session";','apps/web/src/server/b1/complete-session.ts':'export {};'});
 expect((await scanB1ProductionGraph(root,['apps/web/src/server/b1/http.ts'])).length).toBeGreaterThan(0);
});
it.each(['apps/web/src/app/workspace/page.tsx','apps/web/src/app/outside/page.tsx'])('R12 default inventory detects fixture imports from %s',async path=>{
 const root=await fixture(Object.fromEntries([
  ...['apps/web/src/proxy.ts','apps/web/src/server/b1/http.ts','apps/web/src/server/b1/complete-session.ts','apps/web/src/server/b1/logout.ts'].map(p=>[p,'export {};']),
  [path,'import "@/fixture-facade";'],
  ['apps/web/src/fixture-facade.ts','export * from "../../../../scripts/b1-local-fixture.mjs";'],
  ['scripts/b1-local-fixture.mjs','export {};'],
 ]));
 expect((await scanB1ProductionGraph(root)).length).toBeGreaterThan(0);
});
