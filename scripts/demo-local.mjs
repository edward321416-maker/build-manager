// Login-free local demo launcher (operator decision 2026-10-09: remove login from the experience for now).
// Starts a fresh owned synthetic PostgreSQL fixture and the B1 Web app (synthetic provider, Vendor handoff on),
// then opens an isolated Chromium window to choose a role. Each choice opens its own isolated window already
// signed in as the seeded synthetic actor. This launcher is not part of the production app graph; the app's
// own login and security boundaries are unchanged. Usage (pinned Node 24.21.0, Docker running):
//   node --experimental-transform-types scripts/demo-local.mjs [--build] [--check]
// --build forces a fresh Web build; --check runs headless, presses both role buttons, verifies and exits.
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import { Client } from "pg";
import { prepareVendorHandoff, startVendorHandoffServer } from "./vendor-handoff-dev.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const roles = { manager: { label: "관리자", viewport: { width: 1280, height: 900 } }, tenant: { label: "세입자", viewport: { width: 430, height: 900 } } };

async function ensureBuild() {
  if (!process.argv.includes("--build") && existsSync(join(root, "apps/web/.next/BUILD_ID"))) return;
  console.log("DEMO_LOCAL | building the Web app (first run only)…");
  const build = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build"], { cwd: join(root, "apps/web"), stdio: "inherit", windowsHide: true });
  const [code] = await once(build, "exit");
  if (code !== 0) throw new Error("WEB_BUILD_FAILED");
}

/** Fresh synthetic B1 session for one seeded actor, the same way the existing synthetic SDK launchers do. */
async function signedCookie(state, who) {
  const account = state.fixture.accounts[who];
  const admin = new Client(state.admin), login = new Client(state.roles.b1.loginConfig);
  await admin.connect(); await login.connect();
  try {
    const identity = (await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'", [account.userId])).rows[0];
    if (identity?.issuer !== "https://b1.synthetic.invalid/" || !identity.subject.startsWith("auth0|synthetic-")) throw new Error("SYNTHETIC_IDENTITY_REQUIRED");
    const handle = randomBytes(32).toString("hex"), digest = createHash("sha256").update(handle).digest("hex");
    const user = (await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes') AS id", [identity.issuer, identity.subject, Buffer.from(digest, "hex")])).rows[0].id;
    if (user !== account.userId) throw new Error("SESSION_USER_MISMATCH");
    const issuedAt = Math.floor(Date.now() / 1000);
    return generateSessionCookie({ user: { sub: identity.subject }, tokenSet: { accessToken: randomBytes(32).toString("hex"), expiresAt: issuedAt + 3300 }, internal: { sid: randomUUID(), createdAt: issuedAt },
      b1: { handle, csrf: randomBytes(32).toString("hex"), issuedAt, expiresAt: issuedAt + 3300 } }, { secret: state.secret });
  } finally { await login.end(); await admin.end(); }
}

const chooser = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>자취사무소 체험</title><style>
body{font-family:system-ui,"Malgun Gothic",sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#1f2933;line-height:1.6}
h1{font-size:1.6rem;margin-bottom:.2rem}button{display:block;width:100%;margin:.6rem 0;padding:.9rem;font-size:1.05rem;border-radius:10px;border:1px solid #2f5d8a;background:#2f5d8a;color:#fff;cursor:pointer}
button.secondary{background:#fff;color:#2f5d8a}input{width:100%;box-sizing:border-box;padding:.7rem;font-size:.95rem;border:1px solid #9aa5b1;border-radius:8px}
section{margin:1.6rem 0}.note{font-size:.9rem;color:#52606d}#status{min-height:1.4em;color:#2f5d8a}</style></head><body>
<h1>자취사무소 체험</h1><p class="note">로그인 없이 합성 데모 데이터로 체험합니다. 실제 사람·건물·업체 정보는 없습니다.</p>
<section aria-label="역할 선택"><button onclick="enter('manager')">관리자로 체험하기</button><button onclick="enter('tenant')">세입자로 체험하기</button>
<p class="note">역할마다 새 창이 열립니다. 세입자 창에서 수리를 접수하고, 관리자 창에서 처리하거나 업체에 전달해 보세요.</p></section>
<section aria-label="업체 화면"><label for="link">관리자가 발급한 업체 보안 링크</label><input id="link" placeholder="http://localhost:3134/vendor/job#…" autocomplete="off">
<button class="secondary" onclick="vendor()">업체로 링크 열기</button><p class="note">링크는 한 번만 열 수 있습니다. 새 링크가 필요하면 관리자 창에서 다시 발급하세요.</p></section>
<p id="status" role="status"></p><p class="note">앱 안의 로그아웃 대신 이 창에서 역할을 다시 고르세요. 이 창을 닫으면 체험 서버와 데모 데이터가 정리됩니다.</p>
<script>const s=document.getElementById('status');
async function enter(r){s.textContent='창을 여는 중…';try{s.textContent=await window.demoEnter(r);}catch{s.textContent='창을 열지 못했습니다. 잠시 후 다시 눌러 주세요.';}}
async function vendor(){const i=document.getElementById('link');s.textContent='업체 화면을 여는 중…';try{s.textContent=await window.demoVendor(i.value.trim());i.value='';}catch{s.textContent='업체 링크를 열지 못했습니다. 링크를 다시 확인해 주세요.';}}</script></body></html>`;

let cleanup = async () => {};
try {
  if (process.version !== "v24.21.0") throw new Error("PINNED_NODE_REQUIRED");
  await ensureBuild();
  console.log("DEMO_LOCAL | preparing a fresh synthetic database…");
  const { state } = await prepareVendorHandoff();
  let server;
  cleanup = async () => {
    cleanup = async () => {};
    try { await server?.stop(); } catch { /* already stopped */ }
    try { execFileSync("docker", ["rm", "-f", state.containerId], { stdio: "ignore" }); } catch { /* already removed */ }
    console.log("DEMO_LOCAL | stopped the demo server and removed its synthetic database");
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void cleanup().finally(() => process.exit()));
  server = await startVendorHandoffServer(state);
  const check = process.argv.includes("--check");
  const browser = await chromium.launch({ headless: check });
  const home = await (await browser.newContext({ viewport: { width: 620, height: 820 } })).newPage();
  await home.exposeBinding("demoEnter", async (_source, who) => {
    if (!Object.hasOwn(roles, who)) throw new Error("UNKNOWN_ROLE");
    const context = await browser.newContext({ viewport: roles[who].viewport });
    await context.addCookies([{ name: "__session", value: await signedCookie(state, who), url: state.origin, httpOnly: true, sameSite: "Lax" }]);
    await (await context.newPage()).goto(state.origin + "/core");
    return `${roles[who].label} 창을 열었습니다.`;
  });
  await home.exposeBinding("demoVendor", async (_source, link) => {
    if (typeof link !== "string" || link.length > 300 || !link.startsWith(state.origin + "/vendor/job#")) throw new Error("INVALID_VENDOR_LINK");
    const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await (await context.newPage()).goto(link);
    return "업체 창을 열었습니다.";
  });
  await home.setContent(chooser);
  if (check) {
    // Self-check: press each real chooser button and require the signed-in role screen in its new window.
    for (const [who, heading] of [["manager", "업무함"], ["tenant", "어떤 문제가 있나요?"]]) {
      const opened = browser.contexts().length;
      await home.getByRole("button", { name: `${roles[who].label}로 체험하기`, exact: true }).click();
      await home.getByRole("status").filter({ hasText: `${roles[who].label} 창을 열었습니다.` }).waitFor({ timeout: 15000 });
      if (browser.contexts().length !== opened + 1) throw new Error("ROLE_WINDOW_MISSING");
      await browser.contexts().at(-1).pages()[0].getByRole("heading", { name: heading, exact: true }).waitFor({ timeout: 15000 });
    }
    console.log("DEMO_LOCAL_CHECK_PASS | manager workspace and tenant intake opened signed in from the chooser");
  } else {
    console.log(`DEMO_LOCAL_READY | ${state.origin} | choose a role in the opened window; close it to stop`);
    await new Promise(done => { home.on("close", done); browser.on("disconnected", done); });
  }
  await browser.close().catch(() => {});
  await cleanup();
} catch (error) {
  console.error("DEMO_LOCAL_FAILED | " + (error instanceof Error ? error.message : "unknown") + " | requires pinned Node 24.21.0, Docker and a free port 3134");
  await cleanup();
  process.exitCode = 1;
}
