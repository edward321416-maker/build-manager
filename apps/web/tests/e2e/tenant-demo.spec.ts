import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// The real safety flow and DOM probes deliberately share this assertion path.
async function assertSafeGuidance(page: Page): Promise<void> {
  const required = "SAFETY_SURFACE_REQUIRED";
  for (const selector of ["main.tenant-page", ".safety-notice", "#safety-heading", ".tenant-status", "[data-status=\"SAFETY_ESCALATED\"]"]) {
    const region = page.locator(selector);
    expect(await region.count(), required).toBe(1);
    await expect(region, required).toBeVisible();
    expect((await region.innerText()).trim().length, required).toBeGreaterThan(0);
  }
  await expect(page.locator('[data-status="SAFETY_ESCALATED"]'), required)
    .toHaveText("상태: 안전 확인 필요");

  const content = await page.evaluate(() => {
    // Inspect the whole body, including adjacent notices, actions and hidden
    // accessible-description text. Framework serialization is not guidance.
    const body = document.body.cloneNode(true) as HTMLElement;
    body.querySelectorAll("script, style, template").forEach((node) => node.remove());
    const attributes = [body, ...body.querySelectorAll("*")].flatMap((element) =>
      ["aria-label", "aria-description", "title", "alt", "href", "action", "formaction", "placeholder", "value"]
        .map((name) => element.getAttribute(name) ?? ""),
    );
    return [body.textContent ?? "", ...attributes].join("\n");
  });
  for (const unsafe of ["119", "직접 수리", "밸브를 잠그"]) {
    expect(content, `UNSAFE_GUIDANCE:${unsafe}`).not.toContain(unsafe);
  }
}

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

    await assertSafeGuidance(page);
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
  test("safety assertion distinguishes identifiers from unsafe guidance (DOM_PROBE)", async ({ page, request }) => {
    await resetDemo(request);
    await createTicketThroughUi(page, BUILDING_A, "HEATING", "난방이 안 되고 가스 냄새가 나요");
    await expect(page.getByRole("heading", { name: "안전 확인이 필요합니다" })).toBeVisible();
    // Snapshot real API-backed rendering. Mutations below are DOM probes only,
    // not evidence of fixed server IDs or changed persistence/API behavior.
    const snapshot = await page.evaluate(() => {
      const body = document.body.cloneNode(true) as HTMLElement;
      body.querySelectorAll("script").forEach((node) => node.remove());
      return body.outerHTML;
    });
    const probeId = "ticket-e10c7902-9b7c-4b6c-ad4b-228127119d8e";
    const install = async (id: string) => {
      await page.setContent(snapshot);
      await page.evaluate((id) => {
        document.body.dataset.ticketId = id;
        const data = document.createElement("script");
        data.type = "application/json";
        data.textContent = JSON.stringify({ ticketId: id });
        document.body.append(data);
      }, id);
    };
    try {
      for (const id of ["ticket-safe-control", probeId]) {
        await install(id);
        await assertSafeGuidance(page);
      }
      for (const unsafe of ["119", "직접 수리", "밸브를 잠그"]) {
        for (const surface of ["guidance", "adjacent", "heading", "aria-label", "title", "href"]) {
          await install(probeId);
          await page.evaluate(({ unsafe, surface }) => {
            const heading = document.querySelector("#safety-heading")!;
            const guidance = document.querySelector(".safety-notice p")!;
            if (surface === "guidance") guidance.append(` ${unsafe}`);
            else if (surface === "heading") heading.append(` ${unsafe}`);
            else if (surface === "adjacent") {
              const note = document.createElement("p");
              note.textContent = unsafe;
              document.body.append(note); // Outside the first notice AND main.
            } else {
              const action = document.createElement("a");
              action.textContent = "연락 안내";
              action.setAttribute(surface, surface === "href" ? `tel:${unsafe}` : unsafe);
              document.body.append(action);
            }
          }, { unsafe, surface });
          await expect(assertSafeGuidance(page), `${surface}:${unsafe}`).rejects.toThrow(`UNSAFE_GUIDANCE:${unsafe}`);
        }
      }
      for (const missing of ["state", "region", "empty"]) {
        await install(probeId);
        await page.evaluate((missing) => {
          if (missing === "empty") document.body.replaceChildren();
          else document.querySelector(missing === "state" ? '[data-status="SAFETY_ESCALATED"]' : ".safety-notice")!.remove();
        }, missing);
        await expect(assertSafeGuidance(page), missing).rejects.toThrow("SAFETY_SURFACE_REQUIRED");
      }
    } finally {
      await page.setContent(snapshot);
    }
  });

});
