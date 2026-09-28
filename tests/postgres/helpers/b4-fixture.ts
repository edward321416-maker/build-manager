import { randomUUID } from "node:crypto";
import { createPropertyAssignmentMutationPort } from "@build-manager/persistence-postgres/b4";
import { changeOrg, createB2Harness, seedB2Scope, type B2Harness } from "./b2-fixture";

export async function createB4Harness() {
  const h = await createB2Harness();
  return { ...h, assignments: createPropertyAssignmentMutationPort(h.webDb) };
}
export type B4Harness = Awaited<ReturnType<typeof createB4Harness>>;
export async function seedB4Scope(h: B2Harness) {
  const s = await seedB2Scope(h);
  const adminMembership = (await h.p.admin.query("SELECT id FROM app.organization_membership WHERE org_id=$1 AND user_id=$2", [s.orgA,s.adminA.userId])).rows[0].id as string;
  const foreignStaffMembership = randomUUID();
  await changeOrg(h.migration,s.orgB,"INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')",[foreignStaffMembership,s.orgB,s.staffA.userId]);
  return { ...s, adminMembership, foreignStaffMembership };
}
export type B4Scope = Awaited<ReturnType<typeof seedB4Scope>>;
export async function assignmentHistory(h: B2Harness, org: string, property?: string, membership?: string) {
  await h.migration.query("BEGIN");
  try {
    await h.migration.query("SELECT set_config('app.org_id',$1,true)",[org]);
    return (await h.migration.query<{ id: string; status: string; ended_at: Date | null; bytes: string }>(
      `SELECT a.id,a.status,a.ended_at,row_to_json(a)::text AS bytes FROM app.property_assignment a
       WHERE a.org_id=$1 AND ($2::uuid IS NULL OR a.property_id=$2) AND ($3::uuid IS NULL OR a.membership_id=$3) ORDER BY a.id`,
      [org,property ?? null,membership ?? null])).rows;
  } finally { await h.migration.query("ROLLBACK"); }
}
