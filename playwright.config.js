const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    browserName: process.env.PW_BROWSER || 'chromium',
    launchOptions: process.env.PW_BROWSER === 'chromium' || !process.env.PW_BROWSER
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npx --yes http-server . -p 4173 -a 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30000
  },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]]
});
