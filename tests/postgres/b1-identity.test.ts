import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createIdentityBootstrapPort } from "@build-manager/persistence-postgres/b1";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Client } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { createB1Fixture } from "./helpers/b1-fixture";
let f: Awaited<ReturnType<typeof createB1Fixture>>;
beforeAll(async () => { f = await createB1Fixture(); }, 120_000);
afterAll(async () => { await f?.close(); });
const identity = () => ({ issuer: "https://issuer.invalid/", subject: "auth0|" + randomUUID() });
async function begin(i = identity(), digest = randomBytes(32)) {
  const r = await f.login.query("SELECT authn.begin_session($1,$2,$3,$4) AS id", [i.issuer, i.subject, digest, new Date(Date.now()+3_590_000)]);
  return { id: r.rows[0].id as string, digest, identity: i };
}
it("R01 repeat login maps one identity and never grants membership", async () => {
  const a = await begin(); const b = await begin(a.identity);
  expect(a.id).toBe(b.id);
  expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.external_identity WHERE issuer=$1 AND subject=$2", [a.identity.issuer,a.identity.subject])).rows[0].n).toBe(1);
  expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.web_session WHERE user_id=$1", [a.id])).rows[0].n).toBe(2);
  await f.migration.query("SELECT set_config('app.org_id','',false)");
  expect((await f.migration.query("SELECT count(*)::int AS n FROM app.organization_membership WHERE user_id=$1", [a.id])).rows[0].n).toBe(0);
});
it("R01 disabled User does not regain access or gain a second mapping", async () => {
  const a = await begin();
  await f.migration.query("UPDATE app.app_user SET status='SUSPENDED' WHERE id=$1", [a.id]);
  await expect(begin(a.identity).then(() => undefined)).rejects.toMatchObject({ code: "28000" });
});
it("R01 identity key includes issuer and subject, never email", async () => {
  const a = await begin(); const b = await begin({ ...a.identity, issuer: "https://second.invalid/" });
  expect(a.id).not.toBe(b.id);
  expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.external_identity WHERE subject=$1", [a.identity.subject])).rows[0].n).toBe(2);
});
it("R06 completion digest can be consumed only once", async () => {
  const a=await begin();
  await expect(begin(a.identity,a.digest).then(() => undefined)).rejects.toMatchObject({ code: "28000" });
});

it("R01 actual overlapping logins wait before producing one User and two sessions", async () => {
  const b=new Client(f.roles.b1.loginConfig); const diagnostic=new Client(f.roles.b1.loginConfig);
  await b.connect(); await diagnostic.connect();
  let pending: Promise<{ rows: { id: string }[] }> | undefined;
  try {
    const i=identity();
    const pid=(await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await f.login.query("BEGIN");
    const a=await begin(i);
    pending=b.query("SELECT authn.begin_session($1,$2,$3,$4) AS id", [i.issuer,i.subject,randomBytes(32),new Date(Date.now()+3_590_000)]);
    pending.catch(() => undefined);
    let waited=false;
    for(let n=0;n<100;n++) {
      const rows=(await diagnostic.query("SELECT wait_event_type FROM pg_catalog.pg_stat_activity WHERE pid=$1", [pid])).rows;
      if(rows[0]?.wait_event_type === "Lock") { waited=true; break; }
      await new Promise(r=>setTimeout(r,20));
    }
    expect(waited).toBe(true);
    await f.login.query("COMMIT");
    expect((await pending).rows[0].id).toBe(a.id);
    expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.web_session WHERE user_id=$1",[a.id])).rows[0].n).toBe(2);
    console.info("R01: independent backend lock observed; one mapping; two sessions");
  } finally { await f.login.query("ROLLBACK"); await pending?.catch(()=>undefined); await b.end(); await diagnostic.end(); }
});
it("R01 registry insertion failure rolls back the new User and identity", async () => {
  const a=await begin(); const other=identity();
  const before=(await f.migration.query("SELECT count(*)::int AS n FROM app.app_user")).rows[0].n;
  await expect(begin(other,a.digest).then(()=>undefined)).rejects.toMatchObject({code:"28000"});
  expect((await f.migration.query("SELECT count(*)::int AS n FROM app.app_user")).rows[0].n).toBe(before);
  expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.external_identity WHERE subject=$1",[other.subject])).rows[0].n).toBe(0);
});
it("R01 disabled identity and deletion-pending User stay disabled", async () => {
  const a=await begin();
  await f.migration.query("UPDATE authn.external_identity SET status='DISABLED' WHERE user_id=$1",[a.id]);
  await expect(begin(a.identity).then(()=>undefined)).rejects.toMatchObject({code:"28000"});
  const b=await begin();
  await f.migration.query("UPDATE app.app_user SET status='DELETION_PENDING' WHERE id=$1",[b.id]);
  await expect(begin(b.identity).then(()=>undefined)).rejects.toMatchObject({code:"28000"});
});

it("B1 bootstrap adapter writes through the login capability and sanitizes replay denial", async () => {
 const db=createPostgresDatabase(f.roles.b1.loginConfig);
 try {
  const port=createIdentityBootstrapPort(db); const i=identity(); const digest=randomBytes(32).toString("hex");
  const input={identity:i,digest,expiresAt:new Date(Date.now()+3_590_000)};
  const actor=await port.begin(input);
  expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.web_session WHERE user_id=$1",[actor.userId])).rows[0].n).toBe(1);
  await expect(port.begin(input).then(()=>undefined)).rejects.toMatchObject({code:"AUTHENTICATION_REJECTED"});
 } finally { await db.close(); }
});
