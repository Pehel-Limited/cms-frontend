import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for Retail Connects. They run against the real stack (portal, BFF-Customer,
 * account-service, identity, Postgres, ASR and LLM). Fake microphone audio comes from WAV
 * fixtures, so the real Qwen3-ASR and SGLang services are exercised.
 *
 *   E2E_BASE_URL  portal URL (default http://localhost:3001)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
});
