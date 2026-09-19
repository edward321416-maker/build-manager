import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startPostgres18Container,
  type Postgres18Container,
} from "@build-manager/persistence-postgres/testing";

describe("PF02-A PostgreSQL foundation", { concurrent: false }, () => {
  let postgres: Postgres18Container | undefined;

  beforeAll(async () => {
    postgres = await startPostgres18Container();
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
});
