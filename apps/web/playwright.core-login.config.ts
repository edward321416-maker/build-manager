import { defineConfig,devices } from "@playwright/test";
export default defineConfig({
 testDir:"./tests/core-login-e2e",fullyParallel:false,workers:1,retries:0,reporter:[["list"]],
 use:{baseURL:"http://localhost:3133",...devices["Desktop Chrome"],trace:"off",screenshot:"off",video:"off"},
 webServer:{command:"node --experimental-transform-types ../../scripts/core-flow-b1-dev.mjs --serve-synthetic-sdk",url:"http://localhost:3133/core",reuseExistingServer:false,timeout:180000},
});
