import { expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { requireCoreB1Session } from "./b1-access";
const base="http://localhost:3133",now=Math.floor(Date.now()/1000);
const session={user:{sub:"auth0|synthetic"},tokenSet:{accessToken:"unused",expiresAt:now+3600},internal:{sid:"synthetic",createdAt:now},b1:{handle:"a".repeat(64),csrf:"b".repeat(64),issuedAt:now,expiresAt:now+3600}};
const setup=(value:typeof session|null=session)=>({readSession:vi.fn().mockResolvedValue(value),sessions:{currentActor:vi.fn().mockResolvedValue("actor"),revoke:vi.fn()},appBaseUrl:base});
it("consumes B1 registered session rather than developer cookie/bearer",async()=>{
 const d=setup();const current=await requireCoreB1Session(new NextRequest(base,{headers:{authorization:`Bearer ${"c".repeat(64)}`,cookie:`rc1_session=${"d".repeat(64)}`}}),d);
 expect(current.actor).toBe("actor");expect(d.sessions.currentActor).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
 await expect(requireCoreB1Session(new NextRequest(base,{headers:{authorization:`Bearer ${"c".repeat(64)}`}}),setup(null))).rejects.toMatchObject({code:"UNAUTHENTICATED"});
});
it("requires exact Origin and session CSRF for every mutation including binary requests",async()=>{
 for(const headers of ([{},{origin:base},{origin:"https://foreign.invalid","x-b1-csrf":session.b1.csrf}] as Record<string,string>[]))await expect(requireCoreB1Session(new NextRequest(base,{method:"POST",headers}),setup())).rejects.toMatchObject({code:"FORBIDDEN"});
 await expect(requireCoreB1Session(new NextRequest(base,{method:"POST",headers:{origin:base,"x-b1-csrf":session.b1.csrf}}),setup())).resolves.toMatchObject({actor:"actor"});
});
it("rejects expired and revoked sessions without fallback",async()=>{
 const expired=structuredClone(session);expired.b1.issuedAt=now-3601;expired.b1.expiresAt=now-1;
 await expect(requireCoreB1Session(new NextRequest(base),setup(expired))).rejects.toMatchObject({code:"UNAUTHENTICATED"});
 const d=setup();d.sessions.currentActor.mockResolvedValue(null);await expect(requireCoreB1Session(new NextRequest(base),d)).rejects.toMatchObject({code:"UNAUTHENTICATED"});
});
it("does not consume or lock the command/photo body while reading SDK cookies",async()=>{
 const request=new NextRequest(base,{method:"POST",headers:{origin:base,"x-b1-csrf":session.b1.csrf},body:"photo-or-json"});
 await requireCoreB1Session(request,setup());expect(request.bodyUsed).toBe(false);expect(request.body?.locked).toBe(false);expect(await request.text()).toBe("photo-or-json");
});
