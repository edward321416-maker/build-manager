import { randomBytes } from "node:crypto";
import type { ClientConfig } from "pg";
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
    await f.p.admin.query("ALTER ROLE bm_vendor_web PASSWORD $1", [password]);
    const vendorWebConfig: ClientConfig = {
      host: f.p.adminConfig.host,
      port: f.p.adminConfig.port,
      database: f.p.database,
      user: "bm_vendor_web",
      password,
    };
    return {
      ...f,
      data,
      vendorWebConfig,
      async close() { await f.close(); },
    };
  } catch (error) {
    await f.close();
    throw error;
  }
}
