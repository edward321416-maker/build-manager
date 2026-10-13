import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const codes = async () => JSON.parse(await readFile(join(homedir(), ".build-manager-rc1-private", "access-codes.json"), "utf8")) as Record<string, string>;
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
async function login(page: Page, who: string) {
  await page.goto("/core"); await page.getByLabel("개발 접근 코드").fill((await codes())[who]);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}

test("development sign-in gets the same menu without organisations or move-in links (P5 spec D11)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, "tenant");
  await menu(page).getByRole("link", { name: "내 정보", exact: true }).click();
  await expect(page.getByRole("region", { name: "내 정보", exact: true }).locator("[data-menu-row]")).toHaveText(["내 호실", "오픈소스 라이선스", "로그아웃"]);
  await expect(page.getByLabel("내 소속", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click(); await expect(page.getByLabel("개발 접근 코드")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page, "manager");
  await expect(menu(page).getByRole("link")).toHaveText(["업무함", /^알림/, "호실 정비 이력", "내 정보"]);
  await expect(menu(page).getByText(/^(조직 관리자|건물 담당자)$/)).toBeVisible();
});
