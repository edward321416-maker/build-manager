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
const SECRETS = ["never-print-compose-env", "never-print-web-env"];
const TIMEOUT = 30_000;
const rollbackHint = (id: string) => new RegExp(`\\| roll back with: bash .+/deploy/vm/redeploy\\.sh rollback ${id}`);

let dir: string, home: string, state: string;
beforeEach(() => {
  // The fake is copied into the temporary folder: REDEPLOY_DOCKER is split on spaces and the repository path has some.
  dir = posix(mkdtempSync(join(tmpdir(), "vm-redeploy-")));
  home = `${dir}/home`;
  state = `${dir}/state`;
  mkdirSync(`${home}/build-manager-demo-secrets`, { recursive: true });
  mkdirSync(state);
  copyFileSync(join(ROOT, "tests", "architecture", "vm-redeploy-fake-docker.sh"), `${dir}/fake-docker.sh`);
  writeFileSync(`${home}/build-manager-demo-secrets/compose.env`, `POSTGRES_PASSWORD=${SECRETS[0]}\n`);
  writeFileSync(`${home}/build-manager-demo-secrets/web.env`, `SESSION_SECRET=${SECRETS[1]}\n`);
  for (const file of ["running", "latest", "known"]) writeFileSync(`${state}/${file}`, `${OLD}\n`);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function archive(name: string, line: string, padding = 0): { path: string; sha256: string } {
  const bytes = gzipSync(Buffer.concat([Buffer.from(`${line}\n`), Buffer.alloc(padding)]));
  writeFileSync(`${home}/${name}`, bytes);
  return { path: `${home}/${name}`, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync("bash", [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, HOME: home, FAKE_DIR: state, REDEPLOY_DOCKER: `bash ${dir}/fake-docker.sh`, REDEPLOY_READY_SECONDS: "20", ...env },
    encoding: "utf8",
    // A script that loops must fail the test, not hang it: vitest cannot interrupt a synchronous spawn.
    timeout: 25_000,
  });
  const log = `${state}/calls.log`;
  const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
  const output = `${result.stdout}${result.stderr}`;
  // The env files hold the database password and session secrets; the script passes a path and never reads them.
  for (const secret of SECRETS) expect(output).not.toContain(secret);
  return { code: result.status, output, calls };
}
// `load` takes no arguments, so a call is the verb alone or the verb and its arguments.
const at = (calls: string[], verb: string) => calls.findIndex((call) => call === verb || call.startsWith(`${verb} `));
const running = () => readFileSync(`${state}/running`, "utf8").trim();

describe("deploy/vm/redeploy.sh deploy: checks before any change", () => {
  it("stops before any docker call when the checksum does not match", () => {
    const { path } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, "0".repeat(64)]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ARCHIVE_CHECKSUM_MISMATCH");
    expect(calls).toEqual([]);
  }, TIMEOUT);

  it("stops before any docker call when no disk space is free", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256], { REDEPLOY_FREE_KB: "0" });
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | LOW_DISK");
    expect(calls).toEqual([]);
  }, TIMEOUT);

  it("counts the unpacked image, not the archive, when it checks the free space", () => {
    // 10 MB of zeros compress to a few KB; loading still needs about twice the unpacked size.
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`, 10 * 1024 * 1024);
    const { code, output, calls } = run(["deploy", path, sha256], { REDEPLOY_FREE_KB: "5000" });
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | LOW_DISK");
    expect(calls).toEqual([]);
  }, TIMEOUT);

  it("stops before any docker call when the archive is not gzip, even with a matching checksum", () => {
    writeFileSync(`${home}/demo-web-new.tar.gz`, "not a gzip file");
    const sha256 = createHash("sha256").update("not a gzip file").digest("hex");
    const { code, output, calls } = run(["deploy", `${home}/demo-web-new.tar.gz`, sha256]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ARCHIVE_NOT_GZIP");
    expect(calls).toEqual([]);
  }, TIMEOUT);

  it("names an unreachable Docker daemon when it cannot measure Docker's data folder", () => {
    writeFileSync(`${state}/docker-down`, "");
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | DOCKER_UNAVAILABLE");
    expect(calls).toEqual(["info -f {{.DockerRootDir}}"]);
  }, TIMEOUT);

  it("stops before any docker call while another run holds the lock, and leaves that lock alone", () => {
    mkdirSync(`${home}/.redeploy.lock`);
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ALREADY_RUNNING");
    expect(calls).toEqual([]);
    expect(existsSync(`${home}/.redeploy.lock`)).toBe(true);
  }, TIMEOUT);

  it("stops without recreating when the archive holds another tag of the image", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged-v2 ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ARCHIVE_NOT_DEMO_IMAGE");
    expect(at(calls, "compose")).toBe(-1);
    expect(running()).toBe(OLD);
  }, TIMEOUT);
});

describe("deploy/vm/redeploy.sh deploy", () => {
  it("keeps the running image for rollback first, then loads, recreates only web and waits until ready", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(output).toContain(`REDEPLOY_DONE | from ${short(OLD)} to ${short(NEW)} `);
    expect(output).toMatch(rollbackHint(short(OLD)));
    expect(code).toBe(0);
    expect(gunzipSync(readFileSync(`${home}/demo-web-${short(OLD)}.tar.gz`)).toString()).toBe(`fake-image ${OLD}\n`);
    expect(at(calls, "info")).toBeGreaterThan(-1);
    expect(at(calls, "info")).toBeLessThan(at(calls, "save"));
    expect(at(calls, "save")).toBeLessThan(at(calls, "load"));
    expect(at(calls, "load")).toBeLessThan(at(calls, "compose"));
    // Git Bash shows a Windows temporary folder as /tmp/..., so match the folder's unique name, not the whole path.
    expect(calls[at(calls, "compose")]).toMatch(new RegExp(`^compose --env-file \\S*/${basename(dir)}/home/build-manager-demo-secrets/compose\\.env -f `));
    expect(calls[at(calls, "compose")]).toMatch(/\/deploy\/vm\/compose\.yml up -d --no-deps --force-recreate web$/);
    expect(output).toMatch(/^HOSTED_DEMO_ENSURED \| upgraded/m);
    expect(running()).toBe(NEW);
    expect(existsSync(`${home}/.redeploy.lock`)).toBe(false);
  }, TIMEOUT);

  it("accepts a checksum written in capitals", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output } = run(["deploy", path, sha256.toUpperCase()]);
    expect(output).toContain(`REDEPLOY_DONE | from ${short(OLD)} to ${short(NEW)} `);
    expect(code).toBe(0);
  }, TIMEOUT);

  it("does not save the running image again when a valid rollback archive exists", () => {
    archive(`demo-web-${short(OLD)}.tar.gz`, `fake-image ${OLD}`);
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(0);
    expect(at(calls, "save")).toBe(-1);
  }, TIMEOUT);

  it("saves the running image again when the existing rollback archive is broken", () => {
    writeFileSync(`${home}/demo-web-${short(OLD)}.tar.gz`, "not a gzip file");
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(0);
    expect(at(calls, "save")).toBeGreaterThan(-1);
    expect(gunzipSync(readFileSync(`${home}/demo-web-${short(OLD)}.tar.gz`)).toString()).toBe(`fake-image ${OLD}\n`);
  }, TIMEOUT);

  it("tags an archive that was saved by image ID before it recreates web", () => {
    const { path, sha256 } = archive("demo-web-new.tar.gz", `fake-image ${NEW}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(output).toContain(`REDEPLOY_DONE | from ${short(OLD)} to ${short(NEW)} `);
    expect(code).toBe(0);
    expect(calls[at(calls, "tag")]).toBe(`tag ${NEW} build-manager-demo-web:latest`);
    expect(at(calls, "tag")).toBeLessThan(at(calls, "compose"));
    expect(running()).toBe(NEW);
  }, TIMEOUT);

  it("changes nothing when the archive holds the running image", () => {
    const { path, sha256 } = archive("demo-web-same.tar.gz", `tagged ${OLD}`);
    const { code, output, calls } = run(["deploy", path, sha256]);
    expect(code).toBe(0);
    expect(output).toContain(`REDEPLOY_UNCHANGED | ${short(OLD)} is already running`);
    expect(at(calls, "compose")).toBe(-1);
  }, TIMEOUT);
});

describe("deploy/vm/redeploy.sh deploy: a new container that is not ready", () => {
  it.each([
    { name: "compose fails", file: "compose-fails", content: "", reason: "compose failed" },
    { name: "the container still runs the old image", file: "compose-keeps-old", content: "", reason: `the container does not run ${short(NEW)}` },
    { name: "the container restarted", file: "restarts-after-compose", content: "1", reason: "the container restarted" },
    { name: "the log never reports ready", file: "never-ready", content: "", reason: "not ready in 2s" },
    { name: "only the provisioning check is ready", file: "only-ensured", content: "", reason: "not ready in 2s" },
    { name: "only Next.js is ready", file: "only-ready", content: "", reason: "not ready in 2s" },
  ])("exits 1 with the reason and the rollback command when $name", ({ file, content, reason }) => {
    writeFileSync(`${state}/${file}`, content);
    const { path, sha256 } = archive("demo-web-new.tar.gz", `tagged ${NEW}`);
    const { code, output } = run(["deploy", path, sha256], { REDEPLOY_READY_SECONDS: "2" });
    expect(code).toBe(1);
    expect(output).toContain(`REDEPLOY_NOT_READY | ${short(NEW)}: ${reason} `);
    expect(output).toMatch(rollbackHint(short(OLD)));
  }, TIMEOUT);
});

describe("deploy/vm/redeploy.sh rollback", () => {
  it("loads the kept archive when the image is gone, points the tag at it and recreates only web", () => {
    archive(`demo-web-${short(OLD)}.tar.gz`, `fake-image ${OLD}`);
    for (const file of ["running", "latest", "known"]) writeFileSync(`${state}/${file}`, `${NEW}\n`);
    const { code, output, calls } = run(["rollback", short(OLD)]);
    expect(output).toContain(`ROLLBACK_DONE | running ${short(OLD)}`);
    expect(code).toBe(0);
    expect(at(calls, "load")).toBeLessThan(at(calls, "tag"));
    expect(at(calls, "tag")).toBeLessThan(at(calls, "compose"));
    expect(calls[at(calls, "tag")]).toBe(`tag ${short(OLD)} build-manager-demo-web:latest`);
    expect(running()).toBe(OLD);
  }, TIMEOUT);

  it("skips the load when the image is still on the machine", () => {
    for (const file of ["running", "latest"]) writeFileSync(`${state}/${file}`, `${NEW}\n`);
    writeFileSync(`${state}/known`, `${OLD}\n${NEW}\n`);
    const { code, output, calls } = run(["rollback", short(OLD)]);
    expect(output).toContain(`ROLLBACK_DONE | running ${short(OLD)}`);
    expect(code).toBe(0);
    expect(at(calls, "load")).toBe(-1);
    expect(at(calls, "tag")).toBeLessThan(at(calls, "compose"));
    expect(running()).toBe(OLD);
  }, TIMEOUT);

  it("stops before loading or recreating when neither the image nor its archive is there", () => {
    for (const file of ["running", "latest", "known"]) writeFileSync(`${state}/${file}`, `${NEW}\n`);
    const { code, output, calls } = run(["rollback", short(OLD)]);
    expect(code).toBe(1);
    expect(output).toContain("REDEPLOY_STOPPED | ROLLBACK_ARCHIVE_NOT_FOUND");
    expect(calls.filter((call) => !call.startsWith("image inspect "))).toEqual([]);
  }, TIMEOUT);
});

describe("deploy/vm/redeploy.sh usage", () => {
  it.each([
    { name: "no command", args: [] },
    { name: "deploy without its archive", args: ["deploy"] },
    { name: "a checksum that is not sha256", args: ["deploy", "demo-web.tar.gz", "not-a-sum"] },
    { name: "an image ID that is not 12 hex characters", args: ["rollback", "not-an-id"] },
    { name: "an unknown command", args: ["upgrade"] },
    // A wait that is not a whole number would make the readiness loop spin forever.
    { name: "a readiness wait that is not a number", args: ["rollback", short(OLD)], env: { REDEPLOY_READY_SECONDS: "abc" } },
  ])("exits 2 with no docker call for $name", ({ args, env }) => {
    const { code, output, calls } = run(args, env);
    expect(code).toBe(2);
    expect(output).toContain("USAGE: bash deploy/vm/redeploy.sh");
    expect(calls).toEqual([]);
  }, TIMEOUT);
});
