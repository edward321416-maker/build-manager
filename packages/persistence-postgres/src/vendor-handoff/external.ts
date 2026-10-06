import type {
  VendorHandoffExternalPort,
  VendorJobDto,
  VendorSessionDto,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { notYetImplemented, vendorDigest, vendorJson } from "./common";

export function createVendorHandoffExternalPort(database: PostgresDatabase): VendorHandoffExternalPort {
  return {
    redeem(tokenDigest, clientRequestId, sessionDigest, csrfDigest) {
      return vendorJson<VendorSessionDto>(
        database,
        "SELECT vendor_handoff.redeem($1::bytea,$2::uuid,$3::bytea,$4::bytea) AS value",
        [vendorDigest(tokenDigest), clientRequestId, vendorDigest(sessionDigest), vendorDigest(csrfDigest)],
      );
    },
    logout(sessionDigest, clientRequestId) {
      return vendorJson<{ revoked: boolean }>(
        database,
        "SELECT vendor_handoff.logout($1::bytea,$2::uuid) AS value",
        [vendorDigest(sessionDigest), clientRequestId],
      );
    },
    session(sessionDigest) {
      return vendorJson<VendorSessionDto>(
        database,
        "SELECT vendor_handoff.session_info($1::bytea) AS value",
        [vendorDigest(sessionDigest)],
      );
    },
    readJob(sessionDigest) {
      return vendorJson<VendorJobDto>(
        database,
        "SELECT vendor_handoff.read_job($1::bytea) AS value",
        [vendorDigest(sessionDigest)],
      );
    },
    async accept() { return notYetImplemented(); },
    async decline() { return notYetImplemented(); },
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
