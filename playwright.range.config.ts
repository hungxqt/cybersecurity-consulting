import { defineConfig } from '@playwright/test';
import config from './playwright.labs.config';
export default defineConfig({
  ...config,
  use: { ...config.use, launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
});
