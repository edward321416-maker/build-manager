// Hosted synthetic demo database provisioning (operator decision 2026-10-09: an Internet demo without login).
// The hosted database must be PostgreSQL 18 with a true superuser (the accepted B1 role contract in
// migrations 0004-0006 cannot be satisfied by managed services whose admin is not a superuser).
//
//   generate <private-output.json> --origin <app origin> --db-host <host> [--db-port 5432] [--database railway]
//     Writes every runtime value (random role passwords, session secret, fixed synthetic demo subjects) to a
//     private file for the hosting provider's variables. Prints no values.
//   ensure
//     Idempotent, run before each deploy with those variables: on an empty database it creates the runtime
//     roles, applies migrations 0001-0023, seeds synthetic accounts/buildings only and binds the demo
//     subjects; afterwards it applies outstanding migrations and re-asserts role passwords. Prints no secrets.
//
// Database transport: loopback (rehearsal flag only), a private provider network host (*.railway.internal),
// or verified TLS for any other host - the same rule the application enforces.
import "./core-flow-register.mjs";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

const fail = code => { throw new Error(code); };
const secrets = [];
const redact = text => secrets.reduce((value, secret) => secret ? value.split(secret).join("[redacted]") : value, String(text)).replace(/[a-f0-9]{32,}/gi, "[redacted]");
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const PRIVATE_NETWORK = /^[a-z0-9-]+\.railway\.internal$/;
const DEMO_SUBJECTS = { manager: "auth0|synthetic-demo-manager", tenant: "auth0|synthetic-demo-tenant" };
const transport = host => {
  if (process.env.HOSTED_DEMO_REHEARSAL_LOOPBACK === "1" && ["127.0.0.1", "localhost"].includes(host)) return "plain";
  return PRIVATE_NETWORK.test(host) ? "plain" : "tls";
};
const option = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const connectionUrl = config => {
  const u = new URL("postgresql://localhost");
  u.hostname = config.host; u.port = String(config.port); u.username = config.user; u.password = config.password; u.pathname = "/" + config.database;
  if (transport(config.host) === "tls") u.searchParams.set("sslmode", "verify-full");
  return u.href;
};
const withTransport = config => transport(config.host) === "tls" ? { ...config, ssl: true } : config;

async function generate() {
  const output = process.argv[3] ? resolve(process.argv[3]) : fail("OUTPUT_PATH_REQUIRED");
  if (existsSync(output)) fail("OUTPUT_EXISTS");
  const origin = new URL(option("--origin") ?? fail("ORIGIN_REQUIRED"));
  const local = process.env.HOSTED_DEMO_REHEARSAL_LOOPBACK === "1" && origin.protocol === "http:" && origin.hostname === "localhost";
  if (!(origin.protocol === "https:" || local) || origin.origin !== option("--origin")) fail("HTTPS_ORIGIN_REQUIRED");
  const host = option("--db-host") ?? fail("DB_HOST_REQUIRED"), port = Number(option("--db-port") ?? 5432), database = option("--database") ?? "railway";
  const secret = () => randomBytes(32).toString("hex");
  const base = { host, port, database };
  const admin = { ...base, user: "postgres", password: secret() };
  const web = { ...base, user: "bm_b1_web", password: secret() }, login = { ...base, user: "bm_b1_login", password: secret() };
  const vendor = { ...base, user: "bm_vendor_web", password: secret() };
  const values = {
    database: { POSTGRES_PASSWORD: admin.password, POSTGRES_DB: database },
    web: {
      BUILD_MANAGER_MODE: "B1", CORE_FLOW_MODE: "SYNTHETIC_LOCAL",
      CORE_FLOW_DATABASE_CONFIG: JSON.stringify(withTransport(web)), CORE_FLOW_ORIGINS: origin.origin,
      B1_AUTH0_DOMAIN: "b1.synthetic.invalid", B1_AUTH0_CLIENT_ID: "synthetic", B1_AUTH0_CLIENT_SECRET: secret(), B1_AUTH0_SECRET: secret(),
      B1_APP_BASE_URL: origin.origin, B1_LOGIN_DATABASE_URL: connectionUrl(login), B1_WEB_DATABASE_URL: connectionUrl(web),
      VENDOR_HANDOFF_DATABASE_CONFIG: JSON.stringify(withTransport(vendor)), VENDOR_HANDOFF_APP_ORIGIN: origin.origin,
      BUILD_MANAGER_DEMO_ENTRY: "1", BUILD_MANAGER_DEMO_SUBJECTS: JSON.stringify(DEMO_SUBJECTS),
      HOSTED_DEMO_ADMIN_URL: connectionUrl(admin), HOSTED_DEMO_MIGRATOR_PASSWORD: secret(),
    },
  };
  await writeFile(output, JSON.stringify({ version: 1, ...values }, null, 2), { mode: 0o600, flag: "wx" });
  console.log(`HOSTED_DEMO_ENV_GENERATED | database keys=${Object.keys(values.database).length} | web keys=${Object.keys(values.web).length} | transport=${transport(host)} | no values printed`);
}

async function ensure() {
  const env = process.env, required = key => env[key] ?? fail(key + "_REQUIRED");
  const admin = new URL(required("HOSTED_DEMO_ADMIN_URL"));
  const database = decodeURIComponent(admin.pathname.slice(1)) || fail("DATABASE_REQUIRED");
  const adminConfig = withTransport({ host: admin.hostname, port: Number(admin.port || 5432), database, user: decodeURIComponent(admin.username), password: decodeURIComponent(admin.password) });
  const web = JSON.parse(required("CORE_FLOW_DATABASE_CONFIG")), vendor = JSON.parse(required("VENDOR_HANDOFF_DATABASE_CONFIG"));
  const login = new URL(required("B1_LOGIN_DATABASE_URL")), loginPassword = decodeURIComponent(login.password);
  const migratorPassword = required("HOSTED_DEMO_MIGRATOR_PASSWORD"), subjects = JSON.parse(required("BUILD_MANAGER_DEMO_SUBJECTS"));
  secrets.push(adminConfig.password, web.password, vendor.password, loginPassword, migratorPassword);
  if (web.user !== "bm_b1_web" || vendor.user !== "bm_vendor_web" || decodeURIComponent(login.username) !== "bm_b1_login") fail("RUNTIME_ROLE_MISMATCH");
  if (JSON.stringify(subjects) !== JSON.stringify(DEMO_SUBJECTS)) fail("DEMO_SUBJECTS_MISMATCH");
  const { provisionTestRoles, runPostgresMigrations, grantRuntimeAccess, seedCoreFlowFixture } = await import("@build-manager/persistence-postgres/testing");

  const client = new Client(adminConfig); await client.connect();
  try {
    if (Number((await client.query("SHOW server_version_num")).rows[0].server_version_num) < 180000) fail("POSTGRESQL_18_REQUIRED");
    if (!(await client.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0]?.rolsuper) fail("SUPERUSER_REQUIRED");
    const fresh = !(await client.query("SELECT 1 FROM pg_roles WHERE rolname='bm_pf02a_migrator'")).rowCount;
    if (fresh) {
      if ((await client.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('app','core_flow','vendor_handoff','authn')")).rowCount) fail("DATABASE_NOT_EMPTY");
      await provisionTestRoles(client, adminConfig, database);
    }
    // Configured passwords are authoritative, so runtime variables and roles always agree.
    for (const [role, password] of [["bm_pf02a_migrator", migratorPassword], ["bm_b1_login", loginPassword], ["bm_b1_web", web.password], ["bm_vendor_web", vendor.password]])
      await client.query(`ALTER ROLE ${role} PASSWORD ${quote(password)}`);
    const migration = new Client(withTransport({ host: adminConfig.host, port: adminConfig.port, database, user: "bm_pf02a_migrator", password: migratorPassword }));
    await migration.connect();
    try { await runPostgresMigrations(migration); await grantRuntimeAccess(migration); } finally { await migration.end(); }
    let accounts = "existing";
    if (fresh) {
      await client.query(`COMMENT ON DATABASE "${database.replaceAll('"', '""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
      const seeder = new Client(withTransport({ host: adminConfig.host, port: adminConfig.port, database, user: "bm_b1_login", password: loginPassword }));
      await seeder.connect();
      let fixture;
      try { fixture = await seedCoreFlowFixture(client, seeder, "SYNTHETIC_B1"); } finally { await seeder.end(); }
      await client.query("UPDATE core_flow.building_context SET body=body||jsonb_build_object('serviceAddress','합성 데모 서비스 주소')");
      // Bind the fixed demo subjects so the deployed demo entry can name them in configuration.
      for (const role of ["manager", "tenant"]) {
        const updated = await client.query("UPDATE authn.external_identity SET subject=$1 WHERE user_id=$2 AND issuer='https://b1.synthetic.invalid/' AND status='ACTIVE'", [subjects[role], fixture.accounts[role].userId]);
        if (updated.rowCount !== 1) fail("DEMO_SUBJECT_BINDING_FAILED");
      }
      accounts = String(Object.keys(fixture.accounts).length);
    }
    for (const role of ["manager", "tenant"])
      if (!(await client.query("SELECT 1 FROM authn.external_identity WHERE subject=$1 AND issuer='https://b1.synthetic.invalid/' AND status='ACTIVE'", [subjects[role]])).rowCount) fail("DEMO_SUBJECT_MISSING");
    console.log(`HOSTED_DEMO_ENSURED | ${fresh ? "provisioned" : "upgraded"} | migrations current | synthetic accounts=${accounts} | demo subjects bound | no values printed`);
  } finally { await client.end(); }
}

try {
  if (!process.version.startsWith("v24.")) fail("NODE_24_REQUIRED");
  const command = process.argv[2];
  if (command === "generate") await generate();
  else if (command === "ensure") await ensure();
  else fail("USE_GENERATE_OR_ENSURE");
} catch (error) {
  // Known credentials and long hex values are redacted from driver messages before printing.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  console.error("HOSTED_DEMO_PROVISION_FAILED | " + [code, redact(error instanceof Error ? error.message : "UNKNOWN")].filter(Boolean).join(" | "));
  process.exitCode = 1;
}
