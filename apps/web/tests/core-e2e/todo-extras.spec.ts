import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mintOwnSession } from "./own-session";

// P5 PR 2 (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md §5): 결과 확인 and 기한 지남 on 알림, the
// 20-request limit and four reads at once. Development sign-in: no Vendor or link-request reads here.
let tenant = "", manager = "";
test.beforeAll(async () => { tenant = await mintOwnSession("tenant"); manager = await mintOwnSession("manager"); });
// A list read can still be in flight when a test ends; drop it instead of failing on a route that outlived the test.
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });
const bearer = (code: string) => ({ Authorization: `Bearer ${code}` });
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
async function login(page: Page, code: string, path = "/core") {
  await page.goto(path); await page.getByLabel("개발 접근 코드").fill(code);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}
/** Lists only the requests this test made, as home.spec.ts does: the shared fixture keeps every other file's requests. */
async function onlyMine(page: Page, mine: string[]) {
  await page.route("**/api/v2/core/tickets", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(), all = await response.json() as { ticketId: string }[];
    await route.fulfill({ response, json: all.filter(ticket => mine.includes(ticket.ticketId)) });
  });
}
async function api(page: Page, code: string, path: string, data?: unknown, status = 200) {
  const response = data === undefined ? await page.request.get(`/api/v2/core/${path}`, { headers: bearer(code) })
    : await page.request.post(`/api/v2/core/${path}`, { headers: bearer(code), data });
  expect(response.status()).toBe(status); return response.json();
}
async function create(page: Page, text: string) {
  const units = await api(page, tenant, "units") as { id: string }[];
  return (await api(page, tenant, "tickets", { unitId: units[0].id, issueType: "LEAK", rawUserText: text }, 201)).ticketId as string;
}
/** The manager finishes a request, as ticket-outcome.spec.ts does. */
async function finish(page: Page, id: string) {
  await api(page, manager, `tickets/${id}/handling`, { status: "IN_PROGRESS", message: "합성 처리 시작" });
  const version = (await api(page, tenant, `tickets/${id}/communication`)).version;
  await api(page, manager, `tickets/${id}/handling`, { status: "COMPLETED", message: "합성 완료 기록", expectedCommunicationVersion: version });
}

test("a finished request with an unconfirmed result is the tenant's to-do until they answer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  const id = await create(page, "합성 결과 확인 요청"); mine.push(id); await finish(page, id);
  await login(page, tenant);
  await menu(page).getByRole("link", { name: /^알림/ }).click();
  const row = page.locator(`[data-todo-ticket="${id}"]`);
  await expect(row).toContainText("결과 확인 필요");
  await expect(menu(page).getByRole("link", { name: "알림, 처리할 일 1건", exact: true })).toBeVisible();
  await row.click(); await page.getByRole("button", { name: "해결됐어요", exact: true }).click();
  await expect(page.getByText("해결됐다고 알려주셨어요.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page.locator(`[data-todo-ticket="${id}"]`)).toHaveCount(0);
  await expect(page.getByText("지금 처리할 일이 없어요. 새 문제가 생기면 홈에서 접수해 주세요.", { exact: true })).toBeVisible();
});

test("results are read for the 20 most recent finished requests only, four at a time, and 알림 says so", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  for (let n = 0; n < 21; n++) { const id = await create(page, `합성 끝난 요청 ${n}`); await finish(page, id); mine.push(id); }
  const read = new Set<string>(); let open = 0, most = 0;
  await page.route("**/api/v2/core/tickets/*/outcome", async route => {
    if (route.request().method() !== "GET") return route.continue();
    read.add(new URL(route.request().url()).pathname.split("/").at(-2)!);
    open++; most = Math.max(most, open);
    await new Promise(resolve => setTimeout(resolve, 150));
    const response = await route.fetch(); open--;
    await route.fulfill({ response });
  });
  // Opened straight on 알림: tapping the tab would start a second pass while the first is in flight.
  await login(page, tenant, "/core?tab=alerts");
  const todo = page.locator('section[aria-label="처리할 일"]');
  await expect(todo).toBeVisible(); await expect(todo).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator("[data-todo-ticket]")).toHaveCount(20);
  await expect(page.getByText("최근 끝난 요청 20건만 확인해요.", { exact: true })).toBeVisible();
  // mine[0] finished first, so it is the one past the limit.
  expect(read.has(mine[0])).toBe(false);
  expect(read.size).toBe(20);
  expect(most).toBe(4);
});

test("a manager's request past its due date is on 알림 as 기한 지남, above the replies", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const mine: string[] = []; await onlyMine(page, mine);
  const late = await create(page, "합성 기한 지남 요청"); mine.push(late);
  await api(page, manager, `manager/tickets/${late}/work`, { priority: "NORMAL", assigneeLabel: "합성 담당", dueAt: new Date(Date.now() - 86_400_000).toISOString(), expectedVersion: 1 });
  const reply = await create(page, "합성 관리자 답변 대기"); mine.push(reply);
  await api(page, tenant, `tickets/${reply}/communication/messages`, { clientRequestId: randomUUID(), expectedVersion: 0, intent: "TENANT_MESSAGE", body: "합성 세입자 문의예요." }, 201);
  await login(page, manager);
  await menu(page).getByRole("link", { name: /^알림/ }).click();
  const todo = page.locator('section[aria-label="처리할 일"]');
  await expect(todo).toBeVisible(); await expect(todo).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator(`[data-todo-ticket="${late}"]`)).toContainText("기한 지남");
  await expect(page.locator("[data-todo-ticket]")).toHaveCount(2);
  expect(await page.locator("[data-todo-ticket]").evaluateAll(rows => rows.map(row => row.getAttribute("data-todo-ticket")))).toEqual([late, reply]);
  await page.locator(`[data-todo-ticket="${late}"]`).click();
  await expect(page).toHaveURL(/tab=work$/); await expect(page.getByTestId("ticket-heading")).toBeVisible();
});

test("a due date saved in the open request shows 기한 지남 on the work list and 알림 at once and keeps the decision form", async ({ page }) => {
  // From 1440px the work list and the 업무 정보 panel stay beside the open request.
  await page.setViewportSize({ width: 1440, height: 900 });
  const mine: string[] = []; await onlyMine(page, mine);
  const id = await create(page, "합성 처리 예정 저장"); mine.push(id);
  await login(page, manager);
  await expect(menu(page).getByRole("link", { name: "알림", exact: true })).toBeVisible();
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
  await expect(page.getByTestId("ticket-heading")).toBeVisible();
  // The decision form is keyed on the screen revision: a remount would drop what the manager typed there (review of #172).
  await page.locator("#ticket-decision > section").evaluate(form => form.setAttribute("data-e2e-kept", ""));
  const work = page.getByRole("region", { name: "업무 관리", exact: true });
  await expect(work.getByText("업무 정보 불러오는 중…", { exact: true })).toHaveCount(0);
  await work.getByLabel("처리 예정").fill("2026-10-01T09:00");
  await work.getByRole("button", { name: "저장", exact: true }).click();
  await expect(work.getByText("업무 정보를 저장했어요.", { exact: true })).toBeVisible();
  // No refresh and no 알림 tap: only the reads the save started change the menu and the list.
  await expect(menu(page).getByRole("link", { name: "알림, 처리할 일 1건", exact: true })).toBeVisible();
  await expect(page.locator(`section[aria-label="관리 업무함"] [data-ticket-id="${id}"] [data-reason="OVERDUE"]`)).toHaveText("기한 지남");
  await expect(page.locator("#ticket-decision > section[data-e2e-kept]")).toHaveCount(1);
});
