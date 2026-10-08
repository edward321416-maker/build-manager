import { createHash, randomBytes } from "node:crypto";
import {
  VendorHandoffError,
  type ManagerVendorHandoffDto,
  type VendorCompletionPhotoDto,
  type VendorHandoffManagerPort,
  type VendorLinkIssueDto,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { b1DigestCall } from "./common";

// Routing selection is authenticated again and held through the actual operation.
// A committed preflight binding alone cannot isolate concurrent selections.
const managerCall = b1DigestCall;

export function createVendorHandoffManagerPort(database: PostgresDatabase, organization?: string): VendorHandoffManagerPort {
  return {
    readHandoff(digest, ticketId) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_read($1::bytea,$2::text) AS value",
        [ticketId],
        organization,
      );
    },
    createAssignment(digest, ticketId, input) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_create_assignment($1::bytea,$2::text,$3::uuid,$4::bigint,$5::text) AS value",
        [ticketId, input.clientRequestId, input.expectedTicketVersion, input.vendorLabel],
        organization,
      );
    },
    publishPacket(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_publish_packet($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::text,$7::text[],$8::uuid[],$9::text,$10::text) AS value",
        [
          assignmentId,
          input.clientRequestId,
          input.expectedAssignmentVersion,
          input.expectedPacketRevisionId,
          input.workSummary,
          input.sharedDetailKeys,
          input.allowedPhotoIds,
          input.accessPolicy,
          input.accessInstruction,
        ],
        organization,
      );
    },
    async issueLink(digest, assignmentId, input) {
      const raw = randomBytes(32).toString("base64url");
      const tokenDigest = createHash("sha256").update(raw).digest();
      const state = await managerCall<{ created: boolean; assignmentId: string; assignmentVersion: number; expiresAt: string }>(
        database,
        digest,
        "SELECT vendor_handoff.manager_issue_link($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::bytea,false) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId, tokenDigest],
        organization,
      );
      if (!state.created) return { ...state, created: false } satisfies VendorLinkIssueDto;
      return { created: true, assignmentId: state.assignmentId, assignmentVersion: state.assignmentVersion, link: `/vendor/job#${raw}`, expiresAt: state.expiresAt } satisfies VendorLinkIssueDto;
    },
    async reissueLink(digest, assignmentId, input) {
      const raw = randomBytes(32).toString("base64url");
      const tokenDigest = createHash("sha256").update(raw).digest();
      const state = await managerCall<{ created: boolean; assignmentId: string; assignmentVersion: number; expiresAt: string }>(
        database,
        digest,
        "SELECT vendor_handoff.manager_issue_link($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::bytea,true) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedPacketRevisionId, tokenDigest],
        organization,
      );
      if (!state.created) return { ...state, created: false } satisfies VendorLinkIssueDto;
      return { created: true, assignmentId: state.assignmentId, assignmentVersion: state.assignmentVersion, link: `/vendor/job#${raw}`, expiresAt: state.expiresAt } satisfies VendorLinkIssueDto;
    },
    revoke(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(database, digest,
        "SELECT vendor_handoff.manager_revoke($1::bytea,$2::uuid,$3::uuid,$4::bigint) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion], organization);
    },
    reassign(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(database, digest,
        "SELECT vendor_handoff.manager_reassign($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::text) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.vendorLabel], organization);
    },
    requestCorrection(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(database, digest,
        "SELECT vendor_handoff.manager_request_correction($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::text) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedCompletionReportId, input.reason], organization);
    },
    requireFollowUp(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(database, digest,
        "SELECT vendor_handoff.manager_require_follow_up($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedCompletionReportId], organization);
    },
    reschedule(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_reschedule($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion, input.expectedAppointmentId, input.expectedPacketRevisionId],
        organization,
      );
    },
    closeout(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(database, digest,
        "SELECT vendor_handoff.closeout($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::bigint,$7::text) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedCompletionReportId, input.expectedCommunicationVersion, input.message], organization);
    },
    async completionPhoto(digest, ticketId, photoId) {
      const value = await managerCall<{ photo: VendorCompletionPhotoDto; content: string }>(
        database,
        digest,
        "SELECT vendor_handoff.manager_completion_photo($1::bytea,$2::text,$3::uuid) AS value",
        [ticketId, photoId],
        organization,
      );
      const bytes = new Uint8Array(Buffer.from(value.content, "base64"));
      if (bytes.byteLength !== value.photo.byteSize) throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
      return { photo: value.photo, bytes };
    },
  };
}
