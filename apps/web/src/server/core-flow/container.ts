import { CoreFlowError,type CoreFlowPort,type CoreAccessPort,type CoreOnboardingPort,type VendorHandoffManagerPort } from "@build-manager/application";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort,createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { createSessionRegistryPort } from "@build-manager/persistence-postgres/b1";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { createVendorHandoffManagerPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { invitationOrigin } from "./onboarding";

import { requireCoreB1Session } from "./b1-access";
export type CoreHTTPDependencies={port:CoreFlowPort;revoke(digest:string):Promise<void>;origins:string[];vendorHandoff?:{inOrganization(organization:string):VendorHandoffManagerPort};b1?:{current:typeof requireCoreB1Session;access:CoreAccessPort;onboarding?:CoreOnboardingPort;inviteOrigin?:()=>string}};
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
    if(!["B1","DEMO"].includes(process.env.BUILD_MANAGER_MODE??""))throw new CoreFlowError("DEPENDENCY_UNAVAILABLE");
    instance={port:createCoreFlowPort(database),revoke:digest=>registry.revoke(digest),origins,...(process.env.BUILD_MANAGER_MODE==="B1"?{vendorHandoff:{inOrganization:(organization:string)=>createVendorHandoffManagerPort(database,organization)},b1:{current:requireCoreB1Session,access:createCoreAccessPort(database),onboarding:createCoreOnboardingPort(database),inviteOrigin:invitationOrigin}}:{})};
  }
  return instance;
}
