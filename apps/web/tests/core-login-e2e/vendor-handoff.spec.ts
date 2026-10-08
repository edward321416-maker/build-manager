import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { sdkSession } from './session';
import { openInspector } from '../core-e2e/presentation';

test('T12-S01 SDK Manager prepares handoff through real B1; Tenant cannot create it or impersonate Vendor', async ({ browser }) => {
  const tenant = await sdkSession(browser), manager = await sdkSession(browser, 'manager');
  try {
    const created = await tenant.context.request.post('/api/v2/core/tickets', { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: 'LEAK', rawUserText: 'Task12 SDK synthetic handoff' } }); expect(created.status()).toBe(201); const id = (await created.json()).ticketId;
    expect((await manager.context.request.post(`/api/v2/core/tickets/${id}/decision`, { headers: manager.headers, data: { type: 'OVERRIDE', routeCode: 'GENERAL_VENDOR', reason: 'Task12 synthetic prerequisite' } })).status()).toBe(200);
    const detail = await (await manager.context.request.get(`/api/v2/core/tickets/${id}`, { headers: manager.headers })).json();
    const unauthorized = await tenant.context.request.post(`/api/v2/core/manager/tickets/${id}/vendor-assignment`, { headers: tenant.headers, data: { clientRequestId: randomUUID(), expectedTicketVersion: detail.version, vendorLabel: 'Task12 denied' } }); expect(unauthorized.status()).toBe(403);
    const page = await manager.context.newPage(); await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('/core'); await page.getByLabel('내 소속', { exact: true }).selectOption(manager.fixture.orgA); await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click(); await openInspector(page);
    await page.getByLabel('업체 표시 이름', { exact: true }).fill('Task12 SDK Vendor'); await page.getByRole('button', { name: '작업 요청 준비', exact: true }).click(); await expect(page.getByText('작업 요청 준비를 저장했습니다.', { exact: true })).toBeVisible();
    const handoff = await manager.context.request.get(`/api/v2/core/manager/tickets/${id}/vendor-handoff`, { headers: manager.headers }); expect(handoff.status()).toBe(200); expect((await handoff.json()).assignment.status).toBe('PREPARING');
    expect((await tenant.context.request.get(`/api/v2/core/manager/tickets/${id}/vendor-handoff`, { headers: tenant.headers })).status()).toBe(403);
    // This SDK server has no external Vendor runtime config. Separate Vendor suite supplies it.
    expect((await manager.context.request.get('/api/v2/vendor/job')).status()).toBe(503);
  } finally { await tenant.close(); await manager.close(); }
});
