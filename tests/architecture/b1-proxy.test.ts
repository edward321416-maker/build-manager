import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach,expect,it } from 'vitest';
import { scanImportBoundaries } from './import-boundaries';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(proxy:string,helper='export {};'){
 const root=await mkdtemp(join(tmpdir(),'b1-proxy-'));roots.push(root);
 for(const [path,text] of Object.entries({'apps/web/src/proxy.ts':proxy,'apps/web/src/server/b1/auth0.ts':helper})){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),text);}
 return root;
}
it('allows only exact proxy Auth0 transport boundary',async()=>{
 const root=await fixture('import { auth0 } from "./server/b1/auth0";','import {Auth0Client} from "@auth0/nextjs-auth0/server"; import {jwtVerify} from "jose"; export const auth0=Auth0Client;');
 expect(await scanImportBoundaries(root)).toEqual([]);
});
it.each(['@build-manager/application','@build-manager/domain','@build-manager/fixtures','@build-manager/persistence-postgres/b1','pg','node:sqlite','./server/b1/container'])('rejects direct proxy dependency %s',async spec=>{
 const root=await fixture(`import x from '${spec}';`);expect((await scanImportBoundaries(root)).length).toBeGreaterThan(0);
});
it.each(['export * from "@build-manager/application";','const x=require("pg");','const x=import("./container");','import type {X} from "@build-manager/domain";','const x=import(target);','const x=require(target);'])('rejects transitive transport bypass %s',async helper=>{
 const root=await fixture('import "./server/b1/auth0";',helper);expect((await scanImportBoundaries(root)).length).toBeGreaterThan(0);
});
it('does not extend the exception to pages/layouts or proxy-like names',async()=>{
 const root=await fixture('export {};');for(const path of ['app/page.tsx','app/layout.tsx','proxy-extra.ts']){await mkdir(join(root,'apps/web/src',path,'..'),{recursive:true});await writeFile(join(root,'apps/web/src',path), 'import "@/server/b1/auth0";');}
 expect((await scanImportBoundaries(root)).length).toBe(3);
});
