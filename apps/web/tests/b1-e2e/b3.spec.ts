import { test,expect } from '@playwright/test';
import { baseURL } from './fixture-session';
import {
  countRows,fixtureB3Session,jsonError,mutationHeaders,postProperty,postUnit,
  propertiesPath,propertyPath,seedUnit,unitPath,unitsPath,
} from './b3-fixture';

test('B3 AC01 adminPropertyCreateReadback',async({browser})=>{
 const f=await fixtureB3Session(browser);
 try{
  const page=await f.context.newPage();
  await page.goto(`/workspace/organizations/${f.orgId}`);
  await expect(page.getByRole('link',{name:'건물 등록',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'건물 등록',exact:true}).click();
  await page.getByLabel('확인되지 않은 수동 건물 참조').fill('SYNTHETIC-B3-AC01');
  await page.getByRole('button',{name:'등록',exact:true}).click();
  await page.waitForURL(new RegExp(`/workspace/organizations/${f.orgId}/properties/[0-9a-f-]+$`));
  await expect(page.getByText('SYNTHETIC-B3-AC01',{exact:true})).toBeVisible();
  const rows=await f.migration.query<{id:string}>("SELECT id FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-B3-AC01'",[f.orgId]);
  expect(rows.rows).toHaveLength(1);
  const response=await f.context.request.get(propertyPath(f,rows.rows[0].id));
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({id:rows.rows[0].id,orgId:f.orgId,addressReference:'SYNTHETIC-B3-AC01'});
 }finally{await f.close();}
});

test('B3 AC02 staffPropertyCreateForbidden',async({browser})=>{
 const f=await fixtureB3Session(browser,'PROPERTY_STAFF',true);
 try{
  const response=await postProperty(f,'SYNTHETIC-B3-STAFF');
  await jsonError(response,403,'FORBIDDEN');
  expect(await countRows(f,"SELECT count(*) FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-B3-STAFF'",[f.orgId])).toBe(0);
 }finally{await f.close();}
});

test('B3 AC03 hiddenOrgPropertyCreate404',async({browser})=>{
 const f=await fixtureB3Session(browser,'PROPERTY_STAFF',true),foreign=await fixtureB3Session(browser);
 try{
  await jsonError(await postProperty(f,'SYNTHETIC-B3-HIDDEN',foreign.orgId),404,'NOT_FOUND');
  expect(await countRows(f,"SELECT count(*) FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-B3-HIDDEN'",[foreign.orgId])).toBe(0);
  await f.change("UPDATE app.organization SET status='SUSPENDED' WHERE id=$1",[f.orgId]);
  await jsonError(await postProperty(f,'SYNTHETIC-B3-SUSPENDED'),404,'NOT_FOUND');
 }finally{await f.close();await foreign.close();}
});

test('B3 AC05 adminUnitCreateReadback',async({browser})=>{
 const f=await fixtureB3Session(browser);
 try{
  const page=await f.context.newPage();
  await page.goto(`/workspace/organizations/${f.orgId}/properties/${f.propertyId}`);
  await expect(page.getByText('조회 가능한 호실이 없습니다.',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'호실 등록',exact:true}).click();
  await page.getByLabel('호실 이름').fill('SYNTHETIC-501');
  await page.getByRole('button',{name:'등록',exact:true}).click();
  await page.waitForURL(new RegExp(`/workspace/organizations/${f.orgId}/properties/${f.propertyId}/units/[0-9a-f-]+$`));
  await expect(page.getByText('SYNTHETIC-501',{exact:true})).toBeVisible();
  const units=await f.migration.query<{id:string}>("SELECT id FROM app.unit WHERE org_id=$1 AND property_id=$2 AND label='SYNTHETIC-501'",[f.orgId,f.propertyId]);
  expect(units.rows).toHaveLength(1);
  expect((await f.context.request.get(unitPath(f,units.rows[0].id))).status()).toBe(200);
  expect(await countRows(f,'SELECT count(*) FROM app.property_assignment WHERE property_id=$1',[f.propertyId])).toBe(0);
  expect(await countRows(f,'SELECT count(*) FROM app.occupancy WHERE unit_id=$1',[units.rows[0].id])).toBe(0);
 }finally{await f.close();}
});

test('B3 AC06 staffUnitCreateBoundary',async({browser})=>{
 const f=await fixtureB3Session(browser,'PROPERTY_STAFF',true);
 try{
  await jsonError(await postUnit(f,'SYNTHETIC-601',f.propertyId),403,'FORBIDDEN');
  await jsonError(await postUnit(f,'SYNTHETIC-602',f.propertyB),404,'NOT_FOUND');
  expect(await countRows(f,"SELECT count(*) FROM app.unit WHERE org_id=$1 AND label IN ('SYNTHETIC-601','SYNTHETIC-602')",[f.orgId])).toBe(0);
 }finally{await f.close();}
});

test('B3 AC07 hiddenPropertyUnitCreate404',async({browser})=>{
 const f=await fixtureB3Session(browser),foreign=await fixtureB3Session(browser);
 try{
  await f.change("UPDATE app.property SET status='ARCHIVED' WHERE id=$1",[f.propertyId]);
  await jsonError(await postUnit(f,'SYNTHETIC-701',f.propertyId),404,'NOT_FOUND');
  await jsonError(await postUnit(f,'SYNTHETIC-702',foreign.propertyId,foreign.orgId),404,'NOT_FOUND');
  expect(await countRows(f,"SELECT count(*) FROM app.unit WHERE label IN ('SYNTHETIC-701','SYNTHETIC-702')")).toBe(0);
 }finally{await f.close();await foreign.close();}
});

test('B3 AC08 duplicateUnit409',async({browser})=>{
 const f=await fixtureB3Session(browser);
 try{
  const first=await postUnit(f,'CaseLabel');expect(first.status()).toBe(201);
  await jsonError(await postUnit(f,'caselabel'),409,'CONFLICT');
  const peer=await postUnit(f,'caselabel',f.propertyB);expect(peer.status()).toBe(201);
  const firstBody=await first.json();
  await f.change("UPDATE app.unit SET status='ARCHIVED' WHERE id=$1",[firstBody.id]);
  expect((await postUnit(f,'caselabel')).status()).toBe(201);
 }finally{await f.close();}
});

test('B3 AC10 adminUnitReadEmptyAndDetail',async({browser})=>{
 const f=await fixtureB3Session(browser);
 try{
  const empty=await f.context.request.get(unitsPath(f));expect(empty.status()).toBe(200);expect(await empty.json()).toEqual({items:[],nextCursor:null});
  const page=await f.context.newPage();await page.goto(`/workspace/organizations/${f.orgId}/properties/${f.propertyId}`);
  await expect(page.getByText('조회 가능한 호실이 없습니다.',{exact:true})).toBeVisible();
  const id=await seedUnit(f,f.propertyId,'SYNTHETIC-1001');
  const list=await f.context.request.get(unitsPath(f));expect((await list.json()).items).toEqual([{id,orgId:f.orgId,propertyId:f.propertyId,label:'SYNTHETIC-1001'}]);
  const detail=await f.context.request.get(unitPath(f,id));expect(await detail.json()).toEqual({id,orgId:f.orgId,propertyId:f.propertyId,label:'SYNTHETIC-1001'});
 }finally{await f.close();}
});

test('B3 AC11 staffAssignedUnitScope',async({browser})=>{
 const f=await fixtureB3Session(browser,'PROPERTY_STAFF',true),zero=await fixtureB3Session(browser,'PROPERTY_STAFF',false);
 try{
  const visible=await seedUnit(f,f.propertyId,'SYNTHETIC-1101');
  const hidden=await seedUnit(f,f.propertyB,'SYNTHETIC-1102');
  const response=await f.context.request.get(unitsPath(f));expect(response.status()).toBe(200);
  expect((await response.json()).items.map((x:{id:string})=>x.id)).toEqual([visible]);
  await jsonError(await f.context.request.get(unitsPath(f,f.propertyB)),404,'NOT_FOUND');
  await jsonError(await f.context.request.get(unitPath(f,hidden,f.propertyB)),404,'NOT_FOUND');
  await jsonError(await zero.context.request.get(unitsPath(zero)),404,'NOT_FOUND');
  const page=await f.context.newPage();await page.goto(`/workspace/organizations/${f.orgId}/properties/${f.propertyId}`);
  await expect(page.getByText('SYNTHETIC-1101',{exact:true})).toBeVisible();await expect(page.getByText('SYNTHETIC-1102',{exact:true})).toHaveCount(0);
 }finally{await f.close();await zero.close();}
});

test('B3 AC14 csrfOriginBodyBoundaries',async({browser})=>{
 const f=await fixtureB3Session(browser);
 const anonymous=await browser.newContext({baseURL});
 try{
  const before=await countRows(f,'SELECT count(*) FROM app.property WHERE org_id=$1',[f.orgId]);
  await jsonError(await f.context.request.post(propertiesPath(f),{headers:{'x-b1-csrf':f.csrf,'content-type':'application/json'},data:{addressReference:'SYNTHETIC-NO-ORIGIN'}}),403,'FORBIDDEN');
  await jsonError(await f.context.request.post(propertiesPath(f),{headers:{origin:baseURL,'content-type':'application/json'},data:{addressReference:'SYNTHETIC-NO-CSRF'}}),403,'FORBIDDEN');
  await jsonError(await anonymous.request.post(propertiesPath(f),{headers:{origin:baseURL,'x-b1-csrf':f.csrf,'content-type':'application/json'},data:{addressReference:'SYNTHETIC-ANON'}}),401,'UNAUTHENTICATED');
  await jsonError(await f.context.request.post(propertiesPath(f),{headers:mutationHeaders(f),data:'{"addressReference":'}),400,'INVALID_INPUT');
  await jsonError(await f.context.request.post(propertiesPath(f),{headers:mutationHeaders(f),data:JSON.stringify({addressReference:'x'.repeat(8200)})}),413,'PAYLOAD_TOO_LARGE');
  expect(await countRows(f,'SELECT count(*) FROM app.property WHERE org_id=$1',[f.orgId])).toBe(before);
 }finally{await anonymous.close();await f.close();}
});

test('B3 AC19 hiddenUnitPagination',async({browser})=>{
 const f=await fixtureB3Session(browser,'PROPERTY_STAFF',true);
 try{
  const a='10000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002',hidden='15000000-0000-4000-8000-000000000003';
  await seedUnit(f,f.propertyId,'VISIBLE-A',a);await seedUnit(f,f.propertyId,'VISIBLE-B',b);await seedUnit(f,f.propertyB,'HIDDEN',hidden);
  const first=await f.context.request.get(unitsPath(f)+'?limit=1');expect(first.status()).toBe(200);
  const body=await first.json();expect(body.items).toHaveLength(1);expect([a,b]).toContain(body.items[0].id);expect([a,b]).toContain(body.nextCursor);
  const wire=JSON.stringify(body)+JSON.stringify(first.headers());expect(wire).not.toContain(hidden);expect(wire).not.toContain('HIDDEN');
  const second=await f.context.request.get(unitsPath(f)+`?limit=1&after=${body.nextCursor}`);const secondBody=await second.json();
  expect(secondBody.items).toHaveLength(1);expect(secondBody.items[0].id).not.toBe(hidden);
 }finally{await f.close();}
});

test('B3 AC20 syntheticNoFallback',async({browser})=>{
 const f=await fixtureB3Session(browser);
 try{
  const {providerOrigin}=JSON.parse(process.env.B1_E2E_PRIVATE??'{}');
  const before=(await (await fetch(providerOrigin+'/observations')).json()).logoutRequests;
  const created=await postProperty(f,'SYNTHETIC-B3-NETWORK');expect(created.status()).toBe(201);
  const body=await created.json();expect((await f.context.request.get(propertyPath(f,body.id))).status()).toBe(200);
  expect((await f.context.request.get('/api/v2/session')).status()).toBe(200);
  const after=(await (await fetch(providerOrigin+'/observations')).json()).logoutRequests;expect(after).toBe(before);
  const page=await f.context.newPage();await page.goto(`/workspace/organizations/${f.orgId}/properties/new`);
  await expect(page.getByText('확인되지 않은 수동 건물 참조',{exact:false})).toBeVisible();
  await expect(page.getByText(/검증된|소유권 인증|지도/)).toHaveCount(0);
 }finally{await f.close();}
});

test('B3 AC21 capabilityUiAndForgedHeader',async({browser})=>{
 const admin=await fixtureB3Session(browser),staff=await fixtureB3Session(browser,'PROPERTY_STAFF',true);
 try{
  const adminList=await admin.context.request.get(propertiesPath(admin));expect(adminList.headers()['x-b3-can-create-property']).toBe('true');
  const staffList=await staff.context.request.get(propertiesPath(staff));expect(staffList.headers()['x-b3-can-create-property']).toBe('false');
  const adminPage=await admin.context.newPage();await adminPage.goto(`/workspace/organizations/${admin.orgId}`);await expect(adminPage.getByRole('link',{name:'건물 등록',exact:true})).toBeVisible();
  const staffPage=await staff.context.newPage();await staffPage.goto(`/workspace/organizations/${staff.orgId}`);await expect(staffPage.getByRole('link',{name:'건물 등록',exact:true})).toHaveCount(0);
  await staffPage.goto(`/workspace/organizations/${staff.orgId}/properties/new`);await expect(staffPage.getByLabel('확인되지 않은 수동 건물 참조')).toHaveCount(0);
  await jsonError(await postProperty(staff,'SYNTHETIC-FORGED',staff.orgId,{'x-b3-can-create-property':'true','x-role':'ORG_ADMIN'}),403,'FORBIDDEN');
  expect(await countRows(staff,"SELECT count(*) FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-FORGED'",[staff.orgId])).toBe(0);
 }finally{await admin.close();await staff.close();}
});
