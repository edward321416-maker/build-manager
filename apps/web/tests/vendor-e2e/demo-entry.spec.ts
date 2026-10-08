import { test, expect, responsive } from './harness';

test('D01 login-free demo entry opens the Manager queue and Tenant intake; demo logout returns to the role choice', async ({ browser, fixture }) => {
  const managerContext = await browser.newContext({ baseURL: fixture.origin, viewport: { width: 1280, height: 900 } });
  const tenantContext = await browser.newContext({ baseURL: fixture.origin, viewport: { width: 390, height: 900 } });
  try {
    const manager = await managerContext.newPage();
    await manager.goto('/');
    await expect(manager.getByText('로그인 없이 합성 데모 데이터로 체험할 수 있습니다.', { exact: true })).toBeVisible();
    await manager.goto('/core');
    await expect(manager.getByRole('button', { name: '관리자로 체험하기', exact: true })).toBeVisible();
    await expect(manager.locator('a[href="/auth/login"]')).toHaveCount(0);
    await manager.getByRole('button', { name: '관리자로 체험하기', exact: true }).click();
    await expect(manager.getByRole('heading', { name: '업무함', exact: true })).toBeVisible();

    const tenant = await tenantContext.newPage();
    await tenant.goto('/core');
    await responsive(tenant, 390); await responsive(tenant, 390, true);
    await tenant.getByRole('button', { name: '세입자로 체험하기', exact: true }).click();
    await expect(tenant.getByRole('heading', { name: '어떤 문제가 있나요?', exact: true })).toBeVisible();
    await expect(tenant.getByRole('button', { name: '접수하기', exact: true })).toBeVisible();

    // Demo logout ends the server session and returns to the role choice, never to a provider.
    await manager.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(manager.getByRole('button', { name: '관리자로 체험하기', exact: true })).toBeVisible();
    expect(new URL(manager.url()).origin).toBe(fixture.origin);
    expect((await managerContext.request.get('/api/v2/core/access')).status()).toBe(401);

    // The entry accepts only a same-origin form with a known role.
    const post = (origin: string, role: string) => managerContext.request.post('/api/v2/session/demo', { headers: { Origin: origin }, form: { role }, maxRedirects: 0 });
    expect((await post('http://cross-site.invalid', 'manager')).status()).toBe(403);
    expect((await post(fixture.origin, 'vendor')).status()).toBe(400);
    expect((await managerContext.request.get('/api/v2/session/demo', { maxRedirects: 0 })).status()).toBe(405);
  } finally { await managerContext.close(); await tenantContext.close(); }
});
