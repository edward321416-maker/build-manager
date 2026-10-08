import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createCoreAccessPort, createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createVendorHandoffManagerPort, createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { CoreFollowUpResultSchema, CoreMaintenanceFactDetailSchema, CoreTicketOutcomeSchema, CoreTicketSchema, CoreUnitMaintenanceFactSchema, ManagerVendorHandoffDtoSchema, VendorJobDtoSchema, VendorTenantSchedulingDtoSchema } from "@build-manager/api-contracts";
import { handleCoreFlow } from "../../apps/web/src/server/core-flow/http";
import type { CoreHTTPDependencies } from "../../apps/web/src/server/core-flow/container";
import sharp from "sharp";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createVendorHandoffExternalPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { handleVendorHandoff } from "../../apps/web/src/server/vendor-handoff/http";
import { createVendorSecret, vendorSecretDigest } from "../../apps/web/src/server/vendor-handoff/token";
import type { VendorCompletionPhotoUploadCommand } from "@build-manager/application";

describe("Task11 actual HTTP upload recovery across independent services", () => {
  it("T11-P01 reconciles a discarded response before exact sharp replay; changed bytes and every retained guard conflict", async () => {
    const p = await f.published(), assignmentId = p.handoff.assignment!.id, packetId = p.handoff.currentPacket!.id;
    const link = await f.manager.issueLink(f.data.accounts.manager.digest, assignmentId, { clientRequestId: randomUUID(), expectedAssignmentVersion: 2, expectedPacketRevisionId: packetId });
    const raw = createVendorSecret(), csrf = createVendorSecret();
    await f.external.redeem(vendorSecretDigest(link.link!.split("#")[1]), randomUUID(), raw.digest, csrf.digest);
    const sessionStorage = (await f.p.admin.query("SELECT encode(digest,'hex') session,encode(csrf_digest,'hex') csrf FROM vendor_handoff.vendor_session WHERE assignment_id=$1", [assignmentId])).rows[0];
    expect([sessionStorage.session === raw.digest, sessionStorage.csrf === csrf.digest]).toEqual([true, true]);
    const durableAuthority = JSON.stringify((await f.p.admin.query("SELECT row_to_json(t) value FROM vendor_handoff.vendor_session t WHERE assignment_id=$1 UNION ALL SELECT row_to_json(t) FROM vendor_handoff.vendor_capability t WHERE assignment_id=$1 UNION ALL SELECT row_to_json(t) FROM vendor_handoff.command_receipt t WHERE assignment_id=$1", [assignmentId])).rows);
    for (const secret of [raw.raw, csrf.raw, link.link!.split("#")[1]]) expect(durableAuthority.includes(secret)).toBe(false);
    const v = f.externalWith(csrf.digest), t = createVendorHandoffTenantPort(f.managerDatabase);
    await v.accept(raw.digest, { clientRequestId: randomUUID(), expectedAssignmentVersion: 3, expectedPacketRevisionId: packetId });
    const guards = async () => { const j = await v.readJob(raw.digest); return { expectedAssignmentVersion: j.assignmentVersion, expectedRoundVersion: j.currentRound!.version, expectedPacketRevisionId: packetId }; };
    const at = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
    await t.submitAvailability(f.data.accounts.tenant.digest, p.t.ticket.id, { clientRequestId: randomUUID(), ...await guards(), windows: [{ startAt: at(24), endAt: at(28) }] });
    const proposed = await v.proposeSlots(raw.digest, { clientRequestId: randomUUID(), ...await guards(), slots: [{ startAt: at(25), endAt: at(26) }] });
    const confirmed = await t.confirmSlot(f.data.accounts.tenant.digest, p.t.ticket.id, { clientRequestId: randomUUID(), ...await guards(), proposalId: proposed.proposal!.id, selectedSlotId: proposed.proposal!.slots[0].id });
    await v.startVisit(raw.digest, confirmed.appointment!.id, { clientRequestId: randomUUID(), ...await guards() });
    const j = await v.readJob(raw.digest), input: VendorCompletionPhotoUploadCommand = { clientRequestId: randomUUID(), expectedAssignmentVersion: j.assignmentVersion, expectedPacketRevisionId: packetId, expectedAppointmentId: confirmed.appointment!.id, expectedCorrectionRequestId: null };
    const image = await sharp({ create: { width: 12, height: 9, channels: 3, background: "#286ca0" } }).withExif({ IFD0: { Artist: "SYNTHETIC_TASK11" } }).jpeg().toBuffer();
    const databases = [createPostgresDatabase(f.vendorWebConfig), createPostgresDatabase(f.vendorWebConfig)];
    const request = (index: number, command = input, bytes = image) => handleVendorHandoff(new Request(task10Origin + "/api/v2/vendor/job/completion-photos", { method: "POST", headers: { Origin: task10Origin, Cookie: `vendor_session=${raw.raw}`, "x-vendor-csrf": csrf.raw, "x-upload-id": command.clientRequestId, "x-vendor-upload-command": JSON.stringify(command), "Content-Type": "image/jpeg" }, body: new Uint8Array(bytes) }), ["job", "completion-photos"], () => ({ origin: task10Origin, external: digest => createVendorHandoffExternalPort(databases[index], digest) }));
    try {
      // Transport discards the committed response. Reconciliation is a READ, before any replay.
      const lost = await request(0); expect(lost.status).toBe(200);
      const authoritative = await createVendorHandoffExternalPort(databases[1]).readJob(raw.digest);
      expect(authoritative.assignmentId).toBe(assignmentId);
      expect(authoritative.currentPacket!.id).toBe(input.expectedPacketRevisionId);
      expect(authoritative.appointment!.id).toBe(input.expectedAppointmentId);
      const replay = await request(1); expect(replay.status).toBe(200); const receipt = await replay.json();
      const durable = (await f.p.admin.query("SELECT result FROM vendor_handoff.command_receipt WHERE request_key=$1", [input.clientRequestId])).rows;
      expect(durable).toEqual([{ result: receipt }]);
      const stored = await createVendorHandoffExternalPort(databases[1]).readCompletionPhoto(raw.digest, receipt.photoId);
      expect((await sharp(stored.bytes).metadata()).exif === undefined).toBe(true);
      const changed = await sharp({ create: { width: 12, height: 9, channels: 3, background: "#dfab32" } }).jpeg().toBuffer();
      for (const [command, bytes] of [[input, changed], [{ ...input, expectedAssignmentVersion: input.expectedAssignmentVersion - 1 }, image], [{ ...input, expectedPacketRevisionId: randomUUID() }, image], [{ ...input, expectedAppointmentId: randomUUID() }, image], [{ ...input, expectedCorrectionRequestId: randomUUID() }, image]] as const) {
        const r = await request(1, command, bytes); expect(r.status).toBe(409); expect((await r.json()).error.code).toBe("STATE_CONFLICT");
      }
      expect((await f.p.admin.query("SELECT count(*)::int n FROM vendor_handoff.completion_photo WHERE assignment_id=$1", [assignmentId])).rows[0].n).toBe(1);
      expect((await f.p.admin.query("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1", [input.clientRequestId])).rows[0].n).toBe(1);
    } finally { await Promise.all(databases.map(d => d.close())); }
  });
  it("T11-P02 a known peer-assignment completion photo and an unshared source photo are hidden from the real Vendor runtime", async () => {
    const a = await task10Reported(), b = await task10Reported();
    await expect(a.vendor.readCompletionPhoto(a.session, b.photoId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const sourceId = (await f.p.admin.query("SELECT id FROM core_flow.ticket_photo WHERE ticket_id=$1", [a.ticketId])).rows[0].id;
    await expect(a.vendor.readSourcePhoto(a.session, sourceId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.vendor.readSourcePhoto(b.session, sourceId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await a.vendor.readJob(a.session)).currentPacket!.allowedPhotoIds).toEqual([]);
    const own = await a.vendor.readCompletionPhoto(a.session, a.photoId); expect(own.photo.photoId).toBe(a.photoId);
    const runtime = new Client(f.vendorWebConfig); await runtime.connect();
    try { expect((await runtime.query("SELECT current_user AS role")).rows[0].role).toBe("bm_vendor_web"); }
    finally { await runtime.end(); }
  });
});

let f: Awaited<ReturnType<typeof createVendorHandoffFixture>>;

beforeAll(async () => {
  f = await createVendorHandoffFixture();
});

// Cumulative exact Vendor-owned inventory: 0019 foundation, eight 0020 scheduling tables (Task5), 0021 work evidence (Task7) and 0022 completion (Task8).
const schedulingTables = ["appointment", "scheduling_round", "tenant_availability_submission", "tenant_availability_window", "tenant_entry_authorization", "tenant_entry_authorization_window", "vendor_slot", "vendor_slot_proposal"];
const workTables = ["work_event"];
const completionTables = ["completion_photo", "completion_report", "manager_disposition"];
const tables = ["command_receipt", "vendor_assignment", "vendor_capability", "vendor_session", "work_packet_revision", "work_packet_source_photo", ...schedulingTables, ...workTables, ...completionTables].sort();
// bm_b1_web: Manager functions plus the digest-bound Tenant scheduling functions (Task5).
const managerFunctions = ["closeout", "manager_request_correction", "manager_require_follow_up", "manager_revoke", "manager_reassign", "guard_direct_completion", "manager_create_assignment", "manager_issue_link", "manager_completion_photo", "manager_publish_packet", "manager_read", "manager_reschedule", "tenant_authorize_entry", "tenant_confirm_slot", "tenant_read", "tenant_reschedule", "tenant_submit_availability"].sort();
// Cumulative external inventory: Task2/Task4 session and decline, Task5 scheduling, Task7 visit and blocker evidence, Task8 completion.
const externalFunctions = ["accept", "clear_blocker", "decline", "logout", "propose_slots", "read_completion_photo", "read_job", "read_source_photo", "record_blocker", "redeem", "refresh_session", "select_preauthorized_slot", "session_info", "start_visit", "submit_completion_report", "upload_completion_photo", "vendor_reschedule", "withdraw"].sort();
const bridges = ["vendor_handoff_complete", "vendor_handoff_lock_ticket", "vendor_handoff_manager_context", "vendor_handoff_mark_offered", "vendor_handoff_recheck_occupancy", "vendor_handoff_source", "vendor_handoff_source_photo", "vendor_handoff_tenant_context"].sort();
const hash = (label: string) => createHash("sha256").update(label + randomUUID()).digest("hex");
const proof = (value: string) => Buffer.from(value, "hex");
const task10Origin = "http://127.0.0.1:3130";
function task10Request(who: string, path: string, body?: unknown) {
  const database = f.managerDatabase;
  const dependencies: CoreHTTPDependencies = {
    port: createCoreFlowPort(database), revoke: async () => {}, origins: [task10Origin],
    vendorHandoff: { inOrganization: org => createVendorHandoffManagerPort(database, org), tenantInOrganization: org => createVendorHandoffTenantPort(database, org) },
    b1: { current: async () => ({ actor: { userId: f.data.accounts[who].userId }, digest: f.data.accounts[who].digest, csrf: "synthetic-proof" }), access: createCoreAccessPort(database) },
  };
  return handleCoreFlow(new Request(`${task10Origin}/api/v2/core/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: task10Origin, "X-Core-Organization": f.data.orgA, "X-B1-CSRF": "synthetic-proof", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), path.split("/"), () => dependencies);
}
async function task10Json(who: string, path: string, body?: unknown, status = 200) {
  const response = await task10Request(who, path, body);
  expect(response.status, path).toBe(status);
  return response.json();
}
async function task10Reported() {
  const c = await issued(), ticketId = c.t.ticket.id, assignmentId = c.handoff.assignment!.id, packetId = c.handoff.currentPacket!.id;
  const vendor = f.externalWith(c.csrf), tenant = createVendorHandoffTenantPort(f.managerDatabase);
  await vendor.accept(c.session, { clientRequestId: randomUUID(), expectedAssignmentVersion: 3, expectedPacketRevisionId: packetId });
  const guards = async () => {
    const dto = await tenant.readScheduling(f.data.accounts.tenant.digest, ticketId);
    return { expectedAssignmentVersion: dto.assignmentVersion, expectedRoundVersion: dto.currentRound!.version, expectedPacketRevisionId: packetId };
  };
  const at = (hour: number) => new Date(Date.now() + hour * 3_600_000).toISOString();
  await tenant.submitAvailability(f.data.accounts.tenant.digest, ticketId, { clientRequestId: randomUUID(), ...await guards(), windows: [{ startAt: at(24), endAt: at(28) }] });
  const proposal = await vendor.proposeSlots(c.session, { clientRequestId: randomUUID(), ...await guards(), slots: [{ startAt: at(25), endAt: at(26) }] });
  const confirmed = await tenant.confirmSlot(f.data.accounts.tenant.digest, ticketId, { clientRequestId: randomUUID(), ...await guards(), proposalId: proposal.proposal!.id, selectedSlotId: proposal.proposal!.slots[0].id });
  await vendor.startVisit(c.session, confirmed.appointment!.id, { clientRequestId: randomUUID(), ...await guards() });
  const current = await vendor.readJob(c.session);
  const bytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#265b82" } }).png().toBuffer();
  await createCoreFlowPort(f.managerDatabase).run(f.data.accounts.tenant.digest, s => s.savePhoto(ticketId, { uploadId: randomUUID(), mime: "image/png", width: 8, height: 6, bytes }));
  const photo = await vendor.uploadCompletionPhoto(c.session, { clientRequestId: randomUUID(), expectedAssignmentVersion: current.assignmentVersion, expectedPacketRevisionId: packetId,
    expectedAppointmentId: confirmed.appointment!.id, expectedCorrectionRequestId: null }, { bytes, mime: "image/png", byteSize: bytes.length, width: 8, height: 6, sha256: createHash("sha256").update(bytes).digest("hex") });
  await vendor.submitCompletionReport(c.session, { clientRequestId: randomUUID(), expectedAssignmentVersion: current.assignmentVersion, expectedPacketRevisionId: packetId,
    expectedAppointmentId: confirmed.appointment!.id, expectedCorrectionRequestId: null, supersedesReportId: null, workSummary: "T10_VENDOR_REPORT_PRIVATE", componentOrPartNote: "T10_VENDOR_PART_PRIVATE", completionPhotoIds: [photo.photoId], photoOmissionReason: null });
  return { ...c, vendor, ticketId, assignmentId, photoId: photo.photoId };
}
async function task10Close(c: Awaited<ReturnType<typeof task10Reported>>) {
  const handoff = ManagerVendorHandoffDtoSchema.parse(await task10Json("manager", `manager/tickets/${c.ticketId}/vendor-handoff`));
  const communication = await createCoreFlowPort(f.managerDatabase).run(f.data.accounts.manager.digest, s => s.communication.read(c.ticketId));
  return ManagerVendorHandoffDtoSchema.parse(await task10Json("manager", `manager/vendor-assignments/${c.assignmentId}/closeout`, {
    clientRequestId: randomUUID(), expectedAssignmentVersion: handoff.assignment!.version, expectedCompletionReportId: handoff.currentReport!.id, expectedCommunicationVersion: communication.version, message: "T10_MANAGER_PUBLIC_CLOSEOUT",
  }));
}
async function task10SourceSnapshot(ticketId: string, assignmentId: string) {
  const rows = await f.p.admin.query("SELECT body,work_status,version,updated_at FROM core_flow.ticket WHERE id=$1", [ticketId]);
  const assignment = await f.p.admin.query("SELECT status,end_reason,version FROM vendor_handoff.vendor_assignment WHERE id=$1", [assignmentId]);
  expect(rows.rows).toHaveLength(1); expect(rows.rows[0].work_status).toBe("COMPLETED");
  expect(assignment.rows).toHaveLength(1); expect(assignment.rows[0]).toMatchObject({ status: "ENDED", end_reason: "CLOSED" });
  const events = await f.p.admin.query("SELECT id FROM core_flow.ticket_event WHERE ticket_id=$1 ORDER BY id", [ticketId]);
  return { ticket: rows.rows, assignment: assignment.rows, events: events.rows };
}
function task10Absent(value: unknown, names: string[], markers: string[] = []) {
  const serialized = JSON.stringify(value);
  for (const name of names) expect(serialized).not.toContain(`"${name}":`);
  for (const marker of markers) expect(serialized).not.toContain(marker);
}

describe("Task10 actual Vendor closeout preserves Core outcome and role privacy", () => {
  it("T10-P01 RESOLVED is a separate Tenant assertion with exact replay and unchanged closed source/assignment", async () => {
    const c = await task10Reported();
    expect(await task10Json("manager", `manager/tickets/${c.ticketId}/maintenance-fact`)).toEqual({ current: null, revisions: [] });
    const closed = await task10Close(c);
    expect(closed.assignment).toMatchObject({ status: "ENDED", endReason: "CLOSED" });
    expect(CoreTicketOutcomeSchema.parse(await task10Json("tenant", `tickets/${c.ticketId}/outcome`)).kind).toBe("UNCONFIRMED");
    const before = await task10SourceSnapshot(c.ticketId, c.assignmentId), input = { clientRequestId: randomUUID() };
    const result = CoreTicketOutcomeSchema.parse(await task10Json("tenant", `tickets/${c.ticketId}/outcome/resolved`, input, 201));
    expect(result).toMatchObject({ kind: "RESOLVED", followUpTicketId: null });
    expect(await task10Json("tenant", `tickets/${c.ticketId}/outcome/resolved`, input)).toEqual(result);
    expect(await task10SourceSnapshot(c.ticketId, c.assignmentId)).toEqual(before);
    expect(await task10Json("manager", `manager/tickets/${c.ticketId}/maintenance-fact`)).toEqual({ current: null, revisions: [] });
    expect((await task10Request("manager", `tickets/${c.ticketId}/outcome/resolved`, { clientRequestId: randomUUID() })).status).toBe(403);
  });
  it.each(["UNRESOLVED", "RECURRENCE_CLAIM"] as const)("T10-P02 %s creates a fresh linked ticket after Vendor closeout without reopening or copying the source", async claimKind => {
    const c = await task10Reported();
    await createCoreFlowPort(f.managerDatabase).run(f.data.accounts.manager.digest, async s => {
      await s.manager.appendNote(c.ticketId, "T10_MANAGER_NOTE_PRIVATE");
      await s.manager.update(c.ticketId, { priority: "URGENT", assigneeLabel: "T10_MANAGER_ASSIGNEE_PRIVATE", dueAt: null, expectedVersion: 1 });
      await s.communication.send(c.ticketId, { clientRequestId: randomUUID(), expectedVersion: 0, intent: "MANAGER_UPDATE", body: "T10_FULL_QA_PRIVATE" });
      expect((await s.photos(c.ticketId)).length).toBe(1);
    });
    await task10Close(c);
    if (claimKind === "RECURRENCE_CLAIM") await task10Json("tenant", `tickets/${c.ticketId}/outcome/resolved`, { clientRequestId: randomUUID() }, 201);
    const before = await task10SourceSnapshot(c.ticketId, c.assignmentId);
    const input = { clientRequestId: randomUUID(), claimKind, issueType: "HEATING", rawUserText: "T10_FRESH_TENANT_INPUT" };
    const result = CoreFollowUpResultSchema.parse(await task10Json("tenant", `tickets/${c.ticketId}/follow-up`, input, 201));
    const target = result.ticket.ticketId;
    expect(target).not.toBe(c.ticketId); expect(result.ticket.workStatus).toBe("OPEN");
    expect(result.sourceOutcome).toMatchObject({ kind: claimKind, followUpTicketId: target });
    expect(await task10Json("tenant", `tickets/${target}/follow-up`)).toEqual({ sourceTicketId: c.ticketId });
    expect(await task10Json("tenant", `tickets/${c.ticketId}/follow-up`, input)).toEqual(result);
    const fresh = await createCoreFlowPort(f.managerDatabase).run(f.data.accounts.manager.digest, async s => ({ record: await s.read(target), photos: await s.photos(target), communication: await s.communication.read(target), notes: await s.manager.notes(target), work: await s.manager.read(target), fact: await s.maintenance.readForTicket(target) }));
    expect(fresh.record.ticket).toMatchObject({ issueType: "HEATING", rawUserText: input.rawUserText, answers: [], evidence: [], repairPacket: null, routeDecision: null });
    expect(fresh.record.events.map(event => event.kind)).toEqual(["CREATED"]);
    expect(fresh.photos).toEqual([]); expect(fresh.communication).toMatchObject({ version: 0, messages: [] }); expect(fresh.notes).toEqual([]);
    expect(fresh.work).toMatchObject({ priority: "NORMAL", assigneeLabel: null, dueAt: null }); expect(fresh.fact).toEqual({ current: null, revisions: [] });
    task10Absent(fresh, [], ["T10_VENDOR_REPORT_PRIVATE", "T10_VENDOR_PART_PRIVATE", "T10_MANAGER_NOTE_PRIVATE", "T10_MANAGER_ASSIGNEE_PRIVATE", "T10_FULL_QA_PRIVATE", "T10_MANAGER_PUBLIC_CLOSEOUT"]);
    expect(await task10SourceSnapshot(c.ticketId, c.assignmentId)).toEqual(before);
    expect((await task10Request("tenant", `tickets/${c.ticketId}/outcome/resolved`, { clientRequestId: randomUUID() })).status).toBe(409);
    expect((await task10Request("tenant", `tickets/${c.ticketId}/follow-up`, { ...input, clientRequestId: randomUUID() })).status).toBe(409);
  });
  it("T10-P03 actual role DTO serialization excludes private fields and Tenant raw completion-photo access is denied", async () => {
    const history = await task10Reported(); await task10Close(history);
    await task10Json("manager", `manager/tickets/${history.ticketId}/maintenance-fact`, { clientRequestId: randomUUID(), actionKind: "REPAIR", componentLabel: "T10_UNRELATED_FACT_PRIVATE" }, 201);
    const c = await task10Reported(), digest = f.data.accounts.manager.digest;
    await createCoreFlowPort(f.managerDatabase).run(digest, async s => {
      await s.manager.appendNote(c.ticketId, "T10_MANAGER_NOTE_PRIVATE");
      await s.manager.update(c.ticketId, { priority: "URGENT", assigneeLabel: "T10_MANAGER_ASSIGNEE_PRIVATE", dueAt: null, expectedVersion: 1 });
      await s.communication.send(c.ticketId, { clientRequestId: randomUUID(), expectedVersion: 0, intent: "MANAGER_UPDATE", body: "T10_FULL_QA_PRIVATE" });
    });
    const vendor = VendorJobDtoSchema.parse(await c.vendor.readJob(c.session));
    task10Absent(vendor, ["rawUserText", "tenantName", "tenantContact", "contact", "internalNotes", "assigneeLabel", "priority", "dueAt", "messages", "assignmentHistory", "reportHistory", "maintenanceFacts", "costs"], ["합성 비공개 접수 내용", "T10_MANAGER_NOTE_PRIVATE", "T10_MANAGER_ASSIGNEE_PRIVATE", "T10_FULL_QA_PRIVATE", "T10_UNRELATED_FACT_PRIVATE", history.ticketId, history.photoId]);
    expect(vendor.currentReport?.workSummary).toBe("T10_VENDOR_REPORT_PRIVATE");
    const manager = ManagerVendorHandoffDtoSchema.parse(await task10Json("manager", `manager/tickets/${c.ticketId}/vendor-handoff`));
    expect(manager.assignment?.vendorLabel).toBe("합성 업체"); expect(manager.currentReport?.completionPhotoIds).toEqual([c.photoId]);
    const scheduling = VendorTenantSchedulingDtoSchema.parse(await task10Json("tenant", `tickets/${c.ticketId}/vendor-scheduling`));
    const tenant = CoreTicketSchema.parse(await task10Json("tenant", `tickets/${c.ticketId}`));
    task10Absent({ scheduling, tenant }, ["vendorLabel", "currentReport", "completionPhotoIds", "componentOrPartNote", "reportHistory", "assignmentHistory", "internalNotes", "assigneeLabel", "priority", "dueAt"], [manager.assignment!.vendorLabel, "T10_VENDOR_REPORT_PRIVATE", "T10_VENDOR_PART_PRIVATE", "T10_MANAGER_NOTE_PRIVATE", "T10_MANAGER_ASSIGNEE_PRIVATE", c.photoId, "T10_UNRELATED_FACT_PRIVATE"]);
    const allowed = await task10Request("manager", `manager/tickets/${c.ticketId}/vendor-completion-photos/${c.photoId}`);
    expect(allowed.status).toBe(200); expect((await allowed.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await task10Request("tenant", `manager/tickets/${c.ticketId}/vendor-completion-photos/${c.photoId}`)).status).toBe(403);
    expect((await task10Request("tenant", `tickets/${c.ticketId}/vendor-completion-photos/${c.photoId}`)).status).toBe(404);
    await task10Close(c);
    const closedTenant = CoreTicketSchema.parse(await task10Json("tenant", `tickets/${c.ticketId}`));
    expect(closedTenant.workStatus).toBe("COMPLETED");
    task10Absent(closedTenant, ["vendorLabel", "completionPhotoIds", "componentOrPartNote", "assignmentHistory", "internalNotes", "assigneeLabel", "priority", "dueAt"], [manager.assignment!.vendorLabel, "T10_VENDOR_REPORT_PRIVATE", "T10_VENDOR_PART_PRIVATE", "T10_MANAGER_NOTE_PRIVATE", "T10_MANAGER_ASSIGNEE_PRIVATE", c.photoId]);
    expect((await task10Request("tenant", `manager/tickets/${c.ticketId}/vendor-completion-photos/${c.photoId}`)).status).toBe(403);
    expect((await task10Request("tenant", `tickets/${c.ticketId}/vendor-completion-photos/${c.photoId}`)).status).toBe(404);
  });
  it("T10-P04 Vendor report and closeout create no Fact; explicit Manager Fact uses only separately entered fields", async () => {
    const c = await task10Reported();
    expect(CoreMaintenanceFactDetailSchema.parse(await task10Json("manager", `manager/tickets/${c.ticketId}/maintenance-fact`))).toEqual({ current: null, revisions: [] });
    await task10Close(c);
    expect(await task10Json("manager", `manager/tickets/${c.ticketId}/maintenance-fact`)).toEqual({ current: null, revisions: [] });
    const before = await task10SourceSnapshot(c.ticketId, c.assignmentId), input = { clientRequestId: randomUUID(), actionKind: "INSPECTION", componentLabel: "T10_EXPLICIT_MANAGER_FACT" };
    const fact = CoreUnitMaintenanceFactSchema.parse(await task10Json("manager", `manager/tickets/${c.ticketId}/maintenance-fact`, input, 201));
    expect(fact).toMatchObject({ actionKind: "INSPECTION", componentLabel: input.componentLabel, tenantOutcome: "UNCONFIRMED", sourceTicketId: c.ticketId });
    task10Absent(fact, ["workSummary", "completionPhotos", "componentOrPartNote", "vendorLabel"], ["T10_VENDOR_REPORT_PRIVATE", "T10_VENDOR_PART_PRIVATE", c.photoId]);
    expect(await task10Json("manager", `manager/tickets/${c.ticketId}/maintenance-fact`, input)).toEqual(fact);
    expect((await task10Request("tenant", `manager/tickets/${c.ticketId}/maintenance-fact`)).status).toBe(403);
    expect(await task10SourceSnapshot(c.ticketId, c.assignmentId)).toEqual(before);
  });
});
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
    expect((await f.p.admin.query("SELECT has_schema_privilege('bm_core_flow_owner','core_flow','CREATE') AS allowed")).rows[0].allowed).toBe(false);
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
    expect((await f.web.query("SELECT current_user AS role,session_user AS login")).rows).toEqual([{ role: "bm_b1_web", login: "bm_b1_web" }]);
    await expect(f.web.query("SET ROLE bm_vendor_web")).rejects.toMatchObject({ code: "42501" });
    expect((await f.web.query("SELECT current_user AS role")).rows).toEqual([{ role: "bm_b1_web" }]);
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

  it("an owner bound to organization A cannot insert organization B work evidence, even with a permissive probe policy (Task7 review H1)", async () => {
    const b = await f.published("otherManager", "otherTenant");
    await owner(async client => {
      await client.query("SELECT set_config('app.org_id',$1,true)", [f.data.orgA]);
      await client.query("CREATE POLICY hostile_probe ON vendor_handoff.work_event TO bm_vendor_handoff_owner USING(true) WITH CHECK(true)");
      // The guard looks the assignment up under the caller's org A binding, so the org B row is refused by the guard itself.
      await expect(client.query("INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,blocker_code) VALUES($1,$2,'BLOCKER_RECORDED',$3,'OTHER')",
        [f.data.orgB, b.handoff.assignment!.id, b.handoff.currentPacket!.id])).rejects.toMatchObject({ message: "INVALID_PROVENANCE" });
    });
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1", [b.handoff.assignment!.id])).rows[0].n).toBe(0);
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

  it.each(["revoked", "rotated", "ended"] as const)("decline rechecks session, CSRF and assignment after the real source-ticket wait (%s)", async (change) => {
    const a = await issued(), request = randomUUID();
    const input = { clientRequestId: request, expectedAssignmentVersion: 3, expectedPacketRevisionId: a.handoff.currentPacket!.id, reason: "OTHER" as const, operationalNote: null };
    await f.p.admin.query("BEGIN"); await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE", [a.t.ticket.id]);
    const pending = f.externalWith(a.csrf).decline(a.session, input).then(() => "success", e => e.code);
    try {
      await waitForTicketWait();
      if (change === "revoked") await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1", [a.handoff.assignment!.id]);
      else if (change === "rotated") await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET csrf_digest=$2 WHERE assignment_id=$1", [a.handoff.assignment!.id, proof(hash("rotated-csrf"))]);
      else await f.p.admin.query("UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason='REVOKED',ended_at=clock_timestamp(),version=version+1 WHERE id=$1", [a.handoff.assignment!.id]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe(change === "rotated" ? "FORBIDDEN" : "UNAUTHENTICATED");
      const row = (await f.p.admin.query("SELECT status,end_reason,decline_reason FROM vendor_handoff.vendor_assignment WHERE id=$1", [a.handoff.assignment!.id])).rows[0];
      expect(row).toEqual(change === "ended" ? { status: "ENDED", end_reason: "REVOKED", decline_reason: null } : { status: "OFFERED", end_reason: null, decline_reason: null });
      expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1", [request])).rows[0].n).toBe(0);
    } finally { await f.p.admin.query("ROLLBACK"); }
  });

  it("CSRF refresh rechecks the session after the real source-ticket wait and leaves the stored CSRF unchanged", async () => {
    const a = await issued();
    const stored = async () => (await f.p.admin.query("SELECT encode(csrf_digest,'hex') AS c FROM vendor_handoff.vendor_session WHERE assignment_id=$1", [a.handoff.assignment!.id])).rows[0].c;
    const before = await stored();
    await f.p.admin.query("BEGIN"); await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE", [a.t.ticket.id]);
    const pending = f.external.refreshSession(a.session, hash("refreshed-csrf")).then(() => "success", e => e.code);
    try {
      await waitForTicketWait();
      await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1", [a.handoff.assignment!.id]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe("UNAUTHENTICATED");
      expect(await stored()).toBe(before);
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

  it("Task9 historical ENDED assignments still deny stale and unauthorized Manager digests",async()=>{
    const p=await f.prepared();await f.manager.revoke(f.data.accounts.manager.digest,p.handoff.assignment!.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:1});
    await f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)",[proof(f.data.accounts.manager.digest),p.t.ticket.id]);
    for(const who of ["tenant","otherManager"])await expect(f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)",[proof(f.data.accounts[who].digest),p.t.ticket.id])).rejects.toMatchObject({code:"P0002"});
    await expect(f.web.query("SELECT vendor_handoff.guard_direct_completion($1,$2)",[proof(hash("stale-manager")),p.t.ticket.id])).rejects.toMatchObject({code:"28000"});
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
    for (const table of ["vendor_assignment","work_packet_revision","work_packet_source_photo","command_receipt",...schedulingTables]) {
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
    // Cumulative exact inventory (Task5 review L4): every 0019-0022 Vendor table.
    const localTables = ["vendor_assignment","work_packet_revision","work_packet_source_photo","vendor_capability","vendor_session","command_receipt",...schedulingTables,...workTables,...completionTables];
    expect([...localTables].sort()).toEqual(tables);
    for (const role of ["bm_vendor_web","bm_b1_web"]) {
      for (const table of localTables) {
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
