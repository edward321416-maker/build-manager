import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startPostgres18Container,
  type Postgres18Container,
} from "@build-manager/persistence-postgres/testing";

describe("PF02-A PostgreSQL foundation", { concurrent: false }, () => {
  let postgres: Postgres18Container | undefined;
  let diagnostics: unknown[][] = [];

  beforeAll(async () => {
    const info = vi.spyOn(console, "info");
    try {
      postgres = await startPostgres18Container();
    } finally {
      diagnostics = info.mock.calls.map((call) => [...call]);
      info.mockRestore();
    }
  }, 120_000);

  afterAll(async () => {
    await postgres?.stop();
  }, 60_000);

  it("runs the exact PostgreSQL 18.6 server", async () => {
    const result = await postgres!.admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );

    expect(result.rows[0]?.server_version_num).toBe("180006");
  });

  it("records the actual human-readable server version for diagnostics", async () => {
    const result = await postgres!.admin.query<{ server_version: string }>(
      "SHOW server_version",
    );

    expect(diagnostics).toContainEqual([
      "PostgreSQL server_version:",
      result.rows[0]?.server_version,
    ]);
  });
});
