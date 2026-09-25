import { randomUUID } from "node:crypto";
import { Client, type QueryResult } from "pg";
import { vi } from "vitest";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import type { PostgresDatabase } from "@build-manager/persistence-postgres";
import { barrier, changeOrg, createB2Harness, seedB2Scope, type B2Harness, type B2Scope } from "./b2-fixture";

export type B3Harness = B2Harness & {
  registration: ReturnType<typeof createBuildingRegistrationPort>;
};

export async function createB3Harness(): Promise<B3Harness> {
  const h = await createB2Harness();
  return { ...h, registration: createBuildingRegistrationPort(h.webDb) };
}

export async function seedB3Scope(h: B3Harness): Promise<B2Scope> {
  return seedB2Scope(h);
}

export async function inOrg<T>(client: Client, orgId: string, operation: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.org_id',$1,true)", [orgId]);
    return await operation();
  } finally {
    await client.query("ROLLBACK");
  }
}

export async function seedInactiveOrg(
  h: B3Harness,
  userId: string,
  status: "PENDING" | "SUSPENDED" | "ARCHIVED",
): Promise<string> {
  const orgId = randomUUID();
  await changeOrg(
    h.migration,
    orgId,
    "INSERT INTO app.organization(id,status,display_name) VALUES($1,$2,'Synthetic inactive organization')",
    [orgId, status],
  );
  await changeOrg(
    h.migration,
    orgId,
    "INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",
    [randomUUID(), orgId, userId],
  );
  return orgId;
}

export const B3_POOLCLIENT_SPY_PROBE = "SELECT 1 /* B3_POOLCLIENT_SPY_PROBE */";

export type B3QueryGate = {
  reached: Promise<void>;
  arm(): void;
  release(): void;
  restore(): void;
  observations: {
    sentinelCount: number;
    statementCount: number;
    isolation?: string;
    applicationName?: string;
    backendPid?: number;
  };
};

export function gateB3Query(options: {
  sql: string;
  args?: readonly unknown[];
  applicationName?: string;
  timing?: "before" | "after";
  failure?: Error;
}): B3QueryGate {
  const latch = barrier();
  const observations: B3QueryGate["observations"] = { sentinelCount: 0, statementCount: 0 };
  const original = Client.prototype.query;
  let armed = false;
  const expectedSql = options.sql.replace(/\s+/g, " ").trim();
  const expectedArgs = options.args;
  const spy = vi.spyOn(Client.prototype, "query").mockImplementation(function (this: Client, ...args: unknown[]) {
    const forward = () => Reflect.apply(original, this, args);
    const sql = typeof args[0] === "string" ? args[0].replace(/\s+/g, " ").trim() : undefined;
    if (args[0] === B3_POOLCLIENT_SPY_PROBE) observations.sentinelCount += 1;
    const actualArgs = Array.isArray(args[1]) ? args[1] : undefined;
    const argsMatch = expectedArgs === undefined ||
      (actualArgs !== undefined && actualArgs.length === expectedArgs.length &&
        actualArgs.every((value, index) => value === expectedArgs[index]));
    if (!armed || sql !== expectedSql || !argsMatch || args.length > 2) return forward();

    return (async () => {
      const app = await Reflect.apply(original, this, ["SHOW application_name"]) as QueryResult;
      observations.applicationName = app.rows[0]?.application_name;
      if (options.applicationName !== undefined && observations.applicationName !== options.applicationName) {
        return forward();
      }
      if (++observations.statementCount !== 1) throw new Error("B3_EXTRA_GATED_STATEMENT");
      const isolation = await Reflect.apply(original, this, ["SHOW transaction_isolation"]) as QueryResult;
      observations.isolation = isolation.rows[0]?.transaction_isolation;
      const pid = await Reflect.apply(original, this, ["SELECT pg_backend_pid() AS pid"]) as QueryResult;
      observations.backendPid = pid.rows[0]?.pid;
      if ((options.timing ?? "before") === "before") {
        latch.arrive();
        await latch.released;
        if (options.failure) throw options.failure;
        return forward();
      }
      const result = await forward();
      latch.arrive();
      await latch.released;
      if (options.failure) throw options.failure;
      return result;
    })();
  } as typeof Client.prototype.query);

  return {
    reached: latch.reached,
    observations,
    arm() {
      if (observations.sentinelCount !== 1) throw new Error("B3_POOLCLIENT_SPY_NOT_OBSERVED");
      armed = true;
    },
    release: latch.release,
    restore() { latch.release(); spy.mockRestore(); },
  };
}

export async function assertB3PoolProbe(database: PostgresDatabase, run: (database: PostgresDatabase) => Promise<void>) {
  await run(database);
}
