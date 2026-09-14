import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanImportBoundaries } from "./import-boundaries";

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

  it("accepts the current repository import graph", async () => {
    expect(await scanImportBoundaries(process.cwd())).toEqual([]);
  });
});
