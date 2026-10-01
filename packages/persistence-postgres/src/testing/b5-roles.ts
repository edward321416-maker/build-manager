import type { Client } from "pg";

export const B5_MEMBERSHIP_OWNER = "bm_b5_membership_owner";
export const B5_EFFECTIVE_ADMIN_PROBE_OWNER = "bm_b5_effective_admin_probe_owner";

/** Synthetic disposable test clusters only; production migration only preflights roles. */
export async function provisionB5TestRoles(admin: Client, migrationRole: string): Promise<void> {
  if (migrationRole !== "bm_pf02a_migrator") throw new Error("Unexpected B5 test migration role");
  for (const role of [B5_MEMBERSHIP_OWNER, B5_EFFECTIVE_ADMIN_PROBE_OWNER]) {
    await admin.query(`CREATE ROLE ${role}
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`);
    await admin.query(`GRANT ${role} TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
  }
}
