import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/postgres/**/*.test.ts"],
    passWithNoTests: false,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
