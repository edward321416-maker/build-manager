/**
 * Pure demo-entry mode selection (operator decision 2026-10-09, hosted demo without login).
 * Never authentication: the server route still validates everything before starting a session.
 * Demo entry exists only with the synthetic provider, so a real Auth0 configuration disables it.
 */
export type DemoRole="manager"|"tenant";
export const DEMO_ROLES:readonly DemoRole[]=["manager","tenant"];
export const SYNTHETIC_PROVIDER_DOMAIN="b1.synthetic.invalid";
const SYNTHETIC_SUBJECT=/^auth0\|synthetic-[A-Za-z0-9_.-]{1,200}$/;

export function demoEntrySubjects(env:Readonly<Record<string,string|undefined>>=process.env):Readonly<Record<DemoRole,string>>|null{
  if(env.BUILD_MANAGER_MODE!=="B1"||env.BUILD_MANAGER_DEMO_ENTRY!=="1"||env.B1_AUTH0_DOMAIN!==SYNTHETIC_PROVIDER_DOMAIN)return null;
  try{
    const parsed:unknown=JSON.parse(env.BUILD_MANAGER_DEMO_SUBJECTS??"null");
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return null;
    const value=parsed as Record<string,unknown>;
    if(Object.keys(value).sort().join()!==[...DEMO_ROLES].sort().join())return null;
    if(!DEMO_ROLES.every(role=>typeof value[role]==="string"&&SYNTHETIC_SUBJECT.test(value[role] as string)))return null;
    return {manager:value.manager as string,tenant:value.tenant as string};
  }catch{return null;}
}
export function demoEntryMode(env:Readonly<Record<string,string|undefined>>=process.env):boolean{return demoEntrySubjects(env)!==null;}
