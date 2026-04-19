const { defineConfig } = require('@playwright/test');
const path = require('path');

const nodePath = 'C:\\Program Files\\nodejs\\node.exe';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3333',
    headless: true,
  },
  webServer: {
    command: `"${nodePath}" serve.js`,
    port: 3333,
    reuseExistingServer: true,
    cwd: __dirname,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
