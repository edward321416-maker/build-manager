import { expect, test, type APIRequestContext } from "@playwright/test";

const BUILDING_A = "demo-building-a";
const BUILDING_B = "demo-building-b";

const CLEAN_LEAK_ANSWERS: ReadonlyArray<readonly [string, boolean | string]> = [
  ["safety.electricalWaterRisk", false],
  ["safety.otherUrgentHazard", false],
  ["safety.gasSmell", false],
  ["safety.smokeOrFire", false],
  ["leak.location", "CEILING_WALL"],
  ["leak.active", true],
  ["leak.applianceOnly", false],
  ["leak.firstObservedAt", "2026-09-14 아침"],
];

/**
 * Scenario state is built through the real HTTP API, never by injecting fake
 * data into the browser, so the UI is always rendering API-backed state.
 */
async function resetDemo(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/v1/demo/reset");
  expect(response.status()).toBe(200);
}

async function createReviewableTicket(
  request: APIRequestContext,
): Promise<string> {
  const created = await request.post("/api/v1/tickets", {
    data: {
      buildingId: BUILDING_B,
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    },
  });
  expect(created.status()).toBe(201);
  const { ticketId } = await created.json();

  for (const [questionId, answer] of CLEAN_LEAK_ANSWERS) {
    const answered = await request.post(`/api/v1/tickets/${ticketId}/answers`, {
      data: { questionId, answer },
    });
    expect(answered.status()).toBe(200);
  }

  const evidence = await request.post(`/api/v1/tickets/${ticketId}/evidence`, {
    data: { evidenceType: "LEAK_LOCATION", fixtureId: "demo-leak-area" },
  });
  expect(evidence.status()).toBe(200);

  const finalized = await request.post(`/api/v1/tickets/${ticketId}/finalize`, {
    data: {},
  });
  expect(finalized.status()).toBe(200);

  return ticketId;
}

test.describe("landlord demo", () => {
  test("shows the demo banner and both synthetic buildings", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await page.goto("/demo/landlord");

    await expect(page.getByText("DEMO MODE")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "DEMO 해솔빌라" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "DEMO 라온하우징" }),
    ).toBeVisible();
  });

  test("opens Building A and records an owner verification", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    await page.goto("/demo/landlord");

    await page.getByRole("link", { name: "DEMO 해솔빌라" }).click();
    await expect(page).toHaveURL(new RegExp(`/buildings/${BUILDING_A}$`));

    await expect(
      page.getByRole("heading", { name: "DEMO 해솔빌라" }),
    ).toBeVisible();
    await expect(page.getByText("라우팅 기준 정보")).toBeVisible();
    await expect(page.getByText("참고 정보")).toBeVisible();

    await page.getByLabel("관리 방식").selectOption("MANAGEMENT_OFFICE");
    await page.getByLabel("난방 방식").selectOption("CENTRAL_SHARED");
    await page.getByRole("button", { name: "확인 정보 저장" }).click();

    await expect(page.getByTestId("verify-saved")).toBeVisible();

    // Assert inside the passport, not the form: the saved value must come back
    // from the refetched server response, not from the select we just changed.
    const passport = page.getByRole("region", { name: "DEMO 해솔빌라" });
    await expect(passport.getByText("중앙·공용난방")).toBeVisible();
    await expect(passport.getByText("관리사무소")).toBeVisible();
  });

  test("reviews a repair packet and approves the recommended route", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    const ticketId = await createReviewableTicket(request);

    await page.goto("/demo/landlord");
    await expect(page.getByTestId("ticket-count")).toHaveText("1");

    await page.getByRole("link", { name: ticketId }).click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));

    await expect(page.getByRole("heading", { name: "추천 경로" })).toBeVisible();
    await expect(page.getByText("관리사무소").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "왜 이 경로인가" }),
    ).toBeVisible();
    await expect(page.getByText("managementMode")).toBeVisible();

    await page.getByTestId("approve").click();

    await expect(page.getByText("추천 경로를 승인했습니다.")).toBeVisible();
    await expect(page.getByText("상태: 승인됨")).toBeVisible();
  });

  test("overrides to a different route offered by the server", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    const ticketId = await createReviewableTicket(request);

    await page.goto(`/demo/landlord/tickets/${ticketId}`);

    await page.getByLabel("직접 지정할 경로").selectOption("LANDLORD_REVIEW");
    await page.getByLabel("지정 사유").fill("현장 확인 후 임대인이 직접 검토");
    await page.getByTestId("override").click();

    await expect(page.getByText("상태: 임대인 지정")).toBeVisible();
    await expect(
      page.getByText("임대인이 직접 경로를 지정했습니다: LANDLORD_REVIEW"),
    ).toBeVisible();
  });

  test("requests more information without recording a route decision", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    const ticketId = await createReviewableTicket(request);

    await page.goto(`/demo/landlord/tickets/${ticketId}`);

    await page.getByLabel("추가로 확인할 내용").fill("누수 위치를 다시 확인해 주세요");
    await page.getByTestId("request-more-info").click();

    await expect(page.getByText("상태: 추가 정보 요청됨")).toBeVisible();
    await expect(page.getByText("아직 기록된 결정이 없습니다.")).toBeVisible();
  });

  test("shows a zero-ticket empty state after a demo reset", async ({
    page,
    request,
  }) => {
    await createReviewableTicket(request);
    await resetDemo(request);

    await page.goto("/demo/landlord");

    await expect(page.getByTestId("ticket-count")).toHaveText("0");
    await expect(
      page.getByText("접수된 수리 요청이 없습니다."),
    ).toBeVisible();
  });
});
