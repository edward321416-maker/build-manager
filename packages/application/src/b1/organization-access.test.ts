import { expect,it,vi } from 'vitest';
import { getOrganizationProperty,listMyOrganizations,listOrganizationProperties } from './organization-access';
import { B1Error } from './errors';
function fixture(){return {sessions:{currentActor:vi.fn().mockResolvedValue(null),revoke:vi.fn()},organizations:{listMine:vi.fn().mockResolvedValue({items:[],nextCursor:null}),listProperties:vi.fn().mockResolvedValue({items:[],nextCursor:null}),getProperty:vi.fn().mockResolvedValue({})}};}
it('R04 all business use cases require current internal actor before reader',async()=>{
 const d=fixture(),digest='a'.repeat(64),id='00000000-0000-4000-8000-000000000001';
 for(const operation of [()=>listMyOrganizations(d,digest,{limit:20}),()=>listOrganizationProperties(d,digest,id,{limit:20}),()=>getOrganizationProperty(d,digest,id,id)])await expect(operation()).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 expect(d.organizations.listMine).not.toHaveBeenCalled();expect(d.organizations.listProperties).not.toHaveBeenCalled();expect(d.organizations.getProperty).not.toHaveBeenCalled();
});
it('R03 relationship guard failure is preserved and never converted into an empty success',async()=>{
 const d=fixture();d.sessions.currentActor.mockResolvedValue({userId:'synthetic'});d.organizations.listProperties.mockRejectedValue(new B1Error('NOT_FOUND'));
 await expect(listOrganizationProperties(d,'a'.repeat(64),'00000000-0000-4000-8000-000000000001',{limit:20})).rejects.toMatchObject({code:'NOT_FOUND'});
});

it('AC03 current actor can discover context and receive an authorized empty property list without a role DTO',async()=>{
 const d=fixture(),digest='b'.repeat(64),orgId='00000000-0000-4000-8000-000000000001';
 d.sessions.currentActor.mockResolvedValue({userId:'synthetic'});
 d.organizations.listMine.mockResolvedValue({items:[{id:orgId,displayName:'Synthetic org'}],nextCursor:null});
 expect(await listMyOrganizations(d,digest,{limit:20})).toEqual({items:[{id:orgId,displayName:'Synthetic org'}],nextCursor:null});
 expect(await listOrganizationProperties(d,digest,orgId,{limit:20})).toEqual({items:[],nextCursor:null});
 // A previous success does not authorize the next request after actor removal.
 d.sessions.currentActor.mockResolvedValue(null);
 await expect(listOrganizationProperties(d,digest,orgId,{limit:20})).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 expect(d.organizations.listProperties).toHaveBeenCalledTimes(1);
});

it.each(['NOT_FOUND','DEPENDENCY_UNAVAILABLE'] as const)('AC13 preserves reader %s without role-dependent fallback',async code=>{
 const d=fixture();d.sessions.currentActor.mockResolvedValue({userId:'synthetic'});
 d.organizations.getProperty.mockRejectedValue(new B1Error(code));
 await expect(getOrganizationProperty(d,'b'.repeat(64),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')).rejects.toMatchObject({code});
});
