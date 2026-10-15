import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Spec: docs/superpowers/specs/2026-10-15-expo-doctor-offline-design.md. PRs run the pinned Expo Doctor offline, so this
// weekly run is what still compares the mobile packages with Expo's live SDK list; its triggers, token, actions and
// command are pinned here (DEV-10).
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const source = read(".github/workflows/expo-updates.yml");
// Comments explain EXPO_OFFLINE and the offline fallback; the checks below read only the lines that configure the run.
const config = source.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");

// The whole last step, byte for byte: the live check, no cache, and a failure when @expo/cli fell back to its offline
// list because Expo's service could not be reached (it still exits 0 then).
const finalStep = [
  "      - name: Compare the mobile packages with Expo's live SDK list",
  "        shell: bash",
  "        working-directory: apps/mobile",
  "        env:",
  '          EXPO_NO_CACHE: "1"',
  "        run: |",
  "          set -o pipefail",
  '          npx expo install --check 2>&1 | tee "$RUNNER_TEMP/expo-install-check.log"',
  '          if grep -Eq "Networking has been disabled|Unable to reach well-known versions endpoint|offline-mode" "$RUNNER_TEMP/expo-install-check.log"; then',
  "            echo \"::error::Expo's version service could not be reached, so this run cannot tell whether a patch release is out.\"",
  "            exit 1",
  "          fi",
  "",
].join("\n");

describe("expo updates workflow", () => {
  it("runs only on its weekly schedule or by hand, and only in this repository", () => {
    const triggers = /^on:\n([\s\S]*?)(?=^\S)/m.exec(config)?.[1] ?? "";
    expect(triggers.match(/^ +[^\s-][^:]*:/gm)).toEqual(["  schedule:", "  workflow_dispatch:"]);
    expect(triggers.match(/cron:.*$/gm)).toEqual(['cron: "41 0 * * 1"']);
    expect(config.match(/^\s*(?:-\s+)?["']?if["']?\s*:.*$/gm)).toEqual(["    if: github.repository == 'edward321416-maker/build-manager'"]);
    expect(config).not.toMatch(/pull_request|workflow_run|repository_dispatch/);
  });

  it("holds a read-only token, no secrets, and the same pinned actions as the app check", () => {
    expect(config).toMatch(/^permissions:\n {2}contents: read\n(?! )/m);
    expect(config).not.toMatch(/:\s*write\b/);
    expect(config).not.toMatch(/\bsecrets\b/);
    const actions = config.match(/["']?uses["']?\s*:\s*\S+/g) ?? [];
    expect(actions).toHaveLength(2);
    const appCheck = read(".github/workflows/app-check.yml");
    for (const action of actions) {
      expect(action).toMatch(/^uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(appCheck, `${action} is the commit app-check.yml pins`).toContain(action);
    }
    expect(config).toContain("persist-credentials: false");
  });

  it("installs from the lockfile on the pinned runtime and ends with the live check", () => {
    expect(config).toContain('node-version: "24.21.0"');
    expect(config).toContain('test "$(node --version)" = "v24.21.0"');
    expect(config).toContain('test "$(npm --version)" = "11.19.0"');
    expect(config).toMatch(/^ {10}npm ci$/m);
    expect(config.endsWith(finalStep), "the last step is exactly the live check").toBe(true);
    expect(config).not.toContain("EXPO_OFFLINE");
    expect(config).not.toMatch(/--fix|\|\| true|continue-on-error/);
  });

  it("cannot overlap or hang", () => {
    expect(config).toMatch(/^concurrency:\n {2}group: expo-updates\n {2}cancel-in-progress: false$/m);
    expect(config).toMatch(/^ {4}timeout-minutes: 20$/m);
    expect(config.match(/^ {8}shell: bash$/gm)?.length).toBe(config.match(/^ {6}- name: /gm)?.length);
  });
});
