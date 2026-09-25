import { expect,it,vi } from 'vitest';
import { loadPropertyRegistrationAccess,submitPropertyRegistration } from './property-registration';
const org='00000000-0000-4000-8000-000000000001',property='00000000-0000-4000-8000-000000000002';
const response=(body:unknown,status=200,headers?:Record<string,string>)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
it('direct registration requires current csrf and exact create capability',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({csrf:'b'.repeat(64)})).mockResolvedValueOnce(response({items:[],nextCursor:null},200,{'X-B3-Can-Create-Property':'true'}));
 await expect(loadPropertyRegistrationAccess(fetcher,org)).resolves.toEqual({csrf:'b'.repeat(64),canCreate:true});
});
it('posts only the trimmed reference with csrf and derives validated detail path',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response({id:property,orgId:org,addressReference:'SYNTHETIC'},201,{Location:'https://evil.invalid/'}));
 await expect(submitPropertyRegistration(fetcher,org,'c'.repeat(64),'  SYNTHETIC  ')).resolves.toEqual({kind:'created',path:`/workspace/organizations/${org}/properties/${property}`,property:{id:property,orgId:org,addressReference:'SYNTHETIC'}});
 const init=fetcher.mock.calls[0][1];expect(init.headers['x-b1-csrf']).toBe('c'.repeat(64));expect(JSON.parse(init.body)).toEqual({addressReference:'SYNTHETIC'});
});
it.each([[403,'denied'],[404,'denied'],[503,'uncertain'],[400,'invalid']])('maps %s without automatic retry',async(status,kind)=>{
 const fetcher=vi.fn().mockResolvedValue(response({error:'X'},status));await expect(submitPropertyRegistration(fetcher,org,'d'.repeat(64),'SYNTHETIC')).resolves.toMatchObject({kind});expect(fetcher).toHaveBeenCalledOnce();
});
