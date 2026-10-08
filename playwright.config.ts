import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    env: { PUBLIC_FORMSPREE_ID: 'testform' },
    url: 'http://localhost:4321/en/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
