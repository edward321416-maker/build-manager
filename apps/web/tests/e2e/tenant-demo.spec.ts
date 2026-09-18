import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const BUILDING_A = "demo-building-a";
const BUILDING_B = "demo-building-b";

const ORDINARY_HEATING = "난방이 안 돼요";

async function resetDemo(request: APIRequestContext): Promise<void> {
  expect((await request.post("/api/v1/demo/reset")).status()).toBe(200);
}

/** Creates a ticket through the tenant UI, exactly as a person would. */
async function createTicketThroughUi(
  page: Page,
  buildingId: string,
  issue: "HEATING" | "LEAK",
  report: string,
): Promise<void> {
  await page.goto("/demo/tenant");
  await page.locator(`#building-${buildingId}`).check();
  await page.locator(`#issue-${issue}`).check();
  await page.getByLabel("어떤 상황인지 적어 주세요").fill(report);
  await page.getByTestId("create-ticket").click();
  await expect(page).toHaveURL(/\/demo\/tenant\/tickets\//);
}

function questionHeading(page: Page) {
  return page.locator(".question-card h2");
}

/**
 * Clicks an answer and waits for the server's next question to replace it, so
 * the walkthrough never races ahead of the response it is driving.
 */
async function answer(page: Page, testId: string): Promise<void> {
  const before = await questionHeading(page).textContent();
  await page.getByTestId(testId).click();
  await expect(questionHeading(page)).not.toHaveText(before ?? "", {
    timeout: 10_000,
  });
}

/** Answers the four opening safety questions with "no". */
async function clearSafetyQuestions(page: Page): Promise<void> {
  for (let step = 0; step < 4; step += 1) {
    await answer(page, "answer-no");
  }
}

test.describe("tenant demo", () => {
  test("shows the demo banner and both synthetic buildings", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await page.goto("/demo/tenant");

    await expect(page.getByText("DEMO MODE")).toBeVisible();
    await expect(page.getByText("DEMO 해솔빌라")).toBeVisible();
    await expect(page.getByText("DEMO 라온하우징")).toBeVisible();
  });

  test("requires the tenant's own report before accepting a ticket", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await page.goto("/demo/tenant");
    await page.locator(`#building-${BUILDING_A}`).check();

    await expect(page.getByTestId("create-ticket")).toBeDisabled();

    await page.getByLabel("어떤 상황인지 적어 주세요").fill(ORDINARY_HEATING);
    await expect(page.getByTestId("create-ticket")).toBeEnabled();
  });

  test("asks the same heating report differently in each building", async ({
    page,
    request,
  }) => {
    await resetDemo(request);

    // Building A — owner-managed individual heating.
    await createTicketThroughUi(page, BUILDING_A, "HEATING", ORDINARY_HEATING);
    await clearSafetyQuestions(page);
    const buildingAQuestion = await questionHeading(page).textContent();
    expect(buildingAQuestion).toContain("온수");

    // Building B — office-managed shared heating, same words from the tenant.
    await createTicketThroughUi(page, BUILDING_B, "HEATING", ORDINARY_HEATING);
    await clearSafetyQuestions(page);
    const buildingBQuestion = await questionHeading(page).textContent();
    expect(buildingBQuestion).toContain("이 호실");

    expect(buildingAQuestion).not.toBe(buildingBQuestion);
  });

  test("walks a heating report through questions, evidence, and submission", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await createTicketThroughUi(page, BUILDING_A, "HEATING", ORDINARY_HEATING);

    await clearSafetyQuestions(page);
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
  });

  test("walks a leak report through its own questions and evidence", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await createTicketThroughUi(
      page,
      BUILDING_B,
      "LEAK",
      "천장에서 물이 떨어집니다.",
    );

    await clearSafetyQuestions(page);

    await answer(page, "answer-CEILING_WALL");
    await answer(page, "answer-yes");
    await answer(page, "answer-no");
    await page.getByLabel("답변").fill("2026-09-15 아침");
    await page.getByTestId("answer-text-submit").click();

    await expect(page.getByTestId("submit-LEAK_LOCATION")).toBeVisible();
    await page.getByTestId("submit-LEAK_LOCATION").click();
    await page.getByTestId("finalize").click();

    await expect(page.getByText("상태: 검토 대기")).toBeVisible();
  });

  test("interrupts intake when the report itself carries a hazard", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await createTicketThroughUi(
      page,
      BUILDING_A,
      "HEATING",
      "난방이 안 되고 가스 냄새가 나요",
    );

    await expect(
      page.getByRole("heading", { name: "안전 확인이 필요합니다" }),
    ).toBeVisible();
    await expect(page.getByTestId("answer-no")).toHaveCount(0);
    await expect(page.getByTestId("finalize")).toHaveCount(0);
    await expect(page.getByText("상태: 안전 확인 필요")).toBeVisible();

    const content = await page.content();
    for (const unsafe of ["119", "직접 수리", "밸브를 잠그"]) {
      expect(content).not.toContain(unsafe);
    }
  });

  test("interrupts intake when a safety question is answered yes", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await createTicketThroughUi(page, BUILDING_A, "HEATING", ORDINARY_HEATING);

    await page.getByTestId("answer-yes").click();

    await expect(
      page.getByRole("heading", { name: "안전 확인이 필요합니다" }),
    ).toBeVisible();
    await expect(page.getByTestId("finalize")).toHaveCount(0);
  });

  test("reports a partial submission without inventing a route", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await createTicketThroughUi(
      page,
      BUILDING_B,
      "LEAK",
      "천장에서 물이 떨어집니다.",
    );
    await clearSafetyQuestions(page);

    // Skip the remaining detail by submitting straight from the API surface the
    // UI exposes: the tenant has not supplied the required evidence yet.
    const ticketId = page.url().split("/").pop()!;
    const finalized = await request.post(
      `/api/v1/tickets/${ticketId}/finalize`,
      { data: {} },
    );
    expect(finalized.status()).toBe(200);

    await page.getByTestId("refresh").click();

    await expect(page.getByText("상태: 정보 부족")).toBeVisible();
    await expect(page.getByText("정보 상태: 필수 정보 부족")).toBeVisible();

    const content = await page.content();
    for (const landlordOnly of ["추천 경로", "관리사무소", "임대인 검토"]) {
      expect(content).not.toContain(landlordOnly);
    }
  });

  test("carries a landlord follow-up request through to the tenant and back", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await createTicketThroughUi(
      page,
      BUILDING_B,
      "LEAK",
      "천장에서 물이 떨어집니다.",
    );
    const ticketId = page.url().split("/").pop()!;

    await clearSafetyQuestions(page);
    await answer(page, "answer-CEILING_WALL");
    await answer(page, "answer-yes");
    await answer(page, "answer-no");
    await page.getByLabel("답변").fill("2026-09-15 아침");
    await page.getByTestId("answer-text-submit").click();
    await expect(page.getByTestId("submit-LEAK_LOCATION")).toBeVisible();
    await page.getByTestId("submit-LEAK_LOCATION").click();
    await expect(page.getByTestId("finalize")).toBeVisible();
    await page.getByTestId("finalize").click();
    await expect(page.getByText("상태: 검토 대기")).toBeVisible();

    // The landlord asks for one specific question, through the real UI.
    await page.goto(`/demo/landlord/tickets/${ticketId}`);
    await page
      .getByLabel("추가 정보를 요청하는 이유")
      .fill("누수 시점을 다시 확인해 주세요");
    await page.getByLabel("처음 발견한 시점을 입력해 주세요.").check();
    await page.getByTestId("request-more-info").click();
    await expect(page.getByText("상태: 추가 정보 요청됨")).toBeVisible();

    // The tenant sees exactly that request.
    await page.goto(`/demo/tenant/tickets/${ticketId}`);
    await expect(
      page.getByRole("heading", { name: "임대인이 추가 정보를 요청했습니다" }),
    ).toBeVisible();
    await expect(page.getByText("누수 시점을 다시 확인해 주세요")).toBeVisible();
    // Scoped to the outstanding list: the prompt also renders as the question
    // the tenant is being asked to answer right now.
    await expect(
      page.locator(".follow-up-questions li", {
        hasText: "처음 발견한 시점을 입력해 주세요.",
      }),
    ).toBeVisible();

    // Responding clears the outstanding item and offers a resubmission.
    await page.getByLabel("답변").fill("2026-09-16 아침");
    await page.getByTestId("answer-text-submit").click();
    await expect(page.getByTestId("follow-up-done")).toBeVisible();

    await page.getByTestId("refinalize").click();

    await expect(
      page.getByRole("heading", { name: "임대인이 추가 정보를 요청했습니다" }),
    ).toHaveCount(0);

    const detail = await request.get(
      `/api/v1/tickets/${ticketId}?view=tenant`,
    );
    expect((await detail.json()).moreInfoRequest).toBeNull();
  });
});
