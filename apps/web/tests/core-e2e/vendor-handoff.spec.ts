import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { openInspector } from './presentation';

test('T12-C01 legacy synthetic Core does not grant B1 Vendor handoff authority or show its actions', async ({ page, request }) => {
  const codes = JSON.parse(await readFile(join(homedir(), '.build-manager-rc1-private', 'access-codes.json'), 'utf8'));
  const units = await request.get('/api/v2/core/units', { headers: { Authorization: `Bearer ${codes.tenant}` } }); expect(units.status()).toBe(200);
  const made = await request.post('/api/v2/core/tickets', { headers: { Authorization: `Bearer ${codes.tenant}` }, data: { unitId: (await units.json())[0].id, issueType: 'LEAK', rawUserText: 'Task12 legacy boundary synthetic' } }); expect(made.status()).toBe(201); const id = (await made.json()).ticketId;
  await page.goto('/core'); await page.getByLabel('개발 접근 코드').fill(codes.manager); await page.getByRole('button', { name: '들어가기', exact: true }).click(); await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click(); await openInspector(page);
  await expect(page.getByRole('region', { name: '업체 연결 및 작업 요청', exact: true })).toHaveCount(0);
  // Legacy server deliberately has no Vendor port; it fails closed at that dependency boundary.
  const denied = await request.get(`/api/v2/core/manager/tickets/${id}/vendor-handoff`, { headers: { Authorization: `Bearer ${codes.manager}` } }); expect(denied.status()).toBe(503);
});
