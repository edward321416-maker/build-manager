import { expect,it,vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B1Error } from "@build-manager/application";
import { completeTransportSession } from "./complete-session";
function session(age=0):SessionData {const issuedAt=Math.floor(Date.now()/1000)-age;return {user:{sub:'auth0|synthetic'},tokenSet:{accessToken:'synthetic',expiresAt:issuedAt+3600},internal:{sid:'synthetic',createdAt:issuedAt},b1:{handle:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),issuedAt,expiresAt:issuedAt+3600}};}
it('fresh callback completes exactly its server-derived digest and original expiry',async()=>{
 const begin=vi.fn().mockResolvedValue({userId:'synthetic'}),s=session();await completeTransportSession(s,'https://synthetic.invalid/',{begin});
 expect(begin).toHaveBeenCalledWith({identity:{issuer:'https://synthetic.invalid/',subject:'auth0|synthetic'},digest:expect.stringMatching(/^[a-f0-9]{64}$/),expiresAt:new Date((s.b1 as {expiresAt:number}).expiresAt*1000)});
});
it('stale absent malformed and social callback material never bootstraps',async()=>{
 const begin=vi.fn();for(const s of [null,session(61),session(-10),{...session(),b1:{}},{...session(),user:{sub:'oauth2|synthetic'}}])await expect(completeTransportSession(s,'https://synthetic.invalid/',{begin})).rejects.toMatchObject({code:'AUTHENTICATION_REJECTED'});
 expect(begin).not.toHaveBeenCalled();
});
it('consumed/revoked callback failure is not reactivated; new login can recover',async()=>{
 const begin=vi.fn().mockRejectedValueOnce(new B1Error('AUTHENTICATION_REJECTED')).mockResolvedValueOnce({userId:'synthetic'});
 await expect(completeTransportSession(session(),'https://synthetic.invalid/',{begin})).rejects.toMatchObject({code:'AUTHENTICATION_REJECTED'});
 await completeTransportSession(session(),'https://synthetic.invalid/',{begin});expect(begin).toHaveBeenCalledTimes(2);
 expect(begin.mock.calls[0][0].digest===begin.mock.calls[1][0].digest).toBe(false);
});
it('mapping failure is propagated as unavailable and never retried',async()=>{
 const begin=vi.fn().mockRejectedValue(new B1Error('DEPENDENCY_UNAVAILABLE'));await expect(completeTransportSession(session(),'https://synthetic.invalid/',{begin})).rejects.toMatchObject({code:'DEPENDENCY_UNAVAILABLE'});expect(begin).toHaveBeenCalledOnce();
});
