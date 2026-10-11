#!/usr/bin/env node
// Hosted synthetic demo check (spec: docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md).
//   DEMO_ORIGIN=https://<host> node scripts/demo-smoke.mjs [--http-only] [--write-check] [--expect-text <path> <text>]...
// Prints one PASS/FAIL line per check, then SMOKE PASS or SMOKE FAIL. The address never appears in the output.
// Exit 0 = every check passed, 1 = a check failed, 2 = usage error (nothing was requested).
//   --http-only    skip the browser; the hourly .github/workflows/demo-health.yml runs this.
//   --write-check  save one synthetic repair request, so use it only right after a deploy.
//   --expect-text  prove a release reached the site, e.g. a chunk file that only the new image has.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { connect } from "node:tls";
import { pathToFileURL } from "node:url";

const CERT_MIN_DAYS = 7;
const DAY_MS = 86_400_000;
const TIMEOUT_MS = 15_000;
const MAX_LINE = 400;
const CHUNK_PATTERN = /\/_next\/static\/chunks\/[\w.~\/-]+?\.js/;
const PAGES = [["/core", 200], ["/vendor/job", 200], ["/api/v2/core/access", 401], ["/demo/landlord", 404]];
// The image optimizer route stays closed (PR #106): no query, an internal path and a reserved-domain URL.
const IMAGE_PATHS = ["/_next/image", "/_next/image?url=%2F&w=64&q=75", "/_next/image?url=https%3A%2F%2Fexample.invalid%2Fa.png&w=64&q=75"];
const USAGE = "USAGE: DEMO_ORIGIN=https://<host> node scripts/demo-smoke.mjs [--http-only] [--write-check] [--expect-text <path> <text>]...";

export function certificateCheck(validTo, now = new Date()) {
  const days = Math.floor((Date.parse(validTo) - now.getTime()) / DAY_MS);
  return Number.isFinite(days) ? { ok: days >= CERT_MIN_DAYS, days } : { ok: false, days: Number.NaN };
}

function parseArgs(argv) {
  const options = { httpOnly: false, writeCheck: false, expectText: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--http-only") options.httpOnly = true;
    else if (arg === "--write-check") options.writeCheck = true;
    else if (arg === "--expect-text") {
      const path = argv[index + 1], text = argv[index + 2];
      // Git Bash rewrites an argument such as /_next/... into C:/Program Files/Git/_next/... before node starts.
      if (/^[A-Za-z]:[\\/]/.test(path ?? "")) return { error: "EXPECT_TEXT_PATH_REWRITTEN: Git Bash turned the path into a Windows path; run with MSYS_NO_PATHCONV=1" };
      // A path on the demo: `//host/x` would resolve to another host.
      if (!/^\/(?!\/)/.test(path ?? "") || !text || text.startsWith("--")) return { error: "EXPECT_TEXT_NEEDS_PATH_AND_TEXT" };
      options.expectText.push([path, text]);
      index += 2;
    } else return { error: `UNKNOWN_ARGUMENT${arg.startsWith("--") ? ` ${arg.split("=")[0]}` : ""}` };
  }
  if (options.httpOnly && options.writeCheck) return { error: "WRITE_CHECK_NEEDS_BROWSER" };
  return { options };
}

function parseOrigin(value) {
  if (!value) return "DEMO_ORIGIN_REQUIRED";
  let url;
  try {
    url = new URL(value);
  } catch {
    return "DEMO_ORIGIN_INVALID";
  }
  const bare = ["http:", "https:"].includes(url.protocol) && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
  return bare ? url : "DEMO_ORIGIN_INVALID";
}

// Hide the origin, host, host name and every address it resolves to. An sslip.io name also spells its address,
// with dots and as its dashed first label, which survives when a message is cut inside the name.
export async function maskerFor(origin) {
  const secrets = new Set([origin.origin, origin.host, origin.hostname]);
  const dashed = /^(\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3})\./.exec(origin.hostname);
  if (dashed) secrets.add(dashed.slice(1, 5).join(".")).add(dashed.slice(1, 5).join("-"));
  try {
    for (const { address } of await lookup(origin.hostname, { all: true })) secrets.add(address);
  } catch {
    // An unresolvable name fails the first request; there is no address to hide.
  }
  const ordered = [...secrets].filter(Boolean).sort((a, b) => b.length - a.length);
  return (text) => ordered.reduce((out, secret) => out.split(secret).join("<demo>"), String(text));
}

function describe(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` (${error.cause.code ?? error.cause.message})` : "";
  return `${error.message}${cause}`.split("\n")[0];
}

async function request(url) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = response.headers.get("content-type") ?? "";
    return { status: response.status, type, body: await response.text(), detail: `got ${response.status}${type ? ` ${type}` : ""}` };
  } catch (error) {
    return { status: 0, type: "", body: "", detail: describe(error) };
  }
}

function certificateValidTo(origin) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: origin.hostname, port: Number(origin.port || 443), servername: isIP(origin.hostname) ? undefined : origin.hostname });
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error("TLS_TIMEOUT")));
    socket.once("secureConnect", () => {
      const validTo = socket.getPeerCertificate().valid_to;
      socket.destroy();
      if (validTo) resolve(validTo);
      else reject(new Error("NO_PEER_CERTIFICATE"));
    });
    socket.once("error", reject);
  });
}

async function httpChecks(origin, options, check) {
  const get = (path) => request(new URL(path, origin));
  const home = await get("/");
  check("GET / = 200", home.status === 200, home.detail);
  for (const [path, want] of PAGES) {
    const response = await get(path);
    check(`GET ${path} = ${want}`, response.status === want, response.detail);
  }
  const chunk = CHUNK_PATTERN.exec(home.body)?.[0];
  const chunkResponse = chunk ? await get(chunk) : undefined;
  check("GET a static chunk = 200", chunkResponse?.status === 200, chunkResponse ? chunkResponse.detail : "the first page loads no /_next/static/chunks/*.js");
  for (const path of IMAGE_PATHS) {
    const response = await get(path);
    check(`GET ${path} = 404`, response.status === 404 && !response.type.startsWith("image/"), response.detail);
  }
  for (const [path, text] of options.expectText) {
    const response = await get(path);
    check(`GET ${path} has the expected text`, response.status === 200 && response.body.includes(text), response.status === 200 ? "text not found" : response.detail);
  }
  if (origin.protocol === "https:") {
    const name = `TLS certificate valid for ${CERT_MIN_DAYS}+ days`;
    try {
      const { ok, days } = certificateCheck(await certificateValidTo(origin));
      check(name, ok, `${days} days left`);
    } catch (error) {
      check(name, false, describe(error));
    }
  }
}

// Browser checks of the login-free demo entries (DEV-12). Labels follow the current Web copy.
async function browserChecks(origin, options, check) {
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    check("browser checks", false, "@playwright/test is missing: run npm ci, or pass --http-only");
    return;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    check("browser launch", false, describe(error));
    return;
  }
  const serverErrors = [], pageErrors = [];
  const step = async (name, width, body) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    // Kept whole: check() masks the address before it shortens a long line.
    page.on("pageerror", (error) => pageErrors.push(error.message.split("\n")[0]));
    try {
      await page.goto(new URL("/core", origin).href, { timeout: TIMEOUT_MS });
      await body(page);
      check(name, true);
    } catch (error) {
      check(name, false, describe(error));
    } finally {
      // Leave no demo session behind; the entry-only step never signed in, so there is nothing to wait for.
      const signOut = page.getByRole("button", { name: "로그아웃", exact: true });
      if (await signOut.isVisible().catch(() => false)) await signOut.click({ timeout: 5_000 }).catch(() => {});
      await context.close();
    }
  };
  const enter = (page, role) => page.getByRole("button", { name: role, exact: true }).click({ timeout: TIMEOUT_MS });
  try {
    await step("both demo entry buttons at 390 px", 390, async (page) => {
      for (const role of ["관리자로 체험하기", "세입자로 체험하기"]) await page.getByRole("button", { name: role, exact: true }).waitFor({ timeout: TIMEOUT_MS });
    });
    await step("manager entry opens the work queue at 1280 px", 1280, async (page) => {
      await enter(page, "관리자로 체험하기");
      const organization = page.getByLabel("내 소속", { exact: true });
      const queue = page.getByRole("heading", { name: "업무함", exact: true });
      await Promise.race([organization.waitFor({ timeout: TIMEOUT_MS }), queue.waitFor({ timeout: TIMEOUT_MS })]).catch(() => {});
      if (await organization.count()) {
        const values = await organization.locator("option").evaluateAll((items) => items.map((item) => item.value).filter(Boolean));
        if (values.length === 1) await organization.selectOption(values[0]);
      }
      await queue.waitFor({ timeout: TIMEOUT_MS });
    });
    await step("tenant entry opens the repair intake at 390 px", 390, async (page) => {
      await enter(page, "세입자로 체험하기");
      await page.getByRole("heading", { name: "어떤 문제가 있나요?", exact: true }).waitFor({ timeout: TIMEOUT_MS });
      await page.getByRole("button", { name: "접수하기", exact: true }).waitFor({ timeout: TIMEOUT_MS });
    });
    if (options.writeCheck) {
      // PR #100: a saved but unsubmitted request reads 제출 전 and keeps its questions open under the summary.
      await step("write check saves a synthetic request before submission", 390, async (page) => {
        await enter(page, "세입자로 체험하기");
        await page.getByRole("radio", { name: "누수", exact: true }).check({ timeout: TIMEOUT_MS });
        await page.getByLabel("문제 설명").fill("합성 배포 확인 요청 (smoke check)");
        // Awaited together, so a click that fails cannot leave the response wait rejecting unhandled. The wait
        // outlasts the click, so a failed click reports its own error.
        const [created] = await Promise.all([
          page.waitForResponse((response) => response.url().endsWith("/api/v2/core/tickets") && response.request().method() === "POST", { timeout: 2 * TIMEOUT_MS }),
          page.getByRole("button", { name: "접수하기", exact: true }).click({ timeout: TIMEOUT_MS }),
        ]);
        const status = created.status();
        if (status !== 201) throw new Error(`ticket POST answered ${status}`);
        await page.getByRole("status").filter({ hasText: "접수 내용을 저장했어요" }).waitFor({ timeout: TIMEOUT_MS });
        const state = (await page.getByTestId("work-status").textContent({ timeout: TIMEOUT_MS }))?.trim();
        if (state !== "제출 전") throw new Error(`work status reads ${state}`);
        await page.getByRole("region", { name: "지금 할 일: 추가 확인", exact: true }).waitFor({ timeout: TIMEOUT_MS });
      });
    }
  } finally {
    await browser.close();
  }
  check("no 5xx responses", serverErrors.length === 0, serverErrors.join("; "));
  check("no page errors", pageErrors.length === 0, pageErrors.join("; "));
}

async function main(argv, env) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    console.error(`${parsed.error}\n${USAGE}`);
    return 2;
  }
  const origin = parseOrigin(env.DEMO_ORIGIN);
  if (typeof origin === "string") {
    console.error(`${origin}\n${USAGE}`);
    return 2;
  }
  // URL parsing turns `/\host` and paths with tabs or newlines into another host; every check stays on the demo.
  if (parsed.options.expectText.some(([path]) => new URL(path, origin).origin !== origin.origin)) {
    console.error(`EXPECT_TEXT_PATH_LEAVES_THE_DEMO\n${USAGE}`);
    return 2;
  }
  const mask = await maskerFor(origin);
  let failed = 0;
  // Mask first, then shorten, so a cut can never leave part of the address behind.
  const check = (name, ok, detail) => {
    if (!ok) failed += 1;
    const line = mask(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    console.log(line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}…` : line);
  };
  // Anything that escapes the checks still counts as a failure and is printed masked, never as a raw stack.
  const escaped = (error) => {
    check("smoke run", false, describe(error));
    process.exitCode = 1;
  };
  process.on("unhandledRejection", escaped);
  process.on("uncaughtException", escaped);
  try {
    await httpChecks(origin, parsed.options, check);
    if (!parsed.options.httpOnly) await browserChecks(origin, parsed.options, check);
  } catch (error) {
    check("smoke run", false, describe(error));
  }
  console.log(failed ? `SMOKE FAIL (${failed} failed)` : "SMOKE PASS");
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
