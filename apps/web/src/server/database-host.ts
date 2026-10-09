const LOOPBACK=["127.0.0.1","localhost","::1"];
// Railway's per-project private service network (encrypted, not Internet-reachable) hosts the demo database.
const PRIVATE_NETWORK=/^[a-z0-9-]+\.railway\.internal$/;
/**
 * Runtime database hosts: loopback for synthetic local use, the hosting provider's private service network,
 * or any other host only over TLS with certificate verification (hosted demo, operator decision 2026-10-09).
 * Credentials still come only from explicit server configuration.
 */
export function databaseHostAllowed(config:{host?:unknown;ssl?:unknown}):boolean{
  const host=typeof config.host==="string"?config.host:"";
  if(!host)return false;
  if(LOOPBACK.includes(host)||PRIVATE_NETWORK.test(host))return true;
  if(config.ssl===true)return true;
  return typeof config.ssl==="object"&&config.ssl!==null&&!Array.isArray(config.ssl)&&(config.ssl as {rejectUnauthorized?:unknown}).rejectUnauthorized!==false;
}
