import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { test, expect, actor, ticket, core, openTicket, issueThroughUI, vendorContext, provision, job, guards, interval, click, keyboardClick, responsive, forbiddenCopy, safeGoto, vendorPost, scheduled } from './harness';

test('T12-B01 mounted Manager issue survives own refresh; browser redeem is not Accept and reuse fails', async ({ browser, fixture }) => {
  const t = await ticket(fixture), m = await actor(browser, fixture, 'manager', 1440);
  try {
    const link = await issueThroughUI(m.page, t.ticketId);
    const current = await core(fixture, 'manager', `tickets/${t.ticketId}`); expect(current.workStatus).toBe('IN_PROGRESS');
    const v = await vendorContext(browser, fixture, link);
    try {
      expect((await job(v.context)).status).toBe('OFFERED');
      const serialized = JSON.stringify(await job(v.context));
      for (const value of ['Task12 synthetic private resident text', 'rawUserText', 'tenantContact', 'privateNotes']) expect(serialized.includes(value), 'Vendor minimum data').toBe(false);
      await forbiddenCopy(v.page); await responsive(v.page, 390); await responsive(v.page, 390, true);
      expect(await v.page.locator('#vendor-current-task').evaluate(e => Boolean(e.closest('section')?.nextElementSibling?.querySelector('#vendor-packet'))), 'task before packet').toBe(true);
      await keyboardClick(v.page, '작업 수락'); expect((await job(v.context)).status).toBe('ACTIVE');
      const reuse = await browser.newContext({ baseURL: fixture.origin });
      try { const p = await reuse.newPage(); await safeGoto(p, link, 'reused capability'); await expect(p.getByRole('heading', { name: '작업 화면을 열 수 없습니다', exact: true })).toBeVisible(); await expect(p.getByRole('button', { name: '작업 수락', exact: true })).toHaveCount(0); } finally { await reuse.close(); }
    } finally { await v.close(); }
    await click(m.page, '업체 연결 상태 다시 확인'); expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(0);
    await expect(m.page.getByRole('button', { name: '보안 링크 재발급', exact: true })).toBeVisible();
    for (const width of [1440, 1280, 390]) {
      await m.page.setViewportSize({ width, height: 900 });
      if (width === 1280) await expect(m.page.locator('#ticket-inspector-trigger')).toHaveAttribute('aria-expanded', 'false');
      const panel = m.page.getByRole('region', { name: '업체 연결 및 작업 요청', exact: true });
      if (!await panel.isVisible()) {
        if (width === 1280) await click(m.page, '업무 정보');
        else await m.page.locator('#ticket-inspector > summary').click();
      }
      await expect(panel).toBeVisible();
      expect(await panel.evaluate(e => Boolean(e.closest('aside[aria-label="관리자 업무 정보"]'))), 'Manager owns private handoff controls').toBe(true);
      expect(await m.page.getByRole('region', { name: '접수 요약', exact: true }).evaluate(e => Boolean(e.querySelector('[aria-label="업체 연결 및 작업 요청"]'))), 'handoff does not occupy public summary').toBe(false);
      await responsive(m.page, width); await forbiddenCopy(m.page);
    }
    await responsive(m.page, 390, true);
  } finally { await m.close(); }
});

test('T12-B03 preauthorization starts OFF, explicit selected consent links contained Appointment; ended and replaced exact member deny visit', async ({ browser, fixture, admin }) => {
  const c = await provision(fixture, true), v = await vendorContext(browser, fixture, c.link), t = await actor(browser, fixture, 'tenant');
  try {
    await click(v.page, '작업 수락'); await openTicket(t.page, c.ticketId); await interval(t.page, '방문 가능한 시간'); await keyboardClick(t.page, '가능한 시간 보내기');
    const consent = t.page.getByRole('group', { name: '세입자 없이 출입 동의 (선택)', exact: true });
    await expect(consent).toBeVisible(); expect(await consent.getByRole('checkbox').isChecked()).toBe(false);
    await expect(t.page.getByRole('button', { name: '선택한 시간 동의 확인', exact: true })).toBeDisabled();
    await consent.getByRole('checkbox').check(); await keyboardClick(t.page, '선택한 시간 동의 확인');
    const confirmation = t.page.getByRole('group', { name: '출입 동의 확인', exact: true }); await expect(confirmation.getByText('선택한 시간에만 세입자 없이 출입할 수 있습니다. 다른 시간에는 동의가 적용되지 않습니다.', { exact: true })).toBeVisible();
    await keyboardClick(t.page, '동의하기'); await v.page.reload(); await v.page.getByRole('radio', { name: /오전 11:00.*오후 1:00/ }).check();
    await interval(v.page, '동의된 시간 안의 방문 시간', '11:30', '12:30'); await keyboardClick(v.page, '동의된 시간 안에서 방문 확정');
    const j = await job(v.context); expect(j.appointment.confirmationMode).toBe('PREAUTHORIZED_ENTRY');
    const rows = (await admin.query('SELECT a.entry_authorization_id,a.occupancy_member_id,w.start_at,w.end_at FROM vendor_handoff.appointment a JOIN vendor_handoff.tenant_availability_window w ON w.id=a.selected_window_id WHERE a.id=$1', [j.appointment.id])).rows;
    expect(Boolean(rows[0].entry_authorization_id && rows[0].occupancy_member_id)).toBe(true); expect(Date.parse(j.appointment.startAt) >= rows[0].start_at.getTime() && Date.parse(j.appointment.endAt) <= rows[0].end_at.getTime()).toBe(true);
    await responsive(t.page, 390); await responsive(t.page, 390, true); await forbiddenCopy(t.page); await forbiddenCopy(v.page);
    // Owned DB authority-change prerequisites. Commands remain actual UI/network operations.
    const member = rows[0].occupancy_member_id;
    await admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [member]);
    try {
      await click(v.page, '방문 시작'); const failed = v.page.waitForResponse(r => r.url().endsWith('/visit-start')); await keyboardClick(v.page, '방문 시작 기록'); expect((await failed).status()).toBe(409); expect((await job(v.context)).appointment.status).toBe('SCHEDULED');
      const authorization = await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling`, undefined, 403); expect(Boolean(authorization.error)).toBe(true);
      await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(j), windows: [{ startAt: j.appointment.startAt, endAt: j.appointment.endAt }] }, 403);
      const replacement = randomUUID(); await admin.query("INSERT INTO app.occupancy_member(id,org_id,occupancy_id,user_id,joined_at,status) SELECT $1,org_id,occupancy_id,$2,clock_timestamp(),'ACTIVE' FROM app.occupancy_member WHERE id=$3", [replacement, fixture.fixture.accounts.tenantOther.userId, member]);
      try { await vendorPost(v.context, fixture.origin, `appointments/${j.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...guards(j) }, 409); }
      finally { await admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [replacement]); }
    } finally { await admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE id=$1", [member]); }
  } finally { await v.close(); await t.close(); }
});

for (const who of ['TENANT', 'VENDOR', 'MANAGER'] as const) test(`T12-B04 ${who} RESCHEDULE preserves old immutable future Appointment and creates one new round`, async ({ browser, fixture, admin }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link); let a;
  try {
    await click(v.page, '작업 수락'); const before = await scheduled(fixture, v.context, c.ticketId);
    const saved = (await admin.query('SELECT start_at,end_at FROM vendor_handoff.appointment WHERE id=$1', [before.appointment.id])).rows[0];
    if (who === 'VENDOR') { await v.page.reload(); await click(v.page, '방문 일정 변경'); await keyboardClick(v.page, '일정 변경하기'); }
    else { a = await actor(browser, fixture, who.toLowerCase(), who === 'MANAGER' ? 1280 : 390); await openTicket(a.page, c.ticketId, who === 'MANAGER'); await click(a.page, '방문 일정 변경'); await keyboardClick(a.page, '일정 변경하기'); }
    const after = await job(v.context); expect(after.currentRound.purpose).toBe('RESCHEDULE'); expect(after.currentRound.status).toBe('OPEN'); expect(after.appointment).toBeNull();
    const old = (await admin.query('SELECT status,start_at,end_at FROM vendor_handoff.appointment WHERE id=$1', [before.appointment.id])).rows[0]; expect(old.status).toBe('SUPERSEDED'); expect([old.start_at.toISOString(), old.end_at.toISOString()]).toEqual([saved.start_at.toISOString(), saved.end_at.toISOString()]);
    expect((await admin.query("SELECT count(*)::int n FROM vendor_handoff.scheduling_round WHERE assignment_id=$1 AND purpose='RESCHEDULE'", [c.assignmentId])).rows[0].n).toBe(1);
  } finally { await a?.close(); await v.close(); }
});

test('T12-B05 browser Decline and scheduling-aware Withdraw terminate access and preserve history', async ({ browser, fixture, admin }) => {
  for (const mode of ['decline', 'withdraw']) {
    const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link);
    try {
      if (mode === 'decline') { await click(v.page, '작업 거절'); await v.page.getByRole('radio', { name: '일정·인력 여유가 없음', exact: true }).check(); await click(v.page, '거절 내용 확인'); await keyboardClick(v.page, '거절하기'); await expect(v.page.getByRole('heading', { name: '작업 요청을 거절했습니다', exact: true })).toBeVisible(); }
      else { await click(v.page, '작업 수락'); const before = await scheduled(fixture, v.context, c.ticketId); await v.page.reload(); await click(v.page, '작업 철회'); await click(v.page, '철회 내용 확인'); await keyboardClick(v.page, '철회하기'); await expect(v.page.getByRole('heading', { name: '작업을 철회했습니다', exact: true })).toBeVisible(); expect((await admin.query('SELECT status FROM vendor_handoff.appointment WHERE id=$1', [before.appointment.id])).rows[0].status).toBe('CANCELLED'); }
      expect((await v.context.request.get('/api/v2/vendor/job')).status()).toBe(401); const m = await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`); expect(m.assignment.endReason).toBe(mode === 'decline' ? 'DECLINED' : 'WITHDRAWN');
    } finally { await v.close(); }
  }
});

test('T12-B06 issue response loss reconciles unrecoverable raw link and requires explicit Reissue', async ({ browser, fixture }) => {
  const c = await provision(fixture), m = await actor(browser, fixture, 'manager', 1280);
  try {
    await openTicket(m.page, c.ticketId, true);
    let posts = 0;
    await m.page.route('**/api/v2/core/manager/vendor-assignments/*/link/reissue', async route => { posts++; await route.fetch(); await route.abort('failed'); }, { times: 1 });
    await m.page.getByRole('button', { name: '보안 링크 재발급', exact: true }).focus(); await m.page.keyboard.press('Enter'); await expect(m.page.getByRole('button', { name: '같은 요청으로 발급 결과 확인', exact: true })).toBeVisible();
    await keyboardClick(m.page, '같은 요청으로 발급 결과 확인'); await expect(m.page.getByText('발급 기록을 확인했습니다. 원래 링크는 다시 표시할 수 없습니다.', { exact: true })).toBeVisible();
    expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(0); expect(posts).toBe(1); await forbiddenCopy(m.page);
    await keyboardClick(m.page, '보안 링크 재발급'); await expect(m.page.getByText('보안 링크를 발급했습니다. 업체에 직접 전달하세요.', { exact: true })).toBeVisible(); expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(1);
  } finally { await m.close(); }
});

test('T12-B07 mounted navigation and delayed old-ticket issuance never restore previous raw link', async ({ browser, fixture }) => {
  const first = await provision(fixture), second = await ticket(fixture), m = await actor(browser, fixture, 'manager', 1440);
  try {
    await openTicket(m.page, first.ticketId, true);
    let release!: () => void; const held = new Promise<void>(ok => { release = ok; }); let fetched!: () => void; const committed = new Promise<void>(ok => { fetched = ok; });
    await m.page.route('**/api/v2/core/manager/vendor-assignments/*/link/reissue', async route => { const response = await route.fetch(); fetched(); await held; await route.fulfill({ response }); }, { times: 1 });
    const sent = m.page.getByRole('button', { name: '보안 링크 재발급', exact: true }).click(); await committed;
    await m.page.locator(`[data-ticket-id="${second.ticketId}"] [data-open-ticket]`).click(); release(); await sent;
    await expect(m.page.getByLabel('업체 표시 이름', { exact: true })).toBeVisible(); expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(0);
    await openTicket(m.page, first.ticketId, true); expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(0);
  } finally { await m.close(); }
});

test('T12-B02 resident UI schedules immutable visits, blocker FOLLOW_UP, photo-loss recovery, correction and atomic closeout', async ({ browser, fixture, admin }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), tenant = await actor(browser, fixture, 'tenant'), manager = await actor(browser, fixture, 'manager', 1280);
  try {
    await keyboardClick(v.page, '작업 수락');
    await openTicket(tenant.page, c.ticketId);
    await interval(tenant.page, '방문 가능한 시간'); await keyboardClick(tenant.page, '가능한 시간 보내기');
    await v.page.reload(); await interval(v.page, '세입자에게 제안할 방문 시간 (최대 5개)', '11:30', '12:30'); await keyboardClick(v.page, '방문 시간 제안하기');
    await openTicket(tenant.page, c.ticketId);
    const choice = tenant.page.getByRole('radio', { name: /오전 11:30.*오후 12:30/ }); await expect(choice).toBeVisible();
    await choice.check(); await keyboardClick(tenant.page, '이 시간으로 확정'); await expect(tenant.page.getByRole('heading', { name: '확정된 방문 일정', exact: true })).toBeVisible();
    let j = await job(v.context); const firstId = j.appointment.id;
    expect(j.appointment.confirmationMode).toBe('TENANT_CONFIRMED');
    await v.page.reload(); await keyboardClick(v.page, '방문 시작'); await keyboardClick(v.page, '방문 시작 기록'); expect((await job(v.context)).appointment.status).toBe('OCCURRED');
    await click(v.page, '막힘 기록'); await v.page.getByRole('radio', { name: '부품 필요', exact: true }).check(); await click(v.page, '막힘 기록하기');
    expect((await job(v.context)).activeBlocker.code).toBe('PARTS_REQUIRED'); await click(v.page, '막힘 해제'); await click(v.page, '막힘 해제 기록'); expect((await job(v.context)).activeBlocker).toBeNull();
    await click(v.page, '막힘 기록'); await v.page.getByRole('radio', { name: '추가 방문 필요', exact: true }).check(); await v.page.getByRole('checkbox', { name: '추가 방문이 필요함을 확인했습니다', exact: true }).check(); await click(v.page, '막힘 기록하기');
    await click(v.page, '추가 방문 일정 잡기'); await click(v.page, '추가 방문 일정 조율 시작');
    j = await job(v.context); expect(j.currentRound.purpose).toBe('FOLLOW_UP');
    const occurred = (await admin.query('SELECT status,start_at,end_at FROM vendor_handoff.appointment WHERE id=$1', [firstId])).rows[0]; expect(occurred.status).toBe('OCCURRED');
    await interval(v.page, '세입자에게 제안할 방문 시간 (최대 5개)', '14:00', '15:00'); await click(v.page, '방문 시간 제안하기');
    await openTicket(tenant.page, c.ticketId); await tenant.page.getByRole('radio', { name: /오후 2:00–3:00/ }).check(); await click(tenant.page, '이 시간으로 확정');
    await v.page.reload(); await click(v.page, '방문 시작'); await click(v.page, '방문 시작 기록');
    j = await job(v.context); expect(j.appointment.id === firstId).toBe(false); expect(j.appointment.status).toBe('OCCURRED');
    const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#496c82' } }).withExif({ IFD0: { Artist: 'SYNTHETIC_TASK12' } }).jpeg().toBuffer();
    let originalIntent: unknown, originalBytes: string | null = null, uploadPosts = 0;
    await v.page.route('**/api/v2/vendor/job/completion-photos', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      uploadPosts++; const intent = JSON.parse(route.request().headers()['x-vendor-upload-command']);
      if (uploadPosts === 1) { originalIntent = intent; originalBytes = route.request().postDataBuffer()?.toString('hex') ?? null; await route.fetch(); await route.abort('failed'); }
      else { expect(JSON.stringify(intent) === JSON.stringify(originalIntent), 'same original upload command').toBe(true); expect(route.request().postDataBuffer()?.toString('hex') === originalBytes, 'same synthetic image intent').toBe(true); await route.continue(); }
    });
    await v.page.getByLabel('사진 올리기 (JPEG 또는 PNG)').setInputFiles({ name: 'synthetic.jpg', mimeType: 'image/jpeg', buffer: image });
    await expect(v.page.getByRole('button', { name: '같은 요청으로 사진 업로드 다시 확인', exact: true })).toBeVisible();
    expect((await admin.query('SELECT count(*)::int n FROM vendor_handoff.completion_report WHERE assignment_id=$1', [c.assignmentId])).rows[0].n).toBe(0);
    await keyboardClick(v.page, '같은 요청으로 사진 업로드 다시 확인');
    await expect(v.page.getByRole('img', { name: '업로드한 작업 사진 1', exact: true })).toBeVisible(); expect(uploadPosts).toBe(2);
    expect((await admin.query('SELECT count(*)::int n FROM vendor_handoff.completion_photo WHERE assignment_id=$1', [c.assignmentId])).rows[0].n).toBe(1);
    const photoId = (await admin.query('SELECT id FROM vendor_handoff.completion_photo WHERE assignment_id=$1', [c.assignmentId])).rows[0].id;
    const stored = await v.context.request.get(`/api/v2/vendor/job/completion-photos/${photoId}`); expect(stored.status()).toBe(200); const servedBytes = await stored.body(), metadata = await sharp(servedBytes).metadata(); expect(Boolean(metadata.exif || metadata.xmp || metadata.iptc)).toBe(false); expect([metadata.width, metadata.height]).toEqual([16, 12]);
    const storedBytes = (await admin.query('SELECT bytes FROM vendor_handoff.completion_photo WHERE id=$1', [photoId])).rows[0].bytes;
    const durableMetadata = await sharp(storedBytes).metadata(); expect(Boolean(durableMetadata.exif || durableMetadata.xmp || durableMetadata.iptc)).toBe(false);
    expect(createHash('sha256').update(storedBytes).digest('hex') === createHash('sha256').update(servedBytes).digest('hex'), 'stored and served sanitized image match').toBe(true); expect((await sharp(servedBytes).raw().toBuffer()).length).toBe(16 * 12 * 3);
    await v.page.getByRole('checkbox', { name: '작업 사진 1 보고에 포함', exact: true }).check(); await v.page.getByLabel('작업 내용 요약', { exact: true }).fill('Task12 synthetic report'); await v.page.getByRole('checkbox', { name: /현재 작업 요청 내용/ }).check(); await keyboardClick(v.page, '작업 보고 제출'); await keyboardClick(v.page, '작업 보고 제출하기');
    await expect(v.page.getByRole('heading', { name: '작업 보고를 제출했습니다', exact: true })).toBeVisible();
    expect(await v.page.getByRole('group', { name: '작업 보고를 제출했습니다', exact: true }).evaluate(e => /success|green/i.test(e.className)), 'report uses neutral/primary treatment').toBe(false); await forbiddenCopy(v.page);
    for (const name of ['방문 시작', '막힘 기록', '작업 철회', '방문 시간 제안하기']) await expect(v.page.getByRole('button', { name, exact: true })).toHaveCount(0);
    const initial = await job(v.context); expect(initial.phase).toBe('COMPLETION_REPORTED'); expect((await core(fixture, 'manager', `tickets/${c.ticketId}`)).workStatus).toBe('IN_PROGRESS');
    await openTicket(manager.page, c.ticketId, true); await click(manager.page, '보고 수정 요청'); await manager.page.getByLabel('수정 요청 사유', { exact: true }).fill('Task12 synthetic correction'); await click(manager.page, '확인한 내용 저장');
    await v.page.reload(); await v.page.getByRole('checkbox', { name: '작업 사진 1 보고에 포함', exact: true }).check(); await v.page.getByLabel('작업 내용 요약', { exact: true }).fill('Task12 synthetic revised report'); await v.page.getByRole('checkbox', { name: /현재 작업 요청 내용/ }).check(); await click(v.page, '작업 보고 제출'); await click(v.page, '작업 보고 제출하기');
    const revised = await job(v.context); expect(revised.currentReport.revision).toBe(2); expect(revised.currentReport.supersedesReportId).toBe(initial.currentReport.id);
    await openTicket(manager.page, c.ticketId, true); await click(manager.page, '처리 완료 기록'); expect(await manager.page.getByLabel('관리자가 확인한 처리 내용', { exact: true }).inputValue()).toBe('');
    await manager.page.getByLabel('관리자가 확인한 처리 내용', { exact: true }).fill('Task12 independently verified Manager disposition'); await keyboardClick(manager.page, '확인한 내용 저장');
    await expect(manager.page.getByTestId('work-status')).toHaveText('✓ 처리 완료');
    const closed = await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`); expect([closed.assignment.status, closed.assignment.endReason]).toEqual(['ENDED', 'CLOSED']); expect((await v.context.request.get('/api/v2/vendor/job')).status()).toBe(401);
    const result = manager.page.getByRole('status').filter({ hasText: 'COMPLETED / ENDED/CLOSED' }); expect(await result.evaluate(e => /success|green/i.test(e.className)), 'closeout result uses existing neutral treatment').toBe(false);
    await v.page.reload(); await expect(v.page.getByRole('button', { name: '작업 수락', exact: true })).toHaveCount(0);
    await openTicket(tenant.page, c.ticketId); await responsive(tenant.page, 390); await responsive(tenant.page, 390, true);
    expect(await tenant.page.getByRole('img', { name: /작업 사진/ }).count()).toBe(0);
    await keyboardClick(tenant.page, '해결됐어요'); await expect(tenant.page.getByText('해결됐다고 알려주셨어요.', { exact: true })).toBeVisible();
    await openTicket(manager.page, c.ticketId, true);
    const fact = manager.page.getByRole('region', { name: '호실 정비 사실 기록', exact: true });
    await expect(fact).toBeVisible(); expect(await fact.getByLabel('정비 부품·위치 명칭').inputValue()).toBe('');
    await fact.getByLabel('정비 작업 종류').selectOption('REPAIR'); await fact.getByLabel('정비 부품·위치 명칭').fill('Task12 independent synthetic component'); await keyboardClick(manager.page, '정비 사실 저장');
    await expect(fact.getByText('정비 사실 요청의 저장을 확인했습니다.', { exact: true })).toBeVisible();
    await openTicket(tenant.page, c.ticketId); await click(tenant.page, '다시 문제가 생겼어요');
    await expect(tenant.page.getByLabel('문제 설명', { exact: true })).toHaveValue(''); await tenant.page.getByLabel('문제 설명', { exact: true }).fill('Task12 fresh recurrence symptom');
    const made = tenant.page.waitForResponse(r => r.url().endsWith('/follow-up') && r.request().method() === 'POST'); await keyboardClick(tenant.page, '접수하기'); const fresh = await made; expect(fresh.status()).toBe(201); const newId = (await fresh.json()).ticket.ticketId; expect(newId === c.ticketId).toBe(false);
    expect((await core(fixture, 'manager', `manager/tickets/${newId}/vendor-handoff`)).assignment).toBeNull();
  } finally { await v.close(); await tenant.close(); await manager.close(); }
});

test('T12-B08 live security headers, methods, query rejection and deterministic capability/session expiry', async ({ browser, fixture, admin }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link);
  try {
    const response = await v.context.request.get('/api/v2/vendor/job');
    for (const [name, value] of Object.entries({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" })) expect(response.headers()[name]).toBe(value);
    expect((await v.context.request.get('/api/v2/vendor/job?packet=unexpected')).status()).toBe(400);
    const pageResponse = await v.context.request.get('/vendor/job'); expect(pageResponse.headers()['cache-control'].includes('no-store')).toBe(true); expect(pageResponse.headers()['referrer-policy']).toBe('no-referrer'); expect(pageResponse.headers()['x-frame-options']).toBe('DENY');
    expect((await v.context.request.post('/api/v2/vendor/job/accept', { headers: { Origin: 'http://foreign.invalid' }, data: {} })).status()).toBe(403);
    for (const method of ['OPTIONS', 'HEAD']) { const r = await v.context.request.fetch('/api/v2/vendor/job', { method }); expect(r.status()).toBe(405); expect(r.headers()['cache-control']).toBe('no-store'); }
    const durations = (await admin.query("SELECT extract(epoch FROM expires_at-issued_at)::int seconds FROM vendor_handoff.vendor_capability WHERE assignment_id=$1", [c.assignmentId])).rows; expect(durations[0].seconds).toBe(72 * 3600);
    const lifetime = (await admin.query("SELECT extract(epoch FROM expires_at-created_at)::int seconds FROM vendor_handoff.vendor_session WHERE assignment_id=$1", [c.assignmentId])).rows; expect(lifetime[0].seconds).toBe(7 * 86400);
    // Deterministic boundary fixture: expiry at current DB clock, no application clock override.
    await admin.query("UPDATE vendor_handoff.vendor_session SET created_at=clock_timestamp()-interval '7 days',expires_at=clock_timestamp() WHERE assignment_id=$1", [c.assignmentId]);
    expect((await v.context.request.get('/api/v2/vendor/job')).status()).toBe(401); await v.page.reload(); await expect(v.page.getByRole('heading', { name: '작업 화면을 열 수 없습니다', exact: true })).toBeVisible();
    const expired = await provision(fixture); await admin.query("UPDATE vendor_handoff.vendor_capability SET issued_at=clock_timestamp()-interval '72 hours',expires_at=clock_timestamp() WHERE assignment_id=$1", [expired.assignmentId]);
    const ctx = await browser.newContext({ baseURL: fixture.origin }); try { const p = await ctx.newPage(); await safeGoto(p, expired.link, 'expired capability boundary'); await expect(p.getByRole('heading', { name: '작업 화면을 열 수 없습니다', exact: true })).toBeVisible(); } finally { await ctx.close(); }
  } finally { await v.close(); }
});

test('T12-B09 assignment A browser probes known B packet, source/photo, Appointment and report without disclosure', async ({ browser, fixture, admin }) => {
  const a = await provision(fixture), b = await provision(fixture), va = await vendorContext(browser, fixture, a.link), vb = await vendorContext(browser, fixture, b.link);
  try {
    await click(va.page, '작업 수락'); await click(vb.page, '작업 수락'); const jb = await scheduled(fixture, vb.context, b.ticketId); await vendorPost(vb.context, fixture.origin, `appointments/${jb.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...guards(jb) });
    const image = await sharp({ create: { width: 10, height: 8, channels: 3, background: '#547e93' } }).png().toBuffer();
    const owner = fixture.fixture.accounts.tenant;
    const sourceResponse = await fetch(fixture.origin + `/api/v2/core/tickets/${b.ticketId}/photos`, { method: 'POST', headers: { Cookie: '__session=' + owner.cookie, Origin: fixture.origin, 'X-B1-CSRF': owner.csrf, 'X-Core-Organization': owner.orgId, 'Content-Type': 'image/png', 'X-Upload-Id': randomUUID() }, body: image }); expect(sourceResponse.status).toBe(201); const sourceId = (await sourceResponse.json()).photoId;
    const current = await job(vb.context), input = { clientRequestId: randomUUID(), expectedAssignmentVersion: current.assignmentVersion, expectedPacketRevisionId: b.packetId, expectedAppointmentId: current.appointment.id, expectedCorrectionRequestId: null };
    const session = await (await vb.context.request.get('/api/v2/vendor/session')).json();
    const upload = await vb.context.request.post('/api/v2/vendor/job/completion-photos', { headers: { Origin: fixture.origin, 'X-Vendor-CSRF': session.csrf, 'Content-Type': 'image/png', 'X-Upload-Id': input.clientRequestId, 'X-Vendor-Upload-Command': JSON.stringify(input) }, data: image }); expect(upload.status()).toBe(200); const photoId = (await upload.json()).photoId;
    const report = await vendorPost(vb.context, fixture.origin, 'completion-reports', { ...input, clientRequestId: randomUUID(), supersedesReportId: null, workSummary: 'Task12 peer report', componentOrPartNote: null, completionPhotoIds: [photoId], photoOmissionReason: null });
    expect((await vb.context.request.get(`/api/v2/vendor/job/completion-photos/${photoId}`)).status()).toBe(200);
    const tenant = fixture.fixture.accounts.tenant;
    const tenantPhoto = await fetch(fixture.origin + `/api/v2/core/manager/tickets/${b.ticketId}/vendor-completion-photos/${photoId}`, { headers: { Cookie: '__session=' + tenant.cookie, Origin: fixture.origin, 'X-Core-Organization': tenant.orgId } }); expect(tenantPhoto.status).toBe(403);
    for (const path of [`job/packets/${b.packetId}`, `job/source-photos/${sourceId}`, `job/completion-photos/${photoId}`, `appointments/${jb.appointment.id}`, `completion-reports/${report.id}`]) {
      const r = await va.context.request.get('/api/v2/vendor/' + path); expect(r.status()).toBe(404); const body = await r.text(); for (const id of [b.packetId, jb.appointment.id, report.id, b.ticketId]) expect(body.includes(id), 'hidden resource remains non-disclosing').toBe(false);
    }
    const ja = await job(va.context);
    expect(JSON.stringify(ja).includes(b.ticketId), 'one job only, no peer job data').toBe(false);
    const startAt = new Date(Date.now() + 86400000).toISOString(), endAt = new Date(Date.now() + 90000000).toISOString();
    await core(fixture, 'tenant', `tickets/${a.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(ja), windows: [{ startAt, endAt }] });
    const availableA = await job(va.context), proposalInputA = { clientRequestId: randomUUID(), ...guards(availableA), slots: [{ startAt, endAt }] };
    await vendorPost(va.context, fixture.origin, 'scheduling/proposals', { ...proposalInputA, expectedPacketRevisionId: b.packetId }, 409);
    expect((await admin.query('SELECT count(*)::int n FROM vendor_handoff.vendor_slot_proposal WHERE assignment_id=$1', [a.assignmentId])).rows[0].n).toBe(0);
    const ownProposal = await vendorPost(va.context, fixture.origin, 'scheduling/proposals', { ...proposalInputA, clientRequestId: randomUUID() });
    await core(fixture, 'tenant', `tickets/${a.ticketId}/vendor-scheduling/confirm`, { clientRequestId: randomUUID(), ...guards(ownProposal), proposalId: ownProposal.proposal.id, selectedSlotId: ownProposal.proposal.slots[0].id });
    const validA = await job(va.context);
    // Both commands have otherwise valid A guards and a confirmed Appointment.
    await vendorPost(va.context, fixture.origin, `appointments/${jb.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...guards(validA) }, 409);
    expect((await admin.query('SELECT count(*)::int n FROM vendor_handoff.work_event WHERE assignment_id=$1', [a.assignmentId])).rows[0].n).toBe(0);
    await vendorPost(va.context, fixture.origin, `appointments/${validA.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...guards(validA) });
    const occurredA = await job(va.context), reportInputA = { clientRequestId: randomUUID(), expectedAssignmentVersion: occurredA.assignmentVersion, expectedPacketRevisionId: a.packetId, expectedAppointmentId: occurredA.appointment.id, expectedCorrectionRequestId: null, supersedesReportId: null, workSummary: 'Task12 own report control', componentOrPartNote: null, completionPhotoIds: [], photoOmissionReason: 'NOT_APPLICABLE' };
    const ownReport = await vendorPost(va.context, fixture.origin, 'completion-reports', reportInputA);
    const managerA = await core(fixture, 'manager', `manager/tickets/${a.ticketId}/vendor-handoff`);
    await core(fixture, 'manager', `manager/vendor-assignments/${a.assignmentId}/completion-correction`, { clientRequestId: randomUUID(), expectedAssignmentVersion: managerA.assignment.version, expectedCompletionReportId: ownReport.id, reason: 'Task12 current correction control' });
    const correctionA = await job(va.context), revisionInputA = { ...reportInputA, clientRequestId: randomUUID(), expectedAssignmentVersion: correctionA.assignmentVersion, expectedCorrectionRequestId: correctionA.correctionRequest.id, supersedesReportId: report.id };
    await vendorPost(va.context, fixture.origin, 'completion-reports', revisionInputA, 409);
    expect((await admin.query('SELECT count(*)::int n FROM vendor_handoff.completion_report WHERE assignment_id=$1', [a.assignmentId])).rows[0].n).toBe(1);
    const ownRevision = await vendorPost(va.context, fixture.origin, 'completion-reports', { ...revisionInputA, clientRequestId: randomUUID(), supersedesReportId: ownReport.id }); expect(ownRevision.revision).toBe(2);
  } finally { await va.close(); await vb.close(); }
});

for (const mode of ['REVOKE', 'REASSIGN'] as const) test(`T12-B10 Manager ${mode} invalidates future scheduling, retains occurred history and clears mounted link`, async ({ browser, fixture, admin }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), m = await actor(browser, fixture, 'manager', 1280);
  try {
    await click(v.page, '작업 수락'); const first = await scheduled(fixture, v.context, c.ticketId); await vendorPost(v.context, fixture.origin, `appointments/${first.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...guards(first) });
    let j = await job(v.context); j = await vendorPost(v.context, fixture.origin, 'blockers', { clientRequestId: randomUUID(), expectedAssignmentVersion: j.assignmentVersion, expectedPacketRevisionId: c.packetId, blockerCode: 'FOLLOW_UP_VISIT_REQUIRED', operationalNote: null });
    await vendorPost(v.context, fixture.origin, `blockers/${j.activeBlocker.id}/clear`, { clientRequestId: randomUUID(), expectedAssignmentVersion: j.assignmentVersion, expectedPacketRevisionId: c.packetId, operationalNote: null });
    const future = await scheduled(fixture, v.context, c.ticketId);
    await openTicket(m.page, c.ticketId, true); await keyboardClick(m.page, '보안 링크 재발급'); await expect(m.page.getByText('보안 링크를 발급했습니다. 업체에 직접 전달하세요.', { exact: true })).toBeVisible(); expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(1);
    if (mode === 'REVOKE') await keyboardClick(m.page, '업체 접근 철회');
    else { await click(m.page, '업체 재배정'); await m.page.getByLabel('새 업체 표시 이름', { exact: true }).fill('Task12 replacement Vendor'); await keyboardClick(m.page, '확인한 내용 저장'); }
    expect(await m.page.getByLabel('직접 전달할 보안 링크', { exact: true }).count()).toBe(0); expect((await v.context.request.get('/api/v2/vendor/job')).status()).toBe(401);
    const statuses = (await admin.query('SELECT id,status FROM vendor_handoff.appointment WHERE assignment_id=$1', [c.assignmentId])).rows; expect(statuses.find(r => r.id === first.appointment.id)?.status).toBe('OCCURRED'); expect(statuses.find(r => r.id === future.appointment.id)?.status).toBe(mode === 'REASSIGN' ? 'SUPERSEDED' : 'CANCELLED');
    if (mode === 'REASSIGN') { const current = await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`); expect(current.assignment.status).toBe('PREPARING'); expect(current.assignment.id === c.assignmentId).toBe(false); }
  } finally { await v.close(); await m.close(); }
});

test('T12-B11 SAFETY_ESCALATED and nonexternal route expose no handoff; direct completion remains without active assignment', async ({ browser, fixture }) => {
  const m = await actor(browser, fixture, 'manager', 1280);
  try {
    const unsafe = await ticket(fixture, '', '가스 냄새가 나요'); expect(unsafe.detail.status).toBe('SAFETY_ESCALATED');
    await openTicket(m.page, unsafe.ticketId, true); await expect(m.page.getByRole('button', { name: '작업 요청 준비', exact: true })).toHaveCount(0);
    const ordinary = await ticket(fixture, 'LANDLORD_REVIEW'); await openTicket(m.page, ordinary.ticketId, true); await expect(m.page.getByRole('button', { name: '작업 요청 준비', exact: true })).toHaveCount(0);
    await m.page.getByLabel('처리 기록', { exact: true }).fill('Task12 ordinary start'); await keyboardClick(m.page, '처리 시작 기록'); await expect(m.page.getByTestId('work-status')).toHaveText('처리중'); await click(m.page, '업무 정보'); await m.page.getByLabel('처리 기록', { exact: true }).fill('Task12 ordinary completion'); await keyboardClick(m.page, '처리 완료 기록'); await expect(m.page.getByTestId('work-status')).toHaveText('✓ 처리 완료');
    const ended = await provision(fixture), v = await vendorContext(browser, fixture, ended.link);
    try { await click(v.page, '작업 거절'); await v.page.getByRole('radio', { name: '일정·인력 여유가 없음', exact: true }).check(); await click(v.page, '거절 내용 확인'); await click(v.page, '거절하기'); } finally { await v.close(); }
    await openTicket(m.page, ended.ticketId, true); await m.page.getByLabel('처리 기록', { exact: true }).fill('Task12 historical ended direct completion'); await keyboardClick(m.page, '처리 완료 기록'); await expect(m.page.getByTestId('work-status')).toHaveText('✓ 처리 완료');
  } finally { await m.close(); }
});

test('T12-B12 synthetic photo dialog traps keyboard focus and returns it; Vendor status styles stay neutral/primary', async ({ browser, fixture }) => {
  const t = await ticket(fixture), a = fixture.fixture.accounts.tenant, viewer = await actor(browser, fixture, 'tenant');
  try {
    const image = await sharp({ create: { width: 10, height: 8, channels: 3, background: '#547e93' } }).png().toBuffer();
    const response = await fetch(fixture.origin + `/api/v2/core/tickets/${t.ticketId}/photos`, { method: 'POST', headers: { Cookie: '__session=' + a.cookie, Origin: fixture.origin, 'X-B1-CSRF': a.csrf, 'X-Core-Organization': a.orgId, 'Content-Type': 'image/png', 'X-Upload-Id': randomUUID() }, body: image }); expect(response.status).toBe(201);
    await openTicket(viewer.page, t.ticketId); await keyboardClick(viewer.page, '저장된 사진 1 확대');
    const dialog = viewer.page.getByRole('dialog', { name: '첨부 사진 확대', exact: true }); await expect(dialog).toBeVisible();
    for (const key of ['Tab', 'Tab', 'Shift+Tab']) { await viewer.page.keyboard.press(key); expect(await dialog.evaluate(e => e.contains(document.activeElement)), 'native modal keyboard focus containment').toBe(true); }
    await viewer.page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(viewer.page.getByRole('button', { name: '저장된 사진 1 확대', exact: true })).toBeFocused();
    const forbidden = /--(?:vendor|core)-(?:success|green)\b|\.(?:vendor-)?(?:success|green)\b|#(?:34c759|22c55e|16a34a)\b/i;
    for (const file of ['src/app/vendor/job/vendor-job.module.css', 'src/app/core/vendor-handoff.module.css']) expect(forbidden.test(await readFile(file, 'utf8')), 'Vendor-specific success token/class prohibited').toBe(false);
  } finally { await viewer.close(); }
});

test('T12-B13 stale packet/round/report and closeout communication conflict; current Tenant succeeds while wrong/ended digest denies', async ({ browser, fixture, admin }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), m = await actor(browser, fixture, 'manager', 1280);
  try {
    await click(v.page, '작업 수락'); const old = await job(v.context);
    const windows = [{ startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString() }];
    await core(fixture, 'tenantOther', `tickets/${c.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(old), windows }, 404);
    await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(old), windows });
    const digest = fixture.fixture.accounts.tenant.digest;
    await admin.query("UPDATE authn.web_session SET revoked_at=clock_timestamp() WHERE digest=decode($1,'hex')", [digest]);
    try { await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(await job(v.context)), windows }, 401); }
    finally { await admin.query("UPDATE authn.web_session SET revoked_at=NULL WHERE digest=decode($1,'hex')", [digest]); }
    await vendorPost(v.context, fixture.origin, 'scheduling/proposals', { clientRequestId: randomUUID(), ...guards(old), slots: windows }, 409);
    let handoff = await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`);
    await core(fixture, 'manager', `manager/vendor-assignments/${c.assignmentId}/packet-revisions`, { clientRequestId: randomUUID(), expectedAssignmentVersion: handoff.assignment.version, expectedPacketRevisionId: c.packetId, workSummary: 'Task12 revised minimum packet', sharedDetailKeys: [], allowedPhotoIds: [], accessPolicy: 'TENANT_PRESENT_REQUIRED', accessInstruction: null }, 201);
    const newJob = await job(v.context); await vendorPost(v.context, fixture.origin, 'scheduling/proposals', { clientRequestId: randomUUID(), ...guards(newJob), expectedPacketRevisionId: c.packetId, slots: windows }, 409);
    const future = await scheduled(fixture, v.context, c.ticketId); await vendorPost(v.context, fixture.origin, `appointments/${future.appointment.id}/visit-start`, { clientRequestId: randomUUID(), ...guards(future) });
    const occurred = await job(v.context); const report = await vendorPost(v.context, fixture.origin, 'completion-reports', { clientRequestId: randomUUID(), expectedAssignmentVersion: occurred.assignmentVersion, expectedPacketRevisionId: occurred.currentPacket.id, expectedAppointmentId: occurred.appointment.id, expectedCorrectionRequestId: null, supersedesReportId: null, workSummary: 'Task12 stale guard synthetic report', componentOrPartNote: null, completionPhotoIds: [], photoOmissionReason: 'NOT_APPLICABLE' });
    handoff = await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`);
    await core(fixture, 'manager', `manager/vendor-assignments/${c.assignmentId}/completion-correction`, { clientRequestId: randomUUID(), expectedAssignmentVersion: handoff.assignment.version, expectedCompletionReportId: randomUUID(), reason: 'Task12 stale report attempt' }, 409);
    await vendorPost(v.context, fixture.origin, 'blockers', { clientRequestId: randomUUID(), expectedAssignmentVersion: handoff.assignment.version, expectedPacketRevisionId: occurred.currentPacket.id, blockerCode: 'OTHER', operationalNote: null }, 409);
    await openTicket(m.page, c.ticketId, true); await click(m.page, '처리 완료 기록'); await m.page.getByLabel('관리자가 확인한 처리 내용', { exact: true }).fill('Task12 stale communication closeout');
    const communication = await core(fixture, 'tenant', `tickets/${c.ticketId}/communication`);
    await core(fixture, 'tenant', `tickets/${c.ticketId}/communication/messages`, { clientRequestId: randomUUID(), expectedVersion: communication.version, intent: 'TENANT_MESSAGE', body: 'Task12 new public communication' }, 201);
    const conflict = m.page.waitForResponse(r => r.url().endsWith('/closeout') && r.request().method() === 'POST'); await keyboardClick(m.page, '확인한 내용 저장'); expect((await conflict).status()).toBe(409);
    const actual = await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`); expect(actual.assignment.status).toBe('ACTIVE'); expect(actual.currentReport.id).toBe(report.id); expect((await core(fixture, 'manager', `tickets/${c.ticketId}`)).workStatus).toBe('IN_PROGRESS'); expect((await v.context.request.get('/api/v2/vendor/job')).status()).toBe(200);
  } finally { await v.close(); await m.close(); }
});

test('T12-B14 actual Vendor/Tenant cross-midnight and different-year windows remain explicit at 390px and 200 percent text', async ({ browser, fixture }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), tenant = await actor(browser, fixture, 'tenant');
  try {
    await click(v.page, '작업 수락');
    const date = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const start = new Date(date + 'T23:30:00+09:00'), end = new Date(start.getTime() + 7200000), year = start.getFullYear() + 1;
    const windows = [{ startAt: start.toISOString(), endAt: end.toISOString() }, { startAt: `${year}-01-01T02:00:00.000Z`, endAt: `${year}-01-01T03:00:00.000Z` }];
    await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(await job(v.context)), windows });
    await v.page.reload(); await openTicket(tenant.page, c.ticketId);
    for (const page of [v.page, tenant.page]) {
      await expect(page.getByText(/\d+월 \d+일.*오후 11:30.*\d+월 \d+일.*오전 1:30/)).toBeVisible();
      await expect(page.getByText(new RegExp(`${year}년 1월 1일.*오전 11:00.*오후 12:00`))).toBeVisible();
      await responsive(page, 390); await responsive(page, 390, true); await forbiddenCopy(page);
    }
  } finally { await v.close(); await tenant.close(); }
});
