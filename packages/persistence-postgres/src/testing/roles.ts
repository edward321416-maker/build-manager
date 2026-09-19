import { randomBytes } from "node:crypto";
import type { Client, ClientConfig } from "pg";

export const TEST_MIGRATION_ROLE = "bm_pf02a_migrator";
export const TEST_RUNTIME_ROLE = "bm_pf02a_runtime";

export type TestRoleCredentials = {
  readonly migrationConfig: ClientConfig;
  readonly runtimeConfig: ClientConfig;
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function provisionTestRoles(
  admin: Client,
  adminConfig: ClientConfig,
  database: string,
): Promise<TestRoleCredentials> {
  const migrationPassword = `m_${randomBytes(24).toString("hex")}`;
  const runtimePassword = `r_${randomBytes(24).toString("hex")}`;

  await admin.query(`
    CREATE ROLE ${TEST_MIGRATION_ROLE}
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${migrationPassword}'
  `);
  await admin.query(`
    CREATE ROLE ${TEST_RUNTIME_ROLE}
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${runtimePassword}'
  `);
  await admin.query(
    `GRANT CREATE ON DATABASE ${quoteIdentifier(database)} TO ${TEST_MIGRATION_ROLE}`,
  );

  const base = { host: adminConfig.host, port: adminConfig.port, database };
  const migrationConfig: ClientConfig = { ...base, user: TEST_MIGRATION_ROLE };
  const runtimeConfig: ClientConfig = { ...base, user: TEST_RUNTIME_ROLE };
  migrationConfig.password = migrationPassword;
  runtimeConfig.password = runtimePassword;
  return { migrationConfig, runtimeConfig };
}
