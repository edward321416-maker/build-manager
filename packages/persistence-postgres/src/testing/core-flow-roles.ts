import type { Client } from "pg";

/** Disposable local/test clusters only. No runtime provisioning privileges. */
export async function provisionCoreFlowTestRole(admin: Client): Promise<void> {
  await admin.query("CREATE ROLE bm_core_flow_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT");
  await admin.query("GRANT bm_core_flow_owner TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE");
  await provisionCoreAccessTestRole(admin);
  await provisionCoreOnboardingTestRole(admin);
}

export async function provisionCoreOnboardingTestRole(admin:Client):Promise<void>{
  const role=(await admin.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='bm_core_onboarding_owner'")).rows[0];
  if(role){if(Object.values(role).some(Boolean))throw new Error("CORE_ONBOARDING_ROLE_MISMATCH");return;}
  await admin.query("CREATE ROLE bm_core_onboarding_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT");
  await admin.query("GRANT bm_core_onboarding_owner TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE");
}

export async function provisionCoreAccessTestRole(admin:Client):Promise<void>{
  const role=(await admin.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='bm_core_access_owner'")).rows[0];
  if(role){if(Object.values(role).some(Boolean))throw new Error("CORE_ACCESS_ROLE_MISMATCH");return;}
  await admin.query("CREATE ROLE bm_core_access_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT");
  await admin.query("GRANT bm_core_access_owner TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE");
}
