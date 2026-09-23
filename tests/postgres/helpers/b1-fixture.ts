import { randomBytes } from "node:crypto";
import { Client, type ClientConfig } from "pg";
import { startPostgres18Container, provisionTestRoles, runPostgresMigrations, grantRuntimeAccess, type Postgres18Container } from "@build-manager/persistence-postgres/testing";
/** M05 setup deliberately does not invoke the all-role provisioning helper. */
export async function provisionFoundationOnly(p: Postgres18Container) {
  const config: ClientConfig = { ...p.adminConfig, user: "bm_pf02a_migrator" };
  const material = randomBytes(32).toString("hex");
  config.password = material;
  await p.admin.query(`CREATE ROLE bm_pf02a_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${material}'`);
  const db = '"' + p.database.replaceAll('"', '""') + '"';
  await p.admin.query(`GRANT CREATE ON DATABASE ${db} TO bm_pf02a_migrator`);
  return config;
}
export async function createB1Fixture() {
  const p = await startPostgres18Container();
  const roles = await provisionTestRoles(p.admin, p.adminConfig, p.database);
  const migration = new Client(roles.migrationConfig);
  await migration.connect();
  try { await runPostgresMigrations(migration); await grantRuntimeAccess(migration); }
  catch (error) { await migration.end(); await p.stop(); throw error; }
  const login = new Client(roles.b1.loginConfig);
  const web = new Client(roles.b1.webConfig);
  await login.connect(); await web.connect();
  return { p, roles, migration, login, web, async close() { await login.end(); await web.end(); await migration.end(); await p.stop(); } };
}
