import type {
  ManagerVendorHandoffDto,
  VendorHandoffManagerPort,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { notYetImplemented, vendorDigest, vendorJson } from "./common";

export function createVendorHandoffManagerPort(database: PostgresDatabase): VendorHandoffManagerPort {
  return {
    readHandoff(digest, ticketId) {
      return vendorJson<ManagerVendorHandoffDto>(
        database,
        "SELECT vendor_handoff.manager_read($1::bytea,$2::text) AS value",
        [vendorDigest(digest), ticketId],
      );
    },
    createAssignment(digest, ticketId, input) {
      return vendorJson<ManagerVendorHandoffDto>(
        database,
        "SELECT vendor_handoff.manager_create_assignment($1::bytea,$2::text,$3::uuid,$4::bigint,$5::text) AS value",
        [vendorDigest(digest), ticketId, input.clientRequestId, input.expectedTicketVersion, input.vendorLabel],
      );
    },
    publishPacket(digest, assignmentId, input) {
      return vendorJson<ManagerVendorHandoffDto>(
        database,
        "SELECT vendor_handoff.manager_publish_packet($1::bytea,$2::uuid,$3::uuid,$4::bigint,$5::uuid,$6::text,$7::text[],$8::uuid[],$9::text,$10::text) AS value",
        [
          vendorDigest(digest),
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
      );
    },
    issueLink() { return Promise.reject(notYetImplemented()); },
    reissueLink() { return Promise.reject(notYetImplemented()); },
    revoke() { return Promise.reject(notYetImplemented()); },
    reassign() { return Promise.reject(notYetImplemented()); },
    requestCorrection() { return Promise.reject(notYetImplemented()); },
    requireFollowUp() { return Promise.reject(notYetImplemented()); },
    reschedule() { return Promise.reject(notYetImplemented()); },
    closeout() { return Promise.reject(notYetImplemented()); },
    completionPhoto() { return Promise.reject(notYetImplemented()); },
  };
}
