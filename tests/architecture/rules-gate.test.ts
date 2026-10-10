import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPT = join(ROOT, ".claude", "hooks", "rules-gate.mjs");
const CONFIG = join(ROOT, ".claude", "rules-gate.json");

type Rule = { id: string; name: string; file: string; commands?: string[] };
type Config = { rules: Rule[] };
const RULES = (JSON.parse(readFileSync(CONFIG, "utf8")) as Config).rules;
const FILE: Record<string, string> = Object.fromEntries(RULES.map((rule) => [rule.id, rule.file]));

let repo: string, state: string, outside: string;

type Result = { status: number | null; stderr: string };
function run(mode: "record" | "check", input: unknown): Result {
  const result = spawnSync(process.execPath, [SCRIPT, mode], {
    // The hook process runs outside every repository, so only the input decides what is covered.
    cwd: outside,
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, TMP: state, TEMP: state, TMPDIR: state },
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}
const at = (relative: string, base = repo) => join(base, ...relative.split("/"));
const read = (id: string, session = "s1", extra: Record<string, unknown> = {}, base = repo) =>
  run("record", { session_id: session, tool_name: "Read", tool_input: { file_path: at(FILE[id], base), ...extra } });
const edit = (path: string, session = "s1", tool_name = "Edit") =>
  run("check", { session_id: session, tool_name, tool_input: { file_path: path } });
const tool = (tool_name: string, cwd: string, tool_input: Record<string, unknown> = {}, session = "s1") =>
  run("check", { session_id: session, tool_name, cwd, tool_input });
const shell = (command: string, tool_name = "Bash", cwd = repo) => tool(tool_name, cwd, { command });
const writeConfig = (mutate: (config: Config) => void) => {
  const config = JSON.parse(readFileSync(CONFIG, "utf8")) as Config;
  mutate(config);
  writeFileSync(join(repo, ".claude", "rules-gate.json"), JSON.stringify(config));
};

/**
 * Rule ids that a check names as unread, in config order; empty for a clean pass. A crash (any
 * other exit) or a pass that printed a warning returns a marker so it can never satisfy an expectation.
 */
function required(result: Result): string[] {
  if (result.status === 0) return result.stderr.trim() ? [`warning: ${result.stderr.trim()}`] : [];
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
    expect(result.stderr).toContain(at(FILE.development));
  });

  it("allows the edit after every required rulebook was fully read", () => {
    expect(required(read("design"))).toEqual([]);
    expect(required(read("development"))).toEqual([]);
    expect(required(edit(screen()))).toEqual([]);
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
    expect(required(edit(screen()))).toEqual([]);
  });

  it("does not unlock another session", () => {
    read("design");
    read("development");
    expect(edit(screen(), "s2").status).toBe(2);
  });

  it("counts a read in another checkout only while the rulebook content is identical", () => {
    const other = mkdtempSync(join(tmpdir(), "rules-repo-other-"));
    try {
      mkdirSync(join(other, ".claude"), { recursive: true });
      copyFileSync(CONFIG, join(other, ".claude", "rules-gate.json"));
      for (const rule of RULES) {
        mkdirSync(dirname(at(rule.file, other)), { recursive: true });
        writeFileSync(at(rule.file, other), `# ${rule.name} v1\n`);
      }
      read("design", "s1", {}, other);
      read("development", "s1", {}, other);
      expect(required(edit(screen()))).toEqual([]);
      expect(edit(screen(), "s2").status).toBe(2);
      writeFileSync(at(FILE.development), "# 개발 규칙 v2\n");
      expect(required(edit(screen()))).toEqual(["development"]);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
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

  it("checks MultiEdit and the notebook path of NotebookEdit", () => {
    expect(required(edit(screen(), "s1", "MultiEdit"))).toEqual(["design", "development"]);
    const notebook = run("check", {
      session_id: "s1",
      tool_name: "NotebookEdit",
      tool_input: { notebook_path: at("research/a.ipynb") },
    });
    expect(required(notebook)).toEqual(["research"]);
  });

  it("resolves a relative edit path against the session cwd", () => {
    const result = run("check", {
      session_id: "s1",
      tool_name: "Edit",
      cwd: repo,
      tool_input: { file_path: "apps/web/src/app/page.tsx" },
    });
    expect(required(result)).toEqual(["design", "development"]);
  });

  it("gates web lookups by the session working directory", () => {
    mkdirSync(at("apps/web"), { recursive: true });
    expect(required(tool("WebSearch", at("apps/web"), { query: "x" }))).toEqual(["reference"]);
    expect(required(tool("WebFetch", repo, { url: "https://example.com" }))).toEqual(["reference"]);
    read("reference");
    expect(required(tool("WebSearch", at("apps/web"), { query: "x" }))).toEqual([]);
    expect(required(tool("WebSearch", outside, { query: "x" }, "s9"))).toEqual([]);
  });

  it.each([
    "npm install zod",
    "npm i -D vitest",
    "npm install -w apps/web zod",
    "npm --workspace @build-manager/mobile install expo-camera",
    "npm -w apps/web install zod",
    "npm.cmd install zod",
    "cd apps/web && npm install zod",
    "npx expo install expo-camera",
    "npx -y expo install expo-camera",
    "yarn add react",
    "pnpm add -D vitest",
  ])("gates the package-adding command %s", (command) => {
    expect(required(shell(command))).toEqual(["development", "reference"]);
  });

  it.each([
    "npm install",
    "npm ci",
    "npm run test:shared",
    "npm install && npm test",
    "npm install -w apps/web",
    "npm install --omit dev",
    "npm --workspace @build-manager/web run lint",
    "npx expo install --check",
    "git status",
  ])("lets %s through", (command) => {
    expect(required(shell(command))).toEqual([]);
  });

  it("checks PowerShell commands the same way", () => {
    expect(required(shell("npm install zod", "PowerShell"))).toEqual(["development", "reference"]);
    expect(required(shell("Set-Location apps/web; npm install zod", "PowerShell"))).toEqual(["development", "reference"]);
  });

  it("follows a cd in the command to the repository it enters", () => {
    expect(required(shell(`cd "${repo}" && npm install zod`, "Bash", outside))).toEqual(["development", "reference"]);
    expect(required(shell(`cd "${outside}" && npm install zod`, "Bash", repo))).toEqual([]);
  });

  it.runIf(process.platform === "win32")("understands Git Bash drive paths on Windows", () => {
    const posixRepo = repo.replace(/^([A-Za-z]):\\/, (_, drive: string) => `/${drive.toLowerCase()}/`).replace(/\\/g, "/");
    expect(required(shell(`cd "${posixRepo}" && npm install zod`, "Bash", outside))).toEqual(["development", "reference"]);
    expect(required(edit(`${posixRepo}/apps/web/src/app/page.tsx`))).toEqual(["design", "development"]);
  });

  it("skips a rulebook that does not exist yet", () => {
    rmSync(at(FILE.reference));
    expect(required(edit(at("package.json")))).toEqual(["development"]);
  });

  it("never blocks files outside a rules repository", () => {
    expect(required(edit(join(outside, "apps", "web", "src", "app", "page.tsx")))).toEqual([]);
  });

  it("falls back to the design rule in a checkout that has design rules but no gate config", () => {
    rmSync(join(repo, ".claude"), { recursive: true, force: true });
    expect(required(edit(screen()))).toEqual(["design"]);
    expect(required(edit(at("apps/web/src/server/b1/config.ts")))).toEqual([]);
    read("design");
    expect(required(edit(screen()))).toEqual([]);
  });

  it("keeps the other rules working when one rule is broken", () => {
    writeConfig((config) => {
      const development = config.rules.find((rule) => rule.id === "development");
      if (development) development.commands = ["no-such-command-set"];
    });
    const result = shell("npm install zod");
    expect(result.status).toBe(2);
    expect(required(result)).toEqual(["reference"]);
    expect(result.stderr).toContain("no-such-command-set");
    expect(required(edit(screen()))).toEqual(["design", "development"]);
  });

  it("reports an unreadable config visibly instead of passing silently", () => {
    writeFileSync(join(repo, ".claude", "rules-gate.json"), "{ not json");
    const result = edit(screen());
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("rules-gate");
  });

  it("recovers from a corrupt session state file", () => {
    mkdirSync(join(state, "build-manager-rules-gate"), { recursive: true });
    writeFileSync(join(state, "build-manager-rules-gate", "s1.json"), '{"x":"1"}AA');
    expect(required(edit(screen()))).toEqual(["design", "development"]);
    read("design");
    read("development");
    expect(required(edit(screen()))).toEqual([]);
  });

  it("reports malformed hook input visibly without blocking", () => {
    const result = run("check", "not json");
    expect(result.status).toBe(1);
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
