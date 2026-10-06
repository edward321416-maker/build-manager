import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";

let f: Awaited<ReturnType<typeof createVendorHandoffFixture>>;

beforeAll(async () => {
  f = await createVendorHandoffFixture();
});

const tables = ["command_receipt", "vendor_assignment", "vendor_capability", "vendor_session", "work_packet_revision", "work_packet_source_photo"];
const managerFunctions = ["guard_direct_completion", "manager_create_assignment", "manager_issue_link", "manager_publish_packet", "manager_read"].sort();
// Task4 cumulative external inventory: decline, CSRF refresh and allowlisted source-photo read join the Task2 set.
const externalFunctions = ["decline", "logout", "read_job", "read_source_photo", "redeem", "refresh_session", "session_info"].sort();
const bridges = ["vendor_handoff_lock_ticket", "vendor_handoff_manager_context", "vendor_handoff_mark_offered", "vendor_handoff_recheck_occupancy", "vendor_handoff_source", "vendor_handoff_source_photo", "vendor_handoff_tenant_context"].sort();
const hash = (label: string) => createHash("sha256").update(label + randomUUID()).digest("hex");
const proof = (value: string) => Buffer.from(value, "hex");
async function owner<T>(op: (client: Client) => Promise<T>) {
  const client = new Client(f.p.adminConfig); await client.connect();
  try { await client.query("BEGIN"); await client.query("SET LOCAL ROLE bm_vendor_handoff_owner"); return await op(client); }
  finally { await client.query("ROLLBACK"); await client.end(); }
}
async function issued(who = "manager", tenant = "tenant") {
  const p = await f.published(who, tenant);
  const link = await f.manager.issueLink(f.data.accounts[who].digest, p.handoff.assignment!.id, {
    clientRequestId: randomUUID(), expectedAssignmentVersion: 2, expectedPacketRevisionId: p.handoff.currentPacket!.id,
  });
  const token = createHash("sha256").update(link.link!.split("#")[1]).digest("hex");
  const session = hash("session"), csrf = hash("csrf");
  await f.external.redeem(token, randomUUID(), session, csrf);
  return { ...p, token, session, csrf };
}
async function waitForTicketWait() {
  for (let attempt = 0; attempt < 100; attempt++) {
    await f.p.admin.query("SELECT pg_stat_clear_snapshot()");
    const { rows } = await f.p.admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%vendor_handoff%'");
    if (rows[0].n > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Expected real ticket-lock wait was not observed");
}

describe("hostile runtime and exact catalog proofs", () => {
  it("pins exact schema ACL and org-only policy predicates without extra permissive paths", async () => {
    const acl = (await f.p.admin.query("SELECT pg_get_userbyid(a.grantee) AS role,a.privilege_type AS privilege FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname='vendor_handoff' ORDER BY role,privilege")).rows;
    expect(acl).toEqual([
      { role: "bm_b1_web", privilege: "USAGE" }, { role: "bm_vendor_handoff_owner", privilege: "CREATE" },
      { role: "bm_vendor_handoff_owner", privilege: "USAGE" }, { role: "bm_vendor_web", privilege: "USAGE" },
    ]);
    const policies = (await f.p.admin.query("SELECT tablename,policyname,permissive,roles::text[] AS roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='vendor_handoff' ORDER BY tablename,policyname")).rows;
    for (const table of tables) {
      const rows = policies.filter(p => p.tablename === table);
      const bootstrap = ["vendor_capability", "vendor_session"].includes(table);
      expect(rows.map(r => r.policyname).sort()).toEqual((bootstrap ? [
        "vendor_handoff_org_scope", `${table}_digest_bootstrap`, `${table}_bootstrap_ceiling`, `${table}_insert_ceiling`, `${table}_update_ceiling`, `${table}_delete_ceiling`,
      ] : ["vendor_handoff_org_scope", "vendor_handoff_org_ceiling"]).sort());
      for (const policy of rows) {
        expect(policy.roles).toEqual(["bm_vendor_handoff_owner"]);
        if (/digest_bootstrap|bootstrap_ceiling/.test(policy.policyname)) {
          expect(policy.cmd).toBe("SELECT"); expect(policy.with_check).toBeNull();
          expect(policy.qual).toContain(`app.${table}_digest`);
        } else {
          if (policy.qual) expect(policy.qual).toContain("org_id = app.current_org_id()");
          if (policy.with_check) expect(policy.with_check).toContain("org_id = app.current_org_id()");
          expect(`${policy.qual ?? ""}${policy.with_check ?? ""}`).not.toContain("digest");
        }
      }
    }
  });

  it("SQL capabilities reject NULL stale-state guards before a durable assignment can be created", async () => {
    const t = await f.ticket();
    await expect(f.web.query("SELECT vendor_handoff.manager_create_assignment($1,$2,$3,NULL,$4)", [proof(f.data.accounts.manager.digest), t.ticket.id, randomUUID(), "합성 업체"])).rejects.toMatchObject({ code: "22023" });
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1", [t.ticket.id])).rows[0].n).toBe(0);
  });

  it("SQL packet/link capabilities cannot bypass expected versions, packet identity or issue intent using NULL", async () => {
    const p = await f.published();
    const bad = [
      { sql: "SELECT vendor_handoff.manager_publish_packet($1,$2,$3,NULL,$4,'합성 점검','{}'::text[],'{}'::uuid[],'TENANT_PRESENT_REQUIRED',NULL)", values: [proof(f.data.accounts.manager.digest), p.handoff.assignment!.id, randomUUID(), p.handoff.currentPacket!.id] },
      { sql: "SELECT vendor_handoff.manager_issue_link($1,$2,$3,NULL,$4,$5,false)", values: [proof(f.data.accounts.manager.digest), p.handoff.assignment!.id, randomUUID(), p.handoff.currentPacket!.id, proof(hash("guard"))] },
      { sql: "SELECT vendor_handoff.manager_issue_link($1,$2,$3,2,NULL,$4,false)", values: [proof(f.data.accounts.manager.digest), p.handoff.assignment!.id, randomUUID(), proof(hash("packet"))] },
      { sql: "SELECT vendor_handoff.manager_issue_link($1,$2,$3,2,$4,$5,NULL)", values: [proof(f.data.accounts.manager.digest), p.handoff.assignment!.id, randomUUID(), p.handoff.currentPacket!.id, proof(hash("intent"))] },
    ];
    for (const input of bad) {
      await f.web.query("BEGIN");
      try {
        await f.web.query("SELECT core_flow.session($1)", [proof(f.data.accounts.manager.digest)]);
        await expect(f.web.query(input.sql, input.values)).rejects.toMatchObject({ code: "22023" });
      } finally { await f.web.query("ROLLBACK"); }
    }
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_capability WHERE assignment_id=$1", [p.handoff.assignment!.id])).rows[0].n).toBe(0);
  });
  it("pins every table owner and exact runtime/bridge execute set, PUBLIC absence and minimum owner grants", async () => {
    expect((await f.p.admin.query("SELECT relname,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE relnamespace='vendor_handoff'::regnamespace AND relkind='r' ORDER BY relname")).rows).toEqual(tables.map(relname => ({ relname, owner: "bm_vendor_handoff_owner" })));
    const funcs = (await f.p.admin.query("SELECT proname,has_function_privilege('bm_b1_web',oid,'EXECUTE') AS manager,has_function_privilege('bm_vendor_web',oid,'EXECUTE') AS vendor FROM pg_proc WHERE pronamespace='vendor_handoff'::regnamespace ORDER BY proname")).rows;
    expect(funcs.filter(r => r.manager).map(r => r.proname)).toEqual(managerFunctions);
    expect(funcs.filter(r => r.vendor).map(r => r.proname)).toEqual(externalFunctions);
    const bridgeRows = (await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) AS owner,has_function_privilege('bm_vendor_handoff_owner',oid,'EXECUTE') AS allowed,has_function_privilege('bm_b1_web',oid,'EXECUTE') AS b1,has_function_privilege('bm_vendor_web',oid,'EXECUTE') AS vendor FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname LIKE 'vendor_handoff_%' ORDER BY proname")).rows;
    expect(bridgeRows).toEqual(bridges.map(proname => ({ proname, prosecdef: true, proconfig: ["search_path=pg_catalog"], owner: "bm_core_flow_owner", allowed: true, b1: false, vendor: false })));
    expect((await f.p.admin.query("SELECT p.proname FROM pg_proc p WHERE p.pronamespace IN ('vendor_handoff'::regnamespace,'core_flow'::regnamespace) AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')")).rows).toEqual([]);
    expect((await f.p.admin.query("SELECT proname FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND has_function_privilege('bm_vendor_handoff_owner',oid,'EXECUTE') ORDER BY proname")).rows.map(r => r.proname)).toEqual(bridges);
    for (const role of ["bm_b1_web", "bm_vendor_web"]) for (const schema of ["app", "authn", "core_flow", "vendor_handoff"]) expect((await f.p.admin.query("SELECT has_schema_privilege($1,$2,'CREATE') AS v", [role, schema])).rows[0].v).toBe(false);
  });

  it("denies actual table DML, role escalation, owner bridges and client-selected Core locks through both runtimes", async () => {
    const a = await issued(), b = await issued("otherManager", "otherTenant");
    expect((await f.external.readJob(a.session)).assignmentId).toBe(a.handoff.assignment!.id);
    expect((await f.external.readJob(b.session)).assignmentId).toBe(b.handoff.assignment!.id);
    await expect(async () => f.external.readJob(b.handoff.assignment!.id)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const vendor = new Client(f.vendorWebConfig); await vendor.connect();
    try {
      for (const web of [f.web, vendor]) {
        for (const table of tables) for (const sql of [`SELECT * FROM vendor_handoff.${table}`, `INSERT INTO vendor_handoff.${table} DEFAULT VALUES`, `UPDATE vendor_handoff.${table} SET org_id=org_id`, `DELETE FROM vendor_handoff.${table}`]) await expect(web.query(sql)).rejects.toMatchObject({ code: "42501" });
        await expect(web.query("SET ROLE bm_vendor_handoff_owner")).rejects.toMatchObject({ code: "42501" });
        await expect(web.query("SELECT core_flow.vendor_handoff_lock_ticket($1,$2)", [f.data.orgB, b.t.ticket.id])).rejects.toMatchObject({ code: "42501" });
        await expect(web.query("SELECT core_flow.vendor_handoff_tenant_context($1,$2,true)", [proof(f.data.accounts.tenant.digest), randomUUID()])).rejects.toMatchObject({ code: "42501" });
      }
      await expect(vendor.query("SELECT * FROM core_flow.ticket")).rejects.toMatchObject({ code: "42501" });
      await expect(vendor.query("SELECT vendor_handoff.manager_read($1,$2)", [proof(f.data.accounts.manager.digest), randomUUID()])).rejects.toMatchObject({ code: "42501" });
    } finally { await vendor.end(); }
  });

  it("bootstrap SELECT exposes exactly one digest row and grants no cross-org writes even with a hostile permissive policy", async () => {
    const a = await issued(), b = await issued("otherManager", "otherTenant");
    for (const [table, setting, keyA, keyB] of [
      ["vendor_capability", "app.vendor_capability_digest", a.token, b.token],
      ["vendor_session", "app.vendor_session_digest", a.session, b.session],
    ]) {
      await owner(async client => {
        await client.query("SELECT set_config('app.org_id','',true),set_config($1,$2,true)", [setting, keyA]);
        expect((await client.query(`SELECT assignment_id FROM vendor_handoff.${table}`)).rows).toEqual([{ assignment_id: a.handoff.assignment!.id }]);
        expect((await client.query(`UPDATE vendor_handoff.${table} SET revoked_at=clock_timestamp() RETURNING id`)).rowCount).toBe(0);
        expect((await client.query(`DELETE FROM vendor_handoff.${table} RETURNING id`)).rowCount).toBe(0);
        await client.query("SELECT set_config('app.org_id',$1,true),set_config($2,$3,true)", [f.data.orgA, setting, keyB]);
        expect((await client.query(`UPDATE vendor_handoff.${table} SET revoked_at=clock_timestamp() WHERE assignment_id=$1 RETURNING id`, [b.handoff.assignment!.id])).rowCount).toBe(0);
      });
    }
    await owner(async client => {
      await client.query("SELECT set_config('app.org_id',$1,true)", [f.data.orgA]);
      for (const table of tables) {
        await client.query(`CREATE POLICY hostile_probe ON vendor_handoff.${table} TO bm_vendor_handoff_owner USING(true) WITH CHECK(true)`);
        expect((await client.query(`SELECT org_id FROM vendor_handoff.${table} WHERE org_id=$1`, [f.data.orgB])).rows).toEqual([]);
      }
      await expect(client.query("INSERT INTO vendor_handoff.vendor_session(org_id,assignment_id,digest,csrf_digest,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 day')", [f.data.orgB, b.handoff.assignment!.id, proof(hash("hostile")), proof(hash("csrf"))])).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("Core context bridges return only specified fields and bind current exact Tenant occupancy", async () => {
    const p = await f.prepared();
    const context = await owner(async client => {
      const manager = (await client.query("SELECT core_flow.vendor_handoff_manager_context($1,$2) AS v", [proof(f.data.accounts.manager.digest), p.t.ticket.id])).rows[0].v;
      expect(Object.keys(manager).sort()).toEqual(["orgId", "ticketId", "unitId"]);
      const tenant = (await client.query("SELECT core_flow.vendor_handoff_tenant_context($1,$2,true) AS v", [proof(f.data.accounts.tenant.digest), p.t.ticket.id])).rows[0].v;
      expect(Object.keys(tenant).sort()).toEqual(["occupancyId", "occupancyMemberId", "orgId", "ticketId", "ticketVersion", "unitId"]);
      const lock = (await client.query("SELECT core_flow.vendor_handoff_lock_ticket($1,$2) AS v", [f.data.orgA, p.t.ticket.id])).rows[0].v;
      expect(Object.keys(lock).sort()).toEqual(["orgId", "ticketId", "ticketVersion", "unitId", "workStatus"]);
      expect((await client.query("SELECT core_flow.vendor_handoff_recheck_occupancy($1,$2,$3) AS v", [f.data.orgA, p.t.ticket.id, tenant.occupancyMemberId])).rows[0].v).toBe(true);
      return tenant;
    });
    for (const who of ["tenantPeer", "tenantOther", "otherTenant", "manager"]) await expect(owner(c => c.query("SELECT core_flow.vendor_handoff_tenant_context($1,$2,false)", [proof(f.data.accounts[who].digest), p.t.ticket.id]))).rejects.toMatchObject({ code: "P0002" });
    await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [context.occupancyMemberId]);
    try {
      await expect(owner(c => c.query("SELECT core_flow.vendor_handoff_tenant_context($1,$2,false)", [proof(f.data.accounts.tenant.digest), p.t.ticket.id]))).rejects.toMatchObject({ code: "42501" });
      expect(await owner(async c => { await c.query("SELECT core_flow.vendor_handoff_lock_ticket($1,$2)", [f.data.orgA, p.t.ticket.id]); return (await c.query("SELECT core_flow.vendor_handoff_recheck_occupancy($1,$2,$3) AS v", [f.data.orgA, p.t.ticket.id, context.occupancyMemberId])).rows[0].v; })).toBe(false);
    } finally { await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE id=$1", [context.occupancyMemberId]); }
  });

  it("post-ticket-wait redeem denies revocation/reassignment with no session or receipt side effect", async () => {
    for (const reason of ["REVOKED", "SUPERSEDED"]) {
      const p = await f.published();
      const link = await f.manager.issueLink(f.data.accounts.manager.digest, p.handoff.assignment!.id, { clientRequestId: randomUUID(), expectedAssignmentVersion: 2, expectedPacketRevisionId: p.handoff.currentPacket!.id });
      const token = createHash("sha256").update(link.link!.split("#")[1]).digest("hex");
      await f.p.admin.query("BEGIN");
      await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE", [p.t.ticket.id]);
      const request = randomUUID();
      const pending = f.external.redeem(token, request, hash("waiting-session"), hash("waiting-csrf")).then(() => "success", e => e.code);
      try {
        await waitForTicketWait();
        await f.p.admin.query("UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason=$2,ended_at=clock_timestamp(),version=version+1 WHERE id=$1", [p.handoff.assignment!.id, reason]);
        if (reason === "SUPERSEDED") await f.p.admin.query("INSERT INTO vendor_handoff.vendor_assignment(org_id,ticket_id,property_id,unit_id,vendor_label,status) VALUES($1,$2,$3,$4,'합성 대체 업체','PREPARING')", [f.data.orgA, p.t.ticket.id, f.data.propertyA, f.data.unitA]);
        await f.p.admin.query("UPDATE vendor_handoff.vendor_capability SET revoked_at=clock_timestamp() WHERE assignment_id=$1", [p.handoff.assignment!.id]);
        await f.p.admin.query("COMMIT");
        expect(await pending).toBe("UNAUTHENTICATED");
        expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_session WHERE assignment_id=$1", [p.handoff.assignment!.id])).rows[0].n).toBe(0);
        expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1", [request])).rows[0].n).toBe(0);
      } finally { await f.p.admin.query("ROLLBACK"); }
    }
  });

  it("logout rechecks revoked/ended authority after ticket wait without writing a new receipt", async () => {
    const a = await issued();
    await f.p.admin.query("BEGIN"); await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE", [a.t.ticket.id]);
    const request = randomUUID(), pending = f.externalWith(a.csrf).logout(a.session, request).then(() => "success", e => e.code);
    try {
      await waitForTicketWait();
      await f.p.admin.query("UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason='REVOKED',ended_at=clock_timestamp() WHERE id=$1", [a.handoff.assignment!.id]);
      await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1", [a.handoff.assignment!.id]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe("UNAUTHENTICATED");
      expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1", [request])).rows[0].n).toBe(0);
    } finally { await f.p.admin.query("ROLLBACK"); }
  });

  it("Manager and Tenant bridges reauthorize current membership after the real source-ticket lock wait", async () => {
    const p = await f.prepared();
    for (const who of ["staff", "tenant"]) {
      const table = who === "staff" ? "property_assignment" : "occupancy_member", key = who === "staff" ? "membership_id" : "user_id", id = who === "staff" ? f.data.accounts.staff.membershipId : f.data.accounts.tenant.userId;
      await f.p.admin.query("BEGIN"); await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE", [p.t.ticket.id]);
      const pending = who === "staff" ? f.manager.publishPacket(f.data.accounts.staff.digest, p.handoff.assignment!.id, {
        clientRequestId: randomUUID(), expectedAssignmentVersion: 1, expectedPacketRevisionId: null, workSummary: "합성 점검", sharedDetailKeys: [], allowedPhotoIds: [], accessPolicy: "TENANT_PRESENT_REQUIRED", accessInstruction: null,
      }).then(() => "success", e => e.code) : owner(c => c.query("SELECT core_flow.vendor_handoff_tenant_context($1,$2,true)", [proof(f.data.accounts.tenant.digest), p.t.ticket.id])).then(() => "success", e => e.code);
      try {
        await waitForTicketWait(); await f.p.admin.query(`UPDATE app.${table} SET status='ENDED',ended_at=clock_timestamp() WHERE ${key}=$1`, [id]); await f.p.admin.query("COMMIT");
        expect(await pending).toBe(who === "staff" ? "NOT_FOUND" : "42501");
      } finally { await f.p.admin.query("ROLLBACK"); await f.p.admin.query(`UPDATE app.${table} SET status='ACTIVE',ended_at=NULL WHERE ${key}=$1`, [id]); }
    }
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.work_packet_revision WHERE assignment_id=$1", [p.handoff.assignment!.id])).rows[0].n).toBe(0);
  });

  it("guard denies stale and unauthorized Manager digests even with no assignment", async () => {
    const t = await f.ticket();
    await f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)", [proof(f.data.accounts.manager.digest), t.ticket.id]);
    for (const who of ["tenant", "otherManager"]) await expect(f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)", [proof(f.data.accounts[who].digest), t.ticket.id])).rejects.toMatchObject({ code: "P0002" });
    await expect(f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)", [proof(hash("unknown-manager")), t.ticket.id])).rejects.toMatchObject({ code: "28000" });
  });

  it("Tenant bridge rechecks the caller role after ticket wait instead of retaining a pre-wait Tenant role", async () => {
    const p = await f.prepared(), membership = randomUUID();
    await f.p.admin.query("BEGIN"); await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE", [p.t.ticket.id]);
    const pending = owner(c => c.query("SELECT core_flow.vendor_handoff_tenant_context($1,$2,true)", [proof(f.data.accounts.tenant.digest), p.t.ticket.id])).then(() => "success", e => e.code);
    try {
      await waitForTicketWait();
      await f.p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')", [membership, f.data.orgA, f.data.accounts.tenant.userId]);
      await f.p.admin.query("COMMIT"); expect(await pending).toBe("P0002");
    } finally {
      await f.p.admin.query("ROLLBACK");
      await f.p.admin.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [membership]);
    }
  });

  it("published packet and photo allowlist rows cannot be updated or deleted even by their RLS-bound owner", async () => {
    const p = await f.published();
    for (const sql of ["UPDATE vendor_handoff.work_packet_revision SET body=body WHERE id=$1", "DELETE FROM vendor_handoff.work_packet_revision WHERE id=$1"]) {
      await expect(owner(async c => { await c.query("SELECT set_config('app.org_id',$1,true)", [f.data.orgA]); return c.query(sql, [p.handoff.currentPacket!.id]); })).rejects.toMatchObject({ code: "P0001" });
    }
  });
});

afterAll(async () => {
  await f?.close();
});

describe("Vendor Secure Handoff security boundary", () => {
  it("revokes PUBLIC and pins exact schema USAGE/CREATE privileges", async () => {
    const rows = await f.p.admin.query(`
      SELECT grantee,
        has_schema_privilege(grantee,'vendor_handoff','USAGE') AS usage,
        has_schema_privilege(grantee,'vendor_handoff','CREATE') AS create_priv
      FROM (VALUES ('bm_vendor_web'),('bm_b1_web'),('bm_vendor_handoff_owner')) AS g(grantee)
      ORDER BY grantee
    `);
    expect(rows.rows).toEqual([
      { grantee: "bm_b1_web", usage: true, create_priv: false },
      { grantee: "bm_vendor_handoff_owner", usage: true, create_priv: true },
      { grantee: "bm_vendor_web", usage: true, create_priv: false },
    ]);
    const publicAcl = await f.p.admin.query(`
      SELECT coalesce(bool_or(privilege_type IN ('USAGE','CREATE')),false) AS any_privilege
      FROM pg_namespace n LEFT JOIN LATERAL aclexplode(n.nspacl) a ON true
      WHERE n.nspname='vendor_handoff' AND (a.grantee=0 OR a.grantee IS NULL)
    `);
    expect(publicAcl.rows).toEqual([{ any_privilege: false }]);
    expect((await f.p.admin.query("SELECT has_schema_privilege('bm_vendor_handoff_owner','core_flow','CREATE') AS v")).rows[0].v).toBe(false);
    expect((await f.p.admin.query("SELECT has_schema_privilege('bm_vendor_handoff_owner','app','CREATE') AS v")).rows[0].v).toBe(false);
  });

  it("applies org scope, restrictive ceilings and digest bootstrap SELECT-only policies", async () => {
    const policies = await f.p.admin.query(`
      SELECT tablename,policyname,permissive,cmd
      FROM pg_policies
      WHERE schemaname='vendor_handoff'
      ORDER BY tablename,policyname
    `);
    const byTable = new Map<string, typeof policies.rows>();
    for (const row of policies.rows) {
      const list = byTable.get(row.tablename) ?? [];
      list.push(row);
      byTable.set(row.tablename, list);
    }
    for (const table of ["vendor_assignment","work_packet_revision","work_packet_source_photo","command_receipt"]) {
      expect(byTable.get(table)?.some((p) => p.policyname === "vendor_handoff_org_scope" && p.permissive === "PERMISSIVE" && p.cmd === "ALL")).toBe(true);
      expect(byTable.get(table)?.some((p) => p.policyname === "vendor_handoff_org_ceiling" && p.permissive === "RESTRICTIVE" && p.cmd === "ALL")).toBe(true);
    }
    for (const table of ["vendor_capability","vendor_session"]) {
      const set = byTable.get(table) ?? [];
      expect(set.some((p) => /digest_bootstrap/.test(p.policyname) && p.cmd === "SELECT")).toBe(true);
      expect(set.some((p) => /bootstrap_ceiling/.test(p.policyname) && p.permissive === "RESTRICTIVE" && p.cmd === "SELECT")).toBe(true);
      expect(set.some((p) => /insert_ceiling/.test(p.policyname) && p.cmd === "INSERT")).toBe(true);
      expect(set.some((p) => /update_ceiling/.test(p.policyname) && p.cmd === "UPDATE")).toBe(true);
      expect(set.some((p) => /delete_ceiling/.test(p.policyname) && p.cmd === "DELETE")).toBe(true);
    }
  });

  it("denies direct Vendor table access and owner SET ROLE to Web runtimes", async () => {
    const tables = ["vendor_assignment","work_packet_revision","work_packet_source_photo","vendor_capability","vendor_session","command_receipt"];
    for (const role of ["bm_vendor_web","bm_b1_web"]) {
      for (const table of tables) {
        for (const privilege of ["SELECT","INSERT","UPDATE","DELETE"]) {
          const result = await f.p.admin.query("SELECT has_table_privilege($1,$2,$3) AS allowed", [role, `vendor_handoff.${table}`, privilege]);
          expect(result.rows[0].allowed, `${role} ${privilege} ${table}`).toBe(false);
        }
      }
      const membership = await f.p.admin.query(`
        SELECT m.set_option,m.inherit_option,m.admin_option
        FROM pg_auth_members m
        JOIN pg_roles r ON r.oid=m.roleid
        JOIN pg_roles u ON u.oid=m.member
        WHERE r.rolname='bm_vendor_handoff_owner' AND u.rolname=$1
      `, [role]);
      expect(membership.rows).toEqual([]);
    }
  });

  it("revokes PUBLIC function execution and exposes only bounded runtime capabilities", async () => {
    const funcs = await f.p.admin.query(`
      SELECT p.oid::regprocedure::text AS signature,p.prosecdef,p.proconfig,
             pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('bm_vendor_web',p.oid,'EXECUTE') AS vendor_web,
             has_function_privilege('bm_b1_web',p.oid,'EXECUTE') AS b1_web,
             has_function_privilege('public',p.oid,'EXECUTE') AS public_exec
      FROM pg_proc p
      WHERE p.pronamespace=to_regnamespace('vendor_handoff')
      ORDER BY p.oid::regprocedure::text
    `);
    expect(funcs.rows.length).toBeGreaterThan(0);
    expect(funcs.rows.every((row) => row.prosecdef === true && row.owner === "bm_vendor_handoff_owner" && row.public_exec === false)).toBe(true);
    expect(funcs.rows.every((row) => Array.isArray(row.proconfig) && row.proconfig.includes("search_path=pg_catalog"))).toBe(true);
    expect(funcs.rows.some((row) => row.vendor_web)).toBe(true);
    expect(funcs.rows.some((row) => row.b1_web)).toBe(true);
  });

  it("does not grant the Vendor owner broad Core/app table access", async () => {
    const rows = await f.p.admin.query(`
      SELECT n.nspname,c.relname,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'SELECT') AS sel,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'INSERT') AS ins,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'UPDATE') AS upd,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'DELETE') AS del
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('core_flow','app') AND c.relkind='r'
      ORDER BY n.nspname,c.relname
    `);
    expect(rows.rows.every((row) => !row.sel && !row.ins && !row.upd && !row.del)).toBe(true);
  });
});
