import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { Client } from "pg";

export const privateRoot = join(homedir(), ".build-manager-rc1-private");
export const accessCodes = async () => JSON.parse(await readFile(join(privateRoot, "access-codes.json"), "utf8")) as Record<string, string>;

/** A development session of its own for a fixture account. A test that signs out, or files that change what the account
 * sees, then leave the shared access code alive for the files after them (as maintenance-fact.spec.ts does). */
export async function mintOwnSession(who = "tenant"): Promise<string> {
  const state = JSON.parse(await readFile(join(privateRoot, "state.json"), "utf8")); expect(state.admin.host).toBe("127.0.0.1"); expect(state.admin.database).toBe("core_flow_synthetic");
  const admin = new Client(state.admin), login = new Client(state.roles.b1.loginConfig); await admin.connect(); await login.connect();
  try {
    expect((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
    const account = state.fixture.accounts[who], identity = (await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'", [account.userId])).rows[0];
    expect(identity.issuer).toBe("https://rc1.synthetic.invalid/");
    const handle = randomBytes(32).toString("hex"), digest = createHash("sha256").update(handle).digest();
    await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes')", [identity.issuer, identity.subject, digest]);
    await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)", [digest, account.orgId]);
    return handle;
  } finally { await login.end(); await admin.end(); }
}
