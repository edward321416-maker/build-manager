import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { loadPropertyWorkspace,PropertyWorkspace } from './property-workspace';
const org='00000000-0000-4000-8000-000000000001',property='00000000-0000-4000-8000-000000000002';
function response(body:unknown,headers?:Record<string,string>){return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json',...headers}});}
it('starts with create controls hidden and no role badge',()=>{
 const html=renderToStaticMarkup(createElement(PropertyWorkspace,{orgId:org}));expect(html).not.toContain('건물 등록');expect(html).not.toContain('ORG_ADMIN');expect(html).not.toContain('PROPERTY_STAFF');
});
it('uses only exact true capability and preserves empty copy',async()=>{
 const fetcher=vi.fn()
  .mockResolvedValueOnce(response({csrf:'a'.repeat(64)}))
  .mockResolvedValueOnce(response({items:[],nextCursor:null},{'X-B3-Can-Create-Property':'true'}));
 await expect(loadPropertyWorkspace(fetcher,org,null)).resolves.toMatchObject({csrf:'a'.repeat(64),properties:[],canCreate:true,nextCursor:null});
 expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['false','TRUE','true, false',''])('does not treat %s as create authority',async value=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({csrf:'a'.repeat(64)})).mockResolvedValueOnce(response({items:[{id:property,orgId:org,addressReference:'SYNTHETIC'}],nextCursor:null},{'X-B3-Can-Create-Property':value}));
 await expect(loadPropertyWorkspace(fetcher,org,null)).resolves.toMatchObject({canCreate:false});
});
