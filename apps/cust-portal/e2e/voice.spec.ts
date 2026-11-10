import { expect, test as plain } from '@playwright/test';
import { authorise, db, login, openRequest, openSend, PASSWORD, speak, test } from './helpers';

test.describe('voice: send to a Connect', () => {
  test.use({ wav: 'send-john-payne.wav' });

  test('speak → review → confirm → password → live ledger booking', async ({ micPage: page }) => {
    await login(page, 'alice.retail');
    await openSend(page);
    await speak(page);

    const review = page.getByTestId('review-card');
    await expect(review).toBeVisible({ timeout: 40_000 });
    await expect(review).toContainText('John Payne');
    await expect(page.getByTestId('review-amount')).toHaveText(/€\s?10\.00/);
    await expect(review).toContainText(/badminton/i);
    await expect(review).toContainText(/sent immediately/i);
    await expect(review).not.toContainText(/sandbox|simulated/i);
    // Nothing is sent by reviewing: the receipt must not exist yet.
    await expect(page.getByTestId('receipt')).toHaveCount(0);

    await page.getByTestId('confirm-draft').click();
    await expect(page.locator('#auth-password')).toBeVisible();

    // Wrong password: stays on the authorise step, no receipt.
    await authorise(page, 'definitely-wrong');
    await expect(page.getByTestId('money-sheet').getByRole('alert')).toContainText(/password|couldn/i);
    await expect(page.getByTestId('receipt')).toHaveCount(0);

    const total = (username: string) =>
      Number(
        db(`select coalesce(sum(b.ledger_balance), 0)
              from credit.account_balance b
              join credit.account_party_role r on r.account_id = b.account_id and r.role = 'OWNER'
              join credit."user" u on u.customer_id = r.party_id
             where u.username = '${username}'`)
      );
    const aliceBefore = total('alice.retail');
    const johnBefore = total('john.payne');

    await authorise(page, PASSWORD);
    const receipt = page.getByTestId('receipt');
    await expect(receipt).toBeVisible();
    await expect(page.getByTestId('receipt-reference')).toHaveText(/^RC-/);
    await expect(receipt).not.toContainText(/sandbox/i);
    await expect(receipt).toContainText('Completed');

    // The money really moved: one OUT and one IN ledger entry, and balances changed by exactly EUR 10.00.
    const ref = (await page.getByTestId('receipt-reference').innerText()).trim();
    expect(db(`select count(*) from credit.account_transaction where end_to_end_id = '${ref}' and status = 'COMPLETED'`)).toBe('2');
    expect(db(`select string_agg(transaction_type::text || ':' || amount, ',' order by transaction_type::text) from credit.account_transaction where end_to_end_id = '${ref}'`)).toBe('TRANSFER_IN:10.00,TRANSFER_OUT:10.00');
    expect(total('alice.retail')).toBeCloseTo(aliceBefore - 10, 2);
    expect(total('john.payne')).toBeCloseTo(johnBefore + 10, 2);
    expect(db(`select count(*) from credit.account_transaction where end_to_end_id = '${ref}' and balance_before - balance_after = 10.00 and not is_credit`)).toBe('1');

    // It shows up in the customer's own transaction history.
    await page.goto('/portal/transactions');
    await expect(page.getByText(/John Payne/).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('voice: request from a Connect', () => {
  test.use({ wav: 'request-john-payne.wav' });

  test('speak → review → send request (no password, no debit)', async ({ micPage: page }) => {
    await login(page, 'alice.retail');
    await openRequest(page);
    await speak(page);

    const review = page.getByTestId('review-card');
    await expect(review).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId('review-amount')).toHaveText(/€\s?15\.00/);
    await expect(review).toContainText('John Payne');
    await expect(review).toContainText(/only sends a request/i);

    await page.getByTestId('send-request').click();
    await expect(page.getByTestId('request-sent')).toBeVisible();
    await expect(page.locator('#auth-password')).toHaveCount(0);

    await page.goto('/portal/payments/requests');
    await page.getByTestId('tab-sent').click();
    await expect(page.getByTestId('request-row').first()).toContainText('John Payne');
  });
});

test.describe('voice: ambiguous recipient', () => {
  test.use({ wav: 'send-ambiguous-john.wav' });

  test('asks who was meant and never guesses', async ({ micPage: page }) => {
    await login(page, 'alice.retail');
    await openSend(page);
    await speak(page);

    const options = page.getByTestId('pick-connect');
    await expect(options.first()).toBeVisible({ timeout: 40_000 });
    expect(await options.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('review-card')).toHaveCount(0);

    await options.filter({ hasText: 'John Parker' }).click();
    await expect(page.getByTestId('review-card')).toContainText('John Parker');
    await expect(page.getByTestId('review-amount')).toHaveText(/€\s?10\.00/);
  });
});

test.describe('voice: prompt injection', () => {
  test.use({ wav: 'injection.wav' });

  test('spoken instructions cannot raise limits or skip review', async ({ micPage: page }) => {
    await login(page, 'alice.retail');
    await openSend(page);
    await speak(page, 7);

    // The amount is over the per-payment limit, so no reviewable payment is created.
    await expect(page.getByTestId('review-card')).toHaveCount(0, { timeout: 40_000 });
    await expect(page.getByRole('note').first()).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId('receipt')).toHaveCount(0);
    await expect(page.locator('#auth-password')).toHaveCount(0);
  });
});

plain.describe('microphone unavailable', () => {
  plain('denied microphone falls back to typing', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
    await login(page, 'alice.retail');
    await openSend(page);
    await page.getByTestId('mic-button').click();
    await expect(page.getByTestId('mic-status')).toContainText(/blocked|type/i);

    await page.locator('#money-text').fill('Send €10 to John Payne for badminton');
    await page.getByTestId('money-sheet').getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('review-card')).toContainText('John Payne', { timeout: 40_000 });
    await expect(page.getByTestId('review-amount')).toHaveText(/€\s?10\.00/);
  });
});
