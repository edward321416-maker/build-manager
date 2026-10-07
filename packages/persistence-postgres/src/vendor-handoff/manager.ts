import { createHash, randomBytes } from "node:crypto";
import type {
  ManagerVendorHandoffDto,
  VendorHandoffManagerPort,
  VendorLinkIssueDto,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { b1DigestCall, notYetImplemented } from "./common";

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
    async revoke() { return notYetImplemented(); },
    async reassign() { return notYetImplemented(); },
    async requestCorrection() { return notYetImplemented(); },
    async requireFollowUp() { return notYetImplemented(); },
    reschedule(digest, assignmentId, input) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_reschedule($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid) AS value",
        [assignmentId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion, input.expectedAppointmentId, input.expectedPacketRevisionId],
        organization,
      );
    },
    async closeout() { return notYetImplemented(); },
    async completionPhoto() { return notYetImplemented(); },
  };
}
