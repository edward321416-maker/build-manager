import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { UnitWorkspace,loadUnitWorkspace } from './unit-workspace';
const org='00000000-0000-4000-8000-000000000001',property='00000000-0000-4000-8000-000000000002',unit='00000000-0000-4000-8000-000000000003';
const response=(body:unknown,headers?:Record<string,string>)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json',...headers}});
it('starts hidden and role neutral',()=>{const html=renderToStaticMarkup(createElement(UnitWorkspace,{orgId:org,propertyId:property}));expect(html).not.toContain('호실 등록');expect(html).not.toContain('ORG_ADMIN');});
it('loads visible property and units and exact create capability',async()=>{
 const fetcher=vi.fn()
  .mockResolvedValueOnce(response({csrf:'e'.repeat(64)}))
  .mockResolvedValueOnce(response({id:property,orgId:org,addressReference:'SYNTHETIC'}))
  .mockResolvedValueOnce(response({items:[{id:unit,orgId:org,propertyId:property,label:'101'}],nextCursor:null},{'X-B3-Can-Create-Unit':'true'}));
 await expect(loadUnitWorkspace(fetcher,org,property,null)).resolves.toMatchObject({csrf:'e'.repeat(64),canCreate:true,nextCursor:null,units:[{id:unit,label:'101'}]});
});
