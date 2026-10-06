import {
  VendorHandoffError,
  type VendorHandoffExternalPort,
  type VendorJobDto,
  type VendorSessionDto,
  type VendorSourcePhotoDto,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { notYetImplemented, vendorDigest, vendorJson, vendorTransaction } from "./common";

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
    async accept() { return notYetImplemented(); },
    async decline(sessionDigest, input) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.decline($1::bytea,$2::bytea,$3::uuid,$4::bigint,$5::uuid,$6::text,$7::text) AS value",
        [vendorDigest(sessionDigest), presentedCsrf(), input.clientRequestId, input.expectedAssignmentVersion,
          input.expectedPacketRevisionId, input.reason, input.operationalNote],
      );
    },
    async withdraw() { return notYetImplemented(); },
    async proposeSlots() { return notYetImplemented(); },
    async selectPreauthorizedSlot() { return notYetImplemented(); },
    async reschedule() { return notYetImplemented(); },
    async startVisit() { return notYetImplemented(); },
    async recordBlocker() { return notYetImplemented(); },
    async clearBlocker() { return notYetImplemented(); },
    async uploadCompletionPhoto() { return notYetImplemented(); },
    async submitCompletionReport() { return notYetImplemented(); },
  };
}
