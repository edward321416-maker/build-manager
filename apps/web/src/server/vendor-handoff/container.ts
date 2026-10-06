import { VendorHandoffError } from "@build-manager/application";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createVendorHandoffExternalPort } from "@build-manager/persistence-postgres/vendor-handoff";
import type { VendorHTTPDependencies } from "./http";

const LOOPBACK=["127.0.0.1","localhost","::1","[::1]"];
const unavailable=():never=>{throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");};

/** The Vendor surface's public origin is configured, never inferred from request Host/protocol headers. */
function appOrigin(raw:string|undefined):string{
  if(!raw)return unavailable();
  let url:URL;
  try{url=new URL(raw);}catch{return unavailable();}
  if(url.origin!==raw||url.username||url.password)return unavailable();
  if(url.protocol==="http:"&&LOOPBACK.includes(url.hostname))return url.origin;
  if(url.protocol==="https:")return url.origin;
  return unavailable();
}

let instance:VendorHTTPDependencies|undefined;
/** Separate external Vendor runtime: its own pool, its own role, no B1/Auth0 or Core HTTP dependency. */
export function getVendorHandoffContainer():VendorHTTPDependencies{
  if(!instance){
    const origin=appOrigin(process.env.VENDOR_HANDOFF_APP_ORIGIN);
    let config:unknown;
    try{config=JSON.parse(process.env.VENDOR_HANDOFF_DATABASE_CONFIG??"null");}catch{return unavailable();}
    if(!config||typeof config!=="object"||!("host" in config)||!("user" in config))return unavailable();
    // Synthetic-local only: production credentials/IAM are outside this slice.
    if(!LOOPBACK.includes(String(config.host)))return unavailable();
    const user=String(config.user);
    if(user!=="bm_vendor_web")return unavailable();
    const database=createPostgresDatabase({...config,host:String(config.host),user,max:5,connectionTimeoutMillis:5000});
    instance={external:(csrfDigest?:string)=>createVendorHandoffExternalPort(database,csrfDigest),origin};
  }
  return instance;
}
