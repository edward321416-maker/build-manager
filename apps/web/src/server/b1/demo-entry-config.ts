import { readB1AuthConfig,type B1AuthConfig } from "./config";
import { DEMO_ROLES,demoEntrySubjects,type DemoRole } from "../../runtime/demo-entry-mode";

/**
 * Demo entry server configuration. Configuration only: no session, database or login capability,
 * so logout can ask whether demo entry is on. Requires the synthetic provider and valid B1 config.
 */
export { DEMO_ROLES,type DemoRole };
export type DemoEntryConfig=Readonly<{auth:B1AuthConfig;subjects:Readonly<Record<DemoRole,string>>}>;
export function readDemoEntryConfig(env:Readonly<Record<string,string|undefined>>=process.env):DemoEntryConfig|null{
  const subjects=demoEntrySubjects(env);
  if(!subjects)return null;
  try{return {auth:readB1AuthConfig(env),subjects};}catch{return null;}
}
export function demoEntryEnabled(env:Readonly<Record<string,string|undefined>>=process.env):boolean{return readDemoEntryConfig(env)!==null;}
