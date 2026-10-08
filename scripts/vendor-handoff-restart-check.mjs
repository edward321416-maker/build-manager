import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";
import sharp from "sharp";
import { prepareVendorHandoff, startVendorHandoffServer } from "./vendor-handoff-dev.mjs";

assert.equal(process.version, "v24.21.0");
let stage = "prepare", server, admin, prepared, lastHTTP = "none";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const at = h => new Date(Date.now() + h * 3600000).toISOString();
const histories = ["vendor_assignment", "work_packet_revision", "work_packet_source_photo", "vendor_capability", "vendor_session", "scheduling_round", "tenant_availability_submission", "tenant_availability_window", "tenant_entry_authorization", "tenant_entry_authorization_window", "vendor_slot_proposal", "vendor_slot", "appointment", "work_event", "completion_report", "manager_disposition", "completion_photo", "command_receipt"];
try {
  prepared = await prepareVendorHandoff(); const { state } = prepared;
  admin = new Client(state.admin); await admin.connect();
  stage = "first-server"; server = await startVendorHandoffServer(state); const firstPid = server.pid;
  const coreResponse = (who, path, body) => {
    const a = state.fixture.accounts[who];
    return fetch(state.origin + "/api/v2/core/" + path, { method: body === undefined ? "GET" : "POST", headers: { Cookie: "__session=" + a.cookie, Origin: state.origin, "X-B1-CSRF": a.csrf, "X-Core-Organization": a.orgId, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  };
  const core = async (who, path, body, status = 200) => { const r = await coreResponse(who, path, body); lastHTTP = `${who}/${path.split("/").at(-1)}:status${r.status}:expected${status}`; assert.equal(r.status, status, "CORE_STATUS"); return r.json(); };
  const vendorResponse = (c, path, body, extra = {}) => fetch(state.origin + "/api/v2/vendor/" + path, { method: body === undefined ? "GET" : "POST", headers: { Cookie: c.cookie, Origin: state.origin, "x-vendor-csrf": c.csrf, "Content-Type": "application/json", ...extra }, ...(body === undefined ? {} : { body: typeof body === "object" && !(body instanceof Uint8Array) ? JSON.stringify(body) : body }) });
  const vendor = async (c, path, body) => { const r = await vendorResponse(c, path, body); lastHTTP = `vendor/${path.split("/").at(-1)}:status${r.status}:expected200`; assert.equal(r.status, 200, "VENDOR_STATUS"); return r.json(); };
  const ticket = async () => {
    const t = await core("tenant", "tickets", { unitId: state.fixture.unitA, issueType: "LEAK", rawUserText: "Task11 synthetic maintenance request" }, 201);
    await core("manager", `tickets/${t.ticketId}/decision`, { type: "OVERRIDE", routeCode: "GENERAL_VENDOR", reason: "Synthetic owned restart check" });
    return core("manager", `tickets/${t.ticketId}`);
  };
  const runCase = async preauthorized => {
    stage = preauthorized ? "preauthorized-case" : "resident-confirmation-case";
    const t = await ticket(), ticketId = t.ticketId;
    const sourceImage = await sharp({ create: { width: 10, height: 8, channels: 3, background: "#547e93" } }).png().toBuffer();
    const sourcePhotos = [];
    for (let index = 0; index < 2; index++) {
      const a = state.fixture.accounts.tenant;
      const response = await fetch(state.origin + `/api/v2/core/tickets/${ticketId}/photos`, { method: "POST", headers: { Cookie: "__session=" + a.cookie, Origin: state.origin, "X-B1-CSRF": a.csrf, "X-Core-Organization": a.orgId, "Content-Type": "image/png", "x-upload-id": randomUUID() }, body: new Uint8Array(sourceImage) });
      assert.equal(response.status, 201, "SOURCE_UPLOAD_STATUS"); sourcePhotos.push(await response.json());
    }
    let m = await core("manager", `manager/tickets/${ticketId}/vendor-assignment`, { clientRequestId: randomUUID(), expectedTicketVersion: t.version, vendorLabel: "Task11 synthetic vendor" }, 201);
    const assignmentId = m.assignment.id;
    for (const revision of [1, 2]) m = await core("manager", `manager/vendor-assignments/${assignmentId}/packet-revisions`, { clientRequestId: randomUUID(), expectedAssignmentVersion: m.assignment.version, expectedPacketRevisionId: m.currentPacket?.id ?? null, workSummary: "Synthetic packet revision " + revision, sharedDetailKeys: [], allowedPhotoIds: [sourcePhotos[0].photoId], accessPolicy: preauthorized ? "TENANT_PREAUTHORIZATION_ALLOWED" : "TENANT_PRESENT_REQUIRED", accessInstruction: null }, 201);
    const packetId = m.currentPacket.id;
    const linkInput = { clientRequestId: randomUUID(), expectedAssignmentVersion: m.assignment.version, expectedPacketRevisionId: packetId };
    const link = await core("manager", `manager/vendor-assignments/${assignmentId}/link`, linkInput, 201);
    const replayedLink = await core("manager", `manager/vendor-assignments/${assignmentId}/link`, linkInput);
    assert.equal(replayedLink.created, false); assert.equal("link" in replayedLink, false);
    const r = await fetch(state.origin + "/api/v2/vendor/session/redeem", { method: "POST", headers: { Origin: state.origin, Authorization: "VendorCapability " + link.link.split("#")[1], "Content-Type": "application/json" }, body: JSON.stringify({ clientRequestId: randomUUID() }) });
    assert.equal(r.status, 200, "REDEEM_STATUS");
    const redeemed = await r.json(), c = { cookie: r.headers.get("set-cookie").split(";")[0], csrf: redeemed.session.csrf, assignmentId, ticketId, packetId };
    const selectedSource = await vendorResponse(c, "job/source-photos/" + sourcePhotos[0].photoId); assert.equal(selectedSource.status, 200);
    const selectedSourceHash = hash(Buffer.from(await selectedSource.arrayBuffer()));
    assert.equal((await vendorResponse(c, "job/source-photos/" + sourcePhotos[1].photoId)).status, 404);
    let j = await vendor(c, "job/accept", { clientRequestId: randomUUID(), expectedAssignmentVersion: redeemed.job.assignmentVersion, expectedPacketRevisionId: packetId });
    const guards = async () => { const current = await vendor(c, "job"); return { expectedAssignmentVersion: current.assignmentVersion, expectedRoundVersion: current.currentRound.version, expectedPacketRevisionId: packetId }; };
    const window = preauthorized ? { startAt: new Date(Date.now() + 2000).toISOString(), endAt: at(1) } : { startAt: at(24), endAt: at(28) };
    const availability = await core("tenant", `tickets/${ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...await guards(), windows: [window] });
    if (preauthorized) {
      const selected = availability.availability.windows[0];
      await core("tenant", `tickets/${ticketId}/vendor-scheduling/entry-authorization`, { clientRequestId: randomUUID(), ...await guards(), availabilitySubmissionId: availability.availability.id, selectedWindowIds: [selected.id] });
      j = await vendor(c, "scheduling/preauthorized-appointment", { clientRequestId: randomUUID(), ...await guards(), availabilitySubmissionId: availability.availability.id, selectedWindowId: selected.id, startAt: new Date(Date.parse(selected.startAt) + 60000).toISOString(), endAt: new Date(Date.parse(selected.startAt) + 120000).toISOString() });
      assert.equal(j.appointment.confirmationMode, "PREAUTHORIZED_ENTRY");
      // Use the real clock and wait only for this explicitly authorized synthetic window to open.
      await delay(Math.max(0, Date.parse(selected.startAt) - Date.now() + 100));
    } else {
      j = await vendor(c, "scheduling/proposals", { clientRequestId: randomUUID(), ...await guards(), slots: [{ startAt: at(25), endAt: at(26) }] });
      await core("tenant", `tickets/${ticketId}/vendor-scheduling/confirm`, { clientRequestId: randomUUID(), ...await guards(), proposalId: j.proposal.id, selectedSlotId: j.proposal.slots[0].id });
      j = await vendor(c, "job"); assert.equal(j.appointment.confirmationMode, "TENANT_CONFIRMED");
    }
    j = await vendor(c, `appointments/${j.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...await guards() });
    assert.equal(j.appointment.status, "OCCURRED");
    const input = { clientRequestId: randomUUID(), expectedAssignmentVersion: j.assignmentVersion, expectedPacketRevisionId: packetId, expectedAppointmentId: j.appointment.id, expectedCorrectionRequestId: null };
    const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#496c82" } }).withExif({ IFD0: { Artist: "SYNTHETIC_TASK11" } }).jpeg().toBuffer();
    const uploadHeaders = { "Content-Type": "image/jpeg", "x-upload-id": input.clientRequestId, "x-vendor-upload-command": JSON.stringify(input) };
    const discarded = await vendorResponse(c, "job/completion-photos", new Uint8Array(image), uploadHeaders);
    assert.equal(discarded.status, 200, "UPLOAD_STATUS"); await discarded.body.cancel();
    // Authoritative context GET precedes exact same-key receipt reconciliation, across restarted Next instances.
    const current = await vendor(c, "job"); assert.equal(current.assignmentVersion, input.expectedAssignmentVersion); assert.equal(current.currentPacket.id, packetId); assert.equal(current.appointment.id, input.expectedAppointmentId);
    const uploadInstancePid = server.pid;
    await server.stop(); server = await startVendorHandoffServer(state); assert.notEqual(server.pid, uploadInstancePid);
    const replay = await vendorResponse(c, "job/completion-photos", new Uint8Array(image), uploadHeaders); assert.equal(replay.status, 200, "REPLAY_STATUS"); const photo = await replay.json();
    const photoResponse = await vendorResponse(c, "job/completion-photos/" + photo.photoId); assert.equal(photoResponse.status, 200);
    const stored = Buffer.from(await photoResponse.arrayBuffer()), metadata = await sharp(stored).metadata(); assert.equal(metadata.exif, undefined); assert.equal(metadata.width, 16); assert.equal(metadata.height, 12);
    assert.equal((await admin.query("SELECT count(*)::int n FROM vendor_handoff.completion_photo WHERE assignment_id=$1", [assignmentId])).rows[0].n, 1);
    assert.equal((await admin.query("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1", [input.clientRequestId])).rows[0].n, 1);
    const reportInput = { ...input, clientRequestId: randomUUID(), supersedesReportId: null, workSummary: "Task11 synthetic repair completed", componentOrPartNote: null, completionPhotoIds: [photo.photoId], photoOmissionReason: null };
    let report = await vendor(c, "completion-reports", reportInput);
    assert.deepEqual(await vendor(c, "completion-reports", reportInput), report);
    const initialReport = report;
    if (!preauthorized) {
      stage = "resident-correction-revision";
      const currentManager = await core("manager", `manager/tickets/${ticketId}/vendor-handoff`);
      const correctionInput = { clientRequestId: randomUUID(), expectedAssignmentVersion: currentManager.assignment.version, expectedCompletionReportId: initialReport.id, reason: "Task11 synthetic correction request" };
      const correction = await core("manager", `manager/vendor-assignments/${assignmentId}/completion-correction`, correctionInput);
      assert.deepEqual(await core("manager", `manager/vendor-assignments/${assignmentId}/completion-correction`, correctionInput), correction);
      const corrected = await vendor(c, "job"); assert.equal(corrected.correctionRequest.completionReportId, initialReport.id);
      const revisedInput = { ...reportInput, clientRequestId: randomUUID(), expectedAssignmentVersion: corrected.assignmentVersion, expectedCorrectionRequestId: corrected.correctionRequest.id, supersedesReportId: initialReport.id, workSummary: "Task11 synthetic corrected repair report" };
      report = await vendor(c, "completion-reports", revisedInput);
      assert.deepEqual(await vendor(c, "completion-reports", revisedInput), report);
      assert.notEqual(report.id, initialReport.id); assert.equal(report.revision, 2); assert.equal(report.supersedesReportId, initialReport.id);
      const revisedManager = await core("manager", `manager/tickets/${ticketId}/vendor-handoff`);
      assert.deepEqual(revisedManager.reportHistory.find(value => value.id === initialReport.id), initialReport);
      assert.equal(revisedManager.correctionRequest, null);
      const consumed = (await admin.query("SELECT consumed_by_report_id FROM vendor_handoff.manager_disposition WHERE id=$1", [corrected.correctionRequest.id])).rows[0];
      assert.equal(consumed.consumed_by_report_id, report.id);
    }
    return { ...c, preauthorized, photo, photoHash: hash(stored), uploadId: input.clientRequestId, reportId: report.id, initialReport, selectedSourceId: sourcePhotos[0].photoId, selectedSourceHash, unselectedSourceId: sourcePhotos[1].photoId };
  };
  const resident = await runCase(false), preauthorized = await runCase(true);
  stage = "resident-closeout";
  const manager = await core("manager", `manager/tickets/${resident.ticketId}/vendor-handoff`), communication = await core("manager", `tickets/${resident.ticketId}/communication`);
  const closeInput = { clientRequestId: randomUUID(), expectedAssignmentVersion: manager.assignment.version, expectedCompletionReportId: resident.reportId, expectedCommunicationVersion: communication.version, message: "Task11 synthetic public closeout" };
  const closed = await core("manager", `manager/vendor-assignments/${resident.assignmentId}/closeout`, closeInput); assert.equal(closed.assignment.status, "ENDED"); assert.equal(closed.assignment.endReason, "CLOSED");
  assert.deepEqual(await core("manager", `manager/vendor-assignments/${resident.assignmentId}/closeout`, closeInput), closed);
  stage = "ordinary-completion";
  const ordinary = await ticket();
  await core("manager", `tickets/${ordinary.ticketId}/handling`, { status: "IN_PROGRESS", message: "Task11 synthetic ordinary handling" });
  const ordinaryCommunication = await core("manager", `tickets/${ordinary.ticketId}/communication`);
  await core("manager", `tickets/${ordinary.ticketId}/handling`, { status: "COMPLETED", message: "Task11 synthetic ordinary completion", expectedCommunicationVersion: ordinaryCommunication.version });
  assert.equal((await core("manager", `tickets/${ordinary.ticketId}`)).workStatus, "COMPLETED");
  const snapshot = async () => {
    const result = { public: [], history: {} };
    for (const c of [resident, preauthorized]) {
      const m = await core("manager", `manager/tickets/${c.ticketId}/vendor-handoff`), t = await core("manager", `tickets/${c.ticketId}`);
      assert.equal(m.reportHistory.length, c.preauthorized ? 1 : 2); assert.equal(m.currentReport.id, c.reportId);
      assert.deepEqual(m.reportHistory.find(value => value.id === c.initialReport.id), c.initialReport);
      const binary = await coreResponse("manager", `manager/tickets/${c.ticketId}/vendor-completion-photos/${c.photo.photoId}`); assert.equal(binary.status, 200); assert.equal(hash(Buffer.from(await binary.arrayBuffer())), c.photoHash);
      const tenantPhoto = await coreResponse("tenant", `manager/tickets/${c.ticketId}/vendor-completion-photos/${c.photo.photoId}`); assert.equal(tenantPhoto.status, 403);
      assert.equal((await fetch(state.origin + "/api/v2/vendor/job", { headers: { Cookie: "__session=" + state.fixture.accounts.manager.cookie } })).status, 401);
      assert.equal((await fetch(state.origin + `/api/v2/core/tickets/${c.ticketId}`, { headers: { Cookie: c.cookie, Origin: state.origin, "X-Core-Organization": state.fixture.orgA } })).status, 401);
      const vendorJob = await vendorResponse(c, "job"); assert.equal(vendorJob.status, c.preauthorized ? 200 : 401);
      if (c.preauthorized) {
        const j = await vendorJob.json(); assert.equal(j.phase, "COMPLETION_REPORTED"); assert.equal(j.appointment.status, "OCCURRED");
        const selected = await vendorResponse(c, "job/source-photos/" + c.selectedSourceId); assert.equal(selected.status, 200); assert.equal(hash(Buffer.from(await selected.arrayBuffer())), c.selectedSourceHash);
        assert.equal((await vendorResponse(c, "job/source-photos/" + c.unselectedSourceId)).status, 404);
      }
      result.public.push({ manager: m, ticket: t, photoHash: c.photoHash });
    }
    // Hash every row of every durable Vendor table, including child windows and source-photo allowlists.
    // No row JSON, digests, credentials or photo bytes leave this process.
    for (const table of histories) result.history[table] = (await admin.query(`SELECT md5(row_to_json(t)::text) h FROM vendor_handoff.${table} t ORDER BY 1`)).rows.map(r => r.h);
    for (const [table, count] of [["vendor_assignment", 2], ["work_packet_revision", 4], ["work_packet_source_photo", 4], ["vendor_capability", 2], ["vendor_session", 2], ["scheduling_round", 2], ["appointment", 2], ["work_event", 2], ["completion_report", 3], ["completion_photo", 2], ["manager_disposition", 2], ["tenant_entry_authorization", 1]]) assert.equal(result.history[table].length, count, "DURABLE_HISTORY_COUNT");
    assert.ok(result.history.command_receipt.length >= 16, "DURABLE_RECEIPTS_REQUIRED");
    assert.equal((await core("manager", `tickets/${ordinary.ticketId}`)).workStatus, "COMPLETED");
    return result;
  };
  stage = "restart-snapshot"; const before = await snapshot(), beforePid = server.pid; await server.stop(); server = await startVendorHandoffServer(state); assert.notEqual(server.pid, beforePid); assert.deepEqual(await snapshot(), before);
  const counts = Object.fromEntries(Object.entries(before.history).map(([key, value]) => [key, value.length]));
  await writeFile(join(dirname(prepared.file), "restart-receipt.private.json"), JSON.stringify({ result: "VENDOR_HANDOFF_RESTART_PASS", stateFile: prepared.file, firstPid, beforePid, afterPid: server.pid, counts, cases: [resident, preauthorized].map(c => ({ ticketId: c.ticketId, assignmentId: c.assignmentId, photoId: c.photo.photoId, photoHash: c.photoHash, preauthorized: c.preauthorized })), ordinaryTicketId: ordinary.ticketId }), { mode: 0o600 });
  console.log("VENDOR_HANDOFF_RESTART_PASS | cases=2 | ownedNextRestart=true | SDK/B1=true | exactUploadReplay=true | sanitizedPhoto=true | oldSessionDenied=true | ordinaryCompletion=true | history=" + JSON.stringify(counts));
  // Only this private pointer is persisted; terminal output contains no credentials or capability/session bytes.
  await writeFile(join(dirname(prepared.file), "task12-state-path.txt"), prepared.file, { mode: 0o600 });
} catch {
  console.error("VENDOR_HANDOFF_RESTART_FAIL | stage=" + stage + " | lastHTTP=" + lastHTTP + " | private owned setup retained; no raw errors emitted"); process.exitCode = 1;
} finally { await server?.stop(); await admin?.end(); }
