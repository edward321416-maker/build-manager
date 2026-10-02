import { CoreFlowError,type CoreFlowPort } from "@build-manager/application";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createSessionRegistryPort } from "@build-manager/persistence-postgres/b1";

export type CoreHTTPDependencies={port:CoreFlowPort;revoke(digest:string):Promise<void>;origins:string[]};
let instance:CoreHTTPDependencies|undefined;
export function getCoreFlowContainer():CoreHTTPDependencies {
  if(process.env.CORE_FLOW_MODE!=="SYNTHETIC_LOCAL")throw new CoreFlowError("DEPENDENCY_UNAVAILABLE");
  if(!instance){
    const config:unknown=JSON.parse(process.env.CORE_FLOW_DATABASE_CONFIG??"null");
    if(!config || typeof config!=="object" || !("host" in config) || !["127.0.0.1","localhost","::1"].includes(String(config.host)))throw new CoreFlowError("DEPENDENCY_UNAVAILABLE");
    const database=createPostgresDatabase({...config,host:String(config.host),max:5,connectionTimeoutMillis:5000});
    const registry=createSessionRegistryPort(database);
    const origins=(process.env.CORE_FLOW_ORIGINS??"").split(",").filter(Boolean);
    if(!origins.length)throw new CoreFlowError("DEPENDENCY_UNAVAILABLE");
    instance={port:createCoreFlowPort(database),revoke:digest=>registry.revoke(digest),origins};
  }
  return instance;
}
