import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Client, type ClientConfig } from "pg";

export type Postgres18Container = {
  readonly container: StartedPostgreSqlContainer;
  readonly admin: Client;
  readonly adminConfig: ClientConfig;
  readonly database: string;
  stop(): Promise<void>;
};

export async function startPostgres18Container(): Promise<Postgres18Container> {
  const container = await new PostgreSqlContainer("postgres:18.6")
    .withPassword(randomUUID())
    .start();
  const adminConfig: ClientConfig = {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
  };
  adminConfig.password = container.getPassword();
  const admin = new Client(adminConfig);

  async function cleanup(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await admin.end();
    } catch (error) {
      errors.push(error);
    }
    try {
      await container.stop();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "PostgreSQL container cleanup failed");
    }
  }

  try {
    await admin.connect();
    const version = await admin.query<{ server_version: string }>(
      "SHOW server_version",
    );
    console.info("PostgreSQL server_version:", version.rows[0]?.server_version);
    const result = await admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    if (result.rows[0]?.server_version_num !== "180006") {
      throw new Error(
        `Expected PostgreSQL server_version_num 180006, got ${result.rows[0]?.server_version_num ?? "missing"}`,
      );
    }
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "PostgreSQL startup and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }

  let stopping: Promise<void> | undefined;
  return {
    container,
    admin,
    adminConfig,
    database: container.getDatabase(),
    stop() {
      return (stopping ??= cleanup());
    },
  };
}
