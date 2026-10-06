import { createHash, randomBytes } from "node:crypto";
import {
  VendorHandoffError,
  type ManagerVendorHandoffDto,
  type VendorHandoffManagerPort,
  type VendorLinkIssueDto,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { notYetImplemented, vendorDigest, vendorTransaction } from "./common";

async function managerCall<T>(
  database: PostgresDatabase,
  digest: string,
  sql: string,
  values: unknown[],
): Promise<T> {
  const hash = vendorDigest(digest);
  return vendorTransaction(database, async (client) => {
    // Server-derived B1 session binding supplies routing context. No client org id is accepted.
    await client.query("SELECT core_flow.session($1::bytea)", [hash]);
    const result = await client.query<{ value: T }>(sql, [hash, ...values]);
    const value = result.rows[0]?.value;
    if (value === undefined || value === null) throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    return value;
  });
}

export function createVendorHandoffManagerPort(database: PostgresDatabase): VendorHandoffManagerPort {
  return {
    readHandoff(digest, ticketId) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_read($1::bytea,$2::text) AS value",
        [ticketId],
      );
    },
    createAssignment(digest, ticketId, input) {
      return managerCall<ManagerVendorHandoffDto>(
        database,
        digest,
        "SELECT vendor_handoff.manager_create_assignment($1::bytea,$2::text,$3::uuid,$4::bigint,$5::text) AS value",
        [ticketId, input.clientRequestId, input.expectedTicketVersion, input.vendorLabel],
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
      );
      if (!state.created) return { ...state, created: false } satisfies VendorLinkIssueDto;
      return { created: true, assignmentId: state.assignmentId, assignmentVersion: state.assignmentVersion, link: `/vendor/job#${raw}`, expiresAt: state.expiresAt } satisfies VendorLinkIssueDto;
    },
    async revoke() { return notYetImplemented(); },
    async reassign() { return notYetImplemented(); },
    async requestCorrection() { return notYetImplemented(); },
    async requireFollowUp() { return notYetImplemented(); },
    async reschedule() { return notYetImplemented(); },
    async closeout() { return notYetImplemented(); },
    async completionPhoto() { return notYetImplemented(); },
  };
}
