import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { accessCodes, mintOwnSession } from "./own-session";
import { openTab } from "./presentation";

// P5 PR 1b (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md §4): 우리 집's to-do line and in-progress
// requests, 내 요청 in two groups, and why request rows wait while photos are picked.
let code = "";
test.beforeAll(async () => { code = await mintOwnSession("tenant"); });
const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
const pendingHint = "고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요.";
const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#759cac" } }).png().toBuffer();
async function login(page: Page) {
  await page.goto("/core"); await page.getByLabel("개발 접근 코드").fill(code);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}
/** Lists only the requests this test made. The shared fixture keeps every other file's requests, which would change the
 * order; a controlled list exercises the screen, not persistence (as usability.spec.ts does). */
async function onlyMine(page: Page, mine: string[]) {
  await page.route("**/api/v2/core/tickets", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(), all = await response.json() as { ticketId: string }[];
    await route.fulfill({ response, json: all.filter(ticket => mine.includes(ticket.ticketId)) });
  });
}
async function create(page: Page, text: string) {
  const units = await (await page.request.get("/api/v2/core/units", { headers: bearer(code) })).json() as { id: string }[];
  const response = await page.request.post("/api/v2/core/tickets", { headers: bearer(code), data: { unitId: units[0].id, issueType: "LEAK", rawUserText: text } });
  expect(response.status()).toBe(201); return (await response.json() as { ticketId: string }).ticketId;
}

test("우리 집 shows three in-progress requests with their next step, the to-do line and a way to all of them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  for (const n of [1, 2, 3, 4]) mine.push(await create(page, `합성 우리 집 진행 중 요청 ${n}`));
  await login(page);
  const going = page.getByRole("region", { name: "진행 중인 요청", exact: true }), cards = going.locator("[data-home-card]");
  // All four are drafts, so the to-do order is newest first (spec §4: to-dos first, then the most recent).
  await expect(cards).toHaveCount(3);
  expect(await cards.evaluateAll(rows => rows.map(row => row.getAttribute("data-home-card")))).toEqual([mine[3], mine[2], mine[1]]);
  await expect(cards.first()).toContainText("아직 보내지 않았어요. 열어서 제출해 주세요.");
  await expect(going.getByRole("heading", { level: 2 })).toHaveText("진행 중인 요청 4건");
  const line = page.getByRole("link", { name: "처리할 일 4건 · 알림에서 보기", exact: true });
  await expect(line).toBeVisible();
  await going.getByRole("link", { name: "내 요청에서 모두 보기", exact: true }).click();
  await expect(page).toHaveURL(/tab=requests$/);
  await expect(page.getByRole("region", { name: "진행 중", exact: true }).locator("[data-ticket-id]")).toHaveCount(4);
  await openTab(page, "우리 집"); await line.click(); await expect(page).toHaveURL(/tab=alerts$/);
  await openTab(page, "우리 집"); await cards.first().getByRole("button").click();
  await expect(page.getByTestId("ticket-heading")).toBeVisible();
  await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(cards).toHaveCount(3);
  // Three or fewer: no link to all of them.
  mine.splice(1, 3); await page.getByRole("navigation", { name: "접속 및 새로고침" }).getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(cards).toHaveCount(1); await expect(going.getByRole("link", { name: "내 요청에서 모두 보기", exact: true })).toHaveCount(0);
});

test("내 요청 lists 진행 중 and 끝난 요청 apart and says why rows wait while photos are picked", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  const open = await create(page, "합성 진행 중 요청"), done = await create(page, "합성 끝난 요청"); mine.push(open, done);
  const manager = bearer((await accessCodes()).manager);
  for (const status of ["IN_PROGRESS", "COMPLETED"]) expect((await page.request.post(`/api/v2/core/tickets/${done}/handling`, { headers: manager, data: { status, message: "합성 처리 기록" } })).status()).toBe(200);
  await login(page); await openTab(page, "내 요청");
  const going = page.getByRole("region", { name: "진행 중", exact: true }), ended = page.getByRole("region", { name: "끝난 요청", exact: true });
  await expect(going.locator("[data-ticket-id]")).toHaveCount(1); await expect(going.locator(`[data-ticket-id="${open}"]`)).toBeVisible();
  await expect(ended.locator(`[data-ticket-id="${done}"]`)).toContainText("처리 완료");
  mine.splice(1, 1); await page.getByRole("navigation", { name: "접속 및 새로고침" }).getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(ended).toContainText("끝난 요청이 없어요.");
  // Photos picked on 우리 집 keep every request shut; the lists say why (final review of PR 139).
  await openTab(page, "우리 집"); await page.getByLabel("참고 사진 선택", { exact: true }).setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: await png() });
  await openTab(page, "내 요청"); await expect(going.locator("[data-open-ticket]")).toBeDisabled();
  // The hidden 우리 집 says it too, so count only the visible copy.
  await expect(page.getByText(pendingHint, { exact: true }).filter({ visible: true })).toHaveCount(1);
  await openTab(page, "알림"); await expect(page.getByRole("region", { name: "처리할 일", exact: true })).toContainText(pendingHint);
});
