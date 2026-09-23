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
