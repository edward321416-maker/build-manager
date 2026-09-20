import { readdirSync, readFileSync } from "node:fs";
import { matchesGlob, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import postgresConfig from "../../vitest.postgres.config";

// Load the actual Shared entrypoint at runtime: its existing .ts re-export is
// valid in Vitest, but not in the tests' no-TS-extension typecheck configuration.
const sharedConfigPath = "../../vitest.shared.config.ts";
const { default: sharedConfig } = await import(sharedConfigPath) as { default: typeof postgresConfig };

type Sources = Map<string, string>;
type Finding = { file: string; specifier: string };

function importSpecifiers(file: string, source: string): string[] {
  const imports = new Set<string>();
  function visit(node: ts.Node): void {
    let specifier: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (ts.isCallExpression(node) && (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require")
    )) {
      specifier = node.arguments[0];
    } else if (ts.isExternalModuleReference(node)) {
      specifier = node.expression;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
    }
    if (specifier && ts.isStringLiteralLike(specifier)) imports.add(specifier.text);
    ts.forEachChild(node, visit);
  }
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true));
  return [...imports];
}

// Resolve only the repository's relative and workspace source conventions.
function sourcePath(file: string, specifier: string): string {
  if (specifier.startsWith(".")) return posix.normalize(posix.join(posix.dirname(file), specifier));
  const workspace = /^@build-manager\/([^/]+)(?:\/(.*))?$/.exec(specifier);
  if (workspace) return `packages/${workspace[1]}/src/${workspace[2] ?? "index"}`;
  if (specifier.startsWith("@/")) return `apps/web/src/${specifier.slice(2)}`;
  return specifier;
}

function boundaryViolations(sources: Sources, sharedTests: string[]): Finding[] {
  const imports = new Map([...sources].map(([file, source]) => [file, importSpecifiers(file, source)]));
  const findings = new Map<string, Finding>();
  const add = (file: string, specifier: string) => findings.set(`${file}:${specifier}`, { file, specifier });
  const docker = (specifier: string, target: string) =>
    /^(?:@testcontainers\/|testcontainers(?:\/|$))/.test(specifier) ||
    /^packages\/persistence-postgres\/src\/testing(?:\/|\.|$)/.test(target) ||
    target.startsWith("tests/postgres/");

  for (const [file, specifiers] of imports) {
    for (const specifier of specifiers) {
      const target = sourcePath(file, specifier);
      if (file.startsWith("packages/persistence-postgres/") && (
        specifier === "node:sqlite" ||
        /^packages\/fixtures(?:\/|$)/.test(target) ||
        /^apps\/web\/src\/server\/persistence(?:\/|$)/.test(target)
      )) add(file, specifier);
      if (/^packages\/(?:domain|application)\//.test(file) && (
        /^(?:pg(?:\/|$)|@types\/pg(?:\/|$)|node-pg-migrate(?:\/|$))/.test(specifier) ||
        target.startsWith("packages/persistence-postgres/") || docker(specifier, target)
      )) add(file, specifier);
    }
  }

  // Inspect import edges without evaluating a helper or starting a container.
  const visited = new Set<string>();
  function visit(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);
    for (const specifier of imports.get(file) ?? []) {
      const target = sourcePath(file, specifier);
      if (docker(specifier, target)) add(file, specifier);
      const stem = target.replace(/\.[cm]?jsx?$/, "");
      const resolved = [target, `${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`, `${stem}/index.tsx`]
        .find((candidate) => sources.has(candidate));
      if (resolved) visit(resolved);
    }
  }
  for (const file of new Set([
    ...sharedTests,
    ...[...sources.keys()].filter((path) => matchesGlob(path, "packages/**/*.test.ts")),
  ])) visit(file);
  return [...findings.values()];
}

function sourceFiles(root: string): Sources {
  const sources: Sources = new Map();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [file, source] of sourceFiles(path)) sources.set(file, source);
    } else if (/\.[cm]?tsx?$/.test(path)) {
      sources.set(path, readFileSync(path, "utf8"));
    }
  }
  return sources;
}

function discovered(file: string, include: string[], exclude: string[] = []): boolean {
  return include.some((pattern) => matchesGlob(file, pattern)) &&
    !exclude.some((pattern) => matchesGlob(file, pattern));
}

describe("PostgreSQL boundary guard negative controls", () => {
  it.each([
    ["packages/persistence-postgres/src/adapter.ts", 'import "node:sqlite";', "node:sqlite"],
    ["packages/persistence-postgres/src/adapter.ts", 'export * from "@build-manager/fixtures/demo";', "@build-manager/fixtures/demo"],
    ["packages/persistence-postgres/src/adapter.ts", 'const demo = import("../../fixtures/src/index");', "../../fixtures/src/index"],
    ["packages/persistence-postgres/src/adapter.ts", 'const demo = require("../../../apps/web/src/server/persistence/database");', "../../../apps/web/src/server/persistence/database"],
    ["packages/persistence-postgres/src/adapter.ts", 'import "@/server/persistence/database";', "@/server/persistence/database"],
    ["packages/domain/src/model.ts", 'import type { Pool } from "pg";', "pg"],
    ["packages/application/src/port.ts", 'export type { Pool } from "pg/lib/index";', "pg/lib/index"],
    ["packages/application/src/port.ts", 'type Pool = import("pg").Pool;', "pg"],
    ["packages/domain/src/model.ts", 'import driver = require("pg");', "pg"],
    ["packages/application/src/port.ts", 'import "@build-manager/persistence-postgres";', "@build-manager/persistence-postgres"],
    ["packages/domain/src/model.ts", 'import "../../persistence-postgres/src/index";', "../../persistence-postgres/src/index"],
    ["packages/application/src/port.ts", 'import "node-pg-migrate";', "node-pg-migrate"],
    ["packages/persistence-postgres/src/container.test.ts", 'import "@testcontainers/postgresql";', "@testcontainers/postgresql"],
    ["packages/domain/src/container.test.ts", 'const container = import("testcontainers");', "testcontainers"],
    ["packages/api-contracts/src/container.test.ts", 'import "@build-manager/persistence-postgres/testing";', "@build-manager/persistence-postgres/testing"],
    ["tests/architecture/container.test.ts", 'import "../../packages/persistence-postgres/src/testing";', "../../packages/persistence-postgres/src/testing"],
  ])("rejects forbidden edge from %s: %s", (file, source, specifier) => {
    const sharedTests = file.startsWith("tests/") ? [file] : [];
    expect(boundaryViolations(new Map([[file, source]]), sharedTests)).toEqual([
      { file, specifier },
    ]);
  });

  it("rejects a Docker dependency reached through local helpers and re-exports", () => {
    const sources = new Map([
      ["packages/api-contracts/src/model.test.ts", 'import "./helper.js";'],
      ["packages/api-contracts/src/helper.ts", 'export * from "./cycle";'],
      ["packages/api-contracts/src/cycle.ts", 'import "./helper"; export * from "@testcontainers/postgresql";'],
    ]);
    expect(boundaryViolations(sources, [])).toEqual([
      { file: "packages/api-contracts/src/cycle.ts", specifier: "@testcontainers/postgresql" },
    ]);
  });

  it("ignores comments, ordinary strings and allowed production dependencies", () => {
    const sources = new Map([
      ["packages/persistence-postgres/src/adapter.ts", [
        '// import "node:sqlite";',
        '/* export * from "@build-manager/fixtures"; */',
        'const example = \'import("@build-manager/fixtures")\';',
        'import { Pool } from "pg";',
        'import type { Port } from "@build-manager/application";',
      ].join("\n")],
      ["packages/application/src/port.ts", 'import type { Model } from "@build-manager/domain";'],
      ["packages/api-contracts/src/model.test.ts", 'const example = \'import("testcontainers")\';'],
      ["tests/postgres/foundation.test.ts", 'import "@build-manager/persistence-postgres/testing";'],
    ]);
    expect(boundaryViolations(sources, [])).toEqual([]);
  });
});

describe("PostgreSQL production persistence boundary", () => {
  const sources = new Map([...sourceFiles("packages"), ...sourceFiles("tests")]);
  const sharedInclude = sharedConfig.test?.include ?? [];
  const sharedExclude = sharedConfig.test?.exclude ?? [];
  const sharedTests = [...sources.keys()].filter((file) => discovered(file, sharedInclude, sharedExclude));

  it("keeps actual Shared discovery separate from PostgreSQL integration tests", () => {
    expect(sharedInclude).toEqual(["packages/**/*.test.ts", "tests/architecture/**/*.test.ts"]);
    expect(postgresConfig.test?.include).toEqual(["tests/postgres/**/*.test.ts"]);
    expect(postgresConfig.test?.passWithNoTests).toBe(false);
    expect(sharedTests).toContain("tests/architecture/postgres-boundary.test.ts");
    expect(sharedTests.some((file) => file.startsWith("packages/"))).toBe(true);
    const postgresTests = [...sources.keys()].filter((file) => discovered(
      file, postgresConfig.test?.include ?? [], postgresConfig.test?.exclude ?? [],
    ));
    expect(postgresTests.length).toBeGreaterThan(0);
    expect(postgresTests.filter((file) => sharedTests.includes(file))).toEqual([]);
  });

  it("rejects demo imports, reversed PostgreSQL dependencies and Docker in Shared", () => {
    expect([...sources.keys()].some((file) => file.startsWith("packages/persistence-postgres/src/"))).toBe(true);
    expect(boundaryViolations(sources, sharedTests)).toEqual([]);
  });
});
