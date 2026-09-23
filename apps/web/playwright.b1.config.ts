import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/b1-e2e',fullyParallel:false,workers:1,retries:0,forbidOnly:true,
 globalSetup:'./tests/b1-e2e/global-setup.ts',timeout:30000,
 reporter:[['list'],['json',{outputFile:'test-results/b1-results.json'}]],
 use:{baseURL:'http://localhost:3124',...devices['Desktop Chrome'],trace:'off',screenshot:'off',video:'off'},
});
