import { expect,it } from "vitest";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { prepareTransportSession,authRequestStatus } from "./auth-transport";
function session(sub="auth0|synthetic"):SessionData{return {user:{sub},tokenSet:{accessToken:"synthetic",expiresAt:0},internal:{sid:"synthetic",createdAt:1}};}
it("rejects social callback before cookie save",()=>{expect(()=>prepareTransportSession(session("oauth2|synthetic"),"synthetic")).toThrow("AUTHENTICATION_REJECTED");});
it("fresh callback creates random immutable transport material, never business authority",()=>{
 const a=prepareTransportSession(session(),"synthetic"),b=prepareTransportSession(session(),"synthetic");
 expect(a.b1).toMatchObject({issuedAt:expect.any(Number),expiresAt:expect.any(Number),handle:expect.stringMatching(/^[a-f0-9]{64}$/),csrf:expect.stringMatching(/^[a-f0-9]{64}$/)});
 expect(a.b1).not.toEqual(b.b1);expect(prepareTransportSession(a,null).b1).toEqual(a.b1);
 expect(Object.keys(a)).not.toContain("role");
});
it("uninitialized update never creates callback material",()=>{expect(()=>prepareTransportSession(session(),null)).toThrow();});
it.each([['/auth/logout','GET','',405],['/auth/login','POST','',405],['/auth/login','GET','connection=google-oauth2',400],['/auth/login','GET','returnTo=/outside',400],['/auth/access-token','GET','',404],['/auth/profile','GET','',404]])("auth boundary %s %s denies",(p,m,q,status)=>{expect(authRequestStatus(p,m,new URLSearchParams(q))).toBe(status);});
it("accepts only SDK callback and fixed login",()=>{expect(authRequestStatus('/auth/login','GET',new URLSearchParams())).toBeNull();expect(authRequestStatus('/auth/callback','GET',new URLSearchParams('code=synthetic&state=synthetic'))).toBeNull();});
