import { defineConfig, devices } from '@playwright/test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
export default defineConfig({
  testDir: './tests/vendor-e2e', fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  globalSetup: './tests/vendor-e2e/global-setup.ts', timeout: 30000,
  reporter: [['list'], ['./tests/vendor-e2e/coverage-reporter.ts']],
  outputDir: join(homedir(), '.build-manager-vendor-private', 'task12-results-' + randomUUID()),
  use: { baseURL: process.env.VENDOR_HANDOFF_ORIGIN ?? 'http://localhost:3134', ...devices['Desktop Chrome'], actionTimeout: 5000, trace: 'off', screenshot: 'off', video: 'off' },
  // Playwright DOM error snapshots can contain transient capability input values.
  captureGitInfo: { commit: false, diff: false },
});
