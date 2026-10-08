import { provisionTestRoles as provisionBaseTestRoles } from "./roles";
import { provisionVendorHandoffTestRoles } from "./vendor-handoff-roles";

export { grantRuntimeAccess, TEST_MIGRATION_ROLE, TEST_RUNTIME_ROLE } from "./roles";
export type { TestRoleCredentials } from "./roles";
export async function provisionTestRoles(...args: Parameters<typeof provisionBaseTestRoles>) {
  const result = await provisionBaseTestRoles(...args);
  await provisionVendorHandoffTestRoles(args[0], { host: args[1].host, port: args[1].port, database: args[2] }, "bm_pf02a_migrator");
  return result;
}
export * from "./postgres-container";
export * from "./migrate";
export * from "./b4-roles";
export * from "./b5-roles";
export * from "./vendor-handoff-roles";
export * from "./core-flow-fixture";
export { provisionCoreAccessTestRole,provisionCoreOnboardingTestRole } from "./core-flow-roles";
