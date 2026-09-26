import { defineConfig, devices } from '@playwright/test';

const hasAuthCredentials =
  Boolean(process.env.E2E_CLERK_USER_USERNAME?.trim()) &&
  Boolean(process.env.E2E_CLERK_USER_PASSWORD?.trim());

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    ...(hasAuthCredentials
      ? [
          {
            name: 'setup',
            testMatch: /global\.setup\.ts/,
          },
          {
            name: 'signed-in',
            use: {
              ...devices['Desktop Chrome'],
              storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
            testMatch: /signed-in\.spec\.ts/,
          },
        ]
      : []),
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/global\.setup\.ts/, /signed-in\.spec\.ts/],
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run start',
        port: 3000,
        timeout: 120_000,
        reuseExistingServer: false,
      }
    : undefined,
});
