import { randomBytes } from 'node:crypto';
import { spawn,execFileSync } from 'node:child_process';
import { access,readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { Client,type ClientConfig } from 'pg';
import { startPostgres18Container,provisionTestRoles,runPostgresMigrations,grantRuntimeAccess } from '@build-manager/persistence-postgres/testing';
import { stopOwnedServer } from './global-teardown';
export default async function setup(){
 const directory=fileURLToPath(new URL('.',import.meta.url)),web=resolve(directory,'../..'),cli=createRequire(import.meta.url).resolve('next/dist/bin/next');
 // Read installed metadata via the public testing entrypoint; never import SDK internals.
 const testingEntry=createRequire(import.meta.url).resolve('@auth0/nextjs-auth0/testing');
 const sdk=JSON.parse(await readFile(resolve(dirname(testingEntry),'../../package.json'),'utf8'));
 if(sdk.name!=='@auth0/nextjs-auth0'||sdk.version!=='4.30.0')throw new Error('B1_E2E_SDK_VERSION_MISMATCH');
 // Refuse an occupied port: never reuse or stop another server.
 await new Promise<void>((ok,no)=>{const probe=createServer();probe.once('error',()=>no(new Error('B1_E2E_PORT_IN_USE')));probe.listen(3124,()=>probe.close(()=>ok()));});
 if(process.env.BUILD_MANAGER_E2E_PREBUILT==='1')await access(resolve(web,'.next/BUILD_ID'));
 else execFileSync(process.execPath,[cli,'build'],{cwd:web,stdio:'inherit',timeout:180000});
 const p=await startPostgres18Container();
 const roles=await provisionTestRoles(p.admin,p.adminConfig,p.database),migration=new Client(roles.migrationConfig);
 try{await migration.connect();await runPostgresMigrations(migration);await grantRuntimeAccess(migration);}catch{await migration.end();await p.stop();throw new Error('B1_E2E_MIGRATION_FAILED');}
 await migration.end();
 const secret=randomBytes(32).toString('hex');
 function connection(c:ClientConfig){const u=new URL('postgresql://localhost');u.hostname=String(c.host);u.port=String(c.port);u.username=String(c.user);u.password=String(c.password);u.pathname='/'+c.database;return u.toString();}
 let logoutRequests=0;
 const provider=createHttpServer((request,response)=>{
  const path=new URL(request.url??'/', 'http://localhost').pathname;
  if(path==='/logout'){logoutRequests++;response.writeHead(302,{location:'http://localhost:3124/'}).end();}
  else if(path==='/observations')response.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({logoutRequests}));
  else response.writeHead(404).end();
 });
 await new Promise<void>(ok=>provider.listen(0,'127.0.0.1',ok));
 const address=provider.address();if(!address||typeof address==='string')throw new Error('SYNTHETIC_PROVIDER_NOT_READY');
 const providerOrigin=`http://127.0.0.1:${address.port}`;
 const stopProvider=()=>new Promise<void>((ok,no)=>provider.close(error=>error?no(error):ok()));
 process.env.B1_E2E_PRIVATE=JSON.stringify({roles,secret,providerOrigin});
 const env:NodeJS.ProcessEnv={...process.env,B1_E2E_PROVIDER_ORIGIN:providerOrigin,BUILD_MANAGER_MODE:'B1',B1_AUTH0_DOMAIN:'b1.synthetic.invalid',B1_AUTH0_CLIENT_ID:'synthetic',B1_AUTH0_CLIENT_SECRET:randomBytes(32).toString('hex'),B1_AUTH0_SECRET:secret,B1_APP_BASE_URL:'http://localhost:3124',B1_LOGIN_DATABASE_URL:connection(roles.b1.loginConfig),B1_WEB_DATABASE_URL:connection(roles.b1.webConfig)};
 // No test fixture metadata is given to the product server.
 delete env.B1_E2E_PRIVATE;
 const server=spawn(process.execPath,['--import',pathToFileURL(resolve(directory,'provider-network-preload.mjs')).href,cli,'start','--port','3124'],{cwd:web,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 server.stdout?.resume();server.stderr?.resume();
 try{
  const deadline=Date.now()+60000;let ready=false;
  while(Date.now()<deadline){if(server.exitCode!==null)break;try{const r=await fetch('http://localhost:3124/',{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{ /* startup polling */ }await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw new Error('B1_E2E_SERVER_NOT_READY');
 }catch(error){await stopOwnedServer(server);await stopProvider();await p.stop();throw error;}
 console.log('B1_E2E_SYNTHETIC_AUTH PostgreSQL18.6 production Web server ready');
 return async()=>{delete process.env.B1_E2E_PRIVATE;await stopOwnedServer(server);await stopProvider();await p.stop();};
}
