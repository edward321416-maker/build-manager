import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  scanImportBoundaries,
  scanPackageDependencies,
  scanRouteRuntimes,
} from "./import-boundaries";

const temporaryRoots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "build-manager-import-guard-"));
  temporaryRoots.push(root);
  return root;
}

async function source(root: string, path: string, contents: string): Promise<void> {
  const absolutePath = join(root, ...path.split("/"));
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("architecture import boundaries", () => {
  it("finds package subpaths and relative server-core bypasses in client source", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/mobile/src/screen.tsx",
      [
        'import { Ticket } from "@build-manager/domain/ticket";',
        'export { createTicket } from "@build-manager/application/use-cases";',
        'const fixtures = import("@build-manager/fixtures/demo");',
      ].join("\n"),
    );
    await source(
      root,
      "apps/web/src/components/ticket-card.tsx",
      'import type { Ticket } from "../../../../../packages/domain/src";',
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "apps/mobile/src/screen.tsx",
        specifier: "@build-manager/application/use-cases",
        rule: "client-server-core",
      },
      {
        file: "apps/mobile/src/screen.tsx",
        specifier: "@build-manager/domain/ticket",
        rule: "client-server-core",
      },
      {
        file: "apps/mobile/src/screen.tsx",
        specifier: "@build-manager/fixtures/demo",
        rule: "client-server-core",
      },
      {
        file: "apps/web/src/components/ticket-card.tsx",
        specifier: "../../../../../packages/domain/src",
        rule: "client-server-core",
      },
    ]);
  });

  it("allows server imports and ignores comments and ordinary string literals", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/server/container.ts",
      'import { Ticket } from "@build-manager/domain";',
    );
    await source(
      root,
      "apps/web/src/app/api/v1/tickets/route.ts",
      'import { createTicket } from "@build-manager/application";',
    );
    await source(
      root,
      "apps/web/src/components/help.tsx",
      [
        '// import { Ticket } from "@build-manager/domain";',
        'const example = "require(\\\"@build-manager/fixtures\\\")";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([]);
  });

  it("finds framework, native, HTTP, environment, and persistence imports in core", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "packages/domain/src/ticket.ts",
      [
        'import React from "react";',
        'import { sql } from "drizzle-orm/sql";',
        'const native = require("react-native");',
      ].join("\n"),
    );
    await source(
      root,
      "packages/application/src/create-ticket.ts",
      [
        'import "next/server";',
        'import { request } from "node:http";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "packages/application/src/create-ticket.ts",
        specifier: "next/server",
        rule: "server-core-purity",
      },
      {
        file: "packages/application/src/create-ticket.ts",
        specifier: "node:http",
        rule: "server-core-purity",
      },
      {
        file: "packages/domain/src/ticket.ts",
        specifier: "drizzle-orm/sql",
        rule: "server-core-purity",
      },
      {
        file: "packages/domain/src/ticket.ts",
        specifier: "react",
        rule: "server-core-purity",
      },
      {
        file: "packages/domain/src/ticket.ts",
        specifier: "react-native",
        rule: "server-core-purity",
      },
    ]);
  });

  it("forbids the server core from importing the synthetic fixtures package", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "packages/application/src/use-cases/seed.ts",
      'import { demoBuildings } from "@build-manager/fixtures";',
    );
    await source(
      root,
      "packages/domain/src/building/seed.ts",
      'export { demoBuildings } from "@build-manager/fixtures";',
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "packages/application/src/use-cases/seed.ts",
        specifier: "@build-manager/fixtures",
        rule: "server-core-purity",
      },
      {
        file: "packages/domain/src/building/seed.ts",
        specifier: "@build-manager/fixtures",
        rule: "server-core-purity",
      },
    ]);
  });

  it("accepts the current repository import graph", async () => {
    expect(await scanImportBoundaries(process.cwd())).toEqual([]);
  });
});

describe("api-client source purity", () => {
  it("finds server-core and platform imports in api-client source", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "packages/api-client/src/client.ts",
      [
        'import { Ticket } from "@build-manager/domain";',
        'import { createTicket } from "@build-manager/application";',
        'import { demoBuildings } from "@build-manager/fixtures";',
        'import React from "react";',
        'import { Platform } from "react-native";',
        'import { NextRequest } from "next/server";',
        'import { Stack } from "expo-router";',
        'import { sql } from "drizzle-orm";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual(
      [
        "@build-manager/application",
        "@build-manager/domain",
        "@build-manager/fixtures",
        "drizzle-orm",
        "expo-router",
        "next/server",
        "react",
        "react-native",
      ].map((specifier) => ({
        file: "packages/api-client/src/client.ts",
        specifier,
        rule: "api-client-purity",
      })),
    );
  });

  it("finds a relative bypass into the server core from api-client source", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "packages/api-client/src/client.ts",
      'import type { Ticket } from "../../../packages/domain/src";',
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "packages/api-client/src/client.ts",
        specifier: "../../../packages/domain/src",
        rule: "api-client-purity",
      },
    ]);
  });

  it("allows api-client to import the public contracts package", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "packages/api-client/src/client.ts",
      [
        'import { BuildingPassportDtoSchema } from "@build-manager/api-contracts";',
        'import { buildUrl } from "./http";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([]);
  });
});

describe("package runtime dependency allowlist", () => {
  async function manifest(
    root: string,
    path: string,
    contents: unknown,
  ): Promise<void> {
    await source(root, path, JSON.stringify(contents, null, 2));
  }

  it("flags every runtime dependency outside the allowlist", async () => {
    const root = await fixtureRoot();
    await manifest(root, "packages/api-client/package.json", {
      name: "@build-manager/api-client",
      dependencies: {
        "@build-manager/api-contracts": "0.0.0",
        "@build-manager/domain": "0.0.0",
        zod: "4.6.5",
      },
    });

    expect(await scanPackageDependencies(root)).toEqual([
      {
        package: "packages/api-client",
        dependency: "@build-manager/domain",
        rule: "dependency-allowlist",
      },
      {
        package: "packages/api-client",
        dependency: "zod",
        rule: "dependency-allowlist",
      },
    ]);
  });

  it("accepts the approved runtime dependency alone", async () => {
    const root = await fixtureRoot();
    await manifest(root, "packages/api-client/package.json", {
      name: "@build-manager/api-client",
      dependencies: { "@build-manager/api-contracts": "0.0.0" },
    });

    expect(await scanPackageDependencies(root)).toEqual([]);
  });

  it("ignores dev dependencies and a manifest with no dependencies", async () => {
    const root = await fixtureRoot();
    await manifest(root, "packages/api-client/package.json", {
      name: "@build-manager/api-client",
      devDependencies: { vitest: "5.0.0", typescript: "6.0.3" },
    });

    expect(await scanPackageDependencies(root)).toEqual([]);
  });

  it("accepts the current repository manifests", async () => {
    expect(await scanPackageDependencies(process.cwd())).toEqual([]);
  });
});

describe("server persistence driver isolation", () => {
  it("finds the sqlite driver anywhere outside the web server tree", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "packages/api-contracts/src/building.ts",
      'import { DatabaseSync } from "node:sqlite";',
    );
    await source(
      root,
      "packages/api-client/src/client.ts",
      'import { DatabaseSync } from "node:sqlite";',
    );
    await source(
      root,
      "apps/mobile/src/app/index.tsx",
      'import { DatabaseSync } from "node:sqlite";',
    );
    await source(
      root,
      "apps/web/src/components/ticket-card.tsx",
      'import { DatabaseSync } from "node:sqlite";',
    );

    expect(await scanImportBoundaries(root)).toEqual(
      [
        "apps/mobile/src/app/index.tsx",
        "apps/web/src/components/ticket-card.tsx",
        "packages/api-client/src/client.ts",
        "packages/api-contracts/src/building.ts",
      ].map((file) => ({
        file,
        specifier: "node:sqlite",
        rule: "server-driver-isolation",
      })),
    );
  });

  it("finds a browser-facing reach into the server persistence tree", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/components/ticket-card.tsx",
      'import { openSqliteDatabase } from "../server/persistence/database";',
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "apps/web/src/components/ticket-card.tsx",
        specifier: "../server/persistence/database",
        rule: "server-driver-isolation",
      },
    ]);
  });

  it("allows the sqlite driver inside the web server tree", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/server/persistence/database.ts",
      'import { DatabaseSync } from "node:sqlite";',
    );
    await source(
      root,
      "apps/web/src/server/container.ts",
      [
        'import { openSqliteDatabase } from "./persistence/database";',
        'import { demoBuildings } from "@build-manager/fixtures";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([]);
  });
});

describe("api route runtime configuration", () => {
  it("rejects an Edge runtime API route", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/app/api/v1/tickets/route.ts",
      [
        'export const runtime = "edge";',
        'export const dynamic = "force-dynamic";',
        "export function GET() { return new Response(); }",
      ].join("\n"),
    );

    expect(await scanRouteRuntimes(root)).toEqual([
      {
        file: "apps/web/src/app/api/v1/tickets/route.ts",
        rule: "edge-runtime-forbidden",
      },
    ]);
  });

  it("requires an explicit node runtime and dynamic rendering", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/app/api/v1/tickets/route.ts",
      "export function GET() { return new Response(); }",
    );

    expect(await scanRouteRuntimes(root)).toEqual([
      {
        file: "apps/web/src/app/api/v1/tickets/route.ts",
        rule: "missing-dynamic",
      },
      {
        file: "apps/web/src/app/api/v1/tickets/route.ts",
        rule: "missing-node-runtime",
      },
    ]);
  });

  it("accepts a correctly configured API route", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/app/api/v1/tickets/route.ts",
      [
        'export const runtime = "nodejs";',
        'export const dynamic = "force-dynamic";',
        "export function GET() { return new Response(); }",
      ].join("\n"),
    );

    expect(await scanRouteRuntimes(root)).toEqual([]);
  });

  it("accepts every API route in the current repository", async () => {
    expect(await scanRouteRuntimes(process.cwd())).toEqual([]);
  });
});

describe("api routes stay out of persistence", () => {
  it("rejects a route that reaches for the sqlite driver or a repository", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/app/api/v1/tickets/route.ts",
      [
        'import { DatabaseSync } from "node:sqlite";',
        'import { createSqliteTicketRepository } from "@/server/persistence/repositories";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "apps/web/src/app/api/v1/tickets/route.ts",
        specifier: "@/server/persistence/repositories",
        rule: "server-driver-isolation",
      },
      {
        file: "apps/web/src/app/api/v1/tickets/route.ts",
        specifier: "node:sqlite",
        rule: "server-driver-isolation",
      },
    ]);
  });

  it("allows a route to use the server http helpers", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/app/api/v1/tickets/route.ts",
      [
        'import { handleListTickets } from "@/server/http/handlers/tickets";',
        'import { withRequestContainer } from "@/server/http/request-container";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([]);
  });
});

describe("browser UI stays out of the server tree", () => {
  it("rejects browser-facing web code importing the server tree", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/components/landlord/views.tsx",
      'import { createSqliteServerContainer } from "@/server/container";',
    );
    await source(
      root,
      "apps/web/src/app/demo/landlord/page.tsx",
      'import { resolveDemoDatabasePath } from "../../../server/runtime/demo-database-path";',
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "apps/web/src/app/demo/landlord/page.tsx",
        specifier: "../../../server/runtime/demo-database-path",
        rule: "server-driver-isolation",
      },
      {
        file: "apps/web/src/components/landlord/views.tsx",
        specifier: "@/server/container",
        rule: "server-driver-isolation",
      },
    ]);
  });

  it("rejects browser-facing web code importing the core packages", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/components/landlord/views.tsx",
      [
        'import { selectProtocol } from "@build-manager/domain";',
        'import { demoBuildings } from "@build-manager/fixtures";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([
      {
        file: "apps/web/src/components/landlord/views.tsx",
        specifier: "@build-manager/domain",
        rule: "client-server-core",
      },
      {
        file: "apps/web/src/components/landlord/views.tsx",
        specifier: "@build-manager/fixtures",
        rule: "client-server-core",
      },
    ]);
  });

  it("allows browser UI to use the public client and contracts", async () => {
    const root = await fixtureRoot();
    await source(
      root,
      "apps/web/src/components/landlord/views.tsx",
      [
        'import { createApiClient } from "@build-manager/api-client";',
        'import type { BuildingPassportDto } from "@build-manager/api-contracts";',
        'import Link from "next/link";',
        'import { contextRows } from "./logic";',
      ].join("\n"),
    );

    expect(await scanImportBoundaries(root)).toEqual([]);
  });
});
