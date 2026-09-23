import { expect,it,vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import type { SessionData } from '@auth0/nextjs-auth0/types';
import { B1Error } from '@build-manager/application';
import { executeB1Logout } from './logout';
const base='http://localhost:3124';
function fixture(){
 const issuedAt=Math.floor(Date.now()/1000),csrf=randomBytes(32).toString('hex');
 const session:SessionData={user:{sub:'auth0|synthetic'},tokenSet:{accessToken:'synthetic',expiresAt:issuedAt+3600},internal:{sid:'synthetic',createdAt:issuedAt},b1:{csrf,handle:randomBytes(32).toString('hex'),issuedAt,expiresAt:issuedAt+3600}};
 const registry={currentActor:vi.fn().mockResolvedValue({userId:'synthetic'}),revoke:vi.fn().mockResolvedValue(undefined)};
 const provider=vi.fn().mockImplementation(async()=>NextResponse.redirect(base));
 const request=(headers:Record<string,string>={origin:base,'x-b1-csrf':csrf},method='POST')=>new NextRequest(base+'/api/v2/session/logout',{method,headers});
 return {session,registry,provider,request,csrf};
}
it.each(['missing','foreign','csrf','get'])('rejects %s without revoking or provider call',async kind=>{
 const f=fixture(),headers:Record<string,string>=kind==='missing'?{}:{origin:kind==='foreign'?'http://foreign.invalid':base,'x-b1-csrf':kind==='csrf'?'bad':f.csrf};
 const r=await executeB1Logout(f.request(headers,kind==='get'?'GET':'POST'),f.session,f.registry,f.provider,base);
 expect(r.status).toBe(kind==='get'?405:403);expect(f.registry.revoke).not.toHaveBeenCalled();expect(f.provider).not.toHaveBeenCalled();
});
it('commits revoke before provider and preserves cookie deletions with POST-safe redirect',async()=>{
 const f=fixture(),order:string[]=[];f.registry.revoke.mockImplementation(async()=>{order.push('commit');});f.provider.mockImplementation(async(req:NextRequest)=>{
  order.push('provider');expect(req.method).toBe('GET');expect(req.nextUrl.pathname).toBe('/auth/logout');expect(req.nextUrl.search).toBe('');
  const r=NextResponse.redirect(base);r.cookies.set('synthetic','',{maxAge:0});return r;
 });
 const r=await executeB1Logout(f.request(),f.session,f.registry,f.provider,base);expect(order).toEqual(['commit','provider']);expect(r.status).toBe(303);expect(r.headers.getSetCookie()).toEqual(expect.arrayContaining([expect.stringMatching(/^synthetic=;.*Max-Age=0/i)]));expect(r.headers.get('cache-control')).toContain('no-store');
});
it('DB failure returns503 without claiming revoke or invoking provider',async()=>{
 const f=fixture();f.registry.revoke.mockRejectedValue(new B1Error('DEPENDENCY_UNAVAILABLE'));const r=await executeB1Logout(f.request(),f.session,f.registry,f.provider,base);expect(r.status).toBe(503);expect(f.provider).not.toHaveBeenCalled();expect(await r.text()).not.toContain('ok');
});
it('provider failure after commit cannot undo server revoke',async()=>{
 const f=fixture();f.registry.revoke.mockImplementation(async()=>{f.registry.currentActor.mockResolvedValue(null);});f.provider.mockRejectedValue(new Error('PRIVATE_PROVIDER_DETAILS'));
 const r=await executeB1Logout(f.request(),f.session,f.registry,f.provider,base);expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE_PROVIDER_DETAILS');
 expect(await f.registry.currentActor()).toBeNull();
});
