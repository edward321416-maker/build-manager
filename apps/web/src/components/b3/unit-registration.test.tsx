import { expect,it,vi } from 'vitest';
import { loadUnitRegistrationAccess,submitUnitRegistration } from './unit-registration';
const org='00000000-0000-4000-8000-000000000001',property='00000000-0000-4000-8000-000000000002',unit='00000000-0000-4000-8000-000000000003';
const response=(body:unknown,status=200,headers?:Record<string,string>)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
it('direct registration requires exact scoped create capability',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({csrf:'f'.repeat(64)})).mockResolvedValueOnce(response({items:[],nextCursor:null},200,{'X-B3-Can-Create-Unit':'true'}));
 await expect(loadUnitRegistrationAccess(fetcher,org,property)).resolves.toEqual({csrf:'f'.repeat(64),canCreate:true});
});
it('maps duplicate conflict without exposing row detail and derives validated unit path',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({error:'CONFLICT'},409));
 await expect(submitUnitRegistration(fetcher,org,property,'1'.repeat(64),'101')).resolves.toEqual({kind:'conflict'});
 expect(fetcher).toHaveBeenCalledOnce();
 fetcher.mockReset().mockResolvedValueOnce(response({id:unit,orgId:org,propertyId:property,label:'101'},201,{Location:'https://evil.invalid/'}));
 await expect(submitUnitRegistration(fetcher,org,property,'1'.repeat(64),' 101 ')).resolves.toEqual({kind:'created',path:`/workspace/organizations/${org}/properties/${property}/units/${unit}`,unit:{id:unit,orgId:org,propertyId:property,label:'101'}});
});
