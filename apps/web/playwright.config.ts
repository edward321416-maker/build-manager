import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from 'node:fs';

const PORT = 3123;
const prebuilt=process.env.BUILD_MANAGER_E2E_PREBUILT==='1';
if(prebuilt&&!existsSync(join(process.cwd(),'.next','BUILD_ID')))throw new Error('E2E_PREBUILT_BUILD_REQUIRED');

/**
 * The end-to-end server keeps its demo database in the OS temp directory, so a
 * run never writes a database file into the project tree.
 */
const E2E_DATABASE_PATH = join(
  tmpdir(),
  "build-manager-e2e",
  "landlord-demo.sqlite",
);

export default defineConfig({
  testDir: "./tests/e2e",
  // The demo store is shared process state; serial runs keep flows independent.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `${prebuilt?'':'npm run build && '}npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/demo/landlord`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { BUILD_MANAGER_DB_PATH: E2E_DATABASE_PATH, BUILD_MANAGER_MODE: "DEMO" },
  },
});
