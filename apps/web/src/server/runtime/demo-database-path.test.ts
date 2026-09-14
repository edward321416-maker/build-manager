import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEMO_DATABASE_PATH_ENV,
  ensureDemoDatabaseDirectory,
  resolveDemoDatabasePath,
} from "./demo-database-path";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "build-manager-dbpath-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function posix(value: string): string {
  return value.split(sep).join("/");
}

describe("configured database path", () => {
  it("uses an absolute path from the server-only environment variable", () => {
    const configured = join(tmpdir(), "build-manager-configured", "demo.sqlite");

    const resolved = resolveDemoDatabasePath({
      env: { [DEMO_DATABASE_PATH_ENV]: configured },
      cwd: "/anywhere",
    });

    expect(resolved).toBe(configured);
  });

  it("resolves a relative configured path against the working directory", () => {
    const resolved = resolveDemoDatabasePath({
      env: { [DEMO_DATABASE_PATH_ENV]: "local/demo.sqlite" },
      cwd: join(tmpdir(), "build-manager-relative"),
    });

    expect(isAbsolute(resolved)).toBe(true);
    expect(posix(resolved).endsWith("/build-manager-relative/local/demo.sqlite")).toBe(
      true,
    );
  });

  it("ignores a blank configured value and falls back to the default", () => {
    const resolved = resolveDemoDatabasePath({
      env: { [DEMO_DATABASE_PATH_ENV]: "   " },
      cwd: "/repo/apps/web",
    });

    expect(
      posix(resolved).endsWith("/repo/apps/web/.build-manager-local/demo.sqlite"),
    ).toBe(true);
  });

  it("refuses an in-memory database for the HTTP runtime", () => {
    expect(() =>
      resolveDemoDatabasePath({
        env: { [DEMO_DATABASE_PATH_ENV]: ":memory:" },
        cwd: "/repo/apps/web",
      }),
    ).toThrowError(/memory/i);
  });
});

describe("default database path", () => {
  it("lands under the web app when run from the web app itself", () => {
    expect(
      posix(
        resolveDemoDatabasePath({ env: {}, cwd: "/repo/apps/web" }),
      ).endsWith("/repo/apps/web/.build-manager-local/demo.sqlite"),
    ).toBe(true);
  });

  it("lands under the web app when run from the repository root", () => {
    expect(
      posix(resolveDemoDatabasePath({ env: {}, cwd: "/repo" })).endsWith(
        "/repo/apps/web/.build-manager-local/demo.sqlite",
      ),
    ).toBe(true);
  });

  it("lands under the web app when run from a nested web directory", () => {
    expect(
      posix(
        resolveDemoDatabasePath({ env: {}, cwd: "/repo/apps/web/src/server" }),
      ).endsWith("/repo/apps/web/.build-manager-local/demo.sqlite"),
    ).toBe(true);
  });

  it("is deterministic for the same working directory", () => {
    const first = resolveDemoDatabasePath({ env: {}, cwd: "/repo" });
    const second = resolveDemoDatabasePath({ env: {}, cwd: "/repo" });

    expect(first).toBe(second);
  });
});

describe("directory creation is lazy", () => {
  it("creates nothing merely by resolving a path", async () => {
    const directory = await temporaryDirectory();

    const resolved = resolveDemoDatabasePath({ env: {}, cwd: directory });

    expect(existsSync(join(directory, "apps", "web", ".build-manager-local"))).toBe(
      false,
    );
    expect(existsSync(resolved)).toBe(false);
  });

  it("creates the parent directory only when asked", async () => {
    const directory = await temporaryDirectory();
    const databasePath = join(directory, ".build-manager-local", "demo.sqlite");

    expect(existsSync(join(directory, ".build-manager-local"))).toBe(false);

    ensureDemoDatabaseDirectory(databasePath);

    expect(existsSync(join(directory, ".build-manager-local"))).toBe(true);
    expect(existsSync(databasePath)).toBe(false);
  });

  it("is safe to call repeatedly", async () => {
    const directory = await temporaryDirectory();
    const databasePath = join(directory, ".build-manager-local", "demo.sqlite");

    ensureDemoDatabaseDirectory(databasePath);

    expect(() => ensureDemoDatabaseDirectory(databasePath)).not.toThrow();
  });
});

describe("environment naming", () => {
  it("uses a server-only variable that is never exposed to the browser", () => {
    expect(DEMO_DATABASE_PATH_ENV).toBe("BUILD_MANAGER_DB_PATH");
    expect(DEMO_DATABASE_PATH_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
  });
});
