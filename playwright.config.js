import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  use:{baseURL:'http://localhost:4173',channel:'msedge',headless:true,viewport:{width:1440,height:1100}},
  workers:1,
  reporter:'list',
  webServer:{command:'node server.mjs',url:'http://localhost:4173',reuseExistingServer:true},
});
