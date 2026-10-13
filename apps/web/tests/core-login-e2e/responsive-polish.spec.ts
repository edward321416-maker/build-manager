import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { sdkSession } from "./session";

const fits = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const image = async () => ({ name: "synthetic-polish.png", mimeType: "image/png", buffer: await sharp({ create: { width: 240, height: 180, channels: 3, background: "#84aa96" } }).png().toBuffer() });

test("compact tab bar keeps the four tenant tabs in keyboard order at 320 and 390", async ({ browser }) => {
  const tenant = await sdkSession(browser);
  try {
    const page = await tenant.context.newPage(); await page.goto("/core");
    const nav = page.getByRole("navigation", { name: "주 메뉴", exact: true });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 }); await fits(page);
      const links = nav.getByRole("link"); await expect(links).toHaveText(["우리 집", "내 요청", /^알림/, "내 정보"]);
      const boxes = await links.evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ x: r.x, width: r.width, height: r.height })));
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
      for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(50); expect(Math.round(box.height)).toBe(56); }
      await nav.getByRole("link", { name: "우리 집", exact: true }).focus();
      for (const name of ["내 요청", /^알림/, "내 정보"]) { await page.keyboard.press("Tab"); await expect(nav.getByRole("link", { name })).toBeFocused(); }
      await page.keyboard.press("Enter"); await expect(page.getByRole("heading", { level: 1, name: "내 정보" })).toBeVisible();
      await page.getByRole("region", { name: "내 정보", exact: true }).getByRole("link", { name: "호실 연결", exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: "호실 연결" })).toBeVisible();
      await page.getByRole("button", { name: "뒤로", exact: true }).click();
      await nav.getByRole("link", { name: "우리 집", exact: true }).click(); await expect(nav.getByRole("link", { name: "우리 집", exact: true })).toHaveAttribute("aria-current", "page");
    }
  } finally { await tenant.close(); }
});

test("1280 contextual inspector aligns right, toggles and retains every unsaved input without trapping focus", async ({ browser }) => {
  const tenant = await sdkSession(browser), manager = await sdkSession(browser, "manager");
  try {
    const made = await tenant.context.request.post("/api/v2/core/tickets", { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: "LEAK", rawUserText: "합성 inspector 보존 확인" } }); expect(made.status()).toBe(201);
    const id = (await made.json()).ticketId;
    const page = await manager.context.newPage(); await page.setViewportSize({ width: 1280, height: 900 }); await page.goto("/core"); await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
    const trigger = page.getByRole("button", { name: "업무 정보", exact: true });
    const panel = page.getByRole("complementary", { name: "관리자 업무 정보" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false"); await expect(trigger).toHaveAttribute("aria-controls", "ticket-inspector");
    await trigger.click(); await expect(panel).toBeVisible(); await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const box = (await panel.boundingBox())!, main = (await page.getByRole("region", { name: "접수 요약", exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThan(main.x); expect(box.y).toBeLessThan(main.y + main.height); expect(box.x + box.width).toBeLessThanOrEqual(1280);
    const fields = [panel.getByRole("combobox", { name: "긴급도", exact: true }), page.getByLabel("담당자", { exact: true }), page.getByLabel("처리 예정", { exact: true }), panel.getByRole("textbox", { name: "내부 메모 입력", exact: true }), page.getByLabel("처리 기록", { exact: true })];
    const values = ["HIGH", "저장 전 합성 담당", "2030-10-04T09:30", "저장 전 합성 메모", "저장 전 합성 처리"];
    await fields[0].selectOption(values[0]); for (let i = 1; i < fields.length; i++) await fields[i].fill(values[i]);
    const input = await fields[1].elementHandle();
    await page.getByRole("button", { name: "업무 정보 닫기", exact: true }).click(); await expect(panel).not.toBeVisible(); await expect(trigger).toBeFocused();
    await trigger.click(); for (let i = 0; i < fields.length; i++) await expect(fields[i]).toHaveValue(values[i]); expect(await input!.evaluate(el => el.isConnected)).toBe(true);
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click(); await trigger.click(); await expect(panel).not.toBeVisible();
    await trigger.click(); await page.keyboard.press("Shift+Tab"); await expect(panel).not.toBeVisible(); // Native focus may leave the non-modal panel.
    await page.setViewportSize({ width: 1440, height: 900 }); await expect(panel).toBeVisible(); await expect(page.getByRole("button", { name: "업무 정보 닫기", exact: true })).not.toBeVisible();
    const wide = (await panel.boundingBox())!, publicArea = (await page.getByRole("region", { name: "접수 요약", exact: true }).boundingBox())!;
    expect(publicArea.x + publicArea.width).toBeLessThanOrEqual(wide.x); expect((await page.locator("#ticket-inspector").boundingBox())!.width).toBe(320);
    await page.setViewportSize({ width: 1280, height: 900 }); await trigger.click(); await page.evaluate(() => document.documentElement.style.fontSize = "200%"); await fits(page);
    await expect(fields[1]).toHaveValue(values[1]); await page.keyboard.press("Escape");
  } finally { await tenant.close(); await manager.close(); }
});

test("compact intake preview keeps native selection and puts submit directly after photo help", async ({ browser }) => {
  const tenant = await sdkSession(browser);
  try {
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/core");
    await page.getByLabel("문제 설명").fill("합성 compact 사진 접수");
    const picker = page.getByRole("region", { name: "사진 선택 및 미리보기", exact: true }); const file = picker.getByLabel("참고 사진 선택", { exact: true });
    await expect(file).toHaveAttribute("type", "file"); await expect(file).toHaveAttribute("accept", "image/jpeg,image/png"); await expect(file).toHaveAttribute("multiple", ""); await file.setInputFiles(await image());
    const preview = picker.getByAltText("전송 전 사진 1 미리보기"); await expect(preview).toBeVisible();
    expect((await preview.boundingBox())!.width).toBeLessThan((await picker.boundingBox())!.width / 2);
    await expect(picker.getByText("JPEG·PNG · 최대 3장", { exact: true })).toHaveCount(1);
    const recovery = picker.getByText(/선택한 사진은 아직 저장되지 않았어요/); await expect(recovery).not.toBeVisible();
    await picker.getByText("사진 도움말", { exact: true }).click(); await expect(recovery).toBeVisible(); await picker.getByText("사진 도움말", { exact: true }).click();
    const submit = page.getByRole("button", { name: "접수하기", exact: true });
    const a = (await picker.boundingBox())!, b = (await submit.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height); expect(b.y - a.y - a.height).toBeLessThanOrEqual(50);
    const element = await preview.elementHandle();
    for (const width of [320, 390, 768, 1280, 1440]) { await page.setViewportSize({ width, height: 900 }); await fits(page); expect(await element!.evaluate(el => el.isConnected)).toBe(true); }
    await page.evaluate(() => document.documentElement.style.fontSize = "200%"); await fits(page); await page.evaluate(() => document.documentElement.style.fontSize = "");
    let uploads = 0; page.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/photos")) uploads++; });
    const created = page.waitForResponse(r => r.url().endsWith("/core/tickets") && r.request().method() === "POST"); await submit.click(); expect((await created).status()).toBe(201);
    await expect(page.getByRole("region", { name: "사진", exact: true }).getByRole("img")).toHaveCount(1); expect(uploads).toBe(1);
  } finally { await tenant.close(); }
});

test("compact photo validation and failed upload preserve prominent recovery and the selected file", async ({ browser }) => {
  const tenant = await sdkSession(browser);
  try {
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/core");
    const file = page.getByLabel("참고 사진 선택", { exact: true }); const photo = await image();
    const picker = page.getByRole("region", { name: "사진 선택 및 미리보기", exact: true });
    await file.setInputFiles(Array.from({ length: 4 }, (_, i) => ({ ...photo, name: `synthetic-${i}.png` }))); await expect(picker.getByRole("alert")).toContainText("최대 3장");
    await file.setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("synthetic invalid photo") }); await expect(picker.getByRole("alert")).toContainText("JPEG·PNG만 선택");
    await file.setInputFiles(Array.from({ length: 3 }, (_, i) => ({ ...photo, name: `synthetic-${i}.png` }))); await expect(page.getByAltText(/전송 전 사진 .* 미리보기/)).toHaveCount(3);
    await page.getByRole("button", { name: "사진 3 선택 취소", exact: true }).click(); await page.getByRole("button", { name: "사진 2 선택 취소", exact: true }).click();
    await page.getByLabel("문제 설명").fill("합성 compact 전송 복구 확인");
    let uploads = 0, creates = 0; page.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/core/tickets")) creates++; });
    await page.route("**/api/v2/core/tickets/*/photos", route => { if (route.request().method() !== "POST") return route.continue(); uploads++; return uploads === 1 ? route.abort() : route.continue(); });
    await page.getByRole("button", { name: "접수하기", exact: true }).click(); await expect(page.getByText(/사진 전송 결과를 확인하지 못했어요/)).toBeVisible();
    await expect(page.getByText(/선택한 사진은 아직 저장되지 않았어요/)).toBeVisible(); await expect(page.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();
    await page.getByRole("button", { name: "사진 저장", exact: true }).click(); await expect(page.getByRole("region", { name: "사진", exact: true }).getByRole("img")).toHaveCount(1);
    await expect(page.getByAltText("전송 전 사진 1 미리보기")).toHaveCount(0); expect(creates).toBe(1); expect(uploads).toBe(2);
  } finally { await tenant.close(); }
});
