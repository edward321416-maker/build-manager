import "./core-flow-register.mjs";
import { randomBytes,createHash } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir,networkInterfaces } from "node:os";
import { resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync,spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const directory=join(homedir(),".build-manager-rc1-private"),statePath=join(directory,"state.json"),codesPath=join(directory,"access-codes.json");
const container="build-manager-core-flow-rc1",database="core_flow_synthetic";
const docker=(...args)=>execFileSync("docker",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const save=async(state)=>{await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});await writeFile(codesPath,JSON.stringify(Object.fromEntries(Object.entries(state.fixture.accounts).map(([name,a])=>[name,a.handle])),null,2),{mode:0o600});};
async function prepare(){
  const { provisionTestRoles,provisionCoreAccessTestRole,provisionCoreOnboardingTestRole,grantRuntimeAccess,runPostgresMigrations,seedCoreFlowFixture }=await import("@build-manager/persistence-postgres/testing");
  await mkdir(directory,{recursive:true,mode:0o700});
  let state;
  if(existsSync(statePath))state=JSON.parse(await readFile(statePath,"utf8"));
  else{
    // Never adopt, overwrite, or remove a container/volume left by another setup.
    if(docker("ps","-a","--filter",`name=^/${container}$`,"--format","{{.ID}}"))throw new Error("EXISTING_CONTAINER_REQUIRES_ITS_PRIVATE_STATE");
    if(docker("volume","ls","--filter",`name=^${container}-data$`,"--format","{{.Name}}"))throw new Error("EXISTING_VOLUME_REQUIRES_ITS_PRIVATE_STATE");
    const password=randomBytes(32).toString("hex"),envPath=join(directory,"postgres.env");
    await writeFile(envPath,`POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=${database}\n`,{mode:0o600});
    docker("run","-d","--name",container,"--label","build-manager.synthetic=core-flow-rc1","--env-file",envPath,"-p","127.0.0.1:55439:5432","-v",`${container}-data:/var/lib/postgresql`,"postgres:18.6-bookworm");
    state={version:1,admin:{host:"127.0.0.1",port:55439,database,user:"postgres",password}};
    // Save before provisioning so an interrupted setup never loses its credentials.
    await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});
  }
  const inspected=JSON.parse(docker("inspect",container))[0];
  if(state.version!==1||state.admin.host!=="127.0.0.1"||state.admin.database!==database||inspected.Config.Labels["build-manager.synthetic"]!=="core-flow-rc1")throw new Error("PRIVATE_STATE_MISMATCH");
  if(!inspected.State.Running)docker("start",container);
  let ready=false;
  for(let i=0;i<40;i++){try{docker("exec",container,"pg_isready","-U","postgres","-d",database);ready=true;break;}catch{await delay(250);}}
  if(!ready)throw new Error("LOCAL_POSTGRES_NOT_READY");
  const admin=new Client(state.admin);await admin.connect();
  let login;
  try{
    if(!state.roles){
      const existing=await admin.query("SELECT 1 FROM pg_roles WHERE rolname='bm_pf02a_migrator'");
      if(existing.rowCount)throw new Error("INTERRUPTED_SETUP_REQUIRES_INSPECTION");
      state.roles=await provisionTestRoles(admin,state.admin,database);
      await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});
    }
    await provisionCoreAccessTestRole(admin);
    await provisionCoreOnboardingTestRole(admin);
    const migration=new Client(state.roles.migrationConfig);await migration.connect();
    try{await runPostgresMigrations(migration);await grantRuntimeAccess(migration);}finally{await migration.end();}
    login=new Client(state.roles.b1.loginConfig);await login.connect();
    if(!state.fixture){
      await admin.query(`COMMENT ON DATABASE ${database} IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
      state.fixture=await seedCoreFlowFixture(admin,login);
    }else{
      const marker=(await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()")).rows[0].marker;
      if(marker!=="CORE_FLOW_SYNTHETIC_LOCAL")throw new Error("SYNTHETIC_MARKER_REQUIRED");
      for(const account of Object.values(state.fixture.accounts)){
        const identity=(await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'",[account.userId])).rows[0];
        if(identity?.issuer!=="https://rc1.synthetic.invalid/")throw new Error("SYNTHETIC_IDENTITY_REQUIRED");
        const handle=randomBytes(32).toString("hex"),digest=createHash("sha256").update(handle).digest("hex");
        const user=(await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes') AS id",[identity.issuer,identity.subject,Buffer.from(digest,"hex")])).rows[0].id;
        if(user!==account.userId)throw new Error("IDENTITY_MISMATCH");
        await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)",[Buffer.from(digest,"hex"),account.orgId]);
        account.handle=handle;account.digest=digest;
      }
    }
    await save(state);
    console.log("RC1_PREPARED | synthetic accounts renewed for 55 minutes | persistent database preserved");
    console.log(`Private access codes: ${codesPath}`);
  }finally{await login?.end();await admin.end();}
}
async function serve(){
  const state=JSON.parse(await readFile(statePath,"utf8"));
  if(!state.fixture||state.admin?.host!=="127.0.0.1"||state.admin.database!==database)throw new Error("PREPARE_REQUIRED");
  const port=Number(process.env.CORE_FLOW_PORT??3130);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("INVALID_PORT");
  const lan=Object.values(networkInterfaces()).flat().filter(n=>n&&n.family==="IPv4"&&!n.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n=>n.address);
  const host=process.env.CORE_FLOW_HOST??"127.0.0.1";
  if(host!=="127.0.0.1"&&!lan.includes(host))throw new Error("EXPLICIT_PRIVATE_INTERFACE_REQUIRED");
  const hosts=["127.0.0.1","localhost",...lan];
  const origins=hosts.flatMap(host=>[port,8081].map(p=>`http://${host}:${p}`));
  const child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname",host,"--port",String(port)],{
    cwd:join(root,"apps/web"),stdio:"inherit",env:{...process.env,BUILD_MANAGER_MODE:"DEMO",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:origins.join(",")},
  });
  for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>child.kill(signal));
  child.on("exit",code=>{process.exitCode=code??1;});
  child.on("error",()=>{console.error("RC1_SERVER_START_FAILED");process.exitCode=1;});
  console.log(`RC1 Web: http://127.0.0.1:${port}/core`);
  console.log("LAN API candidates (device reachability must be verified): "+lan.map(host=>`http://${host}:${port}`).join(", "));
}
try{
  if(process.version!=="v24.21.0")throw new Error("NODE_24_21_0_REQUIRED");
  if(process.argv.includes("--prepare"))await prepare();
  else if(process.argv.includes("--serve"))await serve();
  else throw new Error("USE_PREPARE_OR_SERVE");
}catch{console.error("RC1_SETUP_FAILED | inspect the local prerequisites; credentials and database errors are not printed");process.exitCode=1;}
