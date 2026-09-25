import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// The real safety flow and DOM probes deliberately share this assertion path.
async function assertSafeGuidance(page: Page, ticketId: string): Promise<void> {
  const required = "SAFETY_SURFACE_REQUIRED";
  for (const selector of ["main.landlord-page", ".repair-packet", "#packet-heading", "[data-testid=\"override-unavailable\"]", "[data-status=\"SAFETY_ESCALATED\"]"]) {
    const region = page.locator(selector);
    expect(await region.count(), required).toBe(1);
    await expect(region, required).toBeVisible();
    expect((await region.innerText()).trim().length, required).toBeGreaterThan(0);
  }
  await expect(page.locator('[data-status="SAFETY_ESCALATED"]'), required)
    .toHaveText("상태: 안전 확인 필요");
  expect(ticketId, required).not.toBe("");
  expect(await page.locator("#packet-heading").textContent(), required)
    .toMatch(new RegExp(`^수리 요청 ${ticketId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`));
  const content = await page.evaluate((expectedId) => {
    // Inspect the whole body, including adjacent notices, actions and hidden
    // accessible-description text. Framework serialization is not guidance.
    const body = document.body.cloneNode(true) as HTMLElement;
    body.querySelectorAll("script, style, template").forEach((node) => node.remove());
    const attributes = [body, ...body.querySelectorAll("*")].flatMap((element) =>
      ["aria-label", "aria-description", "title", "alt", "href", "action", "formaction", "placeholder", "value"]
        .map((name) => element.getAttribute(name) ?? ""),
    );
    // Only this known field's exact expected ID is excluded, once. Retain
    // suffix guidance and all attributes, including those on the heading.
    const heading = body.querySelector("#packet-heading")!;
    heading.textContent = heading.textContent!.replace(`수리 요청 ${expectedId}`, "수리 요청 ");
    return [body.textContent ?? "", ...attributes].join("\n");
  }, ticketId);
  for (const unsafe of ["119", "직접 수리", "밸브를 잠그"]) {
    expect(content, `UNSAFE_GUIDANCE:${unsafe}`).not.toContain(unsafe);
  }
}

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


/**
 * A non-safety ticket the server cannot route: the safety questions are
 * answered cleanly, but the leak details and evidence are missing, so
 * finalizing yields PARTIAL with recommendation null.
 */
async function createUnroutableTicket(
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

  for (const [questionId, answer] of CLEAN_LEAK_ANSWERS.slice(0, 4)) {
    const answered = await request.post(`/api/v1/tickets/${ticketId}/answers`, {
      data: { questionId, answer },
    });
    expect(answered.status()).toBe(200);
  }

  const finalized = await request.post(`/api/v1/tickets/${ticketId}/finalize`, {
    data: {},
  });
  expect(finalized.status()).toBe(200);

  const detail = await request.get(
    `/api/v1/tickets/${ticketId}?view=landlord`,
  );
  const body = await detail.json();
  expect(body.status).toBe("PARTIAL");
  expect(body.repairPacket.recommendation).toBeNull();
  expect(body.repairPacket.safetyEscalated).toBe(false);

  return ticketId;
}

/** A ticket the safety gate escalated from the tenant's own report text. */
async function createEscalatedTicket(
  request: APIRequestContext,
): Promise<string> {
  const created = await request.post("/api/v1/tickets", {
    data: {
      buildingId: BUILDING_B,
      issueType: "LEAK",
      rawUserText: "천장에서 물이 새고 가스 냄새가 나요",
    },
  });
  expect(created.status()).toBe(201);
  const { ticketId } = await created.json();

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

    await page
      .getByLabel("추가 정보를 요청하는 이유")
      .fill("누수 위치를 다시 확인해 주세요");
    // A request must name at least one question or piece of evidence.
    await page.getByLabel("물이 어디에서 보이나요?").check();
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

  test("records a manual route when the system recommended none", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    const ticketId = await createUnroutableTicket(request);

    await page.goto(`/demo/landlord/tickets/${ticketId}`);

    // Scoped to the packet: the same phrase also appears in the approve note.
    await expect(
      page.locator(".no-recommendation[data-state='MISSING_REQUIRED']"),
    ).toBeVisible();
    await expect(page.getByTestId("manual-route-note")).toBeVisible();

    // The whole closed vocabulary is offered, not just server alternatives.
    const selector = page.getByLabel("직접 지정할 경로");
    await expect(selector).toBeEnabled();
    await expect(selector.locator("option")).toHaveCount(5);

    await selector.selectOption("THIRD_PARTY_MANAGER");
    await page.getByLabel("지정 사유").fill("위탁관리사가 확인하기로 함");
    await page.getByTestId("override").click();

    await expect(page.getByText("상태: 임대인 지정")).toBeVisible();
    await expect(
      page.getByText("임대인이 직접 경로를 지정했습니다: THIRD_PARTY_MANAGER"),
    ).toBeVisible();

    const detail = await request.get(
      `/api/v1/tickets/${ticketId}?view=landlord`,
    );
    const body = await detail.json();
    expect(body.status).toBe("OVERRIDDEN");
    expect(body.decision).toEqual({
      type: "OVERRIDE",
      routeCode: "THIRD_PARTY_MANAGER",
      reason: "위탁관리사가 확인하기로 함",
    });
    expect(body.repairPacket.recommendation).toBeNull();
  });

  test("offers no normal override control for a safety-escalated ticket", async ({
    page,
    request,
  }) => {
    await resetDemo(request);
    const ticketId = await createEscalatedTicket(request);

    await page.goto(`/demo/landlord/tickets/${ticketId}`);

    await expect(page.getByTestId("override-unavailable")).toBeVisible();
    await expect(page.getByLabel("직접 지정할 경로")).toHaveCount(0);
    await expect(page.getByTestId("override")).toHaveCount(0);
    await expect(page.getByTestId("approve")).toBeDisabled();

    await assertSafeGuidance(page, ticketId);
  });
  test("safety assertion distinguishes identifiers from unsafe guidance (DOM_PROBE)", async ({ page, request }) => {
    await resetDemo(request);
    const originalId = await createEscalatedTicket(request);
    await page.goto(`/demo/landlord/tickets/${originalId}`);
    await expect(page.getByTestId("override-unavailable")).toBeVisible();
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
        document.querySelector("#packet-heading")!.textContent = `수리 요청 ${id}`;
        const data = document.createElement("script");
        data.type = "application/json";
        data.textContent = JSON.stringify({ ticketId: id });
        document.body.append(data);
      }, id);
    };
    try {
      for (const id of ["ticket-safe-control", probeId]) {
        await install(id);
        await assertSafeGuidance(page, id);
      }
      for (const unsafe of ["119", "직접 수리", "밸브를 잠그"]) {
        for (const surface of ["guidance", "adjacent", "heading", "aria-label", "title", "href"]) {
          await install(probeId);
          await page.evaluate(({ unsafe, surface }) => {
            const heading = document.querySelector("#packet-heading")!;
            const guidance = document.querySelector("[data-testid=override-unavailable]")!;
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
          await expect(assertSafeGuidance(page, probeId), `${surface}:${unsafe}`).rejects.toThrow(`UNSAFE_GUIDANCE:${unsafe}`);
        }
      }
      for (const missing of ["state", "region", "empty"]) {
        await install(probeId);
        await page.evaluate((missing) => {
          if (missing === "empty") document.body.replaceChildren();
          else document.querySelector(missing === "state" ? '[data-status="SAFETY_ESCALATED"]' : ".repair-packet")!.remove();
        }, missing);
        await expect(assertSafeGuidance(page, probeId), missing).rejects.toThrow("SAFETY_SURFACE_REQUIRED");
      }
    } finally {
      await page.setContent(snapshot);
    }
  });

});
