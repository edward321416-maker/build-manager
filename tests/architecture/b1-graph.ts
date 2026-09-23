import { readFile,stat } from 'node:fs/promises';
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
 else return null;
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
