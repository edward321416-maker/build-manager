import "./core-flow-register.mjs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import { Client } from "pg";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const vendorOrigin = "http://localhost:3134";
const connection = c => { const u = new URL("postgresql://localhost"); u.hostname = c.host; u.port = String(c.port); u.username = c.user; u.password = c.password; u.pathname = "/" + c.database; return u.href; };

/** Owned, disposable PostgreSQL18.6 only. Private state stays outside the checkout for Task12 reuse. */
export async function prepareVendorHandoff() {
  assert.equal(process.version, "v24.21.0", "PINNED_NODE_REQUIRED");
  // Keep this explicit owned fixture available after the restart process exits. No shared database is changed.
  process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
  const { startPostgres18Container, provisionTestRoles, runPostgresMigrations, grantRuntimeAccess, seedCoreFlowFixture } = await import("@build-manager/persistence-postgres/testing");
  const p = await startPostgres18Container();
  const roles = await provisionTestRoles(p.admin, p.adminConfig, p.database);
  const migration = new Client(roles.migrationConfig), login = new Client(roles.b1.loginConfig);
  await migration.connect(); await login.connect();
  try {
    await runPostgresMigrations(migration); await grantRuntimeAccess(migration);
    await p.admin.query(`COMMENT ON DATABASE "${p.database.replaceAll('"', '""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
    const fixture = await seedCoreFlowFixture(p.admin, login, "SYNTHETIC_B1");
    await p.admin.query("UPDATE core_flow.building_context SET body=body||jsonb_build_object('serviceAddress','Task11 synthetic service address')");
    const password = randomBytes(32).toString("hex");
    await p.admin.query(`ALTER ROLE bm_vendor_web PASSWORD '${password}'`);
    const vendorConfig = { ...p.adminConfig, user: "bm_vendor_web", password };
    const secret = randomBytes(32).toString("hex"), issuedAt = Math.floor(Date.now() / 1000);
    for (const account of Object.values(fixture.accounts)) {
      const identity = (await p.admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'", [account.userId])).rows[0];
      assert.equal(identity.issuer, "https://b1.synthetic.invalid/");
      account.csrf = randomBytes(32).toString("hex");
      account.cookie = await generateSessionCookie({ user: { sub: identity.subject }, tokenSet: { accessToken: randomBytes(32).toString("hex"), expiresAt: issuedAt + 3600 }, internal: { sid: randomUUID(), createdAt: issuedAt }, b1: { handle: account.handle, csrf: account.csrf, issuedAt, expiresAt: issuedAt + 3600 } }, { secret });
    }
    // Login-free demo entry (synthetic provider only) uses the seeded Manager and Tenant identities.
    const demoSubjects = {};
    for (const who of ["manager", "tenant"]) demoSubjects[who] = (await p.admin.query("SELECT subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'", [fixture.accounts[who].userId])).rows[0].subject;
    const state = { version: 1, origin: vendorOrigin, containerId: p.container.getId(), admin: p.adminConfig, roles, vendorConfig, secret, fixture, demoSubjects };
    const directory = join(homedir(), ".build-manager-vendor-private", "task11-" + randomUUID());
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = join(directory, "state.private.json");
    await writeFile(file, JSON.stringify(state), { mode: 0o600 });
    return { state, file };
  } finally { await login.end(); await migration.end(); await p.admin.end(); }
}

export async function readVendorHandoffState(file) {
  const state = JSON.parse(await readFile(file, "utf8"));
  assert.equal(state.version, 1); assert.equal(state.origin, vendorOrigin);
  for (const c of [state.admin, state.roles.b1.webConfig, state.roles.b1.loginConfig, state.vendorConfig]) {
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(c.host), "LOCAL_ONLY");
    assert.equal(c.database, state.admin.database); assert.equal(c.port, state.admin.port);
  }
  assert.equal(state.roles.b1.webConfig.user, "bm_b1_web"); assert.equal(state.vendorConfig.user, "bm_vendor_web");
  const admin = new Client(state.admin); await admin.connect();
  try { assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker, "CORE_FLOW_SYNTHETIC_LOCAL"); }
  finally { await admin.end(); }
  return state;
}

/** Actual Next + SDK + B1 authority. Never injects a legacy Core authentication resolver. */
export async function startVendorHandoffServer(state) {
  const url = new URL(state.origin), probe = createServer();
  await new Promise((ok, no) => { probe.once("error", no); probe.listen(Number(url.port), url.hostname, ok); });
  await new Promise(ok => probe.close(ok));
  const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", url.hostname, "--port", url.port], {
    cwd: join(root, "apps/web"), windowsHide: true, stdio: "ignore",
    env: { ...process.env, BUILD_MANAGER_MODE: "B1", CORE_FLOW_MODE: "SYNTHETIC_LOCAL", CORE_FLOW_DATABASE_CONFIG: JSON.stringify(state.roles.b1.webConfig), CORE_FLOW_ORIGINS: state.origin,
      B1_AUTH0_DOMAIN: "b1.synthetic.invalid", B1_AUTH0_CLIENT_ID: "synthetic", B1_AUTH0_CLIENT_SECRET: randomBytes(32).toString("hex"), B1_AUTH0_SECRET: state.secret, B1_APP_BASE_URL: state.origin,
      B1_LOGIN_DATABASE_URL: connection(state.roles.b1.loginConfig), B1_WEB_DATABASE_URL: connection(state.roles.b1.webConfig), VENDOR_HANDOFF_DATABASE_CONFIG: JSON.stringify(state.vendorConfig), VENDOR_HANDOFF_APP_ORIGIN: state.origin,
      ...(state.demoSubjects ? { BUILD_MANAGER_DEMO_ENTRY: "1", BUILD_MANAGER_DEMO_SUBJECTS: JSON.stringify(state.demoSubjects) } : {}) },
  });
  let startupError = false; child.on("error", () => { startupError = true; });
  const stop = async () => { if (child.exitCode === null && !startupError) { const done = once(child, "exit"); child.kill(); await done; } };
  try {
    for (let i = 0; i < 100; i++) {
      assert.equal(startupError, false, "OWNED_SERVER_SPAWN_FAILED"); assert.equal(child.exitCode, null, "OWNED_SERVER_EXITED");
      try { if ((await fetch(state.origin + "/vendor/job")).ok) return { pid: child.pid, stop }; } catch { /* readiness only */ }
      await delay(100);
    }
    throw new Error("OWNED_SERVER_NOT_READY");
  } catch (error) { await stop(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Default / --serve starts a fresh generation. Reuse is explicit and never an aging implicit dependency.
    const reuse = process.argv.includes("--reuse-state");
    const state = reuse ? await readVendorHandoffState(process.env.VENDOR_HANDOFF_PRIVATE_STATE) : (await prepareVendorHandoff()).state;
    const server = await startVendorHandoffServer(state);
    console.log(`VENDOR_HANDOFF_DEV_READY | SYNTHETIC_SDK_ONLY | fixture=${reuse ? "explicit-reuse" : "fresh"} | pid=${server.pid} | ${state.origin}`);
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => { await server.stop(); process.exit(); });
  } catch { console.error("VENDOR_HANDOFF_DEV_FAILED | prepared private owned fixture and current build required"); process.exitCode = 1; }
}
