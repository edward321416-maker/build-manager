import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateSafety } from "@build-manager/domain";
import { WRITE_CHECK_CLOSE_MESSAGES, WRITE_CHECK_TEXT, certificateCheck, closeAsManager, confirmAsTenant, maskerFor, namingTicket } from "../../scripts/demo-smoke.mjs";

// Spec: docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md (PR A). The script runs for real against
// a fake demo on 127.0.0.1, so every assertion below is about its exit code and printed lines.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "demo-smoke.mjs");
const CHUNK = "/_next/static/chunks/3su_lcb-c4-x-.js";
const SPAWN_TIMEOUT = 20_000;

type Route = { status: number; type?: string; body?: string };
function healthy(): Record<string, Route> {
  return {
    "/": { status: 200, type: "text/html", body: `<html><script src="${CHUNK}" async=""></script></html>` },
    [CHUNK]: { status: 200, type: "application/javascript", body: 'id:"vendor-window-full"' },
    "/core": { status: 200, type: "text/html", body: "<html></html>" },
    "/vendor/job": { status: 200, type: "text/html", body: "<html></html>" },
    "/api/v2/core/access": { status: 401, type: "application/json", body: "{}" },
    "/demo/landlord": { status: 404, type: "text/html", body: "" },
    "/_next/image*": { status: 404, type: "text/html; charset=utf-8", body: "" },
  };
}

let server: Server, origin: string, routes: Record<string, Route>, requests: number;
beforeEach(async () => {
  routes = healthy();
  requests = 0;
  server = createServer((request, response) => {
    requests += 1;
    const path = request.url ?? "/";
    const route = routes[path] ?? (path.startsWith("/_next/image") ? routes["/_next/image*"] : undefined) ?? { status: 404 };
    response.writeHead(route.status, { "content-type": route.type ?? "text/plain" });
    response.end(route.body ?? "");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

// Asynchronous on purpose: the fake demo answers from this same process. `null` runs without DEMO_ORIGIN.
function run(args: string[], demoOrigin: string | null = origin): Promise<{ code: number | null; output: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DEMO_ORIGIN;
  if (demoOrigin !== null) env.DEMO_ORIGIN = demoOrigin;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: ROOT, env });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

describe("demo smoke check over HTTP", () => {
  it("passes against a healthy demo and never prints the address", async () => {
    const { code, output } = await run(["--http-only"]);
    expect(output).toContain("SMOKE PASS");
    expect(code).toBe(0);
    expect(output).toMatch(/^PASS GET \/api\/v2\/core\/access = 401$/m);
    expect(output).toMatch(/^PASS GET a static chunk = 200$/m);
    expect(output).not.toContain("127.0.0.1");
  }, SPAWN_TIMEOUT);

  it("fails when the image optimizer route answers again", async () => {
    routes["/_next/image*"] = { status: 400, type: "text/plain", body: '"url" parameter is required' };
    const { code, output } = await run(["--http-only"]);
    expect(code).toBe(1);
    expect(output).toMatch(/^FAIL GET \/_next\/image = 404 — got 400/m);
    expect(output).toContain("SMOKE FAIL");
  }, SPAWN_TIMEOUT);

  it("fails when a signed-out visitor is let in", async () => {
    routes["/api/v2/core/access"] = { status: 200, type: "application/json", body: "{}" };
    const { code, output } = await run(["--http-only"]);
    expect(code).toBe(1);
    expect(output).toMatch(/^FAIL GET \/api\/v2\/core\/access = 401 — got 200/m);
  }, SPAWN_TIMEOUT);

  it("fails when the first page loads no static chunk", async () => {
    routes["/"] = { status: 200, type: "text/html", body: "<html></html>" };
    const { code, output } = await run(["--http-only"]);
    expect(code).toBe(1);
    expect(output).toMatch(/^FAIL GET a static chunk = 200/m);
  }, SPAWN_TIMEOUT);

  it("checks that a released file carries the expected text", async () => {
    const present = await run(["--http-only", "--expect-text", CHUNK, "vendor-window-full"]);
    expect(present.code).toBe(0);
    expect(present.output).toContain(`PASS GET ${CHUNK} has the expected text`);
    const missing = await run(["--http-only", "--expect-text", CHUNK, "vendor-completion-missing"]);
    expect(missing.code).toBe(1);
    expect(missing.output).toContain(`FAIL GET ${CHUNK} has the expected text`);
  }, SPAWN_TIMEOUT);

  it.each([
    { name: "no address", args: ["--http-only"], target: "none", message: "DEMO_ORIGIN_REQUIRED" },
    { name: "an address with a path", args: ["--http-only"], target: "path", message: "DEMO_ORIGIN_INVALID" },
    { name: "a write check without the browser", args: ["--http-only", "--write-check"], target: "demo", message: "WRITE_CHECK_NEEDS_BROWSER" },
    { name: "an unknown option", args: ["--http-only", "--fast"], target: "demo", message: "UNKNOWN_ARGUMENT" },
    { name: "an expect-text without its text", args: ["--http-only", "--expect-text", CHUNK], target: "demo", message: "EXPECT_TEXT_NEEDS_PATH_AND_TEXT" },
    // Git Bash turns `/_next/...` into a Windows path before node sees it; say how to stop that.
    { name: "a path Git Bash rewrote", args: ["--http-only", "--expect-text", `C:/Program Files/Git${CHUNK}`, "id"], target: "demo", message: "MSYS_NO_PATHCONV=1" },
    // An unknown --name=value option is named without its value, which could be an address.
    { name: "an unknown option carrying a value", args: ["--http-only", "--origin=https://203-0-113-7.sslip.invalid"], target: "demo", message: "UNKNOWN_ARGUMENT --origin" },
    // `//host/x`, `/\host/x` and a path with a tab all resolve against the demo to another host.
    { name: "an expect-text path to another host", args: ["--http-only", "--expect-text", "//203-0-113-7.sslip.invalid/x", "id"], target: "demo", message: "EXPECT_TEXT_NEEDS_PATH_AND_TEXT" },
    { name: "an expect-text path with a backslash", args: ["--http-only", "--expect-text", "/\\203-0-113-7.sslip.invalid/x", "id"], target: "demo", message: "EXPECT_TEXT_PATH_LEAVES_THE_DEMO" },
    { name: "an expect-text path with a tab", args: ["--http-only", "--expect-text", "/\t/203-0-113-7.sslip.invalid/x", "id"], target: "demo", message: "EXPECT_TEXT_PATH_LEAVES_THE_DEMO" },
    // A path that does not parse must not surface the URL parser's error, which names the demo origin.
    { name: "an expect-text path that does not parse", args: ["--http-only", "--expect-text", "/\\[", "id"], target: "demo", message: "EXPECT_TEXT_PATH_LEAVES_THE_DEMO" },
  ] as const)("stops with exit 2 and no request for $name", async ({ args, target, message }) => {
    const demoOrigin = target === "none" ? null : target === "path" ? `${origin}/core` : origin;
    const { code, output } = await run([...args], demoOrigin);
    expect(code).toBe(2);
    expect(output).toContain(message);
    expect(output).not.toContain("127.0.0.1");
    expect(output).not.toContain("203-0-113-7");
    expect(requests).toBe(0);
  }, SPAWN_TIMEOUT);

  it("fails with the address hidden when the demo cannot be reached", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    // Over HTTPS the certificate check reports `connect ECONNREFUSED <address>:<port>`, so this fails if any
    // printed line skips the mask.
    const { code, output } = await run(["--http-only"], `https://127.0.0.1:${port}`);
    expect(code).toBe(1);
    expect(output).toMatch(/^FAIL GET \/ = 200/m);
    expect(output).not.toContain("127.0.0.1");
    expect(output).not.toContain(`:${port}`);
  }, SPAWN_TIMEOUT);
});

describe("address masking", () => {
  it("hides the origin, host and port in an error that spells them out", async () => {
    const mask = await maskerFor(new URL("http://127.0.0.1:8080"));
    expect(mask("GET http://127.0.0.1:8080/core failed: connect ECONNREFUSED 127.0.0.1:8080")).toBe("GET <demo>/core failed: connect ECONNREFUSED <demo>");
  });
  it("hides the address an sslip.io-style name spells with dashes", async () => {
    // The reserved .invalid name never resolves, so only the dashed spelling can reveal the address.
    const mask = await maskerFor(new URL("https://203-0-113-7.sslip.invalid"));
    expect(mask("navigating to https://203-0-113-7.sslip.invalid/core: connect ETIMEDOUT 203.0.113.7:443")).toBe("navigating to <demo>/core: connect ETIMEDOUT <demo>:443");
    // A message cut short inside the host name still spells the address with dashes.
    expect(mask("TypeError at https://203-0-113-7.ssli")).toBe("TypeError at https://<demo>.ssli");
  }, SPAWN_TIMEOUT);
});

describe("write check", () => {
  // The first --write-check run, right after the P1b deploy on 2026-10-12 KST, failed: its text said "smoke check", the
  // domain's safety scan escalated the request as urgent, and an urgent request never reads 제출 전.
  it("saves a request whose text the safety scan does not escalate", () => {
    expect(evaluateSafety({ rawText: WRITE_CHECK_TEXT })).toMatchObject({ escalated: false, flags: [] });
  });
});

// Spec: docs/superpowers/specs/2026-10-15-smoke-write-check-closes-design.md. These two functions run inside the demo
// page (page.evaluate) with the page's own fetch; here they get a fake one that records every request.
describe("write check closes its own request", () => {
  const CSRF = "c".repeat(64), ORG = "11111111-1111-4111-8111-111111111111", TICKET = "T-1/a?b";
  type Call = { method: string; path: string; headers: Record<string, string>; body: unknown; signal: unknown };
  function fakeFetch(answers: Record<string, number>, ticket: { workStatus: string } = { workStatus: "COMPLETED" }, organizations: unknown[] = [{ id: ORG, name: "합성", role: "ORG_ADMIN" }]) {
    const calls: Call[] = [];
    const impl = async (path: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: unknown } = {}) => {
      const method = init.method ?? "GET";
      calls.push({ method, path, headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal });
      if (path === "/api/v2/core/access") return new Response(JSON.stringify({ authentication: "B1", synthetic: true, csrf: CSRF, organizations }), { status: answers.access ?? 200 });
      if (method === "GET") return new Response(JSON.stringify(ticket), { status: answers.read ?? 200 });
      const key = path.endsWith("/resolved") ? "resolved" : (JSON.parse(init.body ?? "{}") as { status: string }).status;
      return new Response("{}", { status: answers[key] ?? 500 });
    };
    return { calls, impl };
  }
  const handling = `/api/v2/core/tickets/${encodeURIComponent(TICKET)}/handling`;

  it("records 처리 시작 then 처리 완료 for the saved ticket with the page's organisation and CSRF value", async () => {
    const fake = fakeFetch({ IN_PROGRESS: 200, COMPLETED: 200 });
    const result = await closeAsManager({ ticketId: TICKET, ...WRITE_CHECK_CLOSE_MESSAGES }, fake.impl as typeof fetch);
    expect(result).toEqual({ access: 200, started: 200, completed: 200 });
    expect(fake.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /api/v2/core/access", `POST ${handling}`, `POST ${handling}`]);
    expect(fake.calls[1].body).toEqual({ status: "IN_PROGRESS", message: WRITE_CHECK_CLOSE_MESSAGES.start });
    expect(fake.calls[2].body).toEqual({ status: "COMPLETED", message: WRITE_CHECK_CLOSE_MESSAGES.complete });
    for (const call of fake.calls.slice(1)) expect(call.headers).toMatchObject({ "x-core-organization": ORG, "x-b1-csrf": CSRF, "content-type": "application/json" });
    expect(JSON.stringify(result)).not.toContain(CSRF);
  });

  it("does not record 처리 완료 when 처리 시작 is refused", async () => {
    const fake = fakeFetch({ IN_PROGRESS: 409, COMPLETED: 200 });
    expect(await closeAsManager({ ticketId: TICKET, ...WRITE_CHECK_CLOSE_MESSAGES }, fake.impl as typeof fetch)).toEqual({ access: 200, started: 409, completed: null });
    expect(fake.calls).toHaveLength(2);
  });

  it("sends nothing when the page has no session", async () => {
    const fake = fakeFetch({ access: 401 });
    expect(await closeAsManager({ ticketId: TICKET, ...WRITE_CHECK_CLOSE_MESSAGES }, fake.impl as typeof fetch)).toEqual({ access: 401, started: null, completed: null });
    expect(fake.calls).toHaveLength(1);
  });

  it("confirms the result as the tenant and reads the ticket back", async () => {
    const fake = fakeFetch({ resolved: 201 });
    const clientRequestId = "22222222-2222-4222-8222-222222222222";
    const result = await confirmAsTenant({ ticketId: TICKET, clientRequestId }, fake.impl as typeof fetch);
    expect(result).toEqual({ access: 200, resolved: 201, workStatus: "COMPLETED" });
    const base = `/api/v2/core/tickets/${encodeURIComponent(TICKET)}`;
    expect(fake.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /api/v2/core/access", `POST ${base}/outcome/resolved`, `GET ${base}`]);
    expect(fake.calls[1].body).toEqual({ clientRequestId });
    expect(fake.calls[1].headers).toMatchObject({ "x-core-organization": ORG, "x-b1-csrf": CSRF });
    expect(JSON.stringify(result)).not.toContain(CSRF);
  });

  it("sends the organisation and CSRF headers on the read-back too, and a time limit on every request", async () => {
    const fake = fakeFetch({ resolved: 201 });
    await confirmAsTenant({ ticketId: TICKET, clientRequestId: "44444444-4444-4444-8444-444444444444" }, fake.impl as typeof fetch);
    expect(fake.calls[2]).toMatchObject({ method: "GET", headers: { "x-core-organization": ORG, "x-b1-csrf": CSRF } });
    const manager = fakeFetch({ IN_PROGRESS: 200, COMPLETED: 200 });
    await closeAsManager({ ticketId: TICKET, ...WRITE_CHECK_CLOSE_MESSAGES }, manager.impl as typeof fetch);
    for (const call of [...fake.calls, ...manager.calls]) expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends nothing more as the tenant without a session, and reports a failed read-back as no status", async () => {
    const signedOut = fakeFetch({ access: 401 });
    expect(await confirmAsTenant({ ticketId: TICKET, clientRequestId: "55555555-5555-4555-8555-555555555555" }, signedOut.impl as typeof fetch)).toEqual({ access: 401, resolved: null, workStatus: null });
    expect(signedOut.calls).toHaveLength(1);
    const unreadable = fakeFetch({ resolved: 201, read: 404 });
    expect((await confirmAsTenant({ ticketId: TICKET, clientRequestId: "66666666-6666-4666-8666-666666666666" }, unreadable.impl as typeof fetch)).workStatus).toBeNull();
  });

  it("refuses a session without an organisation instead of sending a request", async () => {
    const fake = fakeFetch({ IN_PROGRESS: 200 }, undefined, []);
    await expect(closeAsManager({ ticketId: TICKET, ...WRITE_CHECK_CLOSE_MESSAGES }, fake.impl as typeof fetch)).rejects.toThrow("NO_ORGANIZATION");
    await expect(confirmAsTenant({ ticketId: TICKET, clientRequestId: "77777777-7777-4777-8777-777777777777" }, fake.impl as typeof fetch)).rejects.toThrow("NO_ORGANIZATION");
    expect(fake.calls.map((c) => c.path)).toEqual(["/api/v2/core/access", "/api/v2/core/access"]);
  });

  it("runs from its own source text with nothing but fetch, as page.evaluate runs it", async () => {
    // page.evaluate sends the function's text to the page and calls it with one argument; a reference to anything in
    // this module (a constant, an import) would fail there, so rebuild each function from its text with only `fetch`.
    const rebuild = <F,>(fn: F, fetchImpl: unknown) => new Function("fetch", `return (${String(fn)})`)(fetchImpl) as F;
    const manager = fakeFetch({ IN_PROGRESS: 200, COMPLETED: 200 });
    expect(await rebuild(closeAsManager, manager.impl)({ ticketId: TICKET, ...WRITE_CHECK_CLOSE_MESSAGES })).toEqual({ access: 200, started: 200, completed: 200 });
    const tenant = fakeFetch({ resolved: 201 });
    expect(await rebuild(confirmAsTenant, tenant.impl)({ ticketId: TICKET, clientRequestId: "88888888-8888-4888-8888-888888888888" })).toEqual({ access: 200, resolved: 201, workStatus: "COMPLETED" });
  });

  it("names the request in every failure while closing it", async () => {
    await expect(namingTicket("abc123", async () => { throw new Error("locator.waitFor: Timeout 15000ms exceeded"); })).rejects.toThrow("ticket abc123: locator.waitFor: Timeout 15000ms exceeded");
    await expect(namingTicket("abc123", async () => { throw "page closed"; })).rejects.toThrow("ticket abc123: page closed");
    expect(await namingTicket("abc123", async () => 7)).toBe(7);
  });

  it("reports the work status the read-back gives, not an assumed one", async () => {
    const fake = fakeFetch({ resolved: 201 }, { workStatus: "IN_PROGRESS" });
    const result = await confirmAsTenant({ ticketId: TICKET, clientRequestId: "33333333-3333-4333-8333-333333333333" }, fake.impl as typeof fetch);
    expect(result.workStatus).toBe("IN_PROGRESS");
  });

  it("closes with messages the safety scan does not escalate", () => {
    for (const message of Object.values(WRITE_CHECK_CLOSE_MESSAGES)) expect(evaluateSafety({ rawText: message })).toMatchObject({ escalated: false, flags: [] });
  });
});

describe("certificate check", () => {
  const now = new Date("2026-10-11T00:00:00Z");
  it("accepts a certificate with seven or more days left", () => {
    expect(certificateCheck("Oct 20 00:00:00 2026 GMT", now)).toEqual({ ok: true, days: 9 });
  });
  it("rejects a certificate close to expiry or an unreadable date", () => {
    expect(certificateCheck("Oct 15 00:00:00 2026 GMT", now)).toEqual({ ok: false, days: 4 });
    expect(certificateCheck("not a date", now).ok).toBe(false);
  });
});
