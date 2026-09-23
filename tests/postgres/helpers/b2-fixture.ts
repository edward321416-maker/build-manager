import { randomBytes, randomUUID } from "node:crypto";
import { type Client } from "pg";
import { createPostgresDatabase, type PostgresDatabase } from "@build-manager/persistence-postgres";
import { createIdentityBootstrapPort, createOrganizationReadPort } from "@build-manager/persistence-postgres/b1";
import type { OrganizationReadPort } from "@build-manager/application";
import { createB1Fixture } from "./b1-fixture";

export type B2Harness = Awaited<ReturnType<typeof createB1Fixture>> & {
  loginDb: PostgresDatabase; webDb: PostgresDatabase; reader: OrganizationReadPort;
};
export type B2Actor = { digest: string; userId: string };
export type B2Scope = {
  adminA: B2Actor; adminB: B2Actor; staffA: B2Actor; staffNone: B2Actor; noMember: B2Actor;
  orgA: string; orgB: string; propertyA: string; propertyB: string; propertyC: string;
  foreignProperty: string; staffMembership: string; staffNoneMembership: string;
  foreignMembership: string; assignmentA: string; assignmentC: string;
};

export async function createB2Harness(): Promise<B2Harness> {
  const f = await createB1Fixture();
  const loginDb = createPostgresDatabase(f.roles.b1.loginConfig);
  const webDb = createPostgresDatabase({ ...f.roles.b1.webConfig, max: 1 });
  return { ...f, loginDb, webDb, reader: createOrganizationReadPort(webDb),
    async close() { try { await Promise.all([loginDb.close(), webDb.close()]); } finally { await f.close(); } },
  };
}

export async function changeOrg(c: Client, orgId: string, sql: string, args: unknown[]): Promise<void> {
  await c.query("BEGIN");
  try {
    await c.query("SELECT set_config('app.org_id',$1,true)", [orgId]);
    await c.query(sql, args);
    await c.query("COMMIT");
  } catch (error) { await c.query("ROLLBACK"); throw error; }
}

export function barrier() {
  let arrive!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { arrive = resolve; });
  const released = new Promise<void>(resolve => { release = resolve; });
  return { reached, released, arrive, release };
}

export async function seedB2Scope(h: B2Harness): Promise<B2Scope> {
  const bootstrap = createIdentityBootstrapPort(h.loginDb);
  const actor = async (): Promise<B2Actor> => {
    const digest = randomBytes(32).toString("hex");
    const result = await bootstrap.begin({ identity: { issuer: "https://synthetic.invalid/", subject: "auth0|" + randomUUID() },
      digest, expiresAt: new Date(Date.now() + 3_590_000) });
    return { digest, userId: result.userId };
  };
  const [adminA, adminB, staffA, staffNone, noMember] = await Promise.all(Array.from({ length: 5 }, actor));
  const [propertyA, propertyB, propertyC] = Array.from({ length: 3 }, () => randomUUID()).sort();
  const s: B2Scope = { adminA, adminB, staffA, staffNone, noMember, propertyA, propertyB, propertyC,
    orgA: randomUUID(), orgB: randomUUID(), foreignProperty: randomUUID(), staffMembership: randomUUID(),
    staffNoneMembership: randomUUID(), foreignMembership: randomUUID(), assignmentA: randomUUID(), assignmentC: randomUUID() };
  for (const [org, admin, properties] of [[s.orgA, s.adminA, [s.propertyA, s.propertyB, s.propertyC]],
    [s.orgB, s.adminB, [s.foreignProperty]]] as const) {
    await changeOrg(h.migration, org, "INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','Synthetic organization')", [org]);
    await changeOrg(h.migration, org, "INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",
      [org === s.orgB ? s.foreignMembership : randomUUID(), org, admin.userId]);
    for (const id of properties) await changeOrg(h.migration, org, "INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')", [id, org]);
  }
  for (const [id, actor] of [[s.staffMembership, s.staffA], [s.staffNoneMembership, s.staffNone]] as const)
    await changeOrg(h.migration, s.orgA, "INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')", [id, s.orgA, actor.userId]);
  for (const [id, property] of [[s.assignmentA, s.propertyA], [s.assignmentC, s.propertyC]])
    await changeOrg(h.migration, s.orgA, "INSERT INTO app.property_assignment(id,org_id,membership_id,property_id,status) VALUES($1,$2,$3,$4,'ACTIVE')", [id, s.orgA, s.staffMembership, property]);
  return s;
}
