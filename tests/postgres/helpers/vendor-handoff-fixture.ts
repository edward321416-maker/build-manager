import { randomBytes, randomUUID } from "node:crypto";
import type { ClientConfig } from "pg";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createVendorHandoffExternalPort, createVendorHandoffManagerPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { performCoreAction, type VendorPublishPacketCommand } from "@build-manager/application";
import { seedCoreFlowFixture } from "@build-manager/persistence-postgres/testing";
import { createB1Fixture } from "./b1-fixture";

export async function createVendorHandoffFixture() {
  const f = await createB1Fixture();
  try {
    await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
    const data = await seedCoreFlowFixture(f.p.admin, f.login);
    await f.p.admin.query(`
      UPDATE core_flow.building_context
      SET body = body || jsonb_build_object('serviceAddress','합성 테스트 주소')
    `);
    const password = `vw_${randomBytes(24).toString("hex")}`;
    await f.p.admin.query(`ALTER ROLE bm_vendor_web PASSWORD '${password}'`);
    const vendorWebConfig: ClientConfig = {
      host: f.p.adminConfig.host,
      port: f.p.adminConfig.port,
      database: f.p.database,
      user: "bm_vendor_web",
      password,
    };
    const managerDatabase = createPostgresDatabase(f.roles.b1.webConfig);
    const vendorDatabase = createPostgresDatabase(vendorWebConfig);
    const manager = createVendorHandoffManagerPort(managerDatabase);
    const external = createVendorHandoffExternalPort(vendorDatabase);
    async function ticket(who = "tenant", route = "GENERAL_VENDOR", issueType: "LEAK" | "HEATING" = "LEAK") {
      const account = data.accounts[who];
      const result = await createCoreFlowPort(managerDatabase).run(account.digest, s => performCoreAction(s,
        { type: "CREATE", unitId: who === "otherTenant" ? data.unitB : data.unitA, issueType, rawUserText: "합성 비공개 접수 내용" },
        { now: () => new Date().toISOString() }, { next: () => randomUUID() }));
      // Controlled foundation fixture: Core route approval itself is frozen and tested elsewhere.
      await f.p.admin.query("UPDATE core_flow.ticket SET body=jsonb_set(body,'{routeDecision}',$2::jsonb) WHERE id=$1",
        [result.ticket.id, JSON.stringify({ action: "OVERRIDE_ROUTE", recommendedRoute: null, selectedRoute: route, actor: "LANDLORD", decidedAt: new Date().toISOString() })]);
      return result;
    }
    async function prepared(who = "manager", tenant = "tenant") {
      const t = await ticket(tenant);
      const handoff = await manager.createAssignment(data.accounts[who].digest, t.ticket.id,
        { clientRequestId: randomUUID(), expectedTicketVersion: t.version, vendorLabel: "합성 업체" });
      return { t, handoff };
    }
    async function published(who = "manager", tenant = "tenant", overrides: Partial<VendorPublishPacketCommand> = {}) {
      const { t, handoff } = await prepared(who, tenant);
      const input: VendorPublishPacketCommand = { clientRequestId: randomUUID(), expectedAssignmentVersion: handoff.assignment!.version,
        expectedPacketRevisionId: null, workSummary: "합성 누수 점검", sharedDetailKeys: [], allowedPhotoIds: [],
        accessPolicy: "TENANT_PRESENT_REQUIRED", accessInstruction: null, ...overrides };
      const packet = await manager.publishPacket(data.accounts[who].digest, handoff.assignment!.id, input);
      return { t, handoff: packet, input };
    }
    return {
      ...f,
      data,
      vendorWebConfig,
      managerDatabase, vendorDatabase, manager, external, ticket, prepared, published,
      async close() { await managerDatabase.close(); await vendorDatabase.close(); await f.close(); },
    };
  } catch (error) {
    await f.close();
    throw error;
  }
}
