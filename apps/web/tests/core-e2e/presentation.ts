import { expect, type Page } from "@playwright/test";

export async function openInspector(page: Page) {
  await page.getByRole("button", { name: "업무 정보", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "관리자 업무 정보" })).toBeVisible();
}

export async function openConversation(page: Page) {
  const thread = page.getByRole("region", { name: "세입자와 공유하는 대화", exact: true }).locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: /^(대화 기록|대화)$/ }) });
  if (await thread.getAttribute("open") === null) await thread.locator("summary").click();
  await expect(thread).toHaveAttribute("open", "");
}

const mainMenu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
/** P5: a signed-in /core shows the main menu. Before P5 the check waited for the logout button, now inside 내 정보. */
export async function expectSignedIn(page: Page) {
  await expect(mainMenu(page)).toBeVisible();
}
/** On a phone a request or row screen hides the tab bar (rules 8.14); go back until the menu shows. */
async function toFirstScreen(page: Page) {
  const back = page.getByRole("button", { name: "뒤로", exact: true });
  const menuOrBack = mainMenu(page).or(back);
  await expect(menuOrBack).toBeVisible();
  for (let i = 0; i < 3 && !(await mainMenu(page).isVisible()) && await back.isVisible(); i++) {
    await back.click();
    await expect(menuOrBack).toBeVisible();
  }
  await expectSignedIn(page);
}
/** Clicks a main-menu item by name; the 알림 item may carry a count ("알림, 처리할 일 2건"). */
export async function openTab(page: Page, name: string) {
  await toFirstScreen(page);
  await mainMenu(page).getByRole("link", { name: new RegExp(`^${name}(, |$)`) }).click();
}
/** Opens a 더 보기 row: from the left menu on wide screens, through the 더 보기 tab on phones. */
export async function openMoreRow(page: Page, name: string) {
  await toFirstScreen(page);
  const direct = mainMenu(page).getByRole("link", { name, exact: true });
  if (await direct.count()) { await direct.click(); return; }
  await openTab(page, "더 보기");
  await page.getByRole("region", { name: "더 보기", exact: true }).getByRole("link", { name, exact: true }).click();
}
/** Opens 내 정보: the tenant's tab or the wide account item, else 더 보기 › 내 정보 on a manager's phone. */
export async function openAccount(page: Page) {
  await openMoreRow(page, "내 정보");
}
/** Opens a request row on the current screen, or from 내 요청, where the tenant's list lives since P5. */
export async function openTicketRow(page: Page, id: string) {
  await toFirstScreen(page);
  const requests = mainMenu(page).getByRole("link", { name: "내 요청", exact: true });
  if (await requests.count() && await requests.getAttribute("aria-current") !== "page") await requests.click();
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
}
