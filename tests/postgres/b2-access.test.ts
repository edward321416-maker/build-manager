import { afterAll, beforeAll, expect, test } from "vitest";
import { withB1OrgTransaction } from "../../packages/persistence-postgres/src/b1/org-transaction";
import { createB2Harness, seedB2Scope, changeOrg, type B2Harness } from "./helpers/b2-fixture";

let h: B2Harness;
beforeAll(async () => { h = await createB2Harness(); }, 120_000);
afterAll(async () => { await h?.close(); });
const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id);

test("AC02 explicitPredicateSurvivesCeilingControl", async () => {
  const isolated = await createB2Harness();
  const catalog = async () => (await isolated.migration.query(`SELECT polroles,polcmd,polpermissive,
    pg_get_expr(polqual,polrelid) AS expression FROM pg_policy
    WHERE polrelid='app.property'::regclass AND polname='b1_property_ceiling'`)).rows;
  let original: Awaited<ReturnType<typeof catalog>> | undefined;
  try {
    const s = await seedB2Scope(isolated);
    original = await catalog();
    expect(original).toHaveLength(1);
    await isolated.migration.query("BEGIN");
    await isolated.migration.query("ALTER POLICY b1_property_ceiling ON app.property USING(true)");
    await isolated.migration.query("COMMIT");
    const raw = await withB1OrgTransaction(isolated.webDb, s.staffA.digest, s.orgA,
      async c => (await c.query("SELECT id FROM app.property ORDER BY id")).rows);
    expect(ids(raw).includes(s.propertyB)).toBe(true);
    expect(JSON.stringify(ids(raw)) === JSON.stringify([s.propertyA, s.propertyB, s.propertyC])).toBe(true);
    const page = await isolated.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50 });
    // Compare booleans so a failure does not print runtime identifiers.
    expect(ids(page.items).includes(s.propertyB)).toBe(false);
    expect(JSON.stringify(ids(page.items)) === JSON.stringify([s.propertyA, s.propertyC])).toBe(true);
    await expect(isolated.reader.getProperty(s.staffA.digest, s.orgA, s.propertyB)).rejects.toMatchObject({ code: "NOT_FOUND" });
  } finally {
    try {
      await isolated.migration.query("ROLLBACK");
      if (original?.[0]) {
        await isolated.migration.query(`ALTER POLICY b1_property_ceiling ON app.property USING (${original[0].expression})`);
        expect(await catalog()).toEqual(original);
      }
    } finally { await isolated.close(); }
  }
}, 120_000);

test("AC01 adminAllActive", async () => {
  const s = await seedB2Scope(h);
  const page = await h.reader.listProperties(s.adminA.digest, s.orgA, { limit: 50 });
  expect(JSON.stringify(ids(page.items)) === JSON.stringify([s.propertyA, s.propertyB, s.propertyC])).toBe(true);
  expect(page.nextCursor).toBeNull();
  for (const id of [s.propertyA, s.propertyB, s.propertyC]) {
    const detail = await h.reader.getProperty(s.adminA.digest, s.orgA, id);
    expect(detail.id === id && detail.orgId === s.orgA).toBe(true);
    expect(Object.keys(detail).sort()).toEqual(["addressReference", "id", "orgId"]);
  }
  expect(Object.keys(page.items[0]).sort()).toEqual(["addressReference", "id", "orgId"]);
});

test("AC02 staffAssignedOnly", async () => {
  const s = await seedB2Scope(h);
  const page = await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50 });
  expect(JSON.stringify(ids(page.items)) === JSON.stringify([s.propertyA, s.propertyC])).toBe(true);
  for (const id of [s.propertyA, s.propertyC]) {
    const detail = await h.reader.getProperty(s.staffA.digest, s.orgA, id);
    expect(detail.id === id).toBe(true);
    expect(Object.keys(detail).sort()).toEqual(["addressReference", "id", "orgId"]);
  }
  await expect(h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyB)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("AC03 staffNoAssignmentKeepsOrg", async () => {
  const s = await seedB2Scope(h);
  expect(ids((await h.reader.listMine(s.staffNone.digest, { limit: 50 })).items).includes(s.orgA)).toBe(true);
  expect(await h.reader.listProperties(s.staffNone.digest, s.orgA, { limit: 50 })).toEqual({ items: [], nextCursor: null });
  await expect(h.reader.getProperty(s.staffNone.digest, s.orgA, s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("AC04 foreignIdsNotFound", async () => {
  const s = await seedB2Scope(h);
  for (const actor of [s.staffA, s.adminA]) {
    for (const org of [s.orgA, s.orgB])
      await expect(h.reader.getProperty(actor.digest, org, s.foreignProperty)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.reader.listProperties(actor.digest, s.orgB, { limit: 50 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});

test("AC08 archivedAssignedNotFound", async () => {
  const s = await seedB2Scope(h);
  await h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyA);
  await changeOrg(h.migration, s.orgA, "UPDATE app.property SET status='ARCHIVED' WHERE id=$1", [s.propertyA]);
  for (const actor of [s.staffA, s.adminA]) {
    expect(ids((await h.reader.listProperties(actor.digest, s.orgA, { limit: 50 })).items).includes(s.propertyA)).toBe(false);
    await expect(h.reader.getProperty(actor.digest, s.orgA, s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});

test("AC02 visibleCursorOnly", async () => {
  const s = await seedB2Scope(h);
  const first = await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 1 });
  expect(first.items.length === 1 && first.items[0].id === s.propertyA && first.nextCursor === s.propertyA).toBe(true);
  for (const after of [s.propertyA, s.propertyB]) {
    const next = await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 1, after });
    expect(next.items.length === 1 && next.items[0].id === s.propertyC && next.nextCursor === null).toBe(true);
  }
  const foreign = await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50, after: s.foreignProperty });
  expect(JSON.stringify(ids(foreign.items)) === JSON.stringify([s.propertyA, s.propertyC].filter(id => id > s.foreignProperty))).toBe(true);
  let after: string | undefined;
  for (const id of [s.propertyA, s.propertyB, s.propertyC]) {
    const page = await h.reader.listProperties(s.adminA.digest, s.orgA, { limit: 1, after });
    expect(page.items.length === 1 && page.items[0].id === id).toBe(true);
    expect(page.nextCursor === (id === s.propertyC ? null : id)).toBe(true);
    after = id;
  }
});
