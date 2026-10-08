import { randomBytes } from "node:crypto";
import type { Client, ClientConfig } from "pg";

export const VENDOR_HANDOFF_OWNER = "bm_vendor_handoff_owner";
export const VENDOR_WEB_ROLE = "bm_vendor_web";

export async function provisionVendorHandoffTestRoles(
  admin: Client,
  base: ClientConfig,
  migrationRole: string,
): Promise<{ readonly webConfig: ClientConfig }> {
  if (migrationRole !== "bm_pf02a_migrator") {
    throw new Error("Unexpected Vendor Handoff test migration role");
  }
  const password = `v_${randomBytes(24).toString("hex")}`;
  await admin.query(`CREATE ROLE ${VENDOR_HANDOFF_OWNER}
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`);
  await admin.query(`GRANT ${VENDOR_HANDOFF_OWNER} TO ${migrationRole}
    WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
  await admin.query(`CREATE ROLE ${VENDOR_WEB_ROLE}
    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT
    PASSWORD '${password}'`);
  return { webConfig: { ...base, user: VENDOR_WEB_ROLE, password } };
}
