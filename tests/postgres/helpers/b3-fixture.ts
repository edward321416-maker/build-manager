import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import { changeOrg, createB2Harness, seedB2Scope, type B2Harness, type B2Scope } from "./b2-fixture";

export type B3Harness = B2Harness & {
  registration: ReturnType<typeof createBuildingRegistrationPort>;
};

export async function createB3Harness(): Promise<B3Harness> {
  const h = await createB2Harness();
  return { ...h, registration: createBuildingRegistrationPort(h.webDb) };
}

export async function seedB3Scope(h: B3Harness): Promise<B2Scope> {
  return seedB2Scope(h);
}

export async function inOrg<T>(client: Client, orgId: string, operation: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.org_id',$1,true)", [orgId]);
    return await operation();
  } finally {
    await client.query("ROLLBACK");
  }
}

export async function seedInactiveOrg(
  h: B3Harness,
  userId: string,
  status: "PENDING" | "SUSPENDED" | "ARCHIVED",
): Promise<string> {
  const orgId = randomUUID();
  await changeOrg(
    h.migration,
    orgId,
    "INSERT INTO app.organization(id,status,display_name) VALUES($1,$2,'Synthetic inactive organization')",
    [orgId, status],
  );
  await changeOrg(
    h.migration,
    orgId,
    "INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",
    [randomUUID(), orgId, userId],
  );
  return orgId;
}
