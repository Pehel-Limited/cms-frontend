import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium, expect, test as base, type Page } from '@playwright/test';

export const PASSWORD = 'Passw0rd@';

/** Runs one SQL statement against the local dev database and returns the trimmed output. */
export function db(sql: string): string {
  return execFileSync('psql', ['-h', 'localhost', '-U', 'postgres', '-d', 'postgres', '-Atc', sql], {
    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD ?? 'admin' },
  })
    .toString()
    .trim();
}

export function audio(name: string): string {
  return path.resolve(__dirname, 'fixtures/audio', name);
}

/**
 * A page whose microphone plays the WAV fixture selected with `test.use({ wav })`. Fake-audio
 * capture is a browser launch flag, so each test launches its own Chromium.
 */
export const test = base.extend<{ wav: string; micPage: Page }>({
  wav: ['send-john-payne.wav', { option: true }],
  micPage: async ({ wav, baseURL }, use) => {
    const browser = await chromium.launch({
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audio(wav)}%noloop`,
      ],
    });
    const context = await browser.newContext({ baseURL, permissions: ['microphone'] });
    await use(await context.newPage());
    await browser.close();
  },
});

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto('/portal/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 30_000 });
}

export async function openSend(page: Page) {
  await page.goto('/portal/payments');
  await page.getByTestId('open-send').click();
  await expect(page.getByTestId('money-sheet')).toBeVisible();
}

export async function openRequest(page: Page) {
  await page.goto('/portal/payments');
  await page.getByTestId('open-request').click();
  await expect(page.getByTestId('money-sheet')).toBeVisible();
}

/** Taps the mic, lets the fixture play, then taps again to finish. */
export async function speak(page: Page, seconds = 4.5) {
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('mic-status')).toContainText('Listening');
  await page.waitForTimeout(seconds * 1000);
  await page.getByTestId('mic-button').click();
}

export async function authorise(page: Page, password: string) {
  await page.locator('#auth-password').fill(password);
  await page.getByTestId('authorise-payment').click();
}
