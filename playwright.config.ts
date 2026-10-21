import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

// Pick the settings file: config/.env.qa by default, or TEST_ENV=<name> for another one.
const env = process.env.TEST_ENV || 'qa';
dotenv.config({ path: `config/.env.${env}` });

export default defineConfig({
  testDir: './tests',
  // Tests reset the app's data, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    video: 'on',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } }],
});
