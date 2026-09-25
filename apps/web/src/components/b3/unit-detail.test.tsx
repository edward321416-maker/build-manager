import { expect,it,vi } from 'vitest';
import { loadUnitDetail } from './unit-detail';
const org='00000000-0000-4000-8000-000000000001',property='00000000-0000-4000-8000-000000000002',unit='00000000-0000-4000-8000-000000000003';
it('loads exact nested unit without status role assignment or occupancy fields',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:unit,orgId:org,propertyId:property,label:'101'}),{status:200,headers:{'content-type':'application/json'}}));
 await expect(loadUnitDetail(fetcher,org,property,unit)).resolves.toEqual({id:unit,orgId:org,propertyId:property,label:'101'});
});
