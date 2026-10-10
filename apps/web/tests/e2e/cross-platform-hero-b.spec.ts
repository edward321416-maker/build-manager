import { LandlordTicketDetailDtoSchema } from "@build-manager/api-contracts";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Hero B, browser-and-server half.
 *
 * A real Building B heating request is created through the tenant UI and then
 * read back through the public landlord projection, so the recommendation being
 * asserted is the one the authoritative server produced — not a fixture.
 *
 * The number of safety questions is not a client contract. This follows
 * whatever the server asks until it presents the synthetic evidence step.
 */
const BUILDING_B = "demo-building-b";
const ORDINARY_HEATING = "난방이 안 돼요";
const FIXTURE_EVIDENCE = "submit-FIXTURE_VIEW";

async function resetDemo(request: APIRequestContext): Promise<void> {
  expect((await request.post("/api/v1/demo/reset")).status()).toBe(200);
}

function questionHeading(page: Page) {
  return page.locator(".question-card h2");
}

async function answerNoAndWait(page: Page): Promise<void> {
  const before = await questionHeading(page).textContent();

  await page.getByTestId("answer-no").click();
  console.log(`[diag] clicked answer-no; before=${before}`);

  try { await expect
    .poll(async () => {
      if (
        await page
          .getByTestId(FIXTURE_EVIDENCE)
          .isVisible()
          .catch(() => false)
      ) {
        return "evidence";
      }

      const next = await questionHeading(page).textContent().catch(() => null);
      if (next !== null && next !== before) {
        return "question";
      }

      return "waiting";
    })
    .not.toBe("waiting"); } catch (error) {
    console.log(`[diag] STUCK. main text:\n${await page.locator("main").innerText().catch(() => "<none>")}`);
    throw error;
  }
}

async function answerUntilFixtureEvidence(page: Page): Promise<void> {
  for (let guard = 0; guard < 12; guard += 1) {
    if (
      await page
        .getByTestId(FIXTURE_EVIDENCE)
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }

    await expect(page.getByTestId("answer-no")).toBeVisible();
    await answerNoAndWait(page);
  }

  throw new Error("Hero B did not reach FIXTURE_VIEW evidence within 12 answers");
}

test("Hero B: Web Tenant produces the Building B management-office landlord contract", async ({
  page,
  request,
}) => {
  const t0 = Date.now();
  page.on("request", (r) => { if (r.url().includes("/api/") || r.isNavigationRequest()) console.log(`[diag req +${Date.now() - t0}] ${r.method()} ${new URL(r.url()).pathname}`); });
  page.on("response", (r) => { if (r.url().includes("/api/")) console.log(`[diag res +${Date.now() - t0}] ${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("requestfailed", (r) => console.log(`[diag fail +${Date.now() - t0}] ${r.url()} ${r.failure()?.errorText}`));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[diag console ${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => console.log(`[diag pageerror] ${e.message}`));
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log(`[diag nav +${Date.now() - t0}] ${f.url()}`); });
  await resetDemo(request);
  await page.goto("/demo/tenant");

  await page.locator(`#building-${BUILDING_B}`).check();
  await page.locator("#issue-HEATING").check();
  await page.getByLabel("어떤 상황인지 적어 주세요").fill(ORDINARY_HEATING);
  await page.getByTestId("create-ticket").click();

  await expect(page).toHaveURL(/\/demo\/tenant\/tickets\//);
  const ticketId = page.url().split("/").pop()!;
  expect(ticketId).toBeTruthy();

  await answerUntilFixtureEvidence(page);

  await page.getByTestId(FIXTURE_EVIDENCE).click();
  await expect(page.getByTestId("finalize")).toBeVisible();
  await page.getByTestId("finalize").click();

  await expect(page.getByText("상태: 검토 대기")).toBeVisible();
  await expect(page.getByText("정보 상태: 필수 정보 확인됨")).toBeVisible();

  const response = await request.get(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}?view=landlord`,
  );
  expect(response.status()).toBe(200);

  // Runtime validation, not a cast: the contract itself has to hold.
  const landlord = LandlordTicketDetailDtoSchema.parse(await response.json());

  expect(landlord.ticketId).toBe(ticketId);
  expect(landlord.building.buildingId).toBe(BUILDING_B);
  expect(landlord.issueType).toBe("HEATING");
  expect(landlord.status).toBe("READY_FOR_REVIEW");
  expect(landlord.evidenceStatus).toBe("COMPLETE");
  expect(landlord.repairPacket).not.toBeNull();
  expect(landlord.repairPacket?.safetyEscalated).toBe(false);
  expect(landlord.repairPacket?.recommendation?.routeCode).toBe(
    "MANAGEMENT_OFFICE",
  );
  expect(landlord.repairPacket?.recommendation?.reasons.length).toBeGreaterThan(0);
  expect(landlord.repairPacket?.provenance).toEqual(
    expect.arrayContaining(["heatingType", "managementMode"]),
  );
});
