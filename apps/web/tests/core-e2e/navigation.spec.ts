import { test, expect, type Page } from "@playwright/test";
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
