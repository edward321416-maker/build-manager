import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";
import { ManagerVendorHandoffDtoSchema, VendorJobDtoSchema, VendorLinkIssueDtoSchema } from "@build-manager/api-contracts";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";

// Canonical 0001-0018 Git blob hashes at immutable Task2 entry SHA4fa4265d.
const frozenMigrationHashes: Record<string,string> = {
  "0001_core_identity_organization.sql": "e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "0002_property_unit_occupancy.sql": "1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "0003_runtime_isolation.sql": "649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "0004_b1_identity_sessions.sql": "2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "0005_b1_auth_capabilities.sql": "22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "0006_b1_organization_access.sql": "a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
  "0007_b2_property_assignment_scope.sql": "4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2",
  "0008_b3_building_registration.sql": "c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986",
  "0009_b4_property_assignment_mutation.sql": "021ce7b36282e3a8a1ae12a4daecb944a9400a04825c2f65646944756b537fd4",
  "0010_b5_membership_termination.sql": "9d80e0c2db8f94871ed109c74855dc53a86a3e207c50420f3f36ad047ffe4060",
  "0011_core_flow_tickets.sql": "4216d8b1d603f1cd76deb46559aa43d35b8c74d261f8a09e9f6cdacaca98c054",
  "0012_core_flow_photos.sql": "c272bd6c1252c6b54aa582a94e7426bf136c9689f476b7b3798697d72d9f4168",
  "0013_core_flow_b1_access.sql": "00b0a5cf0a52580d593151426369466fd4dab9ca114790440427fedda99c4452",
  "0014_core_onboarding.sql": "33ca6ecd29ca7f49b2d08fc0d1aa266959f5fd9ced37aa4e0822714715a9f0d4",
  "0015_core_manager_work_queue.sql": "61d54ef861d56276cd12e9c8ef0d04716b268b6694452d83b1a7dfbefe9181c6",
  "0016_core_ticket_communication.sql": "acb1ecf385d1443ebf1e26f40c719404656671e1e2d087a2f4449669a034e40f",
  "0017_core_ticket_outcome_followup.sql": "d74a4eab87fc5b1f185d7905f080723a1e19043c43ceaf01ebe2fc5a2111807f",
  "0018_core_unit_maintenance_fact.sql": "e85f51b725d9dee6bbe3b8be2efa2e43d269e87bf0f440bc8f2d4a954a20ce9b"
};

let f: Awaited<ReturnType<typeof createVendorHandoffFixture>>;

beforeAll(async () => {
  f = await createVendorHandoffFixture();
});

const digest = (label: string) => createHash("sha256").update(label + randomUUID()).digest("hex");
const issueInput = (h: Awaited<ReturnType<typeof f.published>>["handoff"]) => ({
  clientRequestId: randomUUID(), expectedAssignmentVersion: h.assignment!.version, expectedPacketRevisionId: h.currentPacket!.id,
});
async function offered(who = "manager", tenant = "tenant") {
  const p = await f.published(who, tenant);
  const input = issueInput(p.handoff);
  const link = await f.manager.issueLink(f.data.accounts[who].digest, p.handoff.assignment!.id, input);
  return { ...p, input, link, token: createHash("sha256").update(link.link!.split("#")[1]).digest("hex") };
}

describe("foundation runtime commands and durable replay", () => {
  it("authorizes only current managers in property scope and hides cross-org known assignment IDs", async () => {
    const { t, handoff } = await f.prepared();
    for (const who of ["tenant", "tenantPeer", "otherManager"]) {
      await expect(f.manager.readHandoff(f.data.accounts[who].digest, t.ticket.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(f.manager.publishPacket(f.data.accounts[who].digest, handoff.assignment!.id, {
        clientRequestId: randomUUID(), expectedAssignmentVersion: 1, expectedPacketRevisionId: null,
        workSummary: "合成", sharedDetailKeys: [], allowedPhotoIds: [], accessPolicy: "TENANT_PRESENT_REQUIRED", accessInstruction: null,
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(ManagerVendorHandoffDtoSchema.safeParse(await f.manager.readHandoff(f.data.accounts.staff.digest, t.ticket.id)).success).toBe(true);
    await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1", [f.data.accounts.staff.membershipId]);
    try { await expect(f.manager.readHandoff(f.data.accounts.staff.digest, t.ticket.id)).rejects.toMatchObject({ code: "NOT_FOUND" }); }
    finally { await f.p.admin.query("UPDATE app.property_assignment SET status='ACTIVE',ended_at=NULL WHERE membership_id=$1", [f.data.accounts.staff.membershipId]); }
  });

  it("accepts exactly the two vendor routes and denies safety escalation", async () => {
    for (const route of ["GENERAL_VENDOR", "MANUFACTURER_AS", "LANDLORD_REVIEW", "MANAGEMENT_OFFICE", "THIRD_PARTY_MANAGER"]) {
      const t = await f.ticket("tenant", route);
      const call = f.manager.createAssignment(f.data.accounts.manager.digest, t.ticket.id, { clientRequestId: randomUUID(), expectedTicketVersion: 1, vendorLabel: "합성 업체" });
      if (["GENERAL_VENDOR", "MANUFACTURER_AS"].includes(route)) expect((await call).assignment!.status).toBe("PREPARING");
      else await expect(call).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    }
    const t = await f.ticket();
    await f.p.admin.query("UPDATE core_flow.ticket SET body=jsonb_set(body,'{status}','\"SAFETY_ESCALATED\"') WHERE id=$1", [t.ticket.id]);
    await expect(f.manager.createAssignment(f.data.accounts.manager.digest, t.ticket.id, { clientRequestId: randomUUID(), expectedTicketVersion: 1, vendorLabel: "합성 업체" })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
  });

  it("serializes concurrent assignment creation and reconciles exact/changed request replay without IAM rows", async () => {
    const t = await f.ticket();
    const before = (await f.p.admin.query("SELECT (SELECT count(*) FROM app.app_user) AS users,(SELECT count(*) FROM app.organization_membership) AS members")).rows;
    const input = { clientRequestId: randomUUID(), expectedTicketVersion: 1, vendorLabel: "합성 업체" };
    const results = await Promise.all([f.manager.createAssignment(f.data.accounts.manager.digest, t.ticket.id, input), f.manager.createAssignment(f.data.accounts.manager.digest, t.ticket.id, input)]);
    expect(results[0]).toEqual(results[1]);
    await expect(f.manager.createAssignment(f.data.accounts.manager.digest, t.ticket.id, { ...input, vendorLabel: "다른 합성 업체" })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    await expect(f.manager.createAssignment(f.data.accounts.manager.digest, t.ticket.id, { ...input, clientRequestId: randomUUID() })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1", [t.ticket.id])).rows[0].n).toBe(1);
    expect((await f.p.admin.query("SELECT (SELECT count(*) FROM app.app_user) AS users,(SELECT count(*) FROM app.organization_membership) AS members")).rows).toEqual(before);
  });

  it("projects canonical identity and explicitly selected safe provenance without raw input", async () => {
    const { t, handoff } = await f.prepared();
    await f.p.admin.query("UPDATE core_flow.ticket SET body=body || $2::jsonb WHERE id=$1", [t.ticket.id, JSON.stringify({ unitLabel: "FAKE_LABEL", answers: [
      { questionId: "leak.active", value: true }, { questionId: "leak.firstObservedAt", value: "PRIVATE_FREE_TEXT" },
    ] })]);
    const input = { clientRequestId: randomUUID(), expectedAssignmentVersion: 1, expectedPacketRevisionId: null, workSummary: "합성 누수 점검",
      sharedDetailKeys: ["leak.active", "heatingType"], allowedPhotoIds: [], accessPolicy: "TENANT_PRESENT_REQUIRED" as const, accessInstruction: null };
    const h = await f.manager.publishPacket(f.data.accounts.manager.digest, handoff.assignment!.id, input);
    expect(ManagerVendorHandoffDtoSchema.safeParse(h).success).toBe(true);
    expect(h.currentPacket).toMatchObject({ unitLabel: "합성 호실 1", serviceAddress: "합성 테스트 주소", issueType: "LEAK", safetyNotice: [], sharedDetails: [
      { key: "leak.active", sourceType: "TENANT_REPORTED", value: "예" }, { key: "heatingType", sourceType: "BUILDING_VERIFIED", value: "INDIVIDUAL" },
    ] });
    expect(JSON.stringify(h)).not.toContain("PRIVATE_FREE_TEXT");
    expect(JSON.stringify(h)).not.toContain("rawUserText");
    await expect(f.manager.publishPacket(f.data.accounts.manager.digest, handoff.assignment!.id, { ...input, clientRequestId: randomUUID(), expectedAssignmentVersion: 2, expectedPacketRevisionId: h.currentPacket!.id, sharedDetailKeys: ["leak.firstObservedAt"] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("fails publication when the current canonical source acquires a hard-escalation flag", async () => {
    const p = await f.prepared();
    await f.p.admin.query("UPDATE core_flow.ticket SET body=jsonb_set(body,'{safetyFlags}','[\"GAS_SMELL\"]') WHERE id=$1", [p.t.ticket.id]);
    await expect(f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, {
      clientRequestId: randomUUID(), expectedAssignmentVersion: 1, expectedPacketRevisionId: null, workSummary: "합성 안전 차단 검사",
      sharedDetailKeys: [], allowedPhotoIds: [], accessPolicy: "TENANT_PRESENT_REQUIRED", accessInstruction: null,
    })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.work_packet_revision WHERE assignment_id=$1", [p.handoff.assignment!.id])).rows[0].n).toBe(0);
  });

  it("fails first link issuance if a published packet source subsequently becomes unsafe", async () => {
    const p = await f.published();
    await f.p.admin.query("UPDATE core_flow.ticket SET body=jsonb_set(body,'{safetyFlags}','[\"GAS_SMELL\"]') WHERE id=$1", [p.t.ticket.id]);
    await expect(f.manager.issueLink(f.data.accounts.manager.digest, p.handoff.assignment!.id, {
      clientRequestId: randomUUID(), expectedAssignmentVersion: 2, expectedPacketRevisionId: p.handoff.currentPacket!.id,
    }).then(() => "issued")).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_capability WHERE assignment_id=$1", [p.handoff.assignment!.id])).rows[0].n).toBe(0);
  });

  it("publishes append-only packet revisions, exact replay, stale conflicts and fail-safe canonical address", async () => {
    const p = await f.published();
    expect(await f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, p.input)).toEqual(p.handoff);
    await expect(f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, { ...p.input, workSummary: "changed" })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    const next = { ...p.input, clientRequestId: randomUUID(), expectedAssignmentVersion: 2, expectedPacketRevisionId: p.handoff.currentPacket!.id, workSummary: "두 번째 합성 점검" };
    const h = await f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, next);
    await expect(f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, { ...next, clientRequestId: randomUUID() })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    const revisions = (await f.p.admin.query("SELECT body FROM vendor_handoff.work_packet_revision WHERE assignment_id=$1 ORDER BY revision", [p.handoff.assignment!.id])).rows.map(r => r.body);
    expect(revisions).toEqual([p.handoff.currentPacket, h.currentPacket]);
    const missing = await f.prepared();
    await f.p.admin.query("UPDATE core_flow.building_context SET body=body-'serviceAddress' WHERE org_id=$1", [f.data.orgA]);
    try { await expect(f.manager.publishPacket(f.data.accounts.manager.digest, missing.handoff.assignment!.id, { ...p.input, clientRequestId: randomUUID(), expectedAssignmentVersion: 1 })).rejects.toMatchObject({ code: "INVALID_INPUT" }); }
    finally { await f.p.admin.query("UPDATE core_flow.building_context SET body=body || jsonb_build_object('serviceAddress','합성 테스트 주소') WHERE org_id=$1", [f.data.orgA]); }
  });

  it("rejects unknown or other-ticket source photos and persists only the explicit same-ticket allowlist", async () => {
    const p = await f.prepared(), other = await f.ticket();
    const photo = randomUUID();
    await f.p.admin.query("INSERT INTO core_flow.ticket_photo(id,org_id,ticket_id,upload_id,mime,width,height,content,actor_id) VALUES($1,$2,$3,$4,'image/png',1,1,$5,$6)", [photo, f.data.orgA, other.ticket.id, randomUUID(), Buffer.from("89504e470d0a1a0a", "hex"), f.data.accounts.tenant.userId]);
    const input = { clientRequestId: randomUUID(), expectedAssignmentVersion: 1, expectedPacketRevisionId: null, workSummary: "합성 점검", sharedDetailKeys: [], allowedPhotoIds: [photo], accessPolicy: "TENANT_PRESENT_REQUIRED" as const, accessInstruction: null };
    await expect(f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await f.p.admin.query("UPDATE core_flow.ticket_photo SET ticket_id=$1 WHERE id=$2", [p.t.ticket.id, photo]);
    const h = await f.manager.publishPacket(f.data.accounts.manager.digest, p.handoff.assignment!.id, { ...input, clientRequestId: randomUUID() });
    expect(h.currentPacket!.allowedPhotoIds).toEqual([photo]);
    expect((await f.p.admin.query("SELECT source_photo_id FROM vendor_handoff.work_packet_source_photo WHERE packet_revision_id=$1", [h.currentPacket!.id])).rows).toEqual([{ source_photo_id: photo }]);
  });

  it("atomically offers and marks Core handling once, returning metadata-only exact link replay", async () => {
    const o = await offered("staff");
    expect(VendorLinkIssueDtoSchema.safeParse(o.link).success).toBe(true);
    const replay = await f.manager.issueLink(f.data.accounts.staff.digest, o.handoff.assignment!.id, o.input);
    expect({ created: replay.created, assignmentId: replay.assignmentId, assignmentVersion: replay.assignmentVersion, expiresAt: replay.expiresAt }).toMatchObject({ created: false, assignmentId: o.handoff.assignment!.id, assignmentVersion: 3, expiresAt: o.link.expiresAt });
    expect("link" in replay).toBe(false);
    expect(VendorLinkIssueDtoSchema.safeParse(replay).success).toBe(true);
    await expect(f.manager.issueLink(f.data.accounts.staff.digest, o.handoff.assignment!.id, { ...o.input, expectedAssignmentVersion: 3 }).then(() => "issued")).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    const core = await createCoreFlowPort(f.managerDatabase).run(f.data.accounts.tenant.digest, s => s.read(o.t.ticket.id));
    expect(core.workStatus).toBe("IN_PROGRESS");
    expect(core.events.filter(e => e.kind === "HANDLING").map(e => e.actorRole)).toEqual(["PROPERTY_STAFF"]);
    expect(core.events.filter(e => e.kind === "HANDLING").some(e => e.message.includes("합성 업체"))).toBe(false);
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_capability WHERE assignment_id=$1", [o.handoff.assignment!.id])).rows[0].n).toBe(1);
  });

  it("redeems once per request, replaces only on exact request replay, hides other assignment and revokes old sessions", async () => {
    const o = await offered(), request = randomUUID(), sessionA = digest("session-a"), csrfA = digest("csrf-a");
    await f.external.redeem(o.token, request, sessionA, csrfA);
    expect(VendorJobDtoSchema.safeParse(await f.external.readJob(sessionA)).success).toBe(true);
    await expect(f.external.redeem(o.token, randomUUID(), digest("other"), digest("csrf"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const sessionB = digest("session-b"), csrfB = digest("csrf-b");
    await f.external.redeem(o.token, request, sessionB, csrfB);
    await expect(f.external.readJob(sessionA)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect((await f.external.readJob(sessionB)).assignmentId).toBe(o.handoff.assignment!.id);
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_session WHERE assignment_id=$1 AND revoked_at IS NULL", [o.handoff.assignment!.id])).rows[0].n).toBe(1);
    expect(await f.externalWith(csrfB).logout(sessionB, randomUUID())).toEqual({ revoked: true });
    expect(await f.externalWith(csrfB).logout(sessionB, randomUUID())).toEqual({ revoked: true });
    await expect(f.external.session(sessionB)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it.each([false, true])("rechecks current external route before issuance (reissue=%s)", async (reissue) => {
    const p = reissue ? await offered() : await f.published();
    const assignment = p.handoff.assignment!;
    await f.p.admin.query("UPDATE core_flow.ticket SET body=jsonb_set(body,'{routeDecision,selectedRoute}','\"MANAGEMENT_OFFICE\"') WHERE id=$1", [p.t.ticket.id]);
    const before = (await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_capability WHERE assignment_id=$1", [assignment.id])).rows[0].n;
    const input = { ...issueInput(p.handoff), expectedAssignmentVersion: reissue ? 3 : assignment.version };
    await expect((reissue ? f.manager.reissueLink : f.manager.issueLink)(f.data.accounts.manager.digest, assignment.id, input).then(() => "issued")).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_capability WHERE assignment_id=$1", [assignment.id])).rows[0].n).toBe(before);
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1", [input.clientRequestId])).rows[0].n).toBe(0);
  });

  it("old redemption replay cannot displace a newer capability session while reissue preserves the old session", async () => {
    const o = await offered(), oldRequest = randomUUID(), oldSession = digest("lineage-old");
    await f.external.redeem(o.token, oldRequest, oldSession, digest("lineage-old-csrf"));
    const replacement = await f.manager.reissueLink(f.data.accounts.manager.digest, o.handoff.assignment!.id, {
      ...o.input, clientRequestId: randomUUID(), expectedAssignmentVersion: 3,
    });
    expect((await f.external.session(oldSession)).assignmentId).toBe(o.handoff.assignment!.id);
    const token = createHash("sha256").update(replacement.link!.split("#")[1]).digest("hex");
    const currentSession = digest("lineage-current"), currentRequest = randomUUID();
    await f.external.redeem(token, currentRequest, currentSession, digest("lineage-current-csrf"));
    const before = (await f.p.admin.query("SELECT id,revoked_at FROM vendor_handoff.vendor_session WHERE assignment_id=$1 ORDER BY id", [o.handoff.assignment!.id])).rows;
    await expect(f.external.redeem(o.token, oldRequest, digest("lineage-stale-retry"), digest("lineage-stale-csrf"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect((await f.external.session(currentSession)).assignmentId).toBe(o.handoff.assignment!.id);
    expect((await f.p.admin.query("SELECT id,revoked_at FROM vendor_handoff.vendor_session WHERE assignment_id=$1 ORDER BY id", [o.handoff.assignment!.id])).rows).toEqual(before);
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1", [oldRequest])).rows[0].n).toBe(1);
  });

  it.each(["logout", "revocation", "expiry"] as const)("exact redemption retry cannot resurrect a session after deliberate termination (%s)", async (termination) => {
    const o = await offered(), request = randomUUID(), session = digest("logout-lineage"), csrf = digest("logout-lineage-csrf");
    await f.external.redeem(o.token, request, session, csrf);
    if (termination === "logout") await f.externalWith(csrf).logout(session, randomUUID());
    else if (termination === "revocation") await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1", [o.handoff.assignment!.id]);
    else await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE assignment_id=$1", [o.handoff.assignment!.id]);
    const before = (await f.p.admin.query("SELECT id,revoked_at FROM vendor_handoff.vendor_session WHERE assignment_id=$1 ORDER BY id", [o.handoff.assignment!.id])).rows;
    await expect(f.external.redeem(o.token, request, digest("logout-retry"), digest("logout-retry-csrf"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect((await f.p.admin.query("SELECT id,revoked_at FROM vendor_handoff.vendor_session WHERE assignment_id=$1 ORDER BY id", [o.handoff.assignment!.id])).rows).toEqual(before);
  });

  it("reissue supersedes old capability and replacement redemption invalidates the previous browser session", async () => {
    const o = await offered(), oldSession = digest("old-session");
    await f.external.redeem(o.token, randomUUID(), oldSession, digest("csrf"));
    const input = { ...o.input, clientRequestId: randomUUID(), expectedAssignmentVersion: 3 };
    const replacement = await f.manager.reissueLink(f.data.accounts.manager.digest, o.handoff.assignment!.id, input);
    expect(replacement.created).toBe(true);
    const replay = await f.manager.reissueLink(f.data.accounts.manager.digest, o.handoff.assignment!.id, input);
    expect(replay.created).toBe(false); expect("link" in replay).toBe(false);
    await expect(f.external.redeem(o.token, randomUUID(), digest("bad"), digest("csrf"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const nextSession = digest("next-session"), token = createHash("sha256").update(replacement.link!.split("#")[1]).digest("hex");
    await f.external.redeem(token, randomUUID(), nextSession, digest("csrf"));
    await expect(f.external.session(oldSession)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect((await f.external.readJob(nextSession)).status).toBe("OFFERED");
    const receipts = (await f.p.admin.query("SELECT result FROM vendor_handoff.command_receipt WHERE assignment_id=$1", [o.handoff.assignment!.id])).rows;
    expect(receipts.length).toBeGreaterThanOrEqual(5);
    expect(receipts.every(r => !JSON.stringify(r.result).includes("/vendor/job#") && !JSON.stringify(r.result).includes('"link"'))).toBe(true);
  });

  it("expiration and unknown digests deny access; exact redemption retry keeps one receipt and absolute expiry", async () => {
    const o = await offered(), request = randomUUID(), session = digest("expiry-session"), csrf = digest("expiry-csrf");
    const first = await f.external.redeem(o.token, request, session, csrf);
    expect(await f.external.redeem(o.token, request, session, csrf)).toEqual(first);
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1", [request])).rows[0].n).toBe(1);
    const replacement = await f.external.redeem(o.token, request, digest("retry-session"), digest("retry-csrf"));
    expect(replacement.expiresAt).toBe(first.expiresAt);
    await expect(f.external.session(digest("unknown-session"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE assignment_id=$1 AND revoked_at IS NULL", [o.handoff.assignment!.id]);
    const liveDigest = (await f.p.admin.query("SELECT encode(digest,'hex') AS digest FROM vendor_handoff.vendor_session WHERE assignment_id=$1 AND revoked_at IS NULL", [o.handoff.assignment!.id])).rows[0].digest;
    await expect(f.external.readJob(liveDigest)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const expired = await offered();
    await f.p.admin.query("UPDATE vendor_handoff.vendor_capability SET issued_at=clock_timestamp()-interval '4 days',expires_at=clock_timestamp()-interval '1 day' WHERE assignment_id=$1", [expired.handoff.assignment!.id]);
    await expect(f.external.redeem(expired.token, randomUUID(), digest("expired"), digest("csrf"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("scopes issuance request identity to the authenticated actor and organization", async () => {
    const a = await f.published(), b = await f.published("otherManager", "otherTenant"), request = randomUUID();
    for (const [who, packet] of [["manager", a], ["otherManager", b]] as const) {
      const result = await f.manager.issueLink(f.data.accounts[who].digest, packet.handoff.assignment!.id, {
        clientRequestId: request, expectedAssignmentVersion: 2, expectedPacketRevisionId: packet.handoff.currentPacket!.id,
      });
      expect(result.created).toBe(true);
    }
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE actor_scope='MANAGER' AND request_key=$1", [request])).rows[0].n).toBe(2);
  });

  it("direct-completion guard denies a non-ended assignment while the caller holds the source ticket lock", async () => {
    const o = await offered();
    await f.web.query("BEGIN");
    try {
      await f.web.query("SELECT core_flow.read_ticket($1,$2,true)", [Buffer.from(f.data.accounts.manager.digest, "hex"), o.t.ticket.id]);
      await expect(f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)", [Buffer.from(f.data.accounts.manager.digest, "hex"), o.t.ticket.id])).rejects.toMatchObject({ code: "P0001" });
    } finally { await f.web.query("ROLLBACK"); }
    expect((await f.p.admin.query("SELECT work_status FROM core_flow.ticket WHERE id=$1", [o.t.ticket.id])).rows[0].work_status).toBe("IN_PROGRESS");
  });
});

afterAll(async () => {
  await f?.close();
});

describe("Vendor Secure Handoff foundation", () => {
  it("preserves migrations 0001-0018 and provisions exact isolated Vendor roles", async () => {
    const files = (await import("node:fs/promises")).readdir;
    const names = (await files(resolve("packages/persistence-postgres/migrations")))
      .filter((name) => /^00(0[1-9]|1[0-8])_/.test(name))
      .sort();
    expect(names).toHaveLength(18);
    for (const name of names) {
      const bytes = await readFile(resolve("packages/persistence-postgres/migrations", name));
      expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(frozenMigrationHashes[name]);
    }

    const roles = await f.p.admin.query(`
      SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit
      FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname
    `, [["bm_vendor_handoff_owner", "bm_vendor_web"]]);
    expect(roles.rows).toEqual([
      { rolname: "bm_vendor_handoff_owner", rolcanlogin: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false },
      { rolname: "bm_vendor_web", rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false },
    ]);
  }, 120_000);

  // Cumulative current Vendor-owned inventory: the six 0019 foundation tables plus the eight 0020 scheduling tables.
  it("creates exactly the cumulative Vendor tables (0019 foundation + 0020 scheduling) with FORCE RLS and org ownership", async () => {
    const rows = await f.p.admin.query(`
      SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
             EXISTS (
               SELECT 1 FROM information_schema.columns x
               WHERE x.table_schema='vendor_handoff' AND x.table_name=c.relname
                 AND x.column_name='org_id' AND x.is_nullable='NO' AND x.udt_name='uuid'
             ) AS has_org
      FROM pg_class c
      WHERE c.relnamespace=to_regnamespace('vendor_handoff') AND c.relkind='r'
      ORDER BY c.relname
    `);
    expect(rows.rows).toEqual([
      "command_receipt",
      "vendor_assignment",
      "vendor_capability",
      "vendor_session",
      "work_packet_revision",
      "work_packet_source_photo",
      "appointment",
      "scheduling_round",
      "tenant_availability_submission",
      "tenant_availability_window",
      "tenant_entry_authorization",
      "tenant_entry_authorization_window",
      "vendor_slot",
      "vendor_slot_proposal",
    ].sort().map((relname) => ({ relname, relrowsecurity: true, relforcerowsecurity: true, has_org: true })));
  });

  it("enforces one non-ended assignment and one active Vendor session per assignment", async () => {
    const indexes = await f.p.admin.query(`
      SELECT indexname,indexdef
      FROM pg_indexes
      WHERE schemaname='vendor_handoff'
      ORDER BY indexname
    `);
    const defs = indexes.rows.map((row) => String(row.indexdef));
    expect(defs.some((value) => /vendor_assignment/.test(value) && /WHERE/.test(value) && /(PREPARING|OFFERED|ACTIVE)/.test(value))).toBe(true);
    expect(defs.some((value) => /vendor_session/.test(value) && /WHERE/.test(value) && /(revoked_at IS NULL|revoked_at.*NULL)/i.test(value))).toBe(true);
  });

  it("stores capability/session digests rather than plaintext secrets", async () => {
    const columns = await f.p.admin.query(`
      SELECT table_name,column_name,data_type
      FROM information_schema.columns
      WHERE table_schema='vendor_handoff'
        AND table_name IN ('vendor_capability','vendor_session')
      ORDER BY table_name,column_name
    `);
    const names = columns.rows.map((row) => `${row.table_name}.${row.column_name}`);
    expect(names).toContain("vendor_capability.digest");
    expect(names).toContain("vendor_session.digest");
    expect(names).toContain("vendor_session.csrf_digest");
    expect(names.some((name) => /(token|secret|raw_token|session_token)$/i.test(name))).toBe(false);
  });
});
