import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../../.claude/hooks/design-rules-gate.mjs", import.meta.url));

let repo: string, state: string, outside: string, rules: string;

function run(mode: "record" | "check", input: unknown) {
  const result = spawnSync(process.execPath, [SCRIPT, mode], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, TMP: state, TEMP: state, TMPDIR: state },
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}
const read = (session = "s1", extra: Record<string, unknown> = {}) =>
  run("record", { session_id: session, tool_name: "Read", tool_input: { file_path: rules, ...extra } });
const edit = (path: string, session = "s1", tool_name = "Edit") =>
  run("check", { session_id: session, tool_name, tool_input: { file_path: path } });
const ui = (relative: string) => join(repo, ...relative.split("/"));

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "rules-repo-"));
  state = mkdtempSync(join(tmpdir(), "rules-state-"));
  outside = mkdtempSync(join(tmpdir(), "rules-outside-"));
  rules = join(repo, "design", "DESIGN_RULES.md");
  mkdirSync(dirname(rules), { recursive: true });
  writeFileSync(rules, "# 디자인 규칙 v1\n");
});
afterEach(() => {
  for (const dir of [repo, state, outside]) rmSync(dir, { recursive: true, force: true });
});

describe("design rules gate", () => {
  it("blocks a UI edit before the rules were read", () => {
    const result = edit(ui("apps/web/src/app/core/page.tsx"));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("design/DESIGN_RULES.md");
  });

  it("allows the UI edit after the whole rules file was read", () => {
    expect(read().status).toBe(0);
    expect(edit(ui("apps/web/src/app/core/page.tsx")).status).toBe(0);
  });

  it("does not count a partial read", () => {
    expect(read("s1", { limit: 10 }).status).toBe(0);
    expect(edit(ui("apps/web/src/app/core/page.tsx")).status).toBe(2);
    expect(read("s1", { offset: 5 }).status).toBe(0);
    expect(edit(ui("apps/web/src/app/core/page.tsx")).status).toBe(2);
  });

  it("requires a new read after the rules change", () => {
    read();
    writeFileSync(rules, "# 디자인 규칙 v2\n");
    expect(edit(ui("apps/web/src/app/core/page.tsx")).status).toBe(2);
    read();
    expect(edit(ui("apps/web/src/app/core/page.tsx")).status).toBe(0);
  });

  it("does not unlock another session", () => {
    read("s1");
    expect(edit(ui("apps/web/src/app/core/page.tsx"), "s2").status).toBe(2);
  });

  it("covers web components, new folders and mobile screens but not other files", () => {
    expect(edit(ui("apps/web/src/components/new/Widget.tsx"), "s1", "Write").status).toBe(2);
    expect(edit(ui("apps/web/src/app/core/core-design.module.css")).status).toBe(2);
    expect(edit(ui("apps/mobile/src/features/core-ui.tsx"), "s1", "MultiEdit").status).toBe(2);
    expect(edit(ui("apps/web/src/server/b1/config.ts")).status).toBe(0);
    expect(edit(ui("apps/web/src/app/core/login-screen.test.tsx")).status).toBe(0);
    expect(edit(ui("apps/web/tests/vendor-e2e/demo-entry.spec.ts")).status).toBe(0);
    expect(edit(ui("design/DESIGN_RULES.md")).status).toBe(0);
    expect(edit(join(outside, "apps", "web", "src", "app", "page.tsx")).status).toBe(0);
  });

  it("fails open on malformed input", () => {
    const result = run("check", "not json");
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("design-rules-gate");
  });
});
