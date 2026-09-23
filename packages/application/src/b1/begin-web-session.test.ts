import { expect,it } from "vitest";
import { beginWebSession } from "./begin-web-session";
it("rejects malformed identity and digest before any bootstrap write",async()=>{
 let writes=0;
 const port={async begin(){writes++;return {userId:"synthetic"};}};
 const valid={identity:{issuer:"https://issuer.invalid/",subject:"auth0|synthetic"},digest:"a".repeat(64),expiresAt:new Date("2030-01-01T00:00:00Z")};
 for(const input of [{...valid,digest:"bad"},{...valid,identity:{...valid.identity,subject:""}},{...valid,expiresAt:new Date("bad")}]) await expect(beginWebSession(port,input)).rejects.toMatchObject({code:"INVALID_INPUT"});
 expect(writes).toBe(0);
});
