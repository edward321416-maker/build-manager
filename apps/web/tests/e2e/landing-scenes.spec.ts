import { test, expect, type Page } from "@playwright/test";

// Landing scroll scenes (spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md, design rules 9.1).
const scene = (page: Page, name: string) => page.locator(`[data-scene="${name}"]`);
const opacity = (page: Page, selector: string) => page.locator(selector).evaluate(el => getComputedStyle(el).opacity);

/** Waits two frames so a scroll has been followed by the page's own frame update before anything is measured. */
const settle = (page: Page) =>
  page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

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
    for (const index of ["0", "1", "2"]) {
      await expect.poll(() => opacity(page, `[data-scene="tenant"] [data-screen="${index}"]`), `screen ${index} at step ${step}`).toBe(index === step ? "1" : "0");
    }
  }
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
  // The board is still full size here, so the explanation needs its own surface to keep its words off the drawing's.
  expect(await page.locator("[data-hero-side]").evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  // Focus, not scrolling, revealed it: the scene still reports the explanation as hidden.
  await expect(hero).toHaveAttribute("data-side", "hidden");
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
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("1");
  for (const index of ["0", "1", "2"]) await expect.poll(() => opacity(page, `[data-scene="vendor"] [data-screen="${index}"]`)).toBe("1");
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
    // Wait until the scenes have decided on or off, so the measurement is of the state a visitor ends up in.
    await expect(scene(page, "manager")).toHaveAttribute("data-motion", /^(on|off)$/);
    await settle(page);
    expect(await overflow(page), `${width}px at the top`).toBe(0);
    for (const [name, p] of [["hero", 0.5], ["manager", 0], ["manager", 0.5]] as const) {
      await scrollScene(page, name, p);
      await settle(page);
      expect(await overflow(page), `${width}px at ${name} ${p}`).toBe(0);
    }
  }
});

// Operator decision 2026-10-15 (A): drawings shrink to fit rather than overlap the title or run past the scene.
test("the first scene's drawing stays clear of its title on laptop screens, with the manager window at full width", async ({ page }) => {
  for (const [width, height] of [[1024, 768], [1280, 800], [1280, 900], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(scene(page, "hero")).toHaveAttribute("data-motion", "on");
    await settle(page);
    const found = await page.evaluate(() => {
      const figure = document.querySelector('[data-scene="hero"] figure')!;
      const [phone, managerWindow] = Array.from(figure.children).map(el => el.getBoundingClientRect());
      const range = document.createRange();
      range.selectNodeContents(document.querySelector("#home-title")!);
      const lines = Array.from(range.getClientRects());
      const hits = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        overlaps: lines.filter(line => hits(line, phone) || hits(line, managerWindow)).length,
        ratio: managerWindow.width / phone.width,
        gap: managerWindow.left - phone.right,
      };
    });
    expect(found.overlaps, `${width}×${height} title lines over the drawing`).toBe(0);
    // Operator 2026-10-15: tucked behind the phone, the window's first words were hidden; they stand apart now.
    expect(found.gap, `${width}×${height} space between the phone and the window`).toBeGreaterThan(0);
    // Both are scaled together, so 37.5rem against 17.5rem stays about 2.1.
    expect(found.ratio, `${width}×${height} window to phone width`).toBeGreaterThan(2);
  }
});

test("a step scene moves on common phones only while its tallest step and its drawing fit the stage", async ({ page }) => {
  for (const [width, height] of [[390, 844], [375, 812]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    for (const name of ["tenant", "manager", "vendor"]) {
      await expect(scene(page, name), `${name} at ${width}×${height}`).toHaveAttribute("data-motion", "on");
      for (const p of [0.1, 0.5, 0.9]) {
        await scrollScene(page, name, p);
        await settle(page);
        const past = await page.evaluate(n => {
          const stage = document.querySelector(`[data-scene="${n}"] [data-stage]`)!.getBoundingClientRect();
          return document.querySelector(`[data-scene="${n}"] figure`)!.getBoundingClientRect().bottom - stage.bottom;
        }, name);
        expect(past, `${name} drawing past the stage at ${width}×${height}, p ${p}`).toBeLessThanOrEqual(0);
      }
    }
  }
  // The manager scene's steps make it taller than a 375×667 stage, so it stays an ordinary section there.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(scene(page, "hero")).toHaveAttribute("data-motion", "on");
  await expect(scene(page, "manager")).toHaveAttribute("data-motion", "off");
});

test("no drawn screen's words run past its phone or window, so at 320px the manager scene stays still", async ({ page }) => {
  for (const [width, height] of [[320, 844], [360, 740], [390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(scene(page, "manager")).toHaveAttribute("data-motion", /^(on|off)$/);
    await settle(page);
    const clipped = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-motion="on"] [data-screen]'))
      .filter(screen => {
        const frame = screen.parentElement!.getBoundingClientRect();
        return screen.lastElementChild!.getBoundingClientRect().bottom > frame.bottom;
      })
      .map(screen => `${screen.closest<HTMLElement>("[data-scene]")!.dataset.scene} ${screen.dataset.screen}`));
    expect(clipped, `${width}×${height}`).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(scene(page, "manager")).toHaveAttribute("data-motion", "off");
});

test("opening the page starts no transition: the scenes turn on as they will look (rules 9.1)", async ({ page }) => {
  await page.addInitScript(() => {
    (window as { transitionRuns?: string[] }).transitionRuns = [];
    document.addEventListener("transitionrun", event => {
      (window as { transitionRuns?: string[] }).transitionRuns!.push((event as TransitionEvent).propertyName);
    }, true);
  });
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(scene(page, "tenant")).toHaveAttribute("data-motion", "on");
    await settle(page);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as { transitionRuns?: string[] }).transitionRuns), `${width}×${height}`).toEqual([]);
  }
});

test("each drawing has one name, and a narrow screen hides past steps from the eye only", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(scene(page, "tenant")).toHaveAttribute("data-motion", "on");
  await expect(page.getByRole("figure", { name: "세입자 접수 화면 세 단계 예시 · 체험용 데이터" })).toBeVisible();
  // At the last step the first step is a past one: still in the document and the accessibility tree, but clipped to nothing.
  await scrollScene(page, "tenant", 0.9);
  await settle(page);
  await expect(scene(page, "tenant")).toHaveAttribute("data-step", "2");
  const past = page.locator('[data-scene="tenant"] [data-step-item="0"]');
  expect(await past.evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  await expect.poll(() => past.evaluate(el => el.getBoundingClientRect().width), "past step width").toBeLessThanOrEqual(1);
  await expect.poll(() => past.evaluate(el => el.getBoundingClientRect().height), "past step height").toBeLessThanOrEqual(1);
  await expect(page.getByRole("listitem").filter({ hasText: "문제를 고르고 사진과 함께 접수해요" })).toHaveCount(1);
});
