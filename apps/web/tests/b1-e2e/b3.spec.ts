import { test,expect } from '@playwright/test';
import { baseURL } from './fixture-session';
import {
  countRows,fixtureB3Session,jsonError,mutationHeaders,postProperty,postUnit,
  propertiesPath,propertyPath,queryFixture,seedUnit,unitPath,unitsPath,
} from './b3-fixture';

test('B3 LOW M04 propertyUnicodeHttpBoundary',async({browser})=>{
 const f=await fixtureB3Session(browser);
 try{
  const snapshot=async()=>(await queryFixture(f,
   'SELECT id,org_id,address_reference FROM app.property WHERE org_id=$1 ORDER BY id',[f.orgId])).rows;
  const initial=await snapshot();
  expect(initial.some(row=>row.id===f.propertyId && row.address_reference===null)).toBe(true);
  for(const reference of ['한'.repeat(512),'😀'.repeat(512),'한😀A'.repeat(170)+'한😀']){
   expect([...reference]).toHaveLength(512);
   const response=await postProperty(f,reference);
   expect(response.status()).toBe(201);
   const created=await response.json();
   expect(created).toEqual({id:expect.any(String),orgId:f.orgId,addressReference:reference});
   const read=await f.context.request.get(propertyPath(f,created.id));
   expect(read.status()).toBe(200);
   expect(await read.json()).toEqual(created);
   expect((await queryFixture(f,
    'SELECT id,org_id,address_reference,char_length(address_reference) AS code_points FROM app.property WHERE id=$1',
    [created.id])).rows).toEqual([{id:created.id,org_id:f.orgId,address_reference:reference,code_points:512}]);
   const before=await snapshot();
   const tooLong=reference+'한';
   expect([...tooLong]).toHaveLength(513);
   expect(Buffer.byteLength(JSON.stringify({addressReference:tooLong}),'utf8')).toBeLessThan(8192);
   await jsonError(await postProperty(f,tooLong),400,'INVALID_INPUT');
   expect(await snapshot()).toEqual(before); // Exact visible row set and existing values, not only a zero count.
  }
  expect((await snapshot()).length).toBe(initial.length+3);
  expect((await f.context.request.get(propertyPath(f))).status()).toBe(200);
 }finally{await f.close();}
});

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
  const rows=await queryFixture<{id:string}>(f,"SELECT id FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-B3-AC01'",[f.orgId]);
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
  expect(await countRows(foreign,'SELECT count(*) FROM app.property WHERE org_id=$1',[foreign.orgId])).toBeGreaterThan(0);
  await jsonError(await postProperty(f,'SYNTHETIC-B3-HIDDEN',foreign.orgId),404,'NOT_FOUND');
  expect(await countRows(foreign,"SELECT count(*) FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-B3-HIDDEN'",[foreign.orgId])).toBe(0);
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
  const units=await queryFixture<{id:string}>(f,"SELECT id FROM app.unit WHERE org_id=$1 AND property_id=$2 AND label='SYNTHETIC-501'",[f.orgId,f.propertyId]);
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
  expect(await countRows(foreign,"SELECT count(*) FROM app.unit WHERE label IN ('SYNTHETIC-701','SYNTHETIC-702')")).toBe(0);
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
  expect(before).toBeGreaterThan(0);
  const context=await f.migration.query<{org_id:string|null}>("SELECT NULLIF(current_setting('app.org_id',true),'') AS org_id");
  expect(context.rows[0]?.org_id).toBeNull();
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

type H01Probe={ready:boolean;status:number;posts:number;signal?:AbortSignal|null;release?:()=>void;logoutDeferred:boolean};
type H01Window=Window & typeof globalThis & {__b3H01:H01Probe};

for(const kind of ['property','unit'] as const){
 for(const exit of ['navigation','logout'] as const){
  for(const outcome of ['late201','lateDenial'] as const){
   test(`B3 H01 ${kind} ${exit} ${outcome}`,async({browser})=>{
    const f=await fixtureB3Session(browser);
    try{
     const page=await f.context.newPage();
     const postPath=kind==='property'?propertiesPath(f):unitsPath(f);
     const registrationPath=kind==='property'
      ?`/workspace/organizations/${f.orgId}/properties/new`
      :`/workspace/organizations/${f.orgId}/properties/${f.propertyId}/units/new`;
     const destination=kind==='property'?`/workspace/organizations/${f.orgId}`:`/workspace/organizations/${f.orgId}/properties/${f.propertyId}`;
     await page.addInitScript(({postPath,deferLogout})=>{
      const w=window as H01Window;
      const probe:H01Probe={ready:false,status:0,posts:0,logoutDeferred:false};w.__b3H01=probe;
      const originalFetch=window.fetch.bind(window);
      window.fetch=async(input,init)=>{
       const path=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).pathname;
       if(init?.method!=='POST'||path!==postPath)return originalFetch(input,init);
       probe.posts+=1;probe.signal=init.signal;
       // The real API and database finish first. Only delivery to the mounted
       // component is gated; a fully buffered response may outlive cancellation.
       const response=await originalFetch(input,init),text=await response.text();
       const buffered=new Response(text,{status:response.status,headers:response.headers});
       buffered.json=()=>Promise.resolve(JSON.parse(text));
       const released=new Promise<void>(resolve=>{probe.release=resolve;});
       probe.status=response.status;probe.ready=true;
       await released;return buffered;
      };
      if(deferLogout){
       const originalSubmit=HTMLFormElement.prototype.submit;
       HTMLFormElement.prototype.submit=function(this:HTMLFormElement){
        if(new URL(this.action,location.href).pathname==='/api/v2/session/logout'){
         // Defer native document navigation to inspect the actual onSubmit
         // cleanup. Frozen B1 cases separately exercise the real logout endpoint.
         probe.logoutDeferred=true;return;
        }
        originalSubmit.call(this);
       };
      }
     },{postPath,deferLogout:exit==='logout'});
     await page.goto(registrationPath);
     const field=page.getByLabel(kind==='property'?'확인되지 않은 수동 건물 참조':'호실 이름');
     await field.fill('SYNTHETIC-H01');
     if(outcome==='lateDenial')await f.change("UPDATE app.organization_membership SET role='PROPERTY_STAFF' WHERE id=$1",[f.membershipId]);
     await page.getByRole('button',{name:'등록',exact:true}).click();
     await page.waitForFunction(()=>(window as H01Window).__b3H01.ready);
     const observedStatus=await page.evaluate(()=>(window as H01Window).__b3H01.status);
     expect(observedStatus).toBe(outcome==='late201'?201:kind==='property'?403:404);
     const committedCount=()=>kind==='property'
      ?countRows(f,"SELECT count(*) FROM app.property WHERE org_id=$1 AND address_reference='SYNTHETIC-H01'",[f.orgId])
      :countRows(f,"SELECT count(*) FROM app.unit WHERE org_id=$1 AND property_id=$2 AND label='SYNTHETIC-H01'",[f.orgId,f.propertyId]);
     expect(await committedCount()).toBe(outcome==='late201'?1:0);
     await expect(page.getByRole('button',{name:'등록 중',exact:true})).toBeDisabled();
     if(exit==='navigation'){
      await page.getByRole('link',{name:kind==='property'?'건물 목록':'건물 상세',exact:true}).click();
      await expect(page).toHaveURL(baseURL+destination);
      await expect(page.getByRole('heading',{name:kind==='property'?'내 조직의 건물':'건물 상세',exact:true})).toBeVisible();
     }else{
      await page.getByRole('button',{name:'로그아웃',exact:true}).click();
      expect(await page.evaluate(()=>(window as H01Window).__b3H01.logoutDeferred)).toBe(true);
      await expect(page.getByRole('status')).toHaveText('등록 권한을 확인하고 있습니다.');
     }
     expect.soft(await page.evaluate(()=>{
      const p=(window as H01Window).__b3H01;return {hasSignal:Boolean(p.signal),aborted:p.signal?.aborted??false,posts:p.posts};
     })).toEqual({hasSignal:true,aborted:true,posts:1});
     const lateNavigations:string[]=[];
     page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())lateNavigations.push(new URL(request.url()).pathname);});
     let pathAfterRelease:string|undefined;
     try{
      pathAfterRelease=await page.evaluate(async()=>{
       const p=(window as H01Window).__b3H01;
       if(!p.release)throw new Error('H01_RESPONSE_GATE_NOT_REACHED');
       p.release();
       // A posted task drains the buffered-response promise continuations;
       // no elapsed sleep is used as evidence of request completion.
       await new Promise<void>(resolve=>{
        const channel=new MessageChannel();
        channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
        channel.port2.postMessage(null);
       });
       return location.pathname;
      });
     }catch(error){if(lateNavigations.length===0)throw error;}
     expect.soft(lateNavigations).toEqual([]);
     if(pathAfterRelease!==undefined)expect.soft(pathAfterRelease).toBe(exit==='navigation'?destination:registrationPath);
     if(exit==='logout'&&lateNavigations.length===0)await expect.soft(page.getByRole('status')).toHaveText('등록 권한을 확인하고 있습니다.');
     // Aborting UI processing is not a rollback or an automatic write retry.
     expect(await committedCount()).toBe(outcome==='late201'?1:0);
    }finally{await f.close();}
   });
  }
 }
}
