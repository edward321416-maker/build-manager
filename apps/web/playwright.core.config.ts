import { defineConfig,devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/core-e2e",fullyParallel:false,workers:1,retries:0,
  reporter:[["list"]],
  use:{baseURL:"http://127.0.0.1:3131",...devices["Desktop Chrome"],trace:"off",screenshot:"off",video:"off"},
  webServer:{command:"node --experimental-transform-types ../../scripts/core-flow-dev.mjs --serve",url:"http://127.0.0.1:3131/core",reuseExistingServer:false,timeout:180000,env:{CORE_FLOW_PORT:"3131"}},
});
