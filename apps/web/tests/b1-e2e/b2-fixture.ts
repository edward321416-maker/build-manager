import { randomUUID } from 'node:crypto';
import type { Browser } from '@playwright/test';
import { fixtureSession } from './fixture-session';

export type B2WebFixture = Awaited<ReturnType<typeof fixtureSession>> & {
  propertyB: string;
  membershipId: string;
  assignmentId: string | null;
};

export async function fixtureB2Session(browser: Browser, role: 'ORG_ADMIN' | 'PROPERTY_STAFF', assigned: boolean): Promise<B2WebFixture> {
  const f = await fixtureSession(browser, role);
  try {
    const propertyB = randomUUID();
    const assignmentId = assigned ? randomUUID() : null;
    await f.change("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')", [propertyB, f.orgId]);
    await f.migration.query('BEGIN');
    let membershipId: string;
    try {
      await f.migration.query("SELECT set_config('app.org_id',$1,true)", [f.orgId]);
      const result = await f.migration.query<{ id: string }>("SELECT id FROM app.organization_membership WHERE org_id=$1 AND user_id=$2 AND role=$3 AND status='ACTIVE'", [f.orgId, f.userId, role]);
      if (result.rows.length !== 1) throw new Error('B2_SYNTHETIC_MEMBERSHIP_REQUIRED');
      membershipId = result.rows[0].id;
      await f.migration.query('COMMIT');
    } catch (error) {
      await f.migration.query('ROLLBACK');
      throw error;
    }
    if (assignmentId) await f.change("INSERT INTO app.property_assignment(id,org_id,membership_id,property_id,status) VALUES($1,$2,$3,$4,'ACTIVE')", [assignmentId, f.orgId, membershipId, f.propertyId]);
    return { ...f, propertyB, membershipId, assignmentId };
  } catch (error) {
    await f.close();
    throw error;
  }
}
