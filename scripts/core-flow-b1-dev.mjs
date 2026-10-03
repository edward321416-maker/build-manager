import "./core-flow-register.mjs";
import { randomBytes,createHash } from "node:crypto";
import { readFile,writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join,resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Client } from "pg";
import { readB1AuthConfig } from "../apps/web/src/server/b1/config.ts";

const root=resolve(fileURLToPath(new URL("..",import.meta.url))),directory=join(homedir(),".build-manager-rc1-private"),file=join(directory,"b1-sdk-state.json");
const connection=c=>{const u=new URL("postgresql://localhost");u.hostname=c.host;u.port=String(c.port);u.username=c.user;u.password=c.password;u.pathname="/"+c.database;return u.toString();};
try{
 if(process.version!=="v24.21.0")throw new Error();
 const state=JSON.parse(await readFile(join(directory,"state.json"),"utf8"));
 if(state.version!==1||state.admin.host!=="127.0.0.1"||state.admin.database!=="core_flow_synthetic")throw new Error();
 for(const c of [state.roles.b1.loginConfig,state.roles.b1.webConfig])if(c.host!==state.admin.host||c.database!==state.admin.database||c.port!==state.admin.port)throw new Error();
 if(state.roles.b1.loginConfig.user!=="bm_b1_login"||state.roles.b1.webConfig.user!=="bm_b1_web")throw new Error();
 const admin=new Client(state.admin);await admin.connect();
 try{if((await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()")).rows[0].marker!=="CORE_FLOW_SYNTHETIC_LOCAL")throw new Error();}finally{await admin.end();}
 if(process.argv.includes("--migrate")){
  const {provisionCoreOnboardingTestRole,runPostgresMigrations}=await import("@build-manager/persistence-postgres/testing");
  const admin=new Client(state.admin),migration=new Client(state.roles.migrationConfig);await admin.connect();
  try{await provisionCoreOnboardingTestRole(admin);await migration.connect();try{await runPostgresMigrations(migration);}finally{await migration.end();}}
  finally{await admin.end();}
  console.log("CORE_B1_MIGRATED | marked local database; existing accounts, sessions, tickets and photos preserved");
 }else if(process.argv.includes("--prepare-synthetic-sdk")){
  const {seedCoreFlowFixture}=await import("@build-manager/persistence-postgres/testing");
  const admin=new Client(state.admin),login=new Client(state.roles.b1.loginConfig);await admin.connect();await login.connect();
  try{
   const saved=existsSync(file)?JSON.parse(await readFile(file,"utf8")):{version:1,secret:randomBytes(32).toString("hex"),fixture:await seedCoreFlowFixture(admin,login,"SYNTHETIC_B1")};
   if(saved.version!==1)throw new Error();
   for(const account of Object.values(saved.fixture.accounts)){
    const identity=(await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'",[account.userId])).rows[0];
    if(identity?.issuer!=="https://b1.synthetic.invalid/"||!identity.subject.startsWith("auth0|synthetic-"))throw new Error();
    const handle=randomBytes(32).toString("hex"),digest=createHash("sha256").update(handle).digest("hex");
    const user=(await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes') AS id",[identity.issuer,identity.subject,Buffer.from(digest,"hex")])).rows[0].id;
    if(user!==account.userId)throw new Error();
    Object.assign(account,{handle,digest,subject:identity.subject,csrf:randomBytes(32).toString("hex"),issuedAt:Math.floor(Date.now()/1000)});
   }
   await writeFile(file,JSON.stringify(saved,null,2),{mode:0o600});
   console.log("SYNTHETIC_SDK_PREPARED | separate test actors; existing identities, tickets and photos preserved | not live Auth0");
  }finally{await login.end();await admin.end();}
 }else{
  const synthetic=process.argv.includes("--serve-synthetic-sdk");
  if(!synthetic&&!process.argv.includes("--serve"))throw new Error();
  const env={...process.env};
  if(synthetic){const saved=JSON.parse(await readFile(file,"utf8"));Object.assign(env,{B1_AUTH0_DOMAIN:"b1.synthetic.invalid",B1_AUTH0_CLIENT_ID:"synthetic",B1_AUTH0_CLIENT_SECRET:randomBytes(32).toString("hex"),B1_AUTH0_SECRET:saved.secret,B1_APP_BASE_URL:"http://localhost:3133"});}
  const config=readB1AuthConfig(env),url=new URL(config.appBaseUrl);
  // Actual mode uses the configured callback origin unchanged, never assumes 3130.
  Object.assign(env,{BUILD_MANAGER_MODE:"B1",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:config.appBaseUrl,B1_LOGIN_DATABASE_URL:connection(state.roles.b1.loginConfig),B1_WEB_DATABASE_URL:connection(state.roles.b1.webConfig)});
  const child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname",url.hostname,"--port",url.port||"80"],{cwd:join(root,"apps/web"),env,stdio:"inherit",windowsHide:true});
  for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
  child.on("error",()=>{console.error("CORE_B1_START_FAILED");process.exitCode=1;});child.on("exit",code=>{process.exitCode=code??1;});
  console.log(`CORE_B1_SERVER | ${synthetic?"SYNTHETIC_SDK_ONLY; provider login unavailable":"EXISTING_AUTH0_CONFIGURATION"} | ${config.appBaseUrl}/core`);
 }
}catch{console.error("CORE_B1_CONFIGURATION_REQUIRED | use prepared synthetic database and existing private Auth0 configuration; values are not printed");process.exitCode=1;}
