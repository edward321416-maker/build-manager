// Design audit for design/DESIGN_RULES.md §15: screenshots plus geometric checks on a fresh synthetic fixture.
//   node --experimental-transform-types scripts/design-audit.mjs <outDir> [--engines chromium,webkit]
// Requires the pinned Node, Docker and a production Web build (npm run build:web). Synthetic data only; nothing leaves this machine.
// Checks (each one came from operator feedback recorded in the rules, §18):
//   edge-box   text closer than 6px to a box edge that is visible (background or border on that side)
//   edge-view  text closer than 16px to the left or right of the viewport
//   top        first text closer than 10px to the top of the page
//   clipped    select, button or input text that does not fit its box
//   hscroll    the page scrolls sideways
// Exit code 1 when any finding remains, so it can gate a design change.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = process.argv[2];
if (!out) { console.error("USAGE: design-audit.mjs <outDir> [--engines chromium,webkit]"); process.exit(2); }
const engineArg = process.argv.indexOf("--engines");
const engines = (engineArg > 0 ? process.argv[engineArg + 1] : "chromium,webkit").split(",");
mkdirSync(out, { recursive: true });
const playwright = createRequire(join(root, "package.json"))("@playwright/test");
const findings = [], shots = [];

function inspect() {
  document.querySelectorAll("details:not([open])").forEach(d => d.setAttribute("open", ""));
  const transparent = c => c === "rgba(0, 0, 0, 0)" || c === "transparent";
  const hiddenText = el => { for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0" || cs.clipPath.includes("inset(50%)")) return true; if (cs.display === "contents") continue; const r = a.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) return true; } return false; };
  const visibleSides = el => {
    const cs = getComputedStyle(el), sides = new Set();
    let a = el.parentElement, under = "rgb(255, 255, 255)";
    while (a) { const c = getComputedStyle(a).backgroundColor; if (!transparent(c)) { under = c; break; } a = a.parentElement; }
    if (!transparent(cs.backgroundColor) && cs.backgroundColor !== under) ["left", "right", "top", "bottom"].forEach(s => sides.add(s));
    for (const s of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(cs["border" + s + "Width"]) > 0 && cs["border" + s + "Style"] !== "none") sides.add(s.toLowerCase());
    if (el.tagName === "FIELDSET") sides.delete("top"); // the legend sits on the top border by design
    return sides;
  };
  const rects = node => { const r = document.createRange(); r.selectNodeContents(node); return [...r.getClientRects()].filter(x => x.width > 0); };
  const label = el => el.tagName.toLowerCase() + (el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : "") + " \"" + (el.innerText || el.value || "").replace(/\s+/g, " ").trim().slice(0, 30) + "\"";
  const result = [];
  const boxes = [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.width >= 40 && r.height >= 20 && !hiddenText(el) && visibleSides(el).size; });
  const boxSet = new Set(boxes);
  for (const box of boxes) {
    const sides = visibleSides(box), br = box.getBoundingClientRect(), min = { left: 1e9, right: 1e9, top: 1e9, bottom: 1e9 };
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || hiddenText(n.parentElement)) continue;
      let a = n.parentElement, nested = false; while (a && a !== box) { if (boxSet.has(a)) { nested = true; break; } a = a.parentElement; }
      if (nested) continue;
      for (const r of rects(n)) { min.left = Math.min(min.left, r.left - br.left); min.right = Math.min(min.right, br.right - r.right); min.top = Math.min(min.top, r.top - br.top); min.bottom = Math.min(min.bottom, br.bottom - r.bottom); }
    }
    const tight = [...sides].filter(s => min[s] < 6 && min[s] > -500);
    if (tight.length) result.push({ check: "edge-box", where: label(box), detail: tight.map(s => `${s} ${Math.round(min[s])}px`).join(", ") });
  }
  const vw = document.documentElement.clientWidth, walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let top = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim() || hiddenText(n.parentElement)) continue;
    const r = rects(n)[0]; if (!r) continue;
    if (top === null) top = r.top + scrollY;
    if (r.left < 16 || vw - r.right < 16) result.push({ check: "edge-view", where: label(n.parentElement), detail: `left ${Math.round(r.left)}px, right ${Math.round(vw - r.right)}px` });
  }
  if (top !== null && top < 10) result.push({ check: "top", where: "page", detail: `first text at ${Math.round(top)}px` });
  const ctx = document.createElement("canvas").getContext("2d");
  for (const el of document.querySelectorAll("select, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), a.primary-button")) {
    if (hiddenText(el)) continue;
    const cs = getComputedStyle(el), avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let text = el.tagName === "SELECT" ? (el.options[el.selectedIndex]?.text ?? "") : el.tagName === "INPUT" ? el.value : "";
    if (text) { ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; if (ctx.measureText(text).width > avail + 1) result.push({ check: "clipped", where: label(el), detail: `text ${Math.round(ctx.measureText(text).width)}px in ${Math.round(avail)}px` }); }
    else if (el.scrollWidth > el.clientWidth + 1) result.push({ check: "clipped", where: label(el), detail: `content ${el.scrollWidth}px in ${el.clientWidth}px` });
  }
  if (document.documentElement.scrollWidth > vw) result.push({ check: "hscroll", where: "page", detail: `${document.documentElement.scrollWidth}px wide in ${vw}px` });
  return result;
}

async function audit(page, name) {
  await page.waitForTimeout(800);
  const file = join(out, name + ".png");
  await page.screenshot({ path: file, fullPage: true }); shots.push(file);
  for (const f of await page.evaluate(inspect)) findings.push({ screen: name, ...f });
}

let server, state;
try {
  const dev = await import(pathToFileURL(join(root, "scripts/vendor-handoff-dev.mjs")).href);
  ({ state } = await dev.prepareVendorHandoff());
  server = await dev.startVendorHandoffServer(state);
  const origin = state.origin, phones = [375, 390, 430], wide = [768, 1280, 1440];
  for (const engine of engines) {
    let browser;
    try { browser = await playwright[engine].launch(); } catch { console.log(`DESIGN_AUDIT | ${engine} not installed: npx playwright install ${engine}`); continue; }
    const page = async (width, role) => {
      const p = await (await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 } })).newPage();
      await p.goto(origin + "/core");
      if (role) { await p.getByRole("button", { name: role === "manager" ? "관리자로 체험하기" : "세입자로 체험하기", exact: true }).click(); await p.getByRole("heading", { name: role === "manager" ? "업무함" : "어떤 문제가 있나요?", exact: true }).first().waitFor({ timeout: 20000 }); }
      return p;
    };
    const widths = engine === "webkit" ? phones : [...phones, ...wide];
    // Signed out and public screens.
    for (const width of widths) {
      const p = await page(width); await audit(p, `${engine}-${width}-signin`);
      await p.goto(origin + "/"); await audit(p, `${engine}-${width}-home`);
      if (width === 390) { await p.goto(origin + "/core/join"); await audit(p, `${engine}-${width}-join`); await p.goto(origin + "/vendor/job"); await audit(p, `${engine}-${width}-vendor-nolink`); }
      await p.context().close();
    }
    // Manager before any ticket (empty states), then a filter with no result.
    if (engine === engines[0]) for (const width of widths) {
      const m = await page(width, "manager"); await audit(m, `${engine}-${width}-manager-empty`);
      await m.getByRole("combobox", { name: "긴급도 필터" }).selectOption("URGENT"); await audit(m, `${engine}-${width}-manager-filter-empty`);
      await m.context().close();
    }
    // Tenant creates one ticket (once), then tenant and manager screens with data.
    if (engine === engines[0]) {
      const t = await page(390, "tenant");
      await t.getByLabel("문제 설명").fill("거실 보일러가 켜지지 않아요. 온수도 미지근해요.");
      await t.getByRole("button", { name: "접수하기", exact: true }).click(); await t.waitForTimeout(2500);
      await t.context().close();
    }
    for (const width of widths) {
      const t = await page(width, "tenant"); await audit(t, `${engine}-${width}-tenant-intake`);
      const open = t.locator("[data-open-ticket]").first(); if (await open.count()) { await open.click(); await audit(t, `${engine}-${width}-tenant-ticket`); }
      await t.context().close();
      const m = await page(width, "manager"); await audit(m, `${engine}-${width}-manager-queue`);
      const row = m.locator("[data-open-ticket]").first(); if (await row.count()) { await row.click(); await audit(m, `${engine}-${width}-manager-detail`); }
      await m.getByRole("navigation", { name: "관리자 보기" }).getByRole("button", { name: "호실 정비 이력", exact: true }).click(); await audit(m, `${engine}-${width}-manager-maintenance`);
      await m.getByRole("navigation", { name: "작업 이동" }).getByRole("link", { name: "입주 연결", exact: true }).click(); await audit(m, `${engine}-${width}-manager-onboarding`);
      await m.context().close();
    }
    await browser.close();
  }
} finally {
  try { await server?.stop(); } catch { /* already stopped */ }
  if (state?.containerId) { try { execFileSync("docker", ["rm", "-f", state.containerId], { stdio: "ignore" }); } catch { /* already removed */ } }
}
writeFileSync(join(out, "findings.json"), JSON.stringify(findings, null, 1));
for (const f of findings) console.log(`${f.check.padEnd(9)} ${f.screen.padEnd(40)} ${f.where} | ${f.detail}`);
console.log(`DESIGN_AUDIT | ${shots.length} screens | ${findings.length} findings | ${out}`);
process.exit(findings.length ? 1 : 0);
