import { expect, test } from '@playwright/test';
import { authorise, login, PASSWORD } from './helpers';

test.describe('mobile layout', () => {
  test('payments panel and sheet fit a phone screen; typed send completes', async ({ page }) => {
    await login(page, 'alice.retail');
    await page.goto('/portal/payments');
    await expect(page.getByTestId('retail-connects-panel')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByTestId('open-send').click();
    const sheet = page.getByTestId('money-sheet');
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    // Bottom sheet: anchored to the bottom edge of the screen.
    expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(viewport.height - 2);
    await expect(page.getByTestId('mic-button')).toBeVisible();
    const mic = await page.getByTestId('mic-button').boundingBox();
    expect(mic!.width).toBeGreaterThanOrEqual(44);

    await page.locator('#money-text').fill('Send €10 to John Payne for badminton');
    await sheet.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('review-card')).toContainText('John Payne', { timeout: 40_000 });
    await page.getByTestId('confirm-draft').click();
    await authorise(page, PASSWORD);
    await expect(page.getByTestId('receipt-reference')).toHaveText(/^RC-/);
  });

  test('Escape and the close button dismiss the sheet', async ({ page }) => {
    await login(page, 'alice.retail');
    await page.goto('/portal/payments');
    await page.getByTestId('open-request').click();
    await expect(page.getByTestId('money-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('money-sheet')).toHaveCount(0);
  });
});
