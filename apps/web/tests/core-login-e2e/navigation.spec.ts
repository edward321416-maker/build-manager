import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { sdkSession } from "./session";

// P5 (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md): tab bar up to 767px, left menu from 768px.
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
const link = (page: Page, name: string | RegExp) => typeof name === "string" ? menu(page).getByRole("link", { name, exact: true }) : menu(page).getByRole("link", { name });
const round = (n: number) => Math.round(n);

test("phone tab bar: tabs, current mark, badge, re-tap to top, request screens without the bar", async ({ browser }) => {
  const tenant = await sdkSession(browser);
  try {
    // A saved request that was never sent is the tenant's own to-do (제출 전).
    const made = await tenant.context.request.post("/api/v2/core/tickets", { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: "LEAK", rawUserText: "합성 메뉴 처리할 일" } });
    expect(made.status()).toBe(201); const id = (await made.json()).ticketId as string;
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/core");
    await expect(page).toHaveURL(/\/core\?tab=home$/);
    await expect(menu(page).getByRole("link")).toHaveText(["우리 집", "내 요청", /^알림/, "내 정보"]);
    await expect(link(page, "우리 집")).toHaveAttribute("aria-current", "page");
    const bar = (await menu(page).boundingBox())!;
    expect(round(bar.height)).toBe(56); expect(round(bar.y + bar.height)).toBe(844);
    expect(new Set(await menu(page).getByRole("link").evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().width)))).size).toBe(1);
    // Rules 8.14: the content keeps the bar's height free at the bottom.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const footer = (await page.locator("footer.core-environment").boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(bar.y + 1);
    // Tapping the current tab again goes to the top.
    await page.evaluate(() => { document.body.style.minHeight = "3000px"; scrollTo(0, 600); });
    await link(page, "우리 집").click(); await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    // Keyboard: Tab walks the bar in order and Enter opens the tab.
    await link(page, "우리 집").focus(); await page.keyboard.press("Tab"); await expect(link(page, "내 요청")).toBeFocused();
    await page.keyboard.press("Enter"); await expect(page).toHaveURL(/tab=requests$/);
    // The badge sits 19 right and 5 above the icon, and its count is the number of to-do rows (rules 8.15).
    const alerts = link(page, /^알림, 처리할 일 \d+건$/); await expect(alerts).toBeVisible();
    const count = Number((await alerts.getAttribute("aria-label"))!.match(/(\d+)건/)![1]);
    const icon = (await alerts.locator("svg").boundingBox())!, badge = (await alerts.locator("span[aria-hidden]").boundingBox())!;
    expect(round(badge.x - icon.x)).toBe(19); expect(round(icon.y - badge.y)).toBe(5); expect(round(badge.height)).toBe(18);
    await alerts.click(); await expect(page).toHaveURL(/tab=alerts$/);
    await expect(page.locator("[data-todo-ticket]")).toHaveCount(count);
    const row = page.locator(`[data-todo-ticket="${id}"]`); await expect(row).toContainText("제출 전");
    // A request is a sub-screen: no tab bar, a back button, and browser back returns to 알림.
    await row.click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await expect(menu(page)).toBeHidden(); await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeVisible();
    await page.evaluate(() => history.back()); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
    await expect(link(page, /^알림/)).toHaveAttribute("aria-current", "page");
    // Unsent photos keep the request open on browser back, as the back button does.
    await row.click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await page.getByLabel("참고 사진 선택", { exact: true }).setInputFiles({ name: "nav-pending.png", mimeType: "image/png", buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: "#84aa96" } }).png().toBuffer() });
    await page.evaluate(() => history.back());
    await expect(page.getByText("목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.")).toBeVisible();
    await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await page.getByRole("button", { name: "사진 1 선택 취소", exact: true }).click();
    await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
  } finally { await tenant.close(); }
});

test("left menu from 768px: 248px, 더 보기 rows spread with icons, account area, first screens without back", async ({ browser }) => {
  const manager = await sdkSession(browser, "manager");
  try {
    const page = await manager.context.newPage(); await page.setViewportSize({ width: 768, height: 900 }); await page.goto("/core");
    await expect(menu(page)).toBeVisible();
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(round((await menu(page).boundingBox())!.width)).toBe(248);
      await expect(menu(page).getByRole("link")).toHaveText(["업무함", /^알림/, "호실 정비 이력", "입주 연결", "건물·호실 관리", "내 정보"]);
      expect(round((await link(page, "업무함").boundingBox())!.height)).toBe(50);
      await expect(menu(page).getByText(/ · 조직 관리자$/)).toBeVisible();
    }
    await link(page, "호실 정비 이력").click(); await expect(page).toHaveURL(/tab=more&view=maintenance$/);
    await expect(link(page, "호실 정비 이력")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeHidden();
    await link(page, "내 정보").click(); await expect(page.getByRole("heading", { level: 1, name: "내 정보" })).toBeVisible();
    const account = page.getByRole("region", { name: "내 정보", exact: true });
    await expect(account.getByLabel("내 소속", { exact: true })).toBeVisible();
    await account.getByRole("link", { name: "오픈소스 라이선스", exact: true }).click();
    await expect(page.getByText("Copyright (c) 2020-2026 Paweł Kuna")).toBeVisible();
    await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeVisible();
    await expect(link(page, "내 정보")).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(page).toHaveURL(/tab=more&view=me$/);
    await link(page, "건물·호실 관리").click(); await expect(page).toHaveURL(/\/workspace$/);
  } finally { await manager.close(); }
});

test("a manager's to-do opens in 업무함 and browser back returns to 알림", async ({ browser }) => {
  const tenant = await sdkSession(browser), manager = await sdkSession(browser, "manager");
  try {
    const made = await tenant.context.request.post("/api/v2/core/tickets", { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: "HEATING", rawUserText: "합성 관리자 답변 대기" } });
    expect(made.status()).toBe(201); const id = (await made.json()).ticketId as string;
    const asked = await tenant.context.request.post(`/api/v2/core/tickets/${id}/communication/messages`, { headers: tenant.headers, data: { clientRequestId: randomUUID(), expectedVersion: 0, intent: "TENANT_MESSAGE", body: "합성 세입자 문의예요." } });
    expect(asked.status()).toBe(201);
    const page = await manager.context.newPage(); await page.setViewportSize({ width: 1280, height: 900 }); await page.goto("/core?tab=alerts");
    const row = page.locator(`[data-todo-ticket="${id}"]`); await expect(row).toContainText("관리자 답변 대기");
    await row.click(); await expect(page).toHaveURL(/tab=work$/); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await expect(link(page, "업무함")).toHaveAttribute("aria-current", "page");
    await page.evaluate(() => history.back()); await expect(page).toHaveURL(/tab=alerts$/); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
    // Closing a request through the menu replaces its history entry, so one browser back returns to the screen before it.
    await row.click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await link(page, "호실 정비 이력").click(); await expect(page).toHaveURL(/tab=more&view=maintenance$/); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
    await page.evaluate(() => history.back()); await expect(page).toHaveURL(/tab=alerts$/); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
  } finally { await tenant.close(); await manager.close(); }
});

test("the address keeps the menu place, wrong places fall back, and an organisation change starts on the first tab", async ({ browser }) => {
  const tenant = await sdkSession(browser), two = await sdkSession(browser, "none");
  try {
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/core"); await expect(page).toHaveURL(/\/core\?tab=home$/); await page.reload(); await expect(page).toHaveURL(/\/core\?tab=home$/);
    await page.goto("/core?tab=work"); await expect(page).toHaveURL(/\/core\?tab=home$/);
    await page.goto("/core?tab=more&view=invitations"); await expect(page).toHaveURL(/\/core\?tab=home$/);
    await page.goto("/core?tab=me&view=licenses"); await expect(page.getByText("Copyright (c) 2020-2026 Paweł Kuna")).toBeVisible();
    await expect(menu(page)).toBeHidden();
    await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(page).toHaveURL(/\/core\?tab=me$/);
    await expect(page.getByRole("region", { name: "내 정보", exact: true })).toBeVisible();
    // An account in two organisations: switching from 내 정보 lands on that role's first tab (rules 8.16).
    const actor = (await two.admin.query("SELECT authn.current_actor($1) AS id", [two.digest])).rows[0].id;
    for (const org of [two.fixture.orgA, two.fixture.orgB]) await two.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')", [org, actor]);
    const admin = await two.context.newPage(); await admin.setViewportSize({ width: 1280, height: 900 }); await admin.goto("/core");
    await admin.getByLabel("내 소속", { exact: true }).selectOption(two.fixture.orgA); await expect(link(admin, "업무함")).toHaveAttribute("aria-current", "page");
    await link(admin, /^알림/).click(); await link(admin, "내 정보").click();
    await admin.getByRole("region", { name: "내 정보", exact: true }).getByLabel("내 소속", { exact: true }).selectOption(two.fixture.orgB);
    await expect(admin).toHaveURL(/\/core\?tab=work$/); await expect(link(admin, "업무함")).toHaveAttribute("aria-current", "page");
  } finally { await tenant.close(); await two.close(); }
});
