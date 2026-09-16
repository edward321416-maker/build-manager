import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const BUILDING_A = "demo-building-a";
const ORDINARY_HEATING = "난방이 안 돼요";

async function resetDemo(request: APIRequestContext): Promise<void> {
  expect((await request.post("/api/v1/demo/reset")).status()).toBe(200);
}

function questionHeading(page: Page) {
  return page.locator(".question-card h2");
}

/** Clicks an answer and waits for the server's next question to replace it. */
async function answer(page: Page, testId: string): Promise<void> {
  const before = await questionHeading(page).textContent();
  await page.getByTestId(testId).click();
  await expect(questionHeading(page)).not.toHaveText(before ?? "", {
    timeout: 10_000,
  });
}

test.describe("web demo entry", () => {
  test("offers a visible way from the product root into the tenant demo", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await page.goto("/");

    await page.getByRole("link", { name: "세입자 데모 시작" }).click();

    await expect(page).toHaveURL(/\/demo\/tenant$/);
    await expect(
      page.getByRole("heading", { name: "세입자 데모 · 수리 요청" }),
    ).toBeVisible();
  });

  test("offers a visible way from the product root into the landlord demo", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await page.goto("/");

    await page.getByRole("link", { name: "임대인 데모 시작" }).click();

    await expect(page).toHaveURL(/\/demo\/landlord$/);
    await expect(
      page.getByRole("heading", { name: "임대인 데모 · 수리 요청 검토" }),
    ).toBeVisible();
  });
});

test.describe("web milestone golden path", () => {
  test("carries one ticket from the root through tenant intake to landlord approval", async ({
    page,
    request,
  }) => {
    await resetDemo(request);

    // The reviewer starts where a reviewer actually lands.
    await page.goto("/");
    await page.getByRole("link", { name: "세입자 데모 시작" }).click();

    await page.locator(`#building-${BUILDING_A}`).check();
    await page.locator("#issue-HEATING").check();
    await page.getByLabel("어떤 상황인지 적어 주세요").fill(ORDINARY_HEATING);
    await page.getByTestId("create-ticket").click();
    await expect(page).toHaveURL(/\/demo\/tenant\/tickets\//);

    // The real ticket this run produced; nothing below is a fabricated id.
    const tenantTicketUrl = page.url();
    const ticketId = tenantTicketUrl.split("/").pop()!;
    expect(ticketId).toBeTruthy();

    for (let step = 0; step < 4; step += 1) {
      await answer(page, "answer-no");
    }
    await answer(page, "answer-no");
    await answer(page, "answer-no");
    await answer(page, "answer-yes");
    await page.getByLabel("답변").fill("E1");
    await page.getByTestId("answer-text-submit").click();

    await expect(page.getByTestId("submit-BOILER_DISPLAY")).toBeVisible();
    await page.getByTestId("submit-BOILER_DISPLAY").click();

    await expect(page.getByTestId("finalize")).toBeVisible();
    await page.getByTestId("finalize").click();

    await expect(page.getByText("상태: 검토 대기")).toBeVisible();
    await expect(page.getByText("정보 상태: 필수 정보 확인됨")).toBeVisible();

    // The landlord arrives the same way and finds that exact ticket listed.
    await page.goto("/");
    await page.getByRole("link", { name: "임대인 데모 시작" }).click();
    await expect(page).toHaveURL(/\/demo\/landlord$/);
    await expect(page.getByTestId("ticket-count")).toHaveText("1");

    const ticketLink = page.getByRole("link", { name: ticketId });
    await expect(ticketLink).toBeVisible();
    await ticketLink.click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));

    await expect(page.getByRole("heading", { name: "추천 경로" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "왜 이 경로인가" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "판단 근거가 된 건물 정보" }),
    ).toBeVisible();
    await expect(page.locator(".packet-provenance")).toContainText(
      "heatingType",
    );

    await page.getByTestId("approve").click();
    await expect(page.getByText("상태: 승인됨")).toBeVisible();

    // Back to the tenant page this run actually reached.
    await page.goto(tenantTicketUrl);
    await page.getByTestId("refresh").click();

    await expect(page.getByText("상태: 임대인 확인 완료")).toBeVisible();
  });
});
