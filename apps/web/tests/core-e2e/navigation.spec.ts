import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { accessCodes, mintOwnSession } from "./own-session";

const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
// The logout below ends the session it signed in with. A session of its own keeps the shared tenant code alive for the
// files that run after this one (as maintenance-fact.spec.ts and ticket-outcome.spec.ts do).
let ownTenant = "";
let tenantCode = "";
test.beforeAll(async () => { ownTenant = await mintOwnSession("tenant"); tenantCode = await mintOwnSession("tenant"); });
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
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page, (await accessCodes()).manager);
  await expect(menu(page).getByRole("link")).toHaveText(["업무함", /^알림/, "호실 정비 이력", "내 정보"]);
  await expect(menu(page).getByText(/^(조직 관리자|건물 담당자)$/)).toBeVisible();
});

const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
async function createOwn(page: Page, text: string) {
  const units = await (await page.request.get("/api/v2/core/units", { headers: bearer(tenantCode) })).json() as { id: string }[];
  const response = await page.request.post("/api/v2/core/tickets", { headers: bearer(tenantCode), data: { unitId: units[0].id, issueType: "LEAK", rawUserText: text } });
  expect(response.status()).toBe(201); return (await response.json() as { ticketId: string }).ticketId;
}

test("closing a request through its own tab leaves no dead back step (final review of PR 139)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createOwn(page, "합성 같은 탭으로 닫기"); await login(page, tenantCode); await expect(page).toHaveURL(/tab=home$/);
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click(); await expect(page).toHaveURL(/tab=requests$/);
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click();
  await expect(page.getByTestId("ticket-heading")).toHaveCount(0); await expect(page).toHaveURL(/tab=requests$/);
  await page.goBack(); await expect(page).toHaveURL(/tab=home$/);
});

// A plain create leaves the ticket as a tenant draft, which carries no manager to-do; a TENANT_MESSAGE on it is the
// same way the sdk suite gets a manager to-do row (core-login-e2e/navigation.spec.ts, "a manager's to-do opens in
// 업무함...").
async function createManagerTodo(page: Page, text: string) {
  const id = await createOwn(page, text);
  const asked = await page.request.post(`/api/v2/core/tickets/${id}/communication/messages`, { headers: bearer(tenantCode), data: { clientRequestId: randomUUID(), expectedVersion: 0, intent: "TENANT_MESSAGE", body: "합성 세입자 문의예요." } });
  expect(asked.status()).toBe(201); return id;
}

test("closing a manager's request opened from 알림 through the left menu leaves no dead back step (fix round 1)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createManagerTodo(page, "합성 알림에서 연 요청");
  await login(page, (await accessCodes()).manager); await expect(page).toHaveURL(/tab=work$/);
  await menu(page).getByRole("link", { name: /^알림/ }).click(); await expect(page).toHaveURL(/tab=alerts$/);
  const row = page.locator(`[data-todo-ticket="${id}"]`); await expect(row).toBeVisible();
  await row.click(); await expect(page).toHaveURL(/tab=work$/); await expect(page.getByTestId("ticket-heading")).toBeVisible();
  // Closing through 알림 — the place the request was opened from, not its own tab — must step back the same way,
  // collapsing the detail entry instead of leaving a duplicate 알림 entry behind it. Both the fix and the old,
  // dead-step bug show the same ?tab=alerts URL right after this click, so that alone cannot tell them apart: the
  // fix leaves history [work, alerts] (one more back lands on work); the old bug left [work, alerts, alerts] (one
  // more back does nothing, staying on alerts).
  await menu(page).getByRole("link", { name: /^알림/ }).click();
  await expect(page.getByTestId("ticket-heading")).toHaveCount(0); await expect(page).toHaveURL(/tab=alerts$/);
  await page.goBack(); await expect(page).toHaveURL(/tab=work$/);
});

test("opening a 더 보기 row puts focus on the new screen's title", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, (await accessCodes()).manager);
  await menu(page).getByRole("link", { name: "더 보기", exact: true }).click();
  await page.getByRole("region", { name: "더 보기", exact: true }).getByRole("link", { name: "호실 정비 이력", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "호실 정비 이력" })).toBeFocused();
});

test("closing a request with the back button puts focus on the list's title", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await createOwn(page, "합성 닫은 뒤 포커스"); await login(page, tenantCode);
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click(); await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "내 요청" })).toBeFocused();
});

test("from 768px a screen the left menu lists keeps the first-screen title (rules 8.10)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page, (await accessCodes()).manager);
  const font = () => page.getByRole("heading", { level: 1 }).evaluate(h => { const s = getComputedStyle(h); return `${s.fontSize} ${s.fontWeight} ${s.letterSpacing}`; });
  const first = await font();
  await menu(page).getByRole("link", { name: "호실 정비 이력", exact: true }).click(); await expect(page.getByRole("heading", { level: 1, name: "호실 정비 이력" })).toBeVisible();
  expect(await font()).toBe(first);
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "15px");
});

const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#759cac" } }).png().toBuffer();

test("a focused control on a first screen is never under the tab bar (rules 8.14)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 }); await login(page, tenantCode);
  await page.getByLabel("문제 설명").fill("합성 탭바 가림 확인");
  const submit = page.getByRole("button", { name: "접수하기", exact: true });
  const before = await page.evaluate(() => window.scrollY);
  await page.getByLabel("문제 설명").focus();
  for (let i = 0; i < 12 && !(await submit.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  const bar = (await menu(page).boundingBox())!, box = (await submit.boundingBox())!;
  // Rule 8.14: scroll-padding-bottom reserves the tab bar height plus 20px, so the focused control must clear the bar by
  // 20px, not just avoid overlap (core-design.module.css's focus-visible scroll-margin-block backs up the same 20px too).
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y - 20);
});

test("on a wide screen a menu click keeps a request with unsent photos open (spec §3)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createOwn(page, "합성 미전송 사진과 메뉴"); await login(page, tenantCode);
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click();
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
  await page.getByLabel("참고 사진 선택", { exact: true }).setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: await png() });
  await menu(page).getByRole("link", { name: "우리 집", exact: true }).click();
  await expect(page.getByTestId("ticket-heading")).toBeVisible(); await expect(page).toHaveURL(/tab=requests$/);
  await expect(page.getByText("목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.", { exact: true })).toBeVisible();
});

test("at 320px with 200% text every tab label stays on one line inside its cell (rules 8.14, 12)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await login(page, tenantCode);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const cells = await menu(page).getByRole("link").evaluateAll(links => links.filter(a => a.getClientRects().length).map(a => {
    const label = a.querySelector("span")!;
    return { text: label.textContent, lines: label.getClientRects().length, fits: label.getBoundingClientRect().width <= a.getBoundingClientRect().width + 0.5 };
  }));
  expect(cells.map(cell => cell.text)).toEqual(["우리 집", "내 요청", "알림", "내 정보"]);
  for (const cell of cells) expect(cell).toMatchObject({ lines: 1, fits: true });
});
