import { readFile,stat,readdir } from 'node:fs/promises';
import { dirname,join,relative,resolve,sep } from 'node:path';
import ts from 'typescript';
const transport=new Set(['apps/web/src/proxy.ts','apps/web/src/server/b1/auth0.ts','apps/web/src/server/b1/auth-transport.ts','apps/web/src/server/b1/config.ts','apps/web/src/runtime/application-mode.ts']);
// jose is the explicitly operator-approved R08 signature-verification supplement.
const transportModules=new Set(['next/server','@auth0/nextjs-auth0/server','@auth0/nextjs-auth0/types','jose','node:crypto','server-only']);
export function moduleEdges(source:string):{specifier:string;dynamic:boolean}[]{
 const file=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edges:{specifier:string;dynamic:boolean}[]=[];
 const add=(node:ts.Node|undefined)=>edges.push(node && ts.isStringLiteralLike(node)?{specifier:node.text,dynamic:false}:{specifier:'<nonliteral-loader>',dynamic:true});
 function visit(node:ts.Node){
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){if(node.moduleSpecifier)add(node.moduleSpecifier);}
  else if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference))add(node.moduleReference.expression);
  else if(ts.isImportTypeNode(node)){add(ts.isLiteralTypeNode(node.argument)?node.argument.literal:undefined);}
  else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression)&&node.expression.text==='require'))add(node.arguments[0]);
  ts.forEachChild(node,visit);
 }
 visit(file);return edges;
}
export async function resolveLocal(root:string,file:string,specifier:string):Promise<string|null>{
 let target:string;
 if(specifier.startsWith('.'))target=resolve(root,dirname(file),specifier);
 else if(specifier.startsWith('@/'))target=resolve(root,'apps/web/src',specifier.slice(2));
 else if(specifier.startsWith('@build-manager/')){
  let found:string|undefined;
  for(const folder of ['packages','apps']){
   let dirs:string[];try{dirs=await readdir(join(root,folder));}catch{continue;}
   for(const dir of dirs){try{
    const metadata=JSON.parse(await readFile(join(root,folder,dir,'package.json'),'utf8'));
    if(specifier!==metadata.name && !specifier.startsWith(metadata.name+'/'))continue;
    const subpath=specifier===metadata.name?'.':'.'+specifier.slice(metadata.name.length);
    let exp=metadata.exports;
    if(typeof exp==='object' && exp!==null)exp=exp[subpath];
    if(typeof exp==='object' && exp!==null)exp=exp.import??exp.default??exp.types;
    if(typeof exp==='string')found=resolve(root,folder,dir,exp);
   }catch{ /* no usable workspace export */ }}
  }
  if(!found)return '<unresolved-workspace>';target=found;
 }else return null;
 for(const candidate of [target,...['.ts','.tsx','.js','.mjs','.cjs','/index.ts','/index.tsx'].map(ext=>target+ext)]){
  try{if((await stat(candidate)).isFile())return relative(root,candidate).split(sep).join('/');}catch{ /* unresolved target is denied by caller */ }
 }
 return '<unresolved-local>';
}
export async function scanProxyTransport(root:string){
 const findings:{file:string;specifier:string;rule:'proxy-transport'}[]=[],seen=new Set<string>();
 async function walk(file:string){
  if(seen.has(file))return;seen.add(file);
  let source:string;try{source=await readFile(join(root,file),'utf8');}catch{return;}
  for(const edge of moduleEdges(source)){
   const local=await resolveLocal(root,file,edge.specifier);
   if(edge.dynamic || local && !transport.has(local) || !local && !transportModules.has(edge.specifier))findings.push({file,specifier:edge.specifier,rule:'proxy-transport'});
   else if(local)await walk(local);
  }
 }
 await walk('apps/web/src/proxy.ts');return findings;
}
export async function scanB1ProductionGraph(root:string,entries?:string[]){
 const findings:{file:string;specifier:string}[]=[],seen=new Set<string>();
 let bootstrapAllowed=false,fixtureOnly=false;
 const forbidden=(file:string)=>file.startsWith('../')||file.startsWith('scripts/')||/(^|\/)(tests|testing|__tests__|fixtures)(\/|$)|\.test\.[cm]?[jt]sx?$/.test(file)||file.includes('/server/persistence/')||file.includes('/server/container.');
 async function walk(file:string){
  const key=String(fixtureOnly)+String(bootstrapAllowed)+file;if(seen.has(key))return;seen.add(key);
  if(!fixtureOnly && !bootstrapAllowed && file==='apps/web/src/server/b1/complete-session.ts'){findings.push({file,specifier:'<login-capability-outside-completion>'});return;}
  let source:string;try{source=await readFile(join(root,file),'utf8');}catch{findings.push({file,specifier:'<unresolved-source>'});return;}
  for(const edge of moduleEdges(source)){
   const local=await resolveLocal(root,file,edge.specifier);
   const testOnly=local&&(local.startsWith('scripts/')||/(^|\/)(tests|testing|__tests__)(\/|$)|\.test\.[cm]?[jt]sx?$/.test(local));
   if(edge.dynamic || edge.specifier==='@auth0/nextjs-auth0/testing'||(!fixtureOnly&&edge.specifier==='node:sqlite')||local&&(local.startsWith('<')||local.startsWith('../')||testOnly||!fixtureOnly&&forbidden(local))){findings.push({file,specifier:edge.specifier});continue;}
   if(local)await walk(local);
  }
 }
 const defaults=['apps/web/src/proxy.ts','apps/web/src/server/b1/http.ts','apps/web/src/server/b1/complete-session.ts','apps/web/src/server/b1/logout.ts'];
 async function routeEntries(dir:string){let rows;try{rows=await readdir(join(root,dir),{withFileTypes:true});}catch{return;}for(const row of rows){const file=dir+'/'+row.name;if(row.isDirectory())await routeEntries(file);else if(row.name==='route.ts')defaults.push(file);}}
 if(!entries)await routeEntries('apps/web/src/app/api/v2');
 for(const entry of entries??defaults){bootstrapAllowed=entry==='apps/web/src/server/b1/complete-session.ts'||entry==='apps/web/src/app/api/v2/session/complete/route.ts';await walk(entry);}
 if(!entries){
  const sources:string[]=[];
  async function inventory(dir:string){let rows;try{rows=await readdir(join(root,dir),{withFileTypes:true});}catch{return;}
   for(const row of rows){const path=dir+'/'+row.name;if(row.isDirectory()){if(!['testing','tests','__tests__'].includes(row.name))await inventory(path);}else if(/\.[cm]?[jt]sx?$/.test(row.name)&&!/(\.test\.|\.d\.ts$)/.test(row.name))sources.push(path);}
  }
  await inventory('apps/web/src');
  for(const entry of sources){
   fixtureOnly=!entry.startsWith('apps/web/src/app/workspace/')&&!entry.startsWith('apps/web/src/server/b1/');
   bootstrapAllowed=entry==='apps/web/src/server/b1/complete-session.ts'||entry==='apps/web/src/app/api/v2/session/complete/route.ts';
   await walk(entry);
  }
 }
 return findings;
}
