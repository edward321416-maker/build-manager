import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";

const root = join(homedir(), ".build-manager-rc1-private");
const codes = async () => JSON.parse(await readFile(join(root, "access-codes.json"), "utf8")) as Record<string, string>;
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
// The logout below ends the session it signed in with. A session of its own keeps the shared tenant code alive for the
// files that run after this one (as maintenance-fact.spec.ts and ticket-outcome.spec.ts do).
let ownTenant = "";
test.beforeAll(async () => {
  const state = JSON.parse(await readFile(join(root, "state.json"), "utf8")); expect(state.admin.host).toBe("127.0.0.1"); expect(state.admin.database).toBe("core_flow_synthetic");
  const admin = new Client(state.admin), login = new Client(state.roles.b1.loginConfig); await admin.connect(); await login.connect();
  try {
    expect((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
    const account = state.fixture.accounts.tenant, identity = (await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'", [account.userId])).rows[0];
    expect(identity.issuer).toBe("https://rc1.synthetic.invalid/");
    const handle = randomBytes(32).toString("hex"), digest = createHash("sha256").update(handle).digest();
    await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes')", [identity.issuer, identity.subject, digest]);
    await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)", [digest, account.orgId]);
    ownTenant = handle;
  } finally { await login.end(); await admin.end(); }
});
async function login(page: Page, code: string) {
  await page.goto("/core"); await page.getByLabel("개발 접근 코드").fill(code);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}

test("development sign-in gets the same menu without organisations or move-in links (P5 spec D11)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, ownTenant);
  await menu(page).getByRole("link", { name: "내 정보", exact: true }).click();
  await expect(page.getByRole("region", { name: "내 정보", exact: true }).locator("[data-menu-row]")).toHaveText(["내 호실", "오픈소스 라이선스", "로그아웃"]);
  await expect(page.getByLabel("내 소속", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click(); await expect(page.getByLabel("개발 접근 코드")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page, (await codes()).manager);
  await expect(menu(page).getByRole("link")).toHaveText(["업무함", /^알림/, "호실 정비 이력", "내 정보"]);
  await expect(menu(page).getByText(/^(조직 관리자|건물 담당자)$/)).toBeVisible();
});
