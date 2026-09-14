import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3123;

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
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/demo/landlord`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { BUILD_MANAGER_DB_PATH: E2E_DATABASE_PATH },
  },
});
