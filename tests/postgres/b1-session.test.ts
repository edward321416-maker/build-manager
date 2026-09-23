import { afterAll,beforeAll,expect,it } from "vitest";
import { randomBytes,randomUUID } from "node:crypto";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createIdentityBootstrapPort,createSessionRegistryPort } from "@build-manager/persistence-postgres/b1";
import { createB1Fixture } from "./helpers/b1-fixture";
let f:Awaited<ReturnType<typeof createB1Fixture>>;
let loginDb:ReturnType<typeof createPostgresDatabase>,webDb:ReturnType<typeof createPostgresDatabase>;
let login:ReturnType<typeof createIdentityBootstrapPort>,web:ReturnType<typeof createSessionRegistryPort>;
beforeAll(async()=>{f=await createB1Fixture();loginDb=createPostgresDatabase(f.roles.b1.loginConfig);webDb=createPostgresDatabase(f.roles.b1.webConfig);login=createIdentityBootstrapPort(loginDb);web=createSessionRegistryPort(webDb);},120_000);
afterAll(async()=>{await loginDb?.close();await webDb?.close();await f?.close();});
async function begin(){const input={identity:{issuer:"https://issuer.invalid/",subject:"auth0|"+randomUUID()},digest:randomBytes(32).toString("hex"),expiresAt:new Date(Date.now()+3_590_000)};const actor=await login.begin(input);return {input,actor};}
it("R06 committed logout denies replay even within completion window",async()=>{
 const {input,actor}=await begin(); expect(await web.currentActor(input.digest)).toEqual(actor);
 await web.revoke(input.digest); expect(await web.currentActor(input.digest)).toBeNull();
 await web.revoke(input.digest); expect(await web.currentActor(input.digest)).toBeNull();
 await expect(login.begin(input).then(()=>undefined)).rejects.toMatchObject({code:"AUTHENTICATION_REJECTED"});
});
it("R06 absolute expiry denies old registry and completion replay",async()=>{
 const {input}=await begin();
 await f.migration.query("UPDATE authn.web_session SET created_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '1 hour' WHERE digest=$1",[Buffer.from(input.digest,"hex")]);
 expect(await web.currentActor(input.digest)).toBeNull();
 await expect(login.begin(input).then(()=>undefined)).rejects.toMatchObject({code:"AUTHENTICATION_REJECTED"});
});
it("R05 suspended User denies immediately and reactivation cannot revive an old session",async()=>{
 const {input,actor}=await begin();
 await f.migration.query("UPDATE app.app_user SET status='SUSPENDED' WHERE id=$1",[actor.userId]);
 expect(await web.currentActor(input.digest)).toBeNull();
 await f.migration.query("UPDATE app.app_user SET status='ACTIVE' WHERE id=$1",[actor.userId]);
 expect(await web.currentActor(input.digest)).toBeNull();
});
it("R05 identity disable and reactivation cannot revive an old session",async()=>{
 const {input,actor}=await begin();
 await f.migration.query("UPDATE authn.external_identity SET status='DISABLED' WHERE user_id=$1",[actor.userId]);
 expect(await web.currentActor(input.digest)).toBeNull();
 await f.migration.query("UPDATE authn.external_identity SET status='ACTIVE' WHERE user_id=$1",[actor.userId]);
 expect(await web.currentActor(input.digest)).toBeNull();
});
it("R06 missing and malformed registry proofs deny without insertion",async()=>{
 const before=(await f.migration.query("SELECT count(*)::int AS n FROM authn.web_session")).rows[0].n;
 for(const digest of ["", "bad", randomBytes(32).toString("hex")]) expect(await web.currentActor(digest)).toBeNull();
 expect((await f.migration.query("SELECT count(*)::int AS n FROM authn.web_session")).rows[0].n).toBe(before);
});
it('R06 odd-length hex cannot alias an existing digest',async()=>{
 const {input}=await begin();expect(await web.currentActor(input.digest+'f')).toBeNull();
 await expect(web.revoke(input.digest+'f')).rejects.toMatchObject({code:'INVALID_INPUT'});
 expect(await web.currentActor(input.digest)).not.toBeNull();
});
