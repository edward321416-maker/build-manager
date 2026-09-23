import { expect,it,vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { B1Error } from '@build-manager/application';
import type { SessionData } from '@auth0/nextjs-auth0/types';
import { handleB1Read,type B1HTTPDependencies } from './http';
const org='00000000-0000-4000-8000-000000000001',property='00000000-0000-4000-8000-000000000002';
function fixture(){
 const issuedAt=Math.floor(Date.now()/1000),session:SessionData={user:{sub:'auth0|synthetic'},tokenSet:{accessToken:'synthetic',expiresAt:issuedAt+3600},internal:{sid:'synthetic',createdAt:issuedAt},b1:{handle:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),issuedAt,expiresAt:issuedAt+3600}};
 const d={readSession:vi.fn().mockResolvedValue(session),sessions:{currentActor:vi.fn().mockResolvedValue({userId:'synthetic'}),revoke:vi.fn()},organizations:{listMine:vi.fn().mockResolvedValue({items:[{id:org,displayName:'Synthetic org'}],nextCursor:null}),listProperties:vi.fn().mockResolvedValue({items:[{id:property,orgId:org,addressReference:null}],nextCursor:null}),getProperty:vi.fn().mockResolvedValue({id:property,orgId:org,addressReference:null})}} satisfies B1HTTPDependencies;
 const request=(query='')=>new NextRequest('http://localhost:3124/api/v2/me/organizations'+query);
 return {d,request};
}
it.each(['?userId=other','?role=ORG_ADMIN','?orgId=other','?limit=0','?limit=51','?limit=1&limit=2','?after=invalid'])('R04 rejects caller authority/invalid query %s',async query=>{
 const f=fixture(),r=await handleB1Read(f.request(query),'organizations',{},()=>f.d);expect(r.status).toBe(400);expect(f.d.organizations.listMine).not.toHaveBeenCalled();
});
it('R04 anonymous and revoked requests are denied before reader',async()=>{
 const f=fixture();f.d.readSession.mockResolvedValue(null);expect((await handleB1Read(f.request(),'organizations',{},()=>f.d)).status).toBe(401);expect(f.d.organizations.listMine).not.toHaveBeenCalled();
});
it('R10 DB failure never becomes empty success or raw error response',async()=>{
 const f=fixture();f.d.sessions.currentActor.mockRejectedValue(new Error('PRIVATE_SQL_DETAILS'));const r=await handleB1Read(f.request(),'organizations',{},()=>f.d);expect(r.status).toBe(503);expect(await r.text()).toBe('{"error":"DEPENDENCY_UNAVAILABLE"}');expect(f.d.organizations.listMine).not.toHaveBeenCalled();
});
it('R03 foreign property uses general not-found response',async()=>{
 const f=fixture();f.d.organizations.getProperty.mockRejectedValue(new B1Error('NOT_FOUND'));const r=await handleB1Read(f.request(),'property',{orgId:org,propertyId:property},()=>f.d);expect(r.status).toBe(404);expect(await r.json()).toEqual({error:'NOT_FOUND'});
});
it('R04 every successful read and every denial is private/no-store',async()=>{
 const f=fixture();for(const kind of ['session','organizations','properties','property'] as const){const r=await handleB1Read(f.request(),kind,{orgId:org,propertyId:property},()=>f.d);expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');expect(r.headers.get('vary')).toBe('Cookie');}
 f.d.sessions.currentActor.mockResolvedValue(null);const r=await handleB1Read(f.request(),'session',{},()=>f.d);expect(r.status).toBe(401);expect(r.headers.get('cache-control')).toContain('no-store');
});
it('R05 each new request rechecks state, never reuses a previous allow',async()=>{
 const f=fixture();expect((await handleB1Read(f.request(),'organizations',{},()=>f.d)).status).toBe(200);f.d.sessions.currentActor.mockResolvedValue(null);expect((await handleB1Read(f.request(),'organizations',{},()=>f.d)).status).toBe(401);expect(f.d.organizations.listMine).toHaveBeenCalledOnce();
});

// These are HTTP propagation regressions. Actual hidden-reason authorization is
// proved separately by PostgreSQL and the B2 browser suite.
it.each(['unassigned','foreign','archived','ended assignment'])('AC13 noAuthorityAndUniform404: %s',async()=>{
 const f=fixture();f.d.organizations.getProperty.mockRejectedValue(new B1Error('NOT_FOUND'));
 const req=new NextRequest(`http://localhost:3124/api/v2/organizations/${org}/properties/${property}`,{
  headers:{'x-role':'ORG_ADMIN','x-user-id':'synthetic-other','x-org-id':org},
 });
 const r=await handleB1Read(req,'property',{orgId:org,propertyId:property},()=>f.d);
 expect(r.status).toBe(404);expect(await r.json()).toEqual({error:'NOT_FOUND'});
 expect(r.headers.get('cache-control')).toContain('private');
 expect(r.headers.get('cache-control')).toContain('no-store');
 expect(r.headers.get('vary')).toBe('Cookie');
});

it('AC03 authorized empty property list remains 200 with the existing DTO',async()=>{
 const f=fixture();f.d.organizations.listProperties.mockResolvedValue({items:[],nextCursor:null});
 const r=await handleB1Read(f.request(),'properties',{orgId:org},()=>f.d);
 expect(r.status).toBe(200);expect(await r.json()).toEqual({items:[],nextCursor:null});
 expect(r.headers.get('cache-control')).toContain('no-store');
});

it('AC13 forged body and headers never replace a current session',async()=>{
 const f=fixture();f.d.readSession.mockResolvedValue(null);
 const url=`http://localhost:3124/api/v2/organizations/${org}/properties/${property}`;
 const headers={'x-role':'ORG_ADMIN','x-user-id':'synthetic-other','x-org-id':org};
 const missing=await handleB1Read(new NextRequest(url,{headers}),'property',{orgId:org,propertyId:property},()=>f.d);
 expect(missing.status).toBe(401);expect(await missing.json()).toEqual({error:'UNAUTHENTICATED'});
 const posted=await handleB1Read(new NextRequest(url,{method:'POST',headers,body:JSON.stringify({role:'ORG_ADMIN',userId:'synthetic-other',orgId:org})}),'property',{orgId:org,propertyId:property},()=>f.d);
 expect(posted.status).toBe(405);expect(await posted.json()).toEqual({error:'METHOD_NOT_ALLOWED'});
 expect(f.d.organizations.getProperty).not.toHaveBeenCalled();
});

it.each(['?role=ORG_ADMIN','?userId=synthetic-other','?orgId=other','?limit=1&limit=2'])('AC13 property path rejects authority query %s',async query=>{
 const f=fixture();const r=await handleB1Read(f.request(query),'property',{orgId:org,propertyId:property},()=>f.d);
 expect(r.status).toBe(400);expect(await r.json()).toEqual({error:'INVALID_INPUT'});
 expect(f.d.organizations.getProperty).not.toHaveBeenCalled();
});

it('AC13 reader dependency failure stays 503 instead of hidden-resource or empty success',async()=>{
 const f=fixture();f.d.organizations.getProperty.mockRejectedValue(new B1Error('DEPENDENCY_UNAVAILABLE'));
 const r=await handleB1Read(f.request(),'property',{orgId:org,propertyId:property},()=>f.d);
 expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'DEPENDENCY_UNAVAILABLE'});
 expect(r.headers.get('cache-control')).toContain('no-store');
});
