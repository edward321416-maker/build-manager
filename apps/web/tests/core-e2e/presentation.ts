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
