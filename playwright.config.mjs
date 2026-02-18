import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    baseURL: 'http://localhost:5199',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
