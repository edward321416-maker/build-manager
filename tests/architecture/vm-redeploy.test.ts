import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Spec: docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md (PR B). The script runs for real in bash with
// a fake docker (vm-redeploy-fake-docker.sh) that records every call, so the tests see order, arguments and output.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const posix = (path: string) => path.replaceAll("\\", "/");
const SCRIPT = posix(join(ROOT, "deploy", "vm", "redeploy.sh"));
const OLD = `sha256:${"a1".repeat(32)}`, NEW = `sha256:${"b2".repeat(32)}`;
const short = (id: string) => id.slice("sha256:".length, "sha256:".length + 12);
const SECRET = "never-print-this";
const TIMEOUT = 30_000;

let dir: string, home: string, state: string;
beforeEach(() => {
  // The fake is copied into the temporary folder: REDEPLOY_DOCKER is split on spaces and the repository path has some.
  dir = posix(mkdtempSync(join(tmpdir(), "vm-redeploy-")));
  home = `${dir}/home`;
  state = `${dir}/state`;
  mkdirSync(`${home}/build-manager-demo-secrets`, { recursive: true });
  mkdirSync(state);
  copyFileSync(join(ROOT, "tests", "architecture", "vm-redeploy-fake-docker.sh"), `${dir}/fake-docker.sh`);
  writeFileSync(`${home}/build-manager-demo-secrets/compose.env`, `POSTGRES_PASSWORD=${SECRET}\n`);
  for (const file of ["running", "latest", "known"]) writeFileSync(`${state}/${file}`, `${OLD}\n`);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function archive(name: string, line: string): { path: string; sha256: string } {
  const bytes = gzipSync(`${line}\n`);
  writeFileSync(`${home}/${name}`, bytes);
  return { path: `${home}/${name}`, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync("bash", [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, HOME: home, FAKE_DIR: state, REDEPLOY_DOCKER: `bash ${dir}/fake-docker.sh`, REDEPLOY_READY_SECONDS: "20", ...env },
    encoding: "utf8",
  });
  const log = `${state}/calls.log`;
  const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
  const output = `${result.stdout}${result.stderr}`;
  // The env file holds the database password; the script passes its path and never reads it.
  expect(output).not.toContain(SECRET);
  return { code: result.status, output, calls };
}
// `load` takes no arguments, so a call is the verb alone or the verb and its arguments.
const at = (calls: string[], verb: string) => calls.findIndex((call) => call === verb || call.startsWith(`${verb} `));

describe("deploy/vm/redeploy.sh deploy", () => {
  it("stops before any docker call when the checksum does not match", () => {
    const { path } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, "0".repeat(64)]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ARCHIVE_CHECKSUM_MISMATCH");
    expect(calls).toEqual([]);
  }, TIMEOUT);

  it("stops before any docker call when the disk cannot hold the image and a rollback archive", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    // The test archive is tiny, so the script asks for 1 KB; none is free.
    const { code, output, calls } = run(["deploy", path, sha256], { REDEPLOY_FREE_KB: "0" });
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | LOW_DISK");
    expect(calls).toEqual([]);
  }, TIMEOUT);

  it("keeps the running image for rollback first, then loads, recreates only web and waits until ready", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(output).toContain(`REDEPLOY_DONE | from ${short(OLD)} to ${short(NEW)} | roll back with: bash deploy/vm/redeploy.sh rollback ${short(OLD)}`);
    expect(code).toBe(0);
    expect(gunzipSync(readFileSync(`${home}/demo-web-${short(OLD)}.tar.gz`)).toString()).toBe(`fake-image ${OLD}\n`);
    expect(at(calls, "save")).toBeGreaterThan(-1);
    expect(at(calls, "save")).toBeLessThan(at(calls, "load"));
    expect(at(calls, "load")).toBeLessThan(at(calls, "compose"));
    const compose = calls[at(calls, "compose")];
    // Git Bash shows a Windows temporary folder as /tmp/..., so match the folder's unique name, not the whole path.
    expect(compose).toMatch(new RegExp(`^compose --env-file \\S*/${basename(dir)}/home/build-manager-demo-secrets/compose\\.env -f `));
    expect(compose).toMatch(/\/deploy\/vm\/compose\.yml up -d --no-deps --force-recreate web$/);
    expect(output).toMatch(/^HOSTED_DEMO_ENSURED \| upgraded/m);
    expect(readFileSync(`${state}/running`, "utf8").trim()).toBe(NEW);
  }, TIMEOUT);

  it("does not save the running image again when its rollback archive exists", () => {
    archive(`demo-web-${short(OLD)}.tar.gz`, `fake-image ${OLD}`);
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(0);
    expect(at(calls, "save")).toBe(-1);
  }, TIMEOUT);

  it("tags an archive that was saved by image ID before it recreates web", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `fake-image ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(output).toContain(`REDEPLOY_DONE | from ${short(OLD)} to ${short(NEW)}`);
    expect(code).toBe(0);
    expect(at(calls, "tag")).toBeLessThan(at(calls, "compose"));
    expect(readFileSync(`${state}/running`, "utf8").trim()).toBe(NEW);
  }, TIMEOUT);

  it("changes nothing when the archive holds the running image", () => {
    const { path, sha256 } = archive("demo-web-same.tar.gz", `tagged ${OLD}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(0);
    expect(output).toContain(`REDEPLOY_UNCHANGED | ${short(OLD)} is already running`);
    expect(at(calls, "compose")).toBe(-1);
  }, TIMEOUT);

  it("prints the rollback command and exits 1 when the new container never becomes ready", () => {
    writeFileSync(`${state}/never-ready`, "");
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output } = run(["deploy", path, sha256], { REDEPLOY_READY_SECONDS: "2" });
    expect(code).toBe(1);
    expect(output).toContain(`REDEPLOY_NOT_READY | ${short(NEW)} did not become ready in 2s | roll back with: bash deploy/vm/redeploy.sh rollback ${short(OLD)}`);
  }, TIMEOUT);
});

describe("deploy/vm/redeploy.sh rollback", () => {
  it("loads the kept archive, points the tag at it and recreates only web", () => {
    archive(`demo-web-${short(OLD)}.tar.gz`, `fake-image ${OLD}`);
    for (const file of ["running", "latest", "known"]) writeFileSync(`${state}/${file}`, `${NEW}\n`);
    const { code, output, calls } = run(["rollback", short(OLD)]);
    expect(output).toContain(`ROLLBACK_DONE | running ${short(OLD)}`);
    expect(code).toBe(0);
    expect(at(calls, "load")).toBeLessThan(at(calls, "tag"));
    expect(at(calls, "tag")).toBeLessThan(at(calls, "compose"));
    expect(calls[at(calls, "tag")]).toBe(`tag ${short(OLD)} build-manager-demo-web:latest`);
    expect(readFileSync(`${state}/running`, "utf8").trim()).toBe(OLD);
  }, TIMEOUT);

  it("stops before any docker call when the archive is missing", () => {
    const { code, output, calls } = run(["rollback", short(OLD)]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ROLLBACK_ARCHIVE_NOT_FOUND");
    expect(calls).toEqual([]);
  }, TIMEOUT);
});

describe("deploy/vm/redeploy.sh usage", () => {
  it.each([
    { name: "no command", args: [] },
    { name: "deploy without its archive", args: ["deploy"] },
    { name: "a checksum that is not sha256", args: ["deploy", "demo-web.tar.gz", "not-a-sum"] },
    { name: "an image ID that is not 12 hex characters", args: ["rollback", "not-an-id"] },
    { name: "an unknown command", args: ["upgrade"] },
  ])("exits 2 with no docker call for $name", ({ args }) => {
    const { code, output, calls } = run(args);
    expect(code).toBe(2);
    expect(output).toContain("USAGE: bash deploy/vm/redeploy.sh");
    expect(calls).toEqual([]);
  }, TIMEOUT);
});
