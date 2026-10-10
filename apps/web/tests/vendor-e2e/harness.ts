import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client, type ClientConfig } from 'pg';
import type { VendorJobDto } from '@build-manager/api-contracts';
export { expect };
export type Account = { cookie: string; csrf: string; orgId: string; userId: string; digest: string };
export type Fixture = { origin: string; admin: ClientConfig; fixture: { unitA: string; orgA: string; accounts: Record<string, Account> } };
// Per-test timeline of API requests, focus moves, disclosure toggles and button enablement, printed only when a
// test fails so an intermittent CI failure shows where it stopped. API paths drop ids, query and fragment, and
// labels are limited to button and summary text, so no capability or session value reaches the log.
const trail: string[] = [];
let trailStart = 0;
const note = (who: string, line: string) => { if (trail.length < 400) trail.push(`${Date.now() - trailStart}ms ${who} ${line}`); };
async function watch(context: BrowserContext, page: Page, who: string) {
  const path = (url: string) => new URL(url).pathname.replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|[\w-]{32,}/gi, ':id');
  const api = (url: string) => { const p = path(url); return p.startsWith('/api/') ? p : null; };
  page.on('request', r => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) note(who, `navigate ${path(r.url())}`);
    const p = api(r.url()); if (p) note(who, `→ ${r.method()} ${p}`);
  });
  page.on('requestfinished', r => { const p = api(r.url()); if (p) r.response().then(x => note(who, `← ${r.method()} ${p} ${x?.status()}`), () => {}); });
  page.on('requestfailed', r => { const p = api(r.url()); if (p) note(who, `✕ ${r.method()} ${p} ${r.failure()?.errorText}`); });
  page.on('load', () => note(who, 'load'));
  page.on('pageerror', e => note(who, `pageerror ${e.name}`));
  page.on('console', m => { if (m.text().startsWith('[trail] ')) note(who, m.text().slice(8)); else if (m.type() === 'error') note(who, 'console error'); });
  await context.addInitScript(() => {
    const say = (line: string) => console.log('[trail] ' + line);
    const label = (e: Element) => e.matches('button, summary') ? (e.textContent ?? '').trim().slice(0, 24) : e.tagName.toLowerCase();
    document.addEventListener('focusin', e => { if (e.target instanceof Element) say(`focus ${label(e.target)}`); }, true);
    document.addEventListener('toggle', e => { if (e.target instanceof HTMLDetailsElement && e.target.id) say(`#${e.target.id} open=${e.target.open}`); }, true);
    new MutationObserver(records => { for (const r of records) if (r.target instanceof HTMLButtonElement) say(`${label(r.target)} ${r.target.disabled ? 'disabled' : 'enabled'}`); })
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  });
}
export const test = base.extend<{ fixture: Fixture; admin: Client; trail: void }>({
  fixture: async ({ browserName }, provide) => { expect(browserName).toBe('chromium'); await provide(JSON.parse(await readFile(process.env.VENDOR_BROWSER_PRIVATE_STATE!, 'utf8'))); },
  admin: async ({ fixture }, provide) => { const admin = new Client(fixture.admin); await admin.connect(); try { await provide(admin); } finally { await admin.end(); } },
  trail: [async ({}, provide, testInfo) => {
    trail.length = 0; trailStart = Date.now(); await provide();
    if (testInfo.status !== testInfo.expectedStatus) console.log([`VENDOR_E2E_TRAIL | ${testInfo.title}`, ...(trail.length ? trail : ['no browser activity recorded'])].join('\n'));
  }, { auto: true }],
});
export async function actor(browser: Browser, fixture: Fixture, who: string, width = 390) {
  const context = await browser.newContext({ baseURL: fixture.origin, viewport: { width, height: 900 } });
  await context.addCookies([{ name: '__session', value: fixture.fixture.accounts[who].cookie, url: fixture.origin, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage(); await watch(context, page, who);
  return { context, page, close: () => context.close() };
}
export async function core(f: Fixture, who: string, path: string, body?: unknown, status = 200) {
  const a = f.fixture.accounts[who];
  const response = await fetch(f.origin + '/api/v2/core/' + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    Cookie: '__session=' + a.cookie, Origin: f.origin, 'X-B1-CSRF': a.csrf, 'X-Core-Organization': a.orgId, 'Content-Type': 'application/json',
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  expect(response.status, `Core ${who} ${path.split('/').at(-1)} status`).toBe(status);
  return response.json();
}
export async function ticket(f: Fixture, route = 'GENERAL_VENDOR', text = 'Task12 synthetic private resident text') {
  const made = await core(f, 'tenant', 'tickets', { unitId: f.fixture.unitA, issueType: 'LEAK', rawUserText: text }, 201);
  if (route) await core(f, 'manager', `tickets/${made.ticketId}/decision`, { type: 'OVERRIDE', routeCode: route, reason: 'Task12 synthetic prerequisite' });
  return core(f, 'manager', `tickets/${made.ticketId}`);
}
export async function openTicket(page: Page, id: string, manager = false) {
  await safeGoto(page, '/core', 'open Core');
  const org = page.getByLabel('내 소속', { exact: true });
  if (await org.count()) {
    await expect(org).toBeVisible();
    const values = await org.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).filter(Boolean));
    if (values.length === 1) await org.selectOption(values[0]);
  }
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
  if (manager) await page.getByRole('button', { name: '업무 정보', exact: true }).click();
}
export async function safeGoto(page: Page, url: string, phase: string) {
  try { await page.goto(url); } catch { throw new Error(`Browser navigation failed: ${phase}; credential URL withheld`); }
}
const mutationButtons = new Set(['작업 요청 준비', '업체 전달 내용 게시', '보안 링크 발급', '보안 링크 재발급', '같은 요청으로 발급 결과 확인', '작업 수락', '가능한 시간 보내기', '방문 시간 제안하기', '이 시간으로 확정', '방문 시작 기록', '막힘 기록하기', '막힘 해제 기록', '추가 방문 일정 조율 시작', '같은 요청으로 사진 업로드 다시 확인', '작업 보고 제출하기', '확인한 내용 저장', '동의하기', '동의된 시간 안에서 방문 확정', '일정 변경하기', '거절하기', '철회하기', '업체 접근 철회', '해결됐어요', '정비 사실 저장']);
async function action(page: Page, name: string, run: () => Promise<void>) {
  const response = mutationButtons.has(name) ? page.waitForResponse(r => r.url().includes('/api/v2/') && r.request().method() === 'POST', { timeout: 5000 }) : null;
  if (response) await Promise.all([run(), response]); else await run();
}
export async function click(page: Page, name: string) { await action(page, name, () => page.getByRole('button', { name, exact: true }).click()); }
export async function keyboardClick(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true }); await expect(button).toBeEnabled(); await button.focus(); await action(page, name, () => page.keyboard.press('Enter'));
}
export async function issueThroughUI(page: Page, id: string, preauthorized = false) {
  await openTicket(page, id, true);
  await page.getByLabel('업체 표시 이름', { exact: true }).fill('Task12 synthetic Vendor');
  await click(page, '작업 요청 준비');
  await expect(page.getByText('작업 요청 준비를 저장했습니다.', { exact: true })).toBeVisible();
  await page.getByLabel('업체 작업 설명', { exact: true }).fill('Task12 synthetic minimum packet');
  if (preauthorized) await page.getByLabel('출입 정책', { exact: true }).selectOption('TENANT_PREAUTHORIZATION_ALLOWED');
  await click(page, '업체 전달 내용 미리보기');
  const preview = page.getByRole('region', { name: '업체 전달 내용 미리보기', exact: true });
  expect(await preview.innerText()).not.toContain('Task12 synthetic private resident text');
  await keyboardClick(page, '업체 전달 내용 게시');
  await expect(page.getByText('업체 전달 내용을 게시했습니다.', { exact: true })).toBeVisible();
  await keyboardClick(page, '보안 링크 발급');
  await expect(page.getByText('보안 링크를 발급했습니다. 업체에 직접 전달하세요.', { exact: true })).toBeVisible();
  const input = page.getByLabel('직접 전달할 보안 링크', { exact: true });
  // Boolean assertion never lets a failure render the input's secret value.
  expect(await input.count(), 'immediate link remains mounted after own Core version refresh').toBe(1);
  const link = await input.inputValue(); expect(Boolean(link.split('#')[1])).toBe(true);
  return link;
}
export async function provision(f: Fixture, preauthorized = false) {
  const t = await ticket(f);
  let m = await core(f, 'manager', `manager/tickets/${t.ticketId}/vendor-assignment`, { clientRequestId: randomUUID(), expectedTicketVersion: t.version, vendorLabel: 'Task12 synthetic Vendor' }, 201);
  m = await core(f, 'manager', `manager/vendor-assignments/${m.assignment.id}/packet-revisions`, { clientRequestId: randomUUID(), expectedAssignmentVersion: m.assignment.version, expectedPacketRevisionId: null, workSummary: 'Task12 synthetic minimum packet', sharedDetailKeys: [], allowedPhotoIds: [], accessPolicy: preauthorized ? 'TENANT_PREAUTHORIZATION_ALLOWED' : 'TENANT_PRESENT_REQUIRED', accessInstruction: null }, 201);
  const link = await core(f, 'manager', `manager/vendor-assignments/${m.assignment.id}/link`, { clientRequestId: randomUUID(), expectedAssignmentVersion: m.assignment.version, expectedPacketRevisionId: m.currentPacket.id }, 201);
  return { ticketId: t.ticketId, assignmentId: m.assignment.id, packetId: m.currentPacket.id, link: link.link };
}
export async function vendorContext(browser: Browser, f: Fixture, link: string) {
  const context = await browser.newContext({ baseURL: f.origin, viewport: { width: 390, height: 900 } }); const page = await context.newPage(); await watch(context, page, 'vendor');
  await safeGoto(page, link, 'redeem one-time capability');
  await expect(page.getByRole('button', { name: '작업 수락', exact: true })).toBeVisible();
  expect(await page.evaluate(() => location.hash.length === 0), 'capability fragment removed').toBe(true);
  return { context, page, close: () => context.close() };
}
export async function job(context: BrowserContext) {
  const r = await context.request.get('/api/v2/vendor/job'); expect(r.status()).toBe(200); return r.json();
}
export const guards = (j: VendorJobDto) => ({ expectedAssignmentVersion: j.assignmentVersion, expectedPacketRevisionId: j.currentPacket!.id, expectedRoundVersion: j.currentRound!.version });
/** Bounded negative probes use the actual browser cookie, distinct from B1 actor authority. */
export async function vendorPost(context: BrowserContext, origin: string, path: string, body: unknown, status = 200) {
  const session = await context.request.get('/api/v2/vendor/session'); expect(session.status()).toBe(200);
  const csrf = (await session.json()).csrf;
  const response = await context.request.post('/api/v2/vendor/' + path, { headers: { Origin: origin, 'x-vendor-csrf': csrf }, data: body });
  expect(response.status(), `Vendor ${path.split('/').at(-1)} status`).toBe(status); return response.json();
}
export async function scheduled(f: Fixture, context: BrowserContext, ticketId: string) {
  const j = await job(context), startAt = new Date(Date.now() + 86400000).toISOString(), endAt = new Date(Date.now() + 90000000).toISOString();
  await core(f, 'tenant', `tickets/${ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(j), windows: [{ startAt, endAt }] });
  const p = await vendorPost(context, f.origin, 'scheduling/proposals', { clientRequestId: randomUUID(), ...guards(await job(context)), slots: [{ startAt, endAt }] });
  await core(f, 'tenant', `tickets/${ticketId}/vendor-scheduling/confirm`, { clientRequestId: randomUUID(), ...guards(p), proposalId: p.proposal.id, selectedSlotId: p.proposal.slots[0].id });
  return job(context);
}
export async function interval(page: Page, legend: string, start = '11:00', end = '13:00') {
  const date = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const group = page.getByRole('group', { name: legend, exact: true });
  await group.getByLabel('날짜', { exact: true }).fill(date);
  await group.getByLabel('시작 시간', { exact: true }).fill(start); await group.getByLabel('종료 시간', { exact: true }).fill(end);
}
export async function responsive(page: Page, width: number, enlarged = false) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(scale => { document.documentElement.style.fontSize = scale ? '200%' : ''; }, enlarged);
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  if (!fits) console.log('T12_SAFE_GEOMETRY', await page.evaluate(() => [...document.querySelectorAll('body *')].map(e => ({ tag: e.tagName, class: e.getAttribute('class'), right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width })).filter(e => e.right > innerWidth + 1).slice(0, 12)));
  expect(fits, `no overflow ${width}/${enlarged}`).toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('button')].some(e => ['fixed', 'sticky'].includes(getComputedStyle(e).position) && getComputedStyle(e).bottom !== 'auto')), 'no sticky bottom CTA').toBe(false);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('[aria-label="업체 연결 및 작업 요청"] button, [aria-label="방문 일정"] button, main:has(#vendor-current-task) button')].filter(e => e.getClientRects().length && !e.disabled).every(e => e.getBoundingClientRect().height >= 49.5)), 'Vendor task minimum touch target height').toBe(true);
}
export async function forbiddenCopy(page: Page) {
  const text = await page.locator('body').innerText();
  for (const term of ['수리 완료', '문제 해결 완료', '완전히 해결됨', '업체 완료', '상시 출입 허용', '언제든 출입 허용', '자동 출입 허용', '링크 다시 보기', '링크 복구']) expect(text.includes(term), `forbidden semantics ${term}`).toBe(false);
}
