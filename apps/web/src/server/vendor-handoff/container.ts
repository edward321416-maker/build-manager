import { VendorHandoffError } from "@build-manager/application";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createVendorHandoffExternalPort } from "@build-manager/persistence-postgres/vendor-handoff";
import type { VendorHTTPDependencies } from "./http";

let instance:VendorHTTPDependencies|undefined;
/** Separate external Vendor runtime: its own pool, its own role, no B1/Auth0 or Core HTTP dependency. */
export function getVendorHandoffContainer():VendorHTTPDependencies{
  if(!instance){
    let config:unknown;
    try{config=JSON.parse(process.env.VENDOR_HANDOFF_DATABASE_CONFIG??"null");}catch{throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");}
    if(!config||typeof config!=="object"||!("host" in config)||!("user" in config))throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    // Synthetic-local only: production credentials/IAM are outside this slice.
    if(!["127.0.0.1","localhost","::1"].includes(String(config.host)))throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    const user=String(config.user);
    if(user!=="bm_vendor_web")throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    const database=createPostgresDatabase({...config,host:String(config.host),user,max:5,connectionTimeoutMillis:5000});
    instance={external:(csrfDigest?:string)=>createVendorHandoffExternalPort(database,csrfDigest)};
  }
  return instance;
}
