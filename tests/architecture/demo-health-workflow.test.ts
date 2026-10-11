import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Spec: docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md (PR A). The hourly check holds a repository
// secret, so its triggers, token and actions are pinned here (DEV-10).
const source = readFileSync(new URL("../../.github/workflows/demo-health.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");

describe("demo health workflow", () => {
  it("runs only on its schedule or by hand, and only in this repository", () => {
    const triggers = /^on:\n((?:(?: {2}.*)?\n)+)/m.exec(source)?.[1] ?? "";
    expect(triggers.match(/^ {2}[a-z_]+:/gm)).toEqual(["  schedule:", "  workflow_dispatch:"]);
    expect(triggers).toMatch(/^ {4}- cron: "\d+ \* \* \* \*"$/m);
    expect(source).toContain("if: github.repository == 'edward321416-maker/build-manager'");
  });

  it("holds a read-only token and pins every action to a commit", () => {
    expect(source).toMatch(/^permissions:\n {2}contents: read\n(?! )/m);
    expect(source).not.toMatch(/:\s*write\b/);
    const actions = source.match(/uses: \S+/g) ?? [];
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(action).toMatch(/^uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    expect(source).toContain("persist-credentials: false");
  });

  it("runs the HTTP-only check and passes the address only through env", () => {
    expect(source.match(/secrets\.\w+/g)).toEqual(["secrets.DEMO_ORIGIN"]);
    expect(source).toMatch(/^ {10}DEMO_ORIGIN: \$\{\{ secrets\.DEMO_ORIGIN \}\}$/m);
    expect(source).toContain("node scripts/demo-smoke.mjs --http-only");
    expect(source).not.toContain("--write-check");
  });

  it("cannot overlap or hang, and retries a failed check once but not a usage error", () => {
    expect(source).toMatch(/^concurrency:\n {2}group: demo-health$/m);
    expect(source).toMatch(/^ {4}timeout-minutes: [1-9]$/m);
    expect(source).toMatch(/if \[ "\$status" -eq 1 \]; then sleep 60;/);
  });
});
