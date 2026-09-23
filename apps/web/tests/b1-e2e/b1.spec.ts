import { test,expect,type Page } from '@playwright/test';
import { baseURL,fixtureSession } from './fixture-session';
class WorkspacePage {
 constructor(readonly page:Page){}
 async open(path='/workspace'){await this.page.goto(path);}
 async ownOrganization(){await this.page.getByRole('link',{name:'Synthetic organization',exact:true}).click();}
 async property(){await this.page.getByRole('link',{name:'주소 미등록 건물',exact:true}).click();}
 async denied(){await expect(this.page.getByRole('main').getByRole('alert')).toContainText('접근 권한이 없습니다');}
}
test('R04 unauthenticated401',async({page,request})=>{
 expect((await request.get('/api/v2/me/organizations')).status()).toBe(401);
 const ui=new WorkspacePage(page);await ui.open();await ui.denied();
 const r=await request.get('/api/v2/session/complete?userId=forged');expect(r.status()).toBe(400);expect(r.headers()['cache-control']).toContain('no-store');
});
test('R02 unassignedempty',async({browser})=>{
 const f=await fixtureSession(browser,'NONE');try{const page=await f.context.newPage();await page.goto('/workspace');await expect(page.getByText('접근 가능한 조직이 없습니다.')).toBeVisible();expect((await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`)).status()).toBe(404);}finally{await f.close();}
});
test('R01 ownorg/property and one-time completion',async({browser})=>{
 const f=await fixtureSession(browser);try{
  const page=await f.context.newPage(),ui=new WorkspacePage(page);await ui.open();await ui.ownOrganization();await ui.property();await expect(page.getByText('주소가 등록되지 않았습니다.')).toBeVisible();
  const replay=await f.context.request.get('/api/v2/session/complete',{maxRedirects:0});expect(replay.status()).toBe(401);expect(replay.headers()['cache-control']).toContain('no-store');
 }finally{await f.close();}
 const fresh=await fixtureSession(browser,'NONE',false);try{
  expect((await fresh.context.request.get('/api/v2/session')).status()).toBe(401);
  const completion=await fresh.context.request.get('/api/v2/session/complete',{maxRedirects:0});expect(completion.status()).toBe(303);expect(completion.headers()['cache-control']).toContain('no-store');expect(completion.headers()['vary']).toContain('Cookie');
  expect((await fresh.context.request.get('/api/v2/me/organizations')).status()).toBe(200);expect((await fresh.context.request.get('/api/v2/session/complete',{maxRedirects:0})).status()).toBe(401);
 }finally{await fresh.close();}
});
test('R03 foreignorg/property404',async({browser})=>{
 const a=await fixtureSession(browser),b=await fixtureSession(browser);try{
  expect((await a.context.request.get(`/api/v2/organizations/${b.orgId}/properties/${b.propertyId}`)).status()).toBe(404);
  const ui=new WorkspacePage(await a.context.newPage());await ui.open(`/workspace/organizations/${b.orgId}/properties/${b.propertyId}`);await ui.denied();
 }finally{await a.close();await b.close();}
});
test('R04 queryauthority400',async({browser})=>{
 const f=await fixtureSession(browser);try{for(const query of ['role=ORG_ADMIN','userId=forged','orgId=forged','limit=51'])expect((await f.context.request.get('/api/v2/me/organizations?'+query)).status()).toBe(400);}finally{await f.close();}
});
test('R05 staleMembership404',async({browser})=>{
 const f=await fixtureSession(browser);try{const ui=new WorkspacePage(await f.context.newPage());await ui.open();await ui.ownOrganization();await expect(ui.page.getByRole('link',{name:'주소 미등록 건물',exact:true})).toBeVisible();
 await f.change("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[f.userId]);await ui.page.reload();await ui.denied();await expect(ui.page.getByRole('link',{name:'주소 미등록 건물',exact:true})).toHaveCount(0);
 expect((await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`)).status()).toBe(404);
 }finally{await f.close();}
});
test('R05 suspendedUser401',async({browser})=>{
 const f=await fixtureSession(browser);try{expect((await f.context.request.get('/api/v2/session')).status()).toBe(200);await f.change("UPDATE app.app_user SET status='SUSPENDED' WHERE id=$1",[f.userId]);expect((await f.context.request.get('/api/v2/session')).status()).toBe(401);}finally{await f.close();}
});
test('R06 oldcookieAfterLogout401',async({browser})=>{
 const f=await fixtureSession(browser);
 try{
  const {providerOrigin}=JSON.parse(process.env.B1_E2E_PRIVATE??'{}');
  const observations=async()=> (await (await fetch(providerOrigin+'/observations')).json()).logoutRequests;
  const before=await observations(),oldCookies=await f.context.cookies();
  const page=await f.context.newPage();await page.goto('/workspace');
  const logoutResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v2/session/logout');
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  expect((await logoutResponse).status()).toBe(303);await page.waitForURL(baseURL+'/');expect(await observations()).toBe(before+1);
  const replay=await browser.newContext({baseURL});try{await replay.addCookies(oldCookies);expect((await replay.request.get('/api/v2/me/organizations')).status()).toBe(401);expect((await replay.request.get('/api/v2/session/complete',{maxRedirects:0})).status()).toBe(401);}finally{await replay.close();}
 }finally{await f.close();}
});
test('R04 userA/BcacheIsolation',async({browser})=>{
 const a=await fixtureSession(browser),b=await fixtureSession(browser);try{
  for(const f of [a,b,a]){const response=await f.context.request.get('/api/v2/me/organizations');expect(response.headers()['cache-control']).toContain('no-store');expect((await response.json()).items.map((x:{id:string})=>x.id)).toEqual([f.orgId]);}
 }finally{await a.close();await b.close();}
});
test('R04 staff/residentDenied',async({browser})=>{
 for(const role of ['PROPERTY_STAFF','RESIDENT'] as const){const f=await fixtureSession(browser,role);try{expect((await (await f.context.request.get('/api/v2/me/organizations')).json()).items).toEqual([]);expect((await f.context.request.get(`/api/v2/organizations/${f.orgId}/properties`)).status()).toBe(404);}finally{await f.close();}}
});
test('R09 B1demoV1Blocked',async({browser})=>{
 const f=await fixtureSession(browser);try{expect((await f.context.request.get('/demo/landlord')).status()).toBe(404);for(const path of ['/api/v1/buildings/demo-building-a','/api/v1/tickets'])expect((await f.context.request.get(path)).status()).toBeGreaterThanOrEqual(400);}finally{await f.close();}
});
test('R10 DBfailureNoFallback',async({browser})=>{
 const f=await fixtureSession(browser);
 async function permission(verb:'REVOKE'|'GRANT'){await f.migration.query('BEGIN');try{await f.migration.query('SET LOCAL ROLE bm_b1_capability_owner');await f.migration.query(`${verb} EXECUTE ON FUNCTION authn.current_actor(bytea) ${verb==='GRANT'?'TO':'FROM'} bm_b1_web`);await f.migration.query('COMMIT');}catch(e){await f.migration.query('ROLLBACK');throw e;}}
 try{
  await permission('REVOKE');const response=await f.context.request.get('/api/v2/me/organizations');expect(response.status()).toBe(503);expect(await response.json()).toEqual({error:'DEPENDENCY_UNAVAILABLE'});
  const page=await f.context.newPage();await page.goto('/workspace');await expect(page.getByRole('main').getByRole('alert')).toContainText('불러올 수 없습니다');await expect(page.getByText('접근 가능한 조직이 없습니다.')).toHaveCount(0);
 }finally{await permission('GRANT');await f.close();}
});
