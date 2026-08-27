import { defineConfig, devices } from '@playwright/test'

const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000'

/**
 * End-to-end config.
 *
 * `webServer` boots BOTH processes, because an e2e run that mocks the API is
 * testing the frontend against a fiction. The point of these tests is the seam
 * between the two — optimistic updates rolling back on a real 409, a real JWT
 * surviving a real page reload.
 *
 * `reuseExistingServer` keeps local runs fast: if you already have `npm run
 * dev:all` up, Playwright attaches to it instead of starting a second pair.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false, // shared database — parallel workers would fight over stock
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    testIdAttribute: 'data-testid',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Uncomment to widen coverage once the suite is stable in CI.
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : [
        {
          command: 'npm --prefix backend run dev',
          url: `${API_URL}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'npm run dev',
          url: WEB_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
})
