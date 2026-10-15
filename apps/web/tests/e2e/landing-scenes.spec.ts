import { test, expect, type Page } from "@playwright/test";

// Landing scroll scenes (spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md, design rules 9.1).
const scene = (page: Page, name: string) => page.locator(`[data-scene="${name}"]`);
const opacity = (page: Page, selector: string) => page.locator(selector).evaluate(el => getComputedStyle(el).opacity);

/** Scrolls so that the scene's progress is `p`: 0 at its top, 1 at its end. */
async function scrollScene(page: Page, name: string, p: number) {
  await page.evaluate(([n, q]) => {
    const el = document.querySelector<HTMLElement>(`[data-scene="${n}"]`)!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (el.offsetHeight - window.innerHeight) * Number(q));
  }, [name, String(p)] as const);
}

test("a step scene shows one step at a time and follows the scroll both ways", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const tenant = scene(page, "tenant");
  await expect(tenant).toHaveAttribute("data-motion", "on");
  for (const [p, step] of [[0.1, "0"], [0.5, "1"], [0.9, "2"], [0.1, "0"]] as const) {
    await scrollScene(page, "tenant", p);
    await expect(tenant).toHaveAttribute("data-step", step);
    await expect.poll(() => opacity(page, `[data-scene="tenant"] [data-screen="${step}"]`)).toBe("1");
  }
  await expect.poll(() => opacity(page, '[data-scene="tenant"] [data-screen="2"]')).toBe("0");
});

test("the first scene keeps its explanation out of sight until it shrinks, and shows it at once to the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hero = scene(page, "hero");
  await expect(hero).toHaveAttribute("data-motion", "on");
  await expect(hero).toHaveAttribute("data-side", "hidden");
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("0");
  await page.locator("[data-hero-side] a").first().focus();
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("1");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await scrollScene(page, "hero", 0.8);
  await expect(hero).toHaveAttribute("data-side", "shown");
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("1");
});

test("reduced motion shows every scene still, with every step and every screen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  for (const name of ["hero", "tenant", "manager", "vendor", "record"]) await expect(scene(page, name)).toHaveAttribute("data-motion", "off");
  for (const step of ["문제를 고르고 사진과 함께 접수해요", "위험한 신호부터 확인해요", "건물에 맞춘 질문에 답하고 보내요"]) {
    await expect(page.getByText(step, { exact: true })).toBeVisible();
  }
  for (const index of ["0", "1", "2"]) expect(await opacity(page, `[data-scene="vendor"] [data-screen="${index}"]`)).toBe("1");
});

test("a screen too short for the phone scenes keeps them still, and under 600px nothing moves", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(scene(page, "hero")).toHaveAttribute("data-motion", "on");
  await expect(scene(page, "tenant")).toHaveAttribute("data-motion", "off");
  await page.setViewportSize({ width: 390, height: 560 });
  await expect(scene(page, "hero")).toHaveAttribute("data-motion", "off");
});

test("no width scrolls sideways, at the top or in the middle of the scenes", async ({ page }) => {
  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/");
    for (const p of [0, 0.5]) {
      await scrollScene(page, "manager", p);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${width}px at ${p}`).toBe(0);
    }
  }
});

test("each drawing has one name, and a narrow screen hides past steps from the eye only", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("figure", { name: "세입자 접수 화면 세 단계 예시 · 체험용 데이터" })).toBeVisible();
  await expect(scene(page, "tenant")).toHaveAttribute("data-step", "0");
  expect(await page.locator('[data-scene="tenant"] [data-step-item="2"]').evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  await expect(page.getByRole("listitem").filter({ hasText: "건물에 맞춘 질문에 답하고 보내요" })).toHaveCount(1);
});
