import {
  VendorHandoffError,
  type VendorCompletionPhotoDto,
  type VendorCompletionReportDto,
  type VendorHandoffExternalPort,
  type VendorJobDto,
  type VendorSessionDto,
  type VendorSourcePhotoDto,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { vendorDigest, vendorJson, vendorTransaction } from "./common";

/**
 * `csrfDigest` is the request-local digest of the presented server-issued CSRF value. Mutations pass it
 * explicitly to SQL, which compares it with the authenticated session after the source-ticket wait.
 * Without it, every mutation fails closed before reaching the database.
 */
export function createVendorHandoffExternalPort(database: PostgresDatabase, csrfDigest?: string): VendorHandoffExternalPort {
  const presentedCsrf = () => {
    if (csrfDigest === undefined) throw new VendorHandoffError("UNAUTHENTICATED");
    return vendorDigest(csrfDigest);
  };
  return {
    redeem(tokenDigest, clientRequestId, sessionDigest, csrfDigest) {
      return vendorJson<VendorSessionDto>(
        database,
        "SELECT vendor_handoff.redeem($1::bytea,$2::uuid,$3::bytea,$4::bytea) AS value",
        [vendorDigest(tokenDigest), clientRequestId, vendorDigest(sessionDigest), vendorDigest(csrfDigest)],
      );
    },
    async logout(sessionDigest, clientRequestId) {
      return vendorJson<{ revoked: boolean }>(
        database,
        "SELECT vendor_handoff.logout($1::bytea,$2::bytea,$3::uuid) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), clientRequestId],
      );
    },
    session(sessionDigest) {
      return vendorJson<VendorSessionDto>(
        database,
        "SELECT vendor_handoff.session_info($1::bytea) AS value",
        [vendorDigest(sessionDigest)],
      );
    },
    async refreshSession(sessionDigest, nextCsrfDigest) {
      return vendorJson<VendorSessionDto>(
        database,
        "SELECT vendor_handoff.refresh_session($1::bytea,$2::bytea) AS value",
        [vendorDigest(sessionDigest), vendorDigest(nextCsrfDigest)],
      );
    },
    readJob(sessionDigest) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.read_job($1::bytea) AS value",
        [vendorDigest(sessionDigest)],
      );
    },
    async readSourcePhoto(sessionDigest, photoId) {
      const session = vendorDigest(sessionDigest);
      return vendorTransaction(database, async (client) => {
        const result = await client.query<{ metadata: VendorSourcePhotoDto; content: Buffer }>(
          "SELECT metadata,content FROM vendor_handoff.read_source_photo($1::bytea,$2::uuid)",
          [session, photoId],
        );
        const row = result.rows[0];
        if (!row) throw new VendorHandoffError("NOT_FOUND");
        return { photo: row.metadata, bytes: new Uint8Array(row.content) };
      });
    },
    async accept(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.accept($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId],
      );
    },
    async decline(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.decline($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid,$6::text,$7::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion,
          input.expectedPacketRevisionId, input.reason, input.operationalNote],
      );
    },
    async withdraw(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.withdraw($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid,$6::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId, input.operationalNote],
      );
    },
    async proposeSlots(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.propose_slots($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::jsonb) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion,
          input.expectedPacketRevisionId, JSON.stringify(input.slots)],
      );
    },
    async selectPreauthorizedSlot(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.select_preauthorized_slot($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid,$8::uuid,$9::text,$10::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion,
          input.expectedPacketRevisionId, input.availabilitySubmissionId, input.selectedWindowId, input.startAt, input.endAt],
      );
    },
    async reschedule(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.vendor_reschedule($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion,
          input.expectedAppointmentId, input.expectedPacketRevisionId],
      );
    },
    async startVisit(sessionDigest, appointmentId, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.start_visit($1::bytea,$2::bytea,$3::uuid,$4::uuid,$5::bigint,$6::bigint,$7::uuid) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, appointmentId, input.expectedAssignmentVersion,
          input.expectedRoundVersion, input.expectedPacketRevisionId],
      );
    },
    async recordBlocker(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.record_blocker($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid,$6::text,$7::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId,
          input.blockerCode, input.operationalNote],
      );
    },
    async clearBlocker(sessionDigest, blockerId, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.clear_blocker($1::bytea,$2::bytea,$3::uuid,$4::uuid,$5::bigint,$6::uuid,$7::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, blockerId, input.expectedAssignmentVersion,
          input.expectedPacketRevisionId, input.operationalNote],
      );
    },
    async uploadCompletionPhoto(sessionDigest, input, sanitized) {
      if (!/^[0-9a-f]{64}$/.test(sanitized.sha256)) throw new VendorHandoffError("INVALID_INPUT");
      return vendorJson<VendorCompletionPhotoDto>(
        database,
        "SELECT vendor_handoff.upload_completion_photo($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid,$6::uuid,$7::uuid,$8::text,$9::integer,$10::integer,$11::integer,$12::bytea,$13::bytea) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId,
          input.expectedAppointmentId, input.expectedCorrectionRequestId, sanitized.mime, sanitized.byteSize, sanitized.width, sanitized.height,
          Buffer.from(sanitized.sha256, "hex"), Buffer.from(sanitized.bytes)],
      );
    },
    async submitCompletionReport(sessionDigest, input) {
      return vendorJson<VendorCompletionReportDto>(
        database,
        "SELECT vendor_handoff.submit_completion_report($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::text,$10::text,$11::uuid[],$12::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId,
          input.expectedAppointmentId, input.expectedCorrectionRequestId, input.supersedesReportId, input.workSummary, input.componentOrPartNote,
          input.completionPhotoIds, input.photoOmissionReason],
      );
    },
    async readCompletionPhoto(sessionDigest, photoId) {
      const session = vendorDigest(sessionDigest);
      return vendorTransaction(database, async (client) => {
        const result = await client.query<{ metadata: VendorCompletionPhotoDto; content: Buffer }>(
          "SELECT metadata,content FROM vendor_handoff.read_completion_photo($1::bytea,$2::uuid)",
          [session, photoId],
        );
        const row = result.rows[0];
        if (!row) throw new VendorHandoffError("NOT_FOUND");
        return { photo: row.metadata, bytes: new Uint8Array(row.content) };
      });
    },
  };
}
