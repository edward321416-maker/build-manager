import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUnitReadPort } from "@build-manager/persistence-postgres/b3";
import { withB1OrgTransaction } from "../../packages/persistence-postgres/src/b1/org-transaction";
import { changeOrg } from "./helpers/b2-fixture";
import { createB3Harness, inOrg, seedB3Scope, type B3Harness } from "./helpers/b3-fixture";

function orderedIds(count: number): string[] {
  return Array.from({ length: count }, () => randomUUID()).sort();
}

async function seedUnit(
  h: B3Harness,
  orgId: string,
  propertyId: string,
  id: string,
  label: string,
  status: "ACTIVE" | "ARCHIVED" = "ACTIVE",
) {
  await changeOrg(
    h.migration,
    orgId,
    "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,$5)",
    [id, orgId, propertyId, label, status],
  );
}

describe("B3 Unit read and raw isolation", { concurrent: false }, () => {
  let h: B3Harness;
  beforeAll(async () => { h = await createB3Harness(); }, 120_000);
  afterAll(async () => { await h?.close(); });

  it("AC10/AC19 admin Unit list/detail filters archived rows before cursor pagination", async () => {
    const s = await seedB3Scope(h);
    const reader = createUnitReadPort(h.webDb);
    const [firstId, archivedId, lastId] = orderedIds(3);
    await seedUnit(h, s.orgA, s.propertyA, firstId, "Visible first");
    await seedUnit(h, s.orgA, s.propertyA, archivedId, "Hidden archived", "ARCHIVED");
    await seedUnit(h, s.orgA, s.propertyA, lastId, "Visible last");

    await expect(reader.listUnits(s.adminA.digest, s.orgA, s.propertyC, { limit: 20 }))
      .resolves.toEqual({ items: [], nextCursor: null });

    const first = await reader.listUnits(s.adminA.digest, s.orgA, s.propertyA, { limit: 1 });
    expect(first).toEqual({
      items: [{ id: firstId, orgId: s.orgA, propertyId: s.propertyA, label: "Visible first" }],
      nextCursor: firstId,
    });
    const second = await reader.listUnits(s.adminA.digest, s.orgA, s.propertyA, { after: firstId, limit: 1 });
    expect(second).toEqual({
      items: [{ id: lastId, orgId: s.orgA, propertyId: s.propertyA, label: "Visible last" }],
      nextCursor: null,
    });
    expect(await reader.getUnit(s.adminA.digest, s.orgA, s.propertyA, lastId))
      .toEqual({ id: lastId, orgId: s.orgA, propertyId: s.propertyA, label: "Visible last" });
    await expect(reader.getUnit(s.adminA.digest, s.orgA, s.propertyA, archivedId))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("AC11 staff sees assigned ACTIVE parent Units only and zero-assignment cannot enumerate", async () => {
    const s = await seedB3Scope(h);
    const reader = createUnitReadPort(h.webDb);
    const assigned = randomUUID();
    const unassigned = randomUUID();
    await seedUnit(h, s.orgA, s.propertyA, assigned, "Assigned unit");
    await seedUnit(h, s.orgA, s.propertyB, unassigned, "Unassigned unit");

    await expect(reader.listUnits(s.staffA.digest, s.orgA, s.propertyA, { limit: 20 }))
      .resolves.toEqual({
        items: [{ id: assigned, orgId: s.orgA, propertyId: s.propertyA, label: "Assigned unit" }],
        nextCursor: null,
      });
    await expect(reader.getUnit(s.staffA.digest, s.orgA, s.propertyA, assigned))
      .resolves.toMatchObject({ id: assigned });
    await expect(reader.listUnits(s.staffA.digest, s.orgA, s.propertyB, { limit: 20 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reader.listUnits(s.staffNone.digest, s.orgA, s.propertyA, { limit: 20 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reader.listUnits(s.adminA.digest, s.orgA, s.foreignProperty, { limit: 20 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("AC12 raw bm_b1_web SELECT cannot expose peer unassigned Units without application predicates", async () => {
    const s = await seedB3Scope(h);
    const assigned = randomUUID();
    const hidden = randomUUID();
    await seedUnit(h, s.orgA, s.propertyA, assigned, "Raw assigned");
    await seedUnit(h, s.orgA, s.propertyB, hidden, "Raw hidden");

    const rows = await withB1OrgTransaction(h.webDb, s.staffA.digest, s.orgA, async client =>
      (await client.query<{ id: string; property_id: string }>(
        "SELECT id,property_id FROM app.unit WHERE org_id=$1 AND id=ANY($2::uuid[]) ORDER BY id",
        [s.orgA, [assigned, hidden]],
      )).rows);
    expect(rows).toEqual([{ id: assigned, property_id: s.propertyA }]);
  });

  it("AC13 raw staff INSERT and forged org/digest remain denied by Web RLS", async () => {
    const s = await seedB3Scope(h);
    await expect(withB1OrgTransaction(h.webDb, s.staffA.digest, s.orgA, client =>
      client.query(
        "INSERT INTO app.property(id,org_id,address_reference,status) VALUES($1,$2,'raw-staff-property','ACTIVE')",
        [randomUUID(), s.orgA],
      ))).rejects.toMatchObject({ code: "42501" });

    await expect(withB1OrgTransaction(h.webDb, s.staffA.digest, s.orgA, client =>
      client.query(
        "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'raw-staff-unit','ACTIVE')",
        [randomUUID(), s.orgA, s.propertyA],
      ))).rejects.toMatchObject({ code: "42501" });

    await h.web.query("BEGIN");
    try {
      await h.web.query(
        "SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",
        [s.orgA, s.adminB.digest],
      );
      await expect(h.web.query(
        "INSERT INTO app.property(id,org_id,address_reference,status) VALUES($1,$2,'forged-context','ACTIVE')",
        [randomUUID(), s.orgA],
      )).rejects.toMatchObject({ code: "42501" });
    } finally {
      await h.web.query("ROLLBACK");
    }
  });

  it("AC19 detail uses the full org/property/unit chain and generalized NOT_FOUND", async () => {
    const s = await seedB3Scope(h);
    const reader = createUnitReadPort(h.webDb);
    const unit = randomUUID();
    await seedUnit(h, s.orgA, s.propertyA, unit, "Chain unit");

    for (const operation of [
      () => reader.getUnit(s.adminA.digest, s.orgA, s.propertyB, unit),
      () => reader.getUnit(s.adminA.digest, s.orgA, s.propertyA, randomUUID()),
      () => reader.getUnit(s.staffNone.digest, s.orgA, s.propertyA, unit),
      () => reader.getUnit(s.adminA.digest, s.orgA, s.foreignProperty, unit),
    ]) {
      await expect(operation()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("AC09 proves cross-org Unit parent FK23503 outside Web RLS and leaves no Unit", async () => {
    const s = await seedB3Scope(h);
    const unitId = randomUUID();
    expect((await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT id FROM app.organization WHERE id=$1", [s.orgA])).rows,
    ))).toEqual([{ id: s.orgA }]);
    expect((await inOrg(h.migration, s.orgB, async () =>
      (await h.migration.query("SELECT id FROM app.property WHERE org_id=$1 AND id=$2", [s.orgB, s.foreignProperty])).rows,
    ))).toEqual([{ id: s.foreignProperty }]);

    await h.migration.query("BEGIN");
    try {
      await h.migration.query("SELECT set_config('app.org_id',$1,true)", [s.orgA]);
      await expect(h.migration.query(
        "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'Cross org','ACTIVE')",
        [unitId, s.orgA, s.foreignProperty],
      )).rejects.toMatchObject({ code: "23503", constraint: "unit_property_fk" });
    } finally {
      await h.migration.query("ROLLBACK");
    }

    expect(await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT count(*)::int AS n FROM app.unit WHERE id=$1", [unitId])).rows,
    )).toEqual([{ n: 0 }]);
  });
});
