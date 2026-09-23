import { expect,it,vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { requireCurrentSession } from "./session";
function session():SessionData {const issuedAt=Math.floor(Date.now()/1000);return {user:{sub:"auth0|synthetic"},tokenSet:{accessToken:"synthetic",expiresAt:issuedAt+3600},internal:{sid:"synthetic",createdAt:issuedAt},b1:{handle:randomBytes(32).toString("hex"),csrf:randomBytes(32).toString("hex"),issuedAt,expiresAt:issuedAt+3600}};}
it("cookie-only session never authorizes when registry missing or revoked",async()=>{
 const registry={currentActor:vi.fn().mockResolvedValue(null),revoke:vi.fn()};
 await expect(requireCurrentSession(session(),registry)).rejects.toMatchObject({code:"UNAUTHENTICATED"});expect(registry.currentActor).toHaveBeenCalledOnce();
});
it("missing/malformed/expired transport denies before DB",async()=>{
 const registry={currentActor:vi.fn(),revoke:vi.fn()},s=session();
 for(const value of [null,{...s,b1:{}},{...s,b1:{...(s.b1 as object),issuedAt:1,expiresAt:3601}}])await expect(requireCurrentSession(value,registry)).rejects.toMatchObject({code:"UNAUTHENTICATED"});
 expect(registry.currentActor).not.toHaveBeenCalled();
});
it("checks current registry on every request without cache",async()=>{
 const registry={currentActor:vi.fn().mockResolvedValueOnce({userId:'synthetic'}).mockResolvedValueOnce(null),revoke:vi.fn()},s=session();
 expect((await requireCurrentSession(s,registry)).actor.userId).toBe('synthetic');
 await expect(requireCurrentSession(s,registry)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 expect(registry.currentActor).toHaveBeenCalledTimes(2);
});
