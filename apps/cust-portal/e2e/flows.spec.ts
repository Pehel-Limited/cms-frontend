import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { authorise, db, login, openRequest, openSend, PASSWORD } from './helpers';

const SCRIPT = path.resolve(__dirname, '../../../../cms-backend/database/seed-retail-connects-demo.sh');
const psql = (sql: string) =>
  execFileSync('psql', ['-h', 'localhost', '-U', 'postgres', '-d', 'postgres', '-Atc', sql], {
    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD ?? 'admin' },
  })
    .toString()
    .trim();

const COUNTS_SQL = `select
  (select count(*) from credit."user" where email like '%@example.invalid'),
  (select count(*) from credit.customer where primary_email like '%@example.invalid'),
  (select count(*) from credit.registered_payee)`;

test.describe('Connects', () => {
  test('lists a person once with both sources, masked, and external payees are not sendable', async ({ page }) => {
    await login(page, 'alice.retail');
    await page.goto('/portal/payments/connects');
    await expect(page.getByTestId('connect-row').first()).toBeVisible();

    const johnPayne = page.getByTestId('connect-row').filter({ hasText: 'John Payne' });
    await expect(johnPayne).toHaveCount(1);
    await expect(johnPayne).toContainText('Saved payee');
    await expect(johnPayne).toContainText('Paid before');
    // Full IBANs and phone numbers are never rendered.
    await expect(page.locator('body')).not.toContainText(/[A-Z]{2}\d{2}[A-Z0-9]{10,}/);

    const external = page.getByTestId('connect-row').filter({ hasText: 'Unverified External John' });
    await expect(external.getByRole('button', { name: /^Send to/ })).toBeDisabled();
    await expect(external).toContainText(/not|external|verified/i);

    await page.locator('#connect-search').fill('jane');
    await expect(page.getByTestId('connect-row')).toHaveCount(1);
    await expect(page.getByTestId('connect-row')).toContainText('Jane Blake');
  });

  test('another bank’s customer sees none of alice’s Connects (tenant isolation)', async ({ request }) => {
    const api = process.env.E2E_API_URL ?? 'http://localhost:8087';
    const loginRes = await request.post(`${api}/api/customer/auth/login`, {
      data: { username: 'tara.otherbank', password: PASSWORD, bankCode: 'SBXRC-B' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = await loginRes.json();
    const res = await request.get(`${api}/api/customer/connects`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('John Payne');
    expect(body).not.toContain('Jane Blake');
  });

  test('send from a Connect with the form (no voice)', async ({ page }) => {
    await login(page, 'alice.retail');
    await page.goto('/portal/payments/connects');
    await page.getByRole('button', { name: 'Send to Jane Blake' }).click();
    await page.locator('#form-amount').fill('12.50');
    await page.locator('#form-purpose').fill('Lunch');
    await page.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByTestId('review-amount')).toHaveText(/€\s?12\.50/);
    await page.getByTestId('confirm-draft').click();
    await authorise(page, PASSWORD);
    await expect(page.getByTestId('receipt-reference')).toHaveText(/^RC-/);
  });

  test('typed send: invalid input is rejected before anything is created', async ({ page }) => {
    await login(page, 'alice.retail');
    await openSend(page);
    await page.locator('#money-text').fill('Send €99999 to John Payne for a car');
    await page.getByTestId('money-sheet').getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('money-sheet').getByRole('note')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId('review-card')).toHaveCount(0);
  });
});

test.describe('Request money end to end', () => {
  test('requester asks, recipient sees it, pays it with locked terms', async ({ browser }) => {
    const alice = await (await browser.newContext()).newPage();
    await login(alice, 'alice.retail');
    await openRequest(alice);
    await alice.locator('#money-text').fill('Request €15 from John Payne for badminton');
    await alice.getByTestId('money-sheet').getByRole('button', { name: 'Continue' }).click();
    await expect(alice.getByTestId('review-amount')).toHaveText(/€\s?15\.00/, { timeout: 40_000 });
    await alice.getByTestId('send-request').click();
    await expect(alice.getByTestId('request-sent')).toBeVisible();

    const john = await (await browser.newContext()).newPage();
    await login(john, 'john.payne');
    await john.goto('/portal/payments/requests');
    const row = john.getByTestId('request-row').filter({ hasText: 'badminton' }).first();
    await expect(row).toContainText('Alice');
    await row.getByRole('button', { name: 'Pay' }).click();

    // The request fixes amount and reason: the amount cannot be edited.
    await expect(john.getByTestId('review-amount')).toHaveText(/€\s?15\.00/);
    await expect(john.getByRole('button', { name: 'Change amount' })).toHaveCount(0);
    await john.getByTestId('confirm-draft').click();
    await authorise(john, PASSWORD);
    await expect(john.getByTestId('receipt-reference')).toHaveText(/^RC-/);
    const ref = (await john.getByTestId('receipt-reference').innerText()).trim();
    // John's account is debited and Alice's credited by exactly the requested EUR 15.00.
    expect(
      db(`select string_agg(u.username || ':' || t.transaction_type || ':' || t.amount, ',' order by u.username)
            from credit.account_transaction t
            join credit.account_party_role r on r.account_id = t.account_id and r.role = 'OWNER'
            join credit."user" u on u.customer_id = r.party_id
           where t.end_to_end_id = '${ref}'`)
    ).toBe('alice.retail:TRANSFER_IN:15.00,john.payne:TRANSFER_OUT:15.00');
    await john.getByRole('button', { name: 'Done' }).click();

    await alice.goto('/portal/payments/requests');
    await alice.getByTestId('tab-sent').click();
    await expect(alice.getByTestId('request-row').filter({ hasText: 'badminton' }).first()).toContainText(/Paid/);
  });

  test('recipient can decline a request', async ({ browser }) => {
    const alice = await (await browser.newContext()).newPage();
    await login(alice, 'alice.retail');
    await alice.goto('/portal/payments/connects');
    await alice.getByRole('button', { name: 'Request from Jane Blake' }).click();
    await alice.locator('#form-amount').fill('7');
    await alice.locator('#form-purpose').fill('Decline test');
    await alice.getByRole('button', { name: 'Review' }).click();
    await alice.getByTestId('send-request').click();
    await expect(alice.getByTestId('request-sent')).toBeVisible();

    const jane = await (await browser.newContext()).newPage();
    await login(jane, 'jane.blake');
    await jane.goto('/portal/payments/requests');
    const row = jane.getByTestId('request-row').filter({ hasText: 'Decline test' });
    await row.getByRole('button', { name: 'Decline' }).click();
    await expect(row.getByTestId('request-status')).toHaveText('Declined');
  });
});

test.describe('Eligibility', () => {
  test('a business customer gets no Connects entry points', async ({ page }) => {
    await login(page, 'biz.test');
    await page.goto('/portal/payments');
    await expect(page.getByText('Payments & transfers')).toBeVisible();
    await expect(page.getByTestId('retail-connects-panel')).toHaveCount(0);

    await page.goto('/portal/payments/connects');
    await expect(page.getByTestId('not-eligible')).toBeVisible();
  });
});

test.describe('Entry points', () => {
  test('personal customer sees voice Send/Request on the Overview and on Payments', async ({ page }) => {
    await login(page, 'alice.retail');
    await page.goto('/portal');
    await expect(page.getByTestId('retail-connects-panel')).toBeVisible();
    await expect(page.getByTestId('open-send')).toBeVisible();
    await page.goto('/portal/payments');
    await expect(page.getByTestId('retail-connects-panel')).toBeVisible();
  });

  test('switching from a business login to a personal login in one tab does not reuse the old answer', async ({ page }) => {
    await login(page, 'biz.test');
    await page.goto('/portal');
    await expect(page.getByText('Overview').first()).toBeVisible();
    await expect(page.getByTestId('retail-connects-panel')).toHaveCount(0);
    await page.evaluate(() => localStorage.clear());
    await login(page, 'alice.retail');
    await page.goto('/portal');
    await expect(page.getByTestId('retail-connects-panel')).toBeVisible();
  });
});

test.describe('Seeding', () => {
  test('running the seed twice changes nothing; reset is clean; production is refused', async () => {
    const before = psql(COUNTS_SQL);
    execFileSync('bash', [SCRIPT], { env: { ...process.env, APP_ENV: 'local' }, stdio: 'pipe' });
    execFileSync('bash', [SCRIPT], { env: { ...process.env, APP_ENV: 'local' }, stdio: 'pipe' });
    expect(psql(COUNTS_SQL)).toBe(before);

    let refused = 0;
    try {
      execFileSync('bash', [SCRIPT], { env: { ...process.env, APP_ENV: 'production' }, stdio: 'pipe' });
    } catch (err) {
      refused = (err as { status: number }).status;
    }
    expect(refused).toBe(2);
    expect(psql(COUNTS_SQL)).toBe(before);
  });
});
