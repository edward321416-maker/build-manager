import type { TenantVendorSchedulingDto, VendorHandoffTenantPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { b1DigestCall } from "./common";

/**
 * Tenant scheduling port. Every read/mutation passes the request-scoped B1 digest; SQL derives the current
 * Tenant/occupancy through `vendor_handoff_tenant_context` (reads unlocked, mutations after the source-ticket lock).
 * `organization` binds the authenticated selection inside the same transaction as the command.
 */
export function createVendorHandoffTenantPort(database: PostgresDatabase, organization?: string): VendorHandoffTenantPort {
  const call = (digest: string, sql: string, values: unknown[]) =>
    b1DigestCall<TenantVendorSchedulingDto>(database, digest, sql, values, organization);
  return {
    readScheduling(digest, ticketId) {
      return call(digest, "SELECT vendor_handoff.tenant_read($1::bytea,$2::text) AS value", [ticketId]);
    },
    submitAvailability(digest, ticketId, input) {
      return call(digest,
        "SELECT vendor_handoff.tenant_submit_availability($1::bytea,$2::text,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::jsonb) AS value",
        [ticketId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion, input.expectedPacketRevisionId, JSON.stringify(input.windows)]);
    },
    authorizeEntry(digest, ticketId, input) {
      return call(digest,
        "SELECT vendor_handoff.tenant_authorize_entry($1::bytea,$2::text,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid,$8::uuid[]) AS value",
        [ticketId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion, input.expectedPacketRevisionId,
          input.availabilitySubmissionId, input.selectedWindowIds]);
    },
    confirmSlot(digest, ticketId, input) {
      return call(digest,
        "SELECT vendor_handoff.tenant_confirm_slot($1::bytea,$2::text,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid,$8::uuid) AS value",
        [ticketId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion, input.expectedPacketRevisionId,
          input.proposalId, input.selectedSlotId]);
    },
    reschedule(digest, ticketId, input) {
      return call(digest,
        "SELECT vendor_handoff.tenant_reschedule($1::bytea,$2::text,$3::uuid,$4::bigint,$5::bigint,$6::uuid,$7::uuid) AS value",
        [ticketId, input.clientRequestId, input.expectedAssignmentVersion, input.expectedRoundVersion, input.expectedAppointmentId, input.expectedPacketRevisionId]);
    },
  };
}
