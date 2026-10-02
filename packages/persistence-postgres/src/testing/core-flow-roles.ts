import type { Client } from "pg";

/** Disposable local/test clusters only. No runtime provisioning privileges. */
export async function provisionCoreFlowTestRole(admin: Client): Promise<void> {
  await admin.query("CREATE ROLE bm_core_flow_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT");
  await admin.query("GRANT bm_core_flow_owner TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE");
}
