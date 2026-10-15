import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Spec: docs/superpowers/specs/2026-10-15-expo-doctor-offline-design.md. PRs run the pinned Expo Doctor offline, so this
// weekly run is what still compares the mobile packages with Expo's live SDK list; its triggers, token, actions and
// command are pinned here (DEV-10).
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const source = read(".github/workflows/expo-updates.yml");
// The header comment explains EXPO_OFFLINE; the checks below read only the lines that configure the run.
const config = source.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");

describe("expo updates workflow", () => {
  it("runs only on its weekly schedule or by hand, and only in this repository", () => {
    const triggers = /^on:\n((?:(?: {2}.*)?\n)+)/m.exec(source)?.[1] ?? "";
    expect(triggers.match(/^ {2}[a-z_]+:/gm)).toEqual(["  schedule:", "  workflow_dispatch:"]);
    expect(triggers.match(/^ {4}- cron: .*$/gm)).toEqual(['    - cron: "41 0 * * 1"']);
    expect(source).toContain("if: github.repository == 'edward321416-maker/build-manager'");
    expect(source).not.toMatch(/pull_request/);
  });

  it("holds a read-only token, no secrets, and the same pinned actions as the app check", () => {
    expect(source).toMatch(/^permissions:\n {2}contents: read\n(?! )/m);
    expect(source).not.toMatch(/:\s*write\b/);
    expect(source).not.toMatch(/secrets\./);
    const actions = source.match(/uses: \S+/g) ?? [];
    expect(actions).toHaveLength(2);
    const appCheck = read(".github/workflows/app-check.yml");
    for (const action of actions) {
      expect(action).toMatch(/^uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(appCheck, `${action} is the commit app-check.yml pins`).toContain(action);
    }
    expect(source).toContain("persist-credentials: false");
  });

  it("installs from the lockfile on the pinned runtime and checks the mobile packages online", () => {
    expect(source).toContain('node-version: "24.21.0"');
    expect(source).toContain('test "$(node --version)" = "v24.21.0"');
    expect(source).toContain('test "$(npm --version)" = "11.19.0"');
    expect(source).toMatch(/^ {10}npm ci$/m);
    expect(source).toMatch(/^ {8}working-directory: apps\/mobile\n {8}run: npx expo install --check$/m);
    expect(config).not.toContain("EXPO_OFFLINE");
    expect(config).not.toMatch(/--fix|\|\| true|continue-on-error/);
  });

  it("cannot overlap or hang", () => {
    expect(source).toMatch(/^concurrency:\n {2}group: expo-updates\n {2}cancel-in-progress: false$/m);
    expect(source).toMatch(/^ {4}timeout-minutes: 20$/m);
    expect(source.match(/^ {8}shell: bash$/gm)?.length).toBe(source.match(/^ {6}- name: /gm)?.length);
  });
});
