import { test, expect, type Page, type APIResponse } from '@playwright/test';
import { fixtureB2Session, type B2WebFixture } from './b2-fixture';

test('AC03 staffNoAssignmentEmpty', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', false);
  try {
    const page = await f.context.newPage();
    await page.goto('/workspace');
    await page.locator(`a[href="/workspace/organizations/${f.orgId}"]`).click();
    await expect(page.getByRole('heading', { name: '내 조직의 건물', exact: true })).toBeVisible();
    const orgs = await f.context.request.get('/api/v2/me/organizations');
    expect(orgs.status()).toBe(200);
    expect((await orgs.json()).items).toEqual([{ id: f.orgId, displayName: 'Synthetic organization' }]);
    const response = await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    await expect(page.getByText('조회 가능한 건물이 없습니다.', { exact: true })).toBeVisible();
  } finally { await f.close(); }
});

function propertyAPI(f: B2WebFixture, id: string = f.propertyId) { return `/api/v2/organizations/${f.orgId}/properties/${id}`; }
function propertyPage(f: B2WebFixture, id: string = f.propertyId) { return `/workspace/organizations/${f.orgId}/properties/${id}`; }
async function visibleOrganization(f: B2WebFixture) {
  const response = await f.context.request.get('/api/v2/me/organizations');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ items: [{ id: f.orgId, displayName: 'Synthetic organization' }], nextCursor: null });
}
async function propertyIds(f: B2WebFixture) {
  const response = await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['items', 'nextCursor']);
  for (const item of body.items) expect(Object.keys(item).sort()).toEqual(['addressReference', 'id', 'orgId']);
  return body.items.map((item: { id: string }) => item.id).sort();
}
async function deniedResponse(response: APIResponse) {
  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body).toEqual({ error: 'NOT_FOUND' });
  return body;
}
async function deniedPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('접근 권한이 없습니다');
  await expect(page.getByText('주소가 등록되지 않았습니다.', { exact: true })).toHaveCount(0);
}
async function openOrganization(page: Page, f: B2WebFixture) {
  await page.goto('/workspace');
  await page.locator(`a[href="/workspace/organizations/${f.orgId}"]`).click();
  await expect(page.getByRole('heading', { name: '내 조직의 건물', exact: true })).toBeVisible();
}

test('AC01 adminAB', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'ORG_ADMIN', false);
  try {
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([f.propertyId, f.propertyB].sort());
    const page = await f.context.newPage();
    for (const id of [f.propertyId, f.propertyB]) {
      await openOrganization(page, f);
      await page.locator(`a[href="${propertyPage(f, id)}"]`).click();
      await expect(page.getByText('주소가 등록되지 않았습니다.', { exact: true })).toBeVisible();
      const response = await f.context.request.get(propertyAPI(f, id));
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ id, orgId: f.orgId, addressReference: null });
    }
  } finally { await f.close(); }
});

test('AC02 staffAssignedA', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  try {
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([f.propertyId]);
    const page = await f.context.newPage();
    await openOrganization(page, f);
    await expect(page.locator(`a[href="${propertyPage(f)}"]`)).toBeVisible();
    await expect(page.locator(`a[href="${propertyPage(f, f.propertyB)}"]`)).toHaveCount(0);
    await page.locator(`a[href="${propertyPage(f)}"]`).click();
    await expect(page.getByText('주소가 등록되지 않았습니다.', { exact: true })).toBeVisible();
    expect((await f.context.request.get(propertyAPI(f))).status()).toBe(200);
    await deniedResponse(await f.context.request.get(propertyAPI(f, f.propertyB)));
    await deniedPage(page, propertyPage(f, f.propertyB));
  } finally { await f.close(); }
});

test('AC04 foreign404', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  const foreign = await fixtureB2Session(browser, 'ORG_ADMIN', false);
  try {
    const sameOrg = await deniedResponse(await f.context.request.get(propertyAPI(f, f.propertyB)));
    expect(await deniedResponse(await f.context.request.get(propertyAPI(foreign)))).toEqual(sameOrg);
    expect(await deniedResponse(await f.context.request.get(`/api/v2/organizations/${foreign.orgId}/properties`))).toEqual(sameOrg);
    await visibleOrganization(f);
    const page = await f.context.newPage();
    await deniedPage(page, propertyPage(foreign));
    await deniedPage(page, `/workspace/organizations/${foreign.orgId}`);
  } finally { await f.close(); await foreign.close(); }
});

test('AC05 assignmentEnded', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  try {
    const page = await f.context.newPage();
    await openOrganization(page, f);
    await expect(page.locator(`a[href="${propertyPage(f)}"]`)).toBeVisible();
    expect((await f.context.request.get(propertyAPI(f))).status()).toBe(200);
    await f.change("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [f.assignmentId]);
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([]);
    await page.reload();
    await expect(page.getByText('조회 가능한 건물이 없습니다.', { exact: true })).toBeVisible();
    await expect(page.locator(`a[href="${propertyPage(f)}"]`)).toHaveCount(0);
    await deniedResponse(await f.context.request.get(propertyAPI(f)));
    await deniedPage(page, propertyPage(f));
  } finally { await f.close(); }
});

test('AC06 membershipEnded', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  try {
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([f.propertyId]);
    await f.change("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [f.membershipId]);
    const orgs = await f.context.request.get('/api/v2/me/organizations');
    expect(orgs.status()).toBe(200);
    expect(await orgs.json()).toEqual({ items: [], nextCursor: null });
    await deniedResponse(await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`));
    await deniedResponse(await f.context.request.get(propertyAPI(f)));
    await deniedPage(await f.context.newPage(), `/workspace/organizations/${f.orgId}`);
  } finally { await f.close(); }
});

test('AC07 orgSuspended', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  try {
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([f.propertyId]);
    await f.change("UPDATE app.organization SET status='SUSPENDED' WHERE id=$1", [f.orgId]);
    const orgs = await f.context.request.get('/api/v2/me/organizations');
    expect(orgs.status()).toBe(200);
    expect(await orgs.json()).toEqual({ items: [], nextCursor: null });
    await deniedResponse(await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`));
    await deniedResponse(await f.context.request.get(propertyAPI(f)));
    await deniedPage(await f.context.newPage(), `/workspace/organizations/${f.orgId}`);
  } finally { await f.close(); }
});

test('AC08 archived404', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  try {
    expect(await propertyIds(f)).toEqual([f.propertyId]);
    expect((await f.context.request.get(propertyAPI(f))).status()).toBe(200);
    await f.change("UPDATE app.property SET status='ARCHIVED' WHERE id=$1", [f.propertyId]);
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([]);
    await deniedResponse(await f.context.request.get(propertyAPI(f)));
    await deniedPage(await f.context.newPage(), propertyPage(f));
  } finally { await f.close(); }
});

test('AC13 forgedAuthority', async ({ browser }) => {
  const f = await fixtureB2Session(browser, 'PROPERTY_STAFF', true);
  const foreign = await fixtureB2Session(browser, 'ORG_ADMIN', false);
  try {
    for (const query of ['role=ORG_ADMIN', `userId=${foreign.userId}`, `orgId=${foreign.orgId}`]) {
      for (const path of ['/api/v2/me/organizations', `/api/v2/organizations/${f.orgId}/properties`, propertyAPI(f, f.propertyB)]) {
        const response = await f.context.request.get(`${path}?${query}`);
        expect(response.status()).toBe(400);
        expect(await response.json()).toEqual({ error: 'INVALID_INPUT' });
      }
    }
    const standard = await deniedResponse(await f.context.request.get(propertyAPI(f, f.propertyB)));
    expect(await deniedResponse(await f.context.request.get(propertyAPI(f, f.propertyB), { headers: { 'x-role': 'ORG_ADMIN', 'x-user-id': foreign.userId!, 'x-org-id': foreign.orgId } }))).toEqual(standard);
    expect((await f.context.request.post(propertyAPI(f, f.propertyB), { data: { role: 'ORG_ADMIN', userId: foreign.userId, orgId: foreign.orgId } })).status()).toBe(405);
    expect(await deniedResponse(await f.context.request.get(propertyAPI(foreign)))).toEqual(standard);
    await f.change("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [f.assignmentId]);
    expect(await deniedResponse(await f.context.request.get(propertyAPI(f)))).toEqual(standard);
    await f.change("UPDATE app.property SET status='ARCHIVED' WHERE id=$1", [f.propertyId]);
    expect(await deniedResponse(await f.context.request.get(propertyAPI(f)))).toEqual(standard);
    await visibleOrganization(f);
    expect(await propertyIds(f)).toEqual([]);
  } finally { await f.close(); await foreign.close(); }
});
