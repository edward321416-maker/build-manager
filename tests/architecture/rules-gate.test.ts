import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPT = join(ROOT, ".claude", "hooks", "rules-gate.mjs");
const CONFIG = join(ROOT, ".claude", "rules-gate.json");

type Rule = { id: string; name: string; file: string };
const RULES = (JSON.parse(readFileSync(CONFIG, "utf8")) as { rules: Rule[] }).rules;
const FILE: Record<string, string> = Object.fromEntries(RULES.map((rule) => [rule.id, rule.file]));

let repo: string, state: string, outside: string;

type Result = { status: number | null; stderr: string };
function run(mode: "record" | "check", input: unknown): Result {
  const result = spawnSync(process.execPath, [SCRIPT, mode], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, TMP: state, TEMP: state, TMPDIR: state },
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}
const at = (relative: string) => join(repo, ...relative.split("/"));
const read = (id: string, session = "s1", extra: Record<string, unknown> = {}) =>
  run("record", { session_id: session, tool_name: "Read", tool_input: { file_path: at(FILE[id]), ...extra } });
const edit = (path: string, session = "s1", tool_name = "Edit") =>
  run("check", { session_id: session, tool_name, tool_input: { file_path: path } });
const tool = (tool_name: string, cwd: string, tool_input: Record<string, unknown> = {}, session = "s1") =>
  run("check", { session_id: session, tool_name, cwd, tool_input });
const shell = (command: string, tool_name = "Bash") => tool(tool_name, repo, { command });

/** Rule ids that a check names as unread, in config order; empty when the check passes. */
function required(result: Result): string[] {
  if (result.status === 0) return [];
  // Any exit other than a pass (0) or a block (2) is a crash and must never satisfy an expectation.
  if (result.status !== 2) return [`exit ${result.status}: ${result.stderr.trim()}`];
  return RULES.filter((rule) => result.stderr.includes(rule.file)).map((rule) => rule.id);
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "rules-repo-"));
  state = mkdtempSync(join(tmpdir(), "rules-state-"));
  outside = mkdtempSync(join(tmpdir(), "rules-outside-"));
  mkdirSync(join(repo, ".claude"), { recursive: true });
  copyFileSync(CONFIG, join(repo, ".claude", "rules-gate.json"));
  for (const rule of RULES) {
    mkdirSync(dirname(at(rule.file)), { recursive: true });
    writeFileSync(at(rule.file), `# ${rule.name} v1\n`);
  }
});
afterEach(() => {
  for (const dir of [repo, state, outside]) rmSync(dir, { recursive: true, force: true });
});

describe("rules gate", () => {
  const screen = () => at("apps/web/src/app/core/page.tsx");

  it("blocks a UI edit until the design and development rules were read", () => {
    const result = edit(screen());
    expect(result.status).toBe(2);
    expect(required(result)).toEqual(["design", "development"]);
  });

  it("allows the edit after every required rulebook was fully read", () => {
    expect(read("design").status).toBe(0);
    expect(read("development").status).toBe(0);
    expect(edit(screen()).status).toBe(0);
  });

  it("does not count a partial read", () => {
    read("design", "s1", { limit: 10 });
    read("development", "s1", { offset: 5 });
    expect(required(edit(screen()))).toEqual(["design", "development"]);
  });

  it("requires a new read after a rulebook changes", () => {
    read("design");
    read("development");
    writeFileSync(at(FILE.development), "# 개발 규칙 v2\n");
    expect(required(edit(screen()))).toEqual(["development"]);
    read("development");
    expect(edit(screen()).status).toBe(0);
  });

  it("does not unlock another session", () => {
    read("design");
    read("development");
    expect(edit(screen(), "s2").status).toBe(2);
  });

  it.each<[string, string[]]>([
    ["apps/web/src/server/b1/config.ts", ["development"]],
    ["apps/web/src/components/new/Widget.tsx", ["design", "development"]],
    ["apps/web/src/app/core/core-design.module.css", ["design", "development"]],
    ["apps/web/src/app/core/login-screen.test.tsx", ["development"]],
    ["apps/mobile/src/features/core-ui.tsx", ["design", "development"]],
    ["packages/domain/src/a.ts", ["development"]],
    ["docs/superpowers/specs/a.md", ["development"]],
    [".claude/settings.json", ["development"]],
    ["research/a.md", ["research"]],
    ["submission/a.md", ["research"]],
    ["product/mvp_scope.md", ["research"]],
    ["package.json", ["development", "reference"]],
    ["apps/web/package.json", ["development", "reference"]],
    ["references/a.md", ["reference"]],
    ["README.md", []],
    ["ops/AI_Execution_Log.csv", []],
    ["design/DESIGN_RULES.md", []],
    ["governance/project_policy.md", []],
  ])("maps %s to its rulebooks", (path, ids) => {
    expect(required(edit(at(path), "s1", "Write"))).toEqual(ids);
  });

  it("reads the notebook path for NotebookEdit", () => {
    const result = run("check", {
      session_id: "s1",
      tool_name: "NotebookEdit",
      tool_input: { notebook_path: at("research/a.ipynb") },
    });
    expect(required(result)).toEqual(["research"]);
  });

  it("gates web lookups by the session working directory", () => {
    mkdirSync(at("apps/web"), { recursive: true });
    expect(required(tool("WebSearch", at("apps/web"), { query: "x" }))).toEqual(["reference"]);
    expect(required(tool("WebFetch", repo, { url: "https://example.com" }))).toEqual(["reference"]);
    read("reference");
    expect(tool("WebSearch", at("apps/web"), { query: "x" }).status).toBe(0);
    expect(tool("WebSearch", outside, { query: "x" }, "s9").status).toBe(0);
  });

  it.each([
    "npm install zod",
    "npm i -D vitest",
    "cd apps/web && npm install zod",
    "npx expo install expo-camera",
    "yarn add react",
  ])("gates the package-adding command %s", (command) => {
    expect(required(shell(command))).toEqual(["development", "reference"]);
  });

  it.each([
    "npm install",
    "npm ci",
    "npm run test:shared",
    "npm install && npm test",
    "npx expo install --check",
    "git status",
  ])("lets %s through", (command) => {
    expect(shell(command).status).toBe(0);
  });

  it("checks PowerShell commands the same way", () => {
    expect(required(shell("npm install zod", "PowerShell"))).toEqual(["development", "reference"]);
  });

  it("skips a rulebook that does not exist yet", () => {
    rmSync(at(FILE.reference));
    expect(required(edit(at("package.json")))).toEqual(["development"]);
  });

  it("never blocks files outside a rules repository", () => {
    expect(edit(join(outside, "apps", "web", "src", "app", "page.tsx")).status).toBe(0);
  });

  it("fails open on malformed input", () => {
    const result = run("check", "not json");
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("rules-gate");
  });

  it("keeps every listed rulebook small enough to read in one call", () => {
    for (const rule of RULES) {
      const path = join(ROOT, ...rule.file.split("/"));
      expect(readFileSync(path, "utf8").split("\n").length, rule.file).toBeLessThanOrEqual(600);
      expect(statSync(path).size, rule.file).toBeLessThanOrEqual(48_000);
    }
  });
});
