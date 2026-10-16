import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { sdkSession, privateRoot } from "./session";

// P6 PR 2 (docs/superpowers/plans/2026-10-16-building-setup-screen.md): an organisation admin adds a building, saves its
// info and adds a unit from 더 보기 › 건물·호실 관리. A new organisation per run, so organisation A's unit count never grows
// (unit pickers elsewhere read that organisation). Synthetic names only.
async function setup(browser: import("@playwright/test").Browser) {
  const manager = await sdkSession(browser, "buildings-manager-" + randomUUID());
  const org = randomUUID(), managerId = (await manager.admin.query("SELECT authn.current_actor($1) id", [manager.digest])).rows[0].id;
  await manager.admin.query("INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','합성 건물 관리 시험 조직')", [org]);
  await manager.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')", [org, managerId]);
  return { manager, org, headers: { ...manager.headers, "x-core-organization": org } };
}
const title = (page: Page, name: string) => expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
const toast = (page: Page, text: string) => expect(page.locator("[data-toast]")).toHaveText(text);
const fact = (page: Page, name: string) => page.getByRole("region", { name: "건물 정보", exact: true }).locator("dt", { hasText: name }).locator("xpath=following-sibling::dd[1]");
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("an organisation admin adds a building, saves its info and adds a unit (390 then 1280)", async ({ browser }) => {
  const f = await setup(browser), name = "합성 건물 " + randomUUID().slice(0, 4);
  try {
    const page = await f.manager.context.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/core?tab=more&view=buildings");
    await title(page, "건물·호실 관리");
    await expect(page.getByRole("heading", { level: 2, name: "건물 0곳", exact: true })).toBeVisible();
    await expect(page.getByText("아직 건물이 없어요. 건물을 추가해 주세요.", { exact: true })).toBeVisible();
    // The screen's one action sits in the bar fixed at the bottom on phones: 20px above the bottom edge (rules 5).
    const add = page.getByRole("button", { name: "건물 추가하기", exact: true }), box = (await add.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(844 - 20);

    await add.click();
    await title(page, "건물 추가"); await expect(page.getByRole("heading", { level: 2, name: "어떤 건물인가요?" })).toBeVisible();
    await page.getByLabel("건물 이름", { exact: true }).fill(name);
    await page.getByRole("button", { name: "건물 추가하기", exact: true }).click();
    await title(page, name); await toast(page, "건물을 추가했어요");
    await expect(fact(page, "건물 이름")).toHaveText(name);
    await expect(fact(page, "업체에 알려 줄 주소")).toHaveText("입력 전");
    await expect(page.getByRole("heading", { level: 2, name: "호실 0개", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "고치기", exact: true }).click();
    await title(page, "건물 정보");
    await expect(page.getByLabel("건물 이름", { exact: true })).toHaveValue(name);
    // Text at 200% on a 320px phone: the tiles stay inside their content box, so the page keeps its side margin and never
    // scrolls sideways (rules 7, 12; review M2: the 8rem tile floor, 256px, was wider than the 240px content and ran 16px
    // into the margin).
    await page.setViewportSize({ width: 320, height: 800 });
    const zoom = await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await noSideScroll(page)).toBe(true);
    const overflow = await page.locator("label[data-tile]").evaluateAll(labels => labels.map(label => label.getBoundingClientRect().right - label.parentElement!.getBoundingClientRect().right));
    expect(Math.max(...overflow)).toBeLessThanOrEqual(0.5);
    await zoom.evaluate(node => (node as Element).remove()); await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("업체에 알려 줄 주소", { exact: true }).fill("합성 주소 1");
    await page.getByRole("radio", { name: /^개별난방/ }).check();
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await title(page, name); await toast(page, "저장했어요");
    await expect(fact(page, "업체에 알려 줄 주소")).toHaveText("합성 주소 1");
    await expect(fact(page, "난방 방식")).toHaveText("개별난방");
    await expect(fact(page, "관리 방식")).toHaveText("모름");

    await page.getByRole("button", { name: "호실 추가하기", exact: true }).click();
    await title(page, "호실 추가");
    await page.getByLabel("호실 이름", { exact: true }).fill("101호");
    await page.getByRole("button", { name: "호실 추가하기", exact: true }).click();
    await title(page, name); await toast(page, "호실을 추가했어요");
    await expect(page.getByRole("heading", { level: 2, name: "호실 1개", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "호실", exact: true }).getByRole("listitem")).toHaveText(["101호"]);
    expect(await noSideScroll(page)).toBe(true);
    const shots = join(privateRoot, "buildings-sdk"); await mkdir(shots, { recursive: true });
    await page.screenshot({ path: join(shots, "building-390.png"), fullPage: true });

    // Browser back walks up one step: the add and info steps were replaced or popped, so the list is next.
    await page.goBack(); await title(page, "건물·호실 관리");
    const row = page.locator("[data-building-row]", { hasText: name });
    await expect(row).toContainText("호실 1개"); await expect(row).not.toContainText("정보 입력 필요");

    // The saved name and facts reach Core: the admin's unit list and the building info.
    const units = await (await f.manager.context.request.get("/api/v2/core/units", { headers: f.headers })).json() as { buildingName: string; label: string; buildingId: string }[];
    expect(units.map(unit => [unit.buildingName, unit.label])).toEqual([[name, "101호"]]);
    const info = await (await f.manager.context.request.get(`/api/v2/core/buildings/${units[0].buildingId}`, { headers: f.headers })).json();
    expect(info).toMatchObject({ displayName: name, serviceAddress: "합성 주소 1", heatingType: "INDIVIDUAL", managementMode: null, demo: false, version: 2, unitCount: 1, editable: true });

    // From 1120px the list and the building sit side by side; the open building's row is marked.
    await page.setViewportSize({ width: 1280, height: 900 });
    await row.click(); await title(page, name);
    await expect(row).toHaveAttribute("aria-current", "true"); await expect(row).toBeVisible();
    await expect(fact(page, "난방 방식")).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await page.screenshot({ path: join(shots, "building-1280.png"), fullPage: true });
    // Tapping the menu item again goes back to the list (rules 8.14).
    await page.getByRole("navigation", { name: "주 메뉴", exact: true }).getByRole("link", { name: "건물·호실 관리", exact: true }).click();
    await title(page, "건물·호실 관리"); await expect(fact(page, "난방 방식")).toHaveCount(0);
  } finally { await f.manager.close(); }
});

test("a unit name already in the building stays on the form with the reason", async ({ browser }) => {
  const f = await setup(browser);
  try {
    const property = (await f.manager.context.request.post(`/api/v2/organizations/${f.org}/properties`, { headers: f.headers, data: { addressReference: "합성 중복 시험 건물" } }));
    expect(property.status()).toBe(201); const id = (await property.json()).id as string;
    expect((await f.manager.context.request.post(`/api/v2/organizations/${f.org}/properties/${id}/units`, { headers: f.headers, data: { label: "101호" } })).status()).toBe(201);
    const page = await f.manager.context.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/core?tab=more&view=buildings");
    // A building registered without a name (the old /workspace pages do this) shows as 건물 and needs info.
    const row = page.locator(`[data-building-row="${id}"]`);
    await expect(row).toContainText("이름 없음 · 호실 1개"); await expect(row).toContainText("정보 입력 필요");
    await row.click(); await title(page, "건물");
    await page.getByRole("button", { name: "호실 추가하기", exact: true }).click();
    await page.getByLabel("호실 이름", { exact: true }).fill("101호");
    await page.getByRole("button", { name: "호실 추가하기", exact: true }).click();
    await expect(page.getByText("이 건물에 같은 이름의 호실이 있어요. 다른 이름을 적어 주세요.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("호실 이름", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await title(page, "호실 추가");
  } finally { await f.manager.close(); }
});
