import config from '@/config';

/**
 * Resolve the bank's currency & locale from the logged-in user stored in
 * localStorage.  Falls back to env-driven defaults from config.
 */
function getUserCurrencyDefaults(): { currency: string; locale: string } {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(config.auth.userKey);
      if (raw) {
        const user = JSON.parse(raw);
        return {
          currency: user.currency || config.bank.defaultCurrency,
          locale: user.locale || config.bank.defaultLocale,
        };
      }
    } catch {
      // Ignore parse errors — fall through to defaults
    }
  }
  return {
    currency: config.bank.defaultCurrency,
    locale: config.bank.defaultLocale,
  };
}

/**
 * Format a number as currency.
 *
 * Resolution order:
 *  1. Explicit overrides passed by the caller
 *  2. Logged-in user's bank settings (from localStorage)
 *  3. Env-driven defaults from config (USD / en-US)
 */
export function formatCurrency(amount: number, currency?: string, locale?: string): string {
  const defaults = getUserCurrencyDefaults();
  return new Intl.NumberFormat(locale || defaults.locale, {
    style: 'currency',
    currency: currency || defaults.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get the currency symbol for the bank's configured currency.
 * Uses Intl to resolve the symbol (e.g. EUR → €, USD → $, GBP → £).
 */
export function getCurrencySymbol(currency?: string): string {
  const defaults = getUserCurrencyDefaults();
  const parts = new Intl.NumberFormat(defaults.locale, {
    style: 'currency',
    currency: currency || defaults.currency,
  }).formatToParts(0);
  return parts.find(p => p.type === 'currency')?.value || defaults.currency;
}

/**
 * Format a loan amount range string using the bank's configured currency.
 */
export function formatLoanAmountRange(minAmount: number, maxAmount?: number): string {
  if (maxAmount && minAmount !== maxAmount) {
    return `${formatCurrency(minAmount)} – ${formatCurrency(maxAmount)}`;
  }
  return formatCurrency(minAmount);
}
