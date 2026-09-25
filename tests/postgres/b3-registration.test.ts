import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeOrg } from "./helpers/b2-fixture";
import { createB3Harness, inOrg, seedB3Scope, seedInactiveOrg, type B3Harness } from "./helpers/b3-fixture";

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("B3 registration adapter", { concurrent: false }, () => {
  let h: B3Harness;
  beforeAll(async () => { h = await createB3Harness(); }, 120_000);
  afterAll(async () => { await h?.close(); });

  it("AC04 LOW M04 preserves 512 Unicode code points through PostgreSQL and independent readback", async () => {
    const s = await seedB3Scope(h);
    const assertStored = (actual: unknown, expected: unknown) => expect(actual).toEqual(expected);
    for (const addressReference of ["한".repeat(512), "😀".repeat(512), "한😀A".repeat(170) + "한😀"]) {
      expect([...addressReference]).toHaveLength(512);
      const created = await h.registration.createProperty(s.adminA.digest, s.orgA, { addressReference });
      expect(created).toEqual({ id: expect.stringMatching(uuidV7), orgId: s.orgA, addressReference });
      expect(await h.reader.getProperty(s.adminA.digest, s.orgA, created.id)).toEqual(created);
      const rows = await inOrg(h.migration, s.orgA, async () => (await h.migration.query(
        "SELECT id,org_id,address_reference,char_length(address_reference) AS code_points,octet_length(address_reference) AS utf8_bytes FROM app.property WHERE id=$1",
        [created.id],
      )).rows);
      const expected = [{ id: created.id, org_id: s.orgA, address_reference: addressReference,
        code_points: 512, utf8_bytes: Buffer.byteLength(addressReference, "utf8") }];
      assertStored(rows, expected); // Positive control also proves the FORCE RLS diagnostic read is not empty.
      for (const changed of [[...addressReference].slice(0, -1).join(""), "X" + [...addressReference].slice(1).join("")]) {
        // ASSERTION_MUTATION_PROBE: same assertion, throwaway observation; no stored data is mutated.
        expect(() => assertStored([{ ...rows[0], address_reference: changed }], expected)).toThrow();
      }
    }
    expect((await h.reader.getProperty(s.adminA.digest, s.orgA, s.propertyA)).addressReference).toBeNull();
  });

  it("AC01/AC04 admin creates Property, keeps legacy null rows readable, and permits duplicate references", async () => {
    const s = await seedB3Scope(h);
    const legacy = await h.reader.getProperty(s.adminA.digest, s.orgA, s.propertyA);
    expect(legacy.addressReference).toBeNull();

    const first = await h.registration.createProperty(s.adminA.digest, s.orgA, { addressReference: "synthetic-ref-a" });
    const second = await h.registration.createProperty(s.adminA.digest, s.orgA, { addressReference: "synthetic-ref-a" });
    const foreign = await h.registration.createProperty(s.adminB.digest, s.orgB, { addressReference: "synthetic-ref-a" });
    for (const property of [first, second, foreign]) expect(uuidV7.test(property.id)).toBe(true);
    expect(first.id).not.toBe(second.id);

    const persisted = await h.reader.getProperty(s.adminA.digest, s.orgA, first.id);
    expect(persisted).toEqual(first);
    expect(await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT count(*)::int AS n FROM app.property_assignment WHERE property_id=$1", [first.id])).rows,
    )).toEqual([{ n: 0 }]);

    const meta = await h.migration.query(
      "SELECT column_default FROM information_schema.columns WHERE table_schema='app' AND table_name='property' AND column_name='created_at'",
    );
    expect(meta.rows).toEqual([{ column_default: "transaction_timestamp()" }]);
  });

  it("AC02 staff cannot create Property in a visible organization", async () => {
    const s = await seedB3Scope(h);
    await expect(h.registration.createProperty(s.staffA.digest, s.orgA, { addressReference: "synthetic-staff-ref" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT count(*)::int AS n FROM app.property WHERE address_reference='synthetic-staff-ref'")).rows,
    )).toEqual([{ n: 0 }]);
  });

  it("AC03 foreign and inactive organizations stay NOT_FOUND with no row", async () => {
    const s = await seedB3Scope(h);
    await expect(h.registration.createProperty(s.adminA.digest, s.orgB, { addressReference: "synthetic-foreign-ref" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const status of ["PENDING", "SUSPENDED", "ARCHIVED"] as const) {
      const orgId = await seedInactiveOrg(h, s.adminA.userId, status);
      await expect(h.registration.createProperty(s.adminA.digest, orgId, { addressReference: "synthetic-inactive-ref" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await inOrg(h.migration, orgId, async () =>
        (await h.migration.query("SELECT count(*)::int AS n FROM app.property WHERE org_id=$1", [orgId])).rows,
      )).toEqual([{ n: 0 }]);
    }
  });

  it("AC05 admin creates Unit without assignment or Occupancy and reads persisted defaults", async () => {
    const s = await seedB3Scope(h);
    const unit = await h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "Synthetic 101" });
    expect(uuidV7.test(unit.id)).toBe(true);
    expect(unit).toMatchObject({ orgId: s.orgA, propertyId: s.propertyA, label: "Synthetic 101" });
    expect(await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT count(*)::int AS n FROM app.occupancy WHERE unit_id=$1", [unit.id])).rows,
    )).toEqual([{ n: 0 }]);
    const persisted = await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT id,org_id,property_id,label,status,created_at<=transaction_timestamp() AS default_time FROM app.unit WHERE id=$1", [unit.id])).rows,
    );
    expect(persisted).toEqual([{ id: unit.id, org_id: s.orgA, property_id: s.propertyA, label: "Synthetic 101", status: "ACTIVE", default_time: true }]);
  });

  it("AC06 staff Unit create distinguishes visible assigned parent from hidden unassigned parent", async () => {
    const s = await seedB3Scope(h);
    await expect(h.registration.createUnit(s.staffA.digest, s.orgA, s.propertyA, { label: "Synthetic staff 101" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(h.registration.createUnit(s.staffNone.digest, s.orgA, s.propertyA, { label: "Synthetic none 101" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await inOrg(h.migration, s.orgA, async () =>
      (await h.migration.query("SELECT count(*)::int AS n FROM app.unit WHERE label LIKE 'Synthetic % 101'")).rows,
    )).toEqual([{ n: 0 }]);
  });

  it("AC07 foreign and archived Property createUnit stays NOT_FOUND", async () => {
    const s = await seedB3Scope(h);
    await expect(h.registration.createUnit(s.adminA.digest, s.orgA, s.foreignProperty, { label: "Synthetic foreign 101" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await changeOrg(h.migration, s.orgA, "UPDATE app.property SET status='ARCHIVED' WHERE id=$1", [s.propertyB]);
    await expect(h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyB, { label: "Synthetic archived 101" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("AC08 Unit label conflicts end at the database index while scopes/history remain independent", async () => {
    const s = await seedB3Scope(h);
    await h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "Suite A" });
    await expect(h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "suite a" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await expect(h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyB, { label: "suite a" }))
      .resolves.toMatchObject({ propertyId: s.propertyB, label: "suite a" });

    const archivedId = randomUUID();
    await changeOrg(
      h.migration,
      s.orgA,
      "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'Archived label','ARCHIVED')",
      [archivedId, s.orgA, s.propertyC],
    );
    await expect(h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyC, { label: "archived label" }))
      .resolves.toMatchObject({ propertyId: s.propertyC, label: "archived label" });
  });

  it("AC23 capability methods preserve visible-parent-before-admin ordering", async () => {
    const s = await seedB3Scope(h);
    await expect(h.registration.canCreateProperty(s.adminA.digest, s.orgA)).resolves.toBe(true);
    await expect(h.registration.canCreateProperty(s.staffA.digest, s.orgA)).resolves.toBe(false);
    await expect(h.registration.canCreateUnit(s.staffA.digest, s.orgA, s.propertyA)).resolves.toBe(false);
    await expect(h.registration.canCreateUnit(s.staffNone.digest, s.orgA, s.propertyA))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
