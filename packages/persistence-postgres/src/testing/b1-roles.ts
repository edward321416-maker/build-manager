import { randomBytes } from "node:crypto";
import type { Client, ClientConfig } from "pg";
export const B1_ROLES = ["bm_b1_login", "bm_b1_web", "bm_b1_capability_owner"] as const;
export type B1RoleCredentials = { loginConfig: ClientConfig; webConfig: ClientConfig };
/** Disposable role provisioning only, never imported by production composition. */
export async function provisionB1TestRoles(admin: Client, base: ClientConfig, migrationRole: string): Promise<B1RoleCredentials> {
  const configs: ClientConfig[] = [];
  for (const name of B1_ROLES) {
    const material = randomBytes(32).toString("hex");
    const login = name !== "bm_b1_capability_owner";
    await admin.query(`CREATE ROLE ${name} ${login ? "LOGIN" : "NOLOGIN"} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT ${login ? `PASSWORD '${material}'` : ""}`);
    const config: ClientConfig = { ...base, user: name };
    config.password = material;
    configs.push(config);
  }
  if (migrationRole !== "bm_pf02a_migrator") throw new Error("Unexpected test migration owner");
  await admin.query(`GRANT bm_b1_capability_owner TO ${migrationRole} WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
  return { loginConfig: configs[0], webConfig: configs[1] };
}
