import type { Client } from "pg";

export const B4_ASSIGNMENT_OWNER = "bm_b4_assignment_owner";

/** Disposable test database only; production migration preflights this role. */
export async function provisionB4TestRole(admin: Client, migrationRole: string): Promise<void> {
  if (migrationRole !== "bm_pf02a_migrator") throw new Error("Unexpected B4 test migration role");
  await admin.query(`CREATE ROLE ${B4_ASSIGNMENT_OWNER}
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`);
  await admin.query(`GRANT ${B4_ASSIGNMENT_OWNER} TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
}
