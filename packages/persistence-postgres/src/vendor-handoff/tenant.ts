import type { VendorHandoffTenantPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { notYetImplemented } from "./common";

export function createVendorHandoffTenantPort(_database: PostgresDatabase): VendorHandoffTenantPort {
  return {
    async readScheduling() { return notYetImplemented(); },
    async submitAvailability() { return notYetImplemented(); },
    async authorizeEntry() { return notYetImplemented(); },
    async confirmSlot() { return notYetImplemented(); },
    async reschedule() { return notYetImplemented(); },
  };
}
