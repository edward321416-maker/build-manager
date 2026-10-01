import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ClientConfig, PoolClient } from "pg";

// Actual graph: B5 -> application index -> domain index. No other source roots.
const roots = ["persistence-postgres","application","domain"].map(name => new URL(`../../../packages/${name}/src/`,import.meta.url).href);
// These two existing TS basenames contain a version suffix, not a JS extension.
const versionedDomainSources = ["heating.v1","leak.v1"].map(name => new URL(`../../../packages/domain/src/protocol/${name}`,import.meta.url).href);
registerHooks({ resolve(specifier,context,nextResolve) {
  if (/^\.\.?\//.test(specifier) && context.parentURL && roots.some(root => context.parentURL!.startsWith(root))) {
    const target = new URL(specifier,context.parentURL);
    if ((!extname(specifier) || versionedDomainSources.includes(target.href)) && roots.some(root => target.href.startsWith(root))) {
      for (const suffix of [".ts","/index.ts"]) {
        const candidate = new URL(target.href+suffix);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href,context);
      }
    }
  }
  return nextResolve(specifier,context);
} });

const { createOrganizationMembershipTerminationPort } = await import("@build-manager/persistence-postgres/b5");
process.send?.({ type: "module-loaded",version: process.version,execArgv: process.execArgv,roots: ["persistence-postgres","application","domain"] });
if (process.argv.includes("load-only")) {
  process.disconnect?.();
} else {
  const { createPostgresDatabase, getInternalPool } = await import(new URL("../../../packages/persistence-postgres/src/database.ts",import.meta.url).href) as typeof import("../../../packages/persistence-postgres/src/database");
  process.once("message",async (input: { config: ClientConfig; digest: string; org: string; target: string; mode: "active" | "idle" }) => {
    const db = createPostgresDatabase({ ...input.config,max: 1 });
    const pool = getInternalPool(db), originalConnect = pool.connect.bind(pool), originalError = console.error;
    let releases = 0, destroyed = 0, commits = 0, rollbacks = 0, commands = 0, pid = 0;
    const codes: string[] = [];
    let observedClient: PoolClient | undefined;
    let originalQuery: PoolClient["query"] | undefined;
    let observer: ((error: unknown) => void) | undefined;
    const safeCode = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "25P04" ? "25P04" : "OTHER";
    try {
      console.error = (...args: unknown[]) => {
        const safe = args.length === 2 && args[0] === "postgres.pool.idle_error" && typeof args[1] === "string" && /^(?:[0-9A-Z]{5}|UNKNOWN)$/.test(args[1]);
        process.send?.({ type: "diagnostic",safe });
        if (!safe) process.exitCode = 1;
      };
      // Observe a single actual checkout. No Pool error listener or exception handler.
      pool.connect = (async () => {
        const client = await originalConnect(); observedClient = client; originalQuery = client.query;
        const query = client.query.bind(client), release = client.release.bind(client);
        pid = Number((await query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        let terminated!: () => void;
        const ended = new Promise<void>(resolve => { terminated = resolve; });
        observer = error => { codes.push(safeCode(error)); terminated(); };
        client.on("error",observer);
        client.release = (destroy?: boolean | Error) => { releases++; if (destroy) destroyed++; release(destroy); };
        client.query = (async (...args: unknown[]) => {
          if (args[0] === "COMMIT") commits++;
          if (args[0] === "ROLLBACK") rollbacks++;
          if (typeof args[0] !== "string" || !args[0].includes("authn.b5_end_organization_membership")) return Reflect.apply(query,client,args);
          commands++;
          const result = await Reflect.apply(query,client,args);
          if (input.mode === "idle") {
            process.send?.({ type: "phase",mode: "idle",pid });
            let timer: ReturnType<typeof setTimeout> | undefined;
            try { await Promise.race([ended,new Promise((_,reject) => { timer=setTimeout(()=>reject(new Error("B5_PHASE_DEADLINE")),10_000); })]); }
            finally { clearTimeout(timer); }
          } else {
            await query("SELECT pg_sleep(4)");
            process.send?.({ type: "phase",mode: "active",pid });
            try { await query("SELECT pg_sleep(4)"); }
            catch (error) { codes.push(safeCode(error)); throw error; }
          }
          return result;
        }) as PoolClient["query"];
        return client;
      }) as typeof pool.connect;
      let failure: unknown;
      try { await createOrganizationMembershipTerminationPort(db).endCurrent(input.digest,input.org,input.target); }
      catch (error) { failure=error; }
      pool.connect = originalConnect;
      assert.equal((failure as { code?: string })?.code,"DEPENDENCY_UNAVAILABLE");
      assert.equal((failure as Error)?.message,"DEPENDENCY_UNAVAILABLE");
      assert.equal(releases,1); assert.equal(destroyed,1); assert.equal(commits,0); assert.equal(rollbacks,0); assert.equal(commands,1);
      assert.ok(codes.includes("25P04"));
      const replacement = await pool.connect();
      let replacementPid: number;
      try {
        await replacement.query("BEGIN");
        replacementPid=Number((await replacement.query("SELECT pg_backend_pid() AS pid,1 AS healthy")).rows[0].pid);
        await replacement.query("COMMIT"); assert.notEqual(replacementPid,pid);
      } finally { replacement.release(); }
      process.send?.({ type: "recovered",mode: input.mode,pid,replacementPid,codes,releases,destroyed,commits,rollbacks,commands,result: "DEPENDENCY_UNAVAILABLE" });
    } catch { process.send?.({ type: "worker_failure" }); process.exitCode=1; }
    finally {
      pool.connect=originalConnect;
      if (observedClient && originalQuery) observedClient.query=originalQuery;
      if (observedClient && observer) observedClient.removeListener("error",observer);
      console.error=originalError;
      try { await db.close(); } catch { process.exitCode=1; }
      process.disconnect?.();
    }
  });
}
