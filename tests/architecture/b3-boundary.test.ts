import { readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { moduleEdges,scanB1ProductionGraph } from './b1-graph';

it('B3 container assembles registration and unit ports on the existing database handle',async()=>{
 const body=await readFile('apps/web/src/server/b1/container.ts','utf8');
 expect(body).toContain('createBuildingRegistrationPort');
 expect(body).toContain('createUnitReadPort');
 expect((body.match(/createPostgresDatabase\(/g)??[]).length).toBe(1);
 expect(body).not.toMatch(/B3_.*DATABASE_URL|createPostgresDatabase\([^)]*B3/);
});

it('B3 server modules do not import raw pg, demo persistence, fixtures, or test auth',async()=>{
 const dir='apps/web/src/server/b3';
 const files=(await readdir(dir)).filter(x=>x.endsWith('.ts')&&!x.endsWith('.test.ts'));
 for(const file of files){
  const body=await readFile(join(dir,file),'utf8');
  const specs=moduleEdges(body).map(x=>x.specifier);
  expect(specs,file).not.toContain('pg');
  expect(specs,file).not.toContain('node:sqlite');
  expect(specs,file).not.toContain('@build-manager/fixtures');
  expect(specs,file).not.toContain('@auth0/nextjs-auth0/testing');
 }
});

it('B3 production graph excludes test and demo fallbacks',async()=>{
 expect(await scanB1ProductionGraph(process.cwd())).toEqual([]);
});
