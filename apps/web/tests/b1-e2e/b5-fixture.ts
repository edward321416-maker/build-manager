import { randomUUID } from "node:crypto";
import type { Browser } from "@playwright/test";
import { createB4Fixture } from "./b4-fixture";
import { fixtureSession, baseURL } from "./fixture-session";
import { queryFixture } from "./b3-fixture";

export async function createB5Fixture(browser: Browser) {
  const f=await createB4Fixture(browser);
  const extra: Awaited<ReturnType<typeof fixtureSession>>[]=[];
  return {...f,
    async addAdmin() {
      const session=await fixtureSession(browser,"NONE"); extra.push(session);
      const membershipId=randomUUID();
      await f.change("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[membershipId,f.orgId,session.userId]);
      return {...session,membershipId};
    },
    async members() {return (await queryFixture(f,"SELECT row_to_json(m) AS row FROM app.organization_membership m WHERE org_id=$1 ORDER BY id",[f.orgId])).rows.map(r=>r.row);},
    async close() {try {for(const session of extra) await session.close();} finally {await f.close();}},
  };
}
export type B5Fixture=Awaited<ReturnType<typeof createB5Fixture>>;
export const membershipPath=(f:{orgId:string},membershipId:string)=>`/api/v2/organizations/${f.orgId}/memberships/${membershipId}`;
export const b5Headers=(f:{csrf:string})=>({origin:baseURL,"x-b1-csrf":f.csrf});
