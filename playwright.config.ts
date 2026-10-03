import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real web export (npm run export:web),
 * served the way GitHub Pages serves it: under /quits/, with 404.html as the
 * fallback for deep links.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173/quits/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs 4173',
    url: 'http://localhost:4173/quits/',
    reuseExistingServer: !process.env.CI,
  },
});
