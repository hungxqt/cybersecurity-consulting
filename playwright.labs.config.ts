import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Use an isolated static preview: the normal dev server may already occupy 4321.
export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: 'http://localhost:4322' },
  webServer: {
    command: 'npm run preview -- --port 4322',
    url: 'http://localhost:4322/en/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
