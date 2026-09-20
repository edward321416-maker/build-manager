// Native Node worker: keep fatal idle-pool errors outside the Vitest process.
// Resolve only this package's extensionless source imports for Node type stripping.
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import type { ClientConfig } from "pg";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") && context.parentURL?.includes("/packages/persistence-postgres/src/")) {
      return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

const { createPostgresDatabase, withTransaction, withOrgTransaction } =
  await import("@build-manager/persistence-postgres");

process.once("message", async (input: { config: ClientConfig; orgA: string; orgB: string }) => {
  const database = createPostgresDatabase({ ...input.config, max: 1 });
  const originalError = console.error;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    let observed!: () => void;
    const diagnostic = new Promise<void>((resolve, reject) => {
      observed = resolve;
      timer = setTimeout(() => reject(new Error("Idle diagnostic deadline exceeded")), 8_000);
    });
    // Observe the production diagnostic, never install a Pool error listener.
    console.error = (...args: unknown[]) => {
      const safe = args.length === 2 && args[0] === "postgres.pool.idle_error"
        && args[1] === "57P01";
      process.send?.({ type: "diagnostic", safe });
      observed();
    };
    const first = await withOrgTransaction(database, input.orgA, async (client) => {
      const result = await client.query("SELECT pg_backend_pid() AS pid, app.current_org_id() AS org");
      assert.equal(result.rows[0].org, input.orgA);
      return result.rows[0].pid as number;
    });
    process.send?.({ type: "idle", pid: first });
    await diagnostic;
    clearTimeout(timer);
    const plain = await withTransaction(database, async (client) => {
      const context = await client.query("SELECT pg_backend_pid() AS pid, app.current_org_id() AS org");
      const visible = await client.query("SELECT id FROM app.organization");
      return { ...context.rows[0], visible: visible.rows.length };
    });
    const scoped = await withOrgTransaction(database, input.orgB, async (client) => {
      const context = await client.query("SELECT pg_backend_pid() AS pid, app.current_org_id() AS org");
      const visible = await client.query("SELECT id FROM app.organization");
      return { ...context.rows[0], rows: visible.rows };
    });
    process.send?.({ type: "recovered", plain, scoped });
    await database.close();
    await database.close();
    process.send?.({ type: "closed" });
  } catch {
    // Never forward config, raw pg Error, or driver-attached client properties.
    process.send?.({ type: "worker_failure" });
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    console.error = originalError;
    try { await database.close(); } catch { process.exitCode = 1; }
    process.disconnect?.();
  }
});
