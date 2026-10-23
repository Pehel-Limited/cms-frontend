'use client';

import { useCallback, useEffect, useState } from 'react';
import { quoteService, type Quote } from '@/services/api/quote-service';

const fmt2 = (n: number) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);

/**
 * Requests a quote from the bank for the figures the customer has entered.
 *
 * Debounced, and superseded responses are discarded so a slow first request cannot
 * overwrite the quote the customer is now looking at. When the service is unreachable
 * the caller says so and offers a retry — a repayment worked out in the browser is not a
 * figure the bank can reproduce, so nothing is estimated in its place.
 */
export function useBankQuote(productCode: string | null, amount: number, termMonths: number) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const usable =
    !!productCode &&
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isInteger(termMonths) &&
    termMonths > 0;

  useEffect(() => {
    if (!usable) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    const handle = window.setTimeout(() => {
      quoteService
        .issue({ productCode: productCode as string, requestedAmount: amount, termMonths })
        .then(issued => {
          if (!cancelled) setQuote(issued);
        })
        .catch(() => {
          if (!cancelled) {
            setQuote(null);
            setQuoteError('We could not get a quote for those figures.');
          }
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [usable, productCode, amount, termMonths, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  return { quote, quoting, quoteError, retry, usable };
}

/** The figures the bank issued, with the rate that produced them and where it came from. */
export function QuoteFigures({ quote }: { quote: Quote }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-tile">
          <p className="stat-label">Monthly payment</p>
          <p className="stat-value">{fmt2(quote.monthlyRepayment)}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Total cost of credit</p>
          <p className="stat-value">{fmt2(quote.costOfCredit)}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Total repayable</p>
          <p className="stat-value">{fmt2(quote.totalRepayable)}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        <div className="flex justify-between gap-4 text-sm">
          <dt style={{ color: 'var(--text-muted)' }}>Interest rate</dt>
          <dd className="font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {quote.calculatedRatePct}%{' '}
            {quote.rateType ? `(${quote.rateType.toLowerCase()})` : ''}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <dt style={{ color: 'var(--text-muted)' }}>Rate source</dt>
          <dd className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            {quote.rateProvenance === 'PRODUCT_RATE_PLAN'
              ? 'a published rate plan'
              : 'the product’s standard rate'}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <dt style={{ color: 'var(--text-muted)' }}>APRC</dt>
          <dd className="font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {quote.aprcAvailable ? `${quote.aprcPct}%` : 'Not published for this product'}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <dt style={{ color: 'var(--text-muted)' }}>Repayments</dt>
          <dd className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            {quote.repaymentFrequency.toLowerCase()} ·{' '}
            {quote.repaymentStructure === 'EQUAL_INSTALMENT'
              ? 'equal amount each time'
              : 'interest each time, balance repaid at the end'}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        Quote {quote.quoteId.slice(0, 8)} is illustrative, not an offer. Based on the rate published
        today, it holds until{' '}
        {new Date(quote.expiresAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        .
      </p>
    </>
  );
}

/**
 * The compact form shown while the customer is partway through the wizard: the headline
 * repayment, and nothing else, so it can sit above the fields that change it.
 */
export function QuoteHeadline({
  quote,
  quoting,
  quoteError,
  onRetry,
}: {
  quote: Quote | null;
  quoting: boolean;
  quoteError: string | null;
  onRetry: () => void;
}) {
  if (quoteError) {
    return (
      <p className="text-sm" role="alert" style={{ color: 'var(--text-secondary)' }}>
        {quoteError}{' '}
        <button type="button" onClick={onRetry} className="link-arrow">
          Try again <span data-arrow aria-hidden="true">→</span>
        </button>
      </p>
    );
  }
  if (quoting && !quote) {
    return (
      <p className="text-sm" role="status" aria-live="polite" style={{ color: 'var(--text-muted)' }}>
        Getting a quote from the bank…
      </p>
    );
  }
  if (!quote) return null;
  return (
    <p className="text-sm" aria-live="polite" style={{ color: 'var(--text-secondary)' }}>
      <span className="sr-only">
        {quoting ? 'Updating your quote. ' : ''}
      </span>
      About{' '}
      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {fmt2(quote.monthlyRepayment)}
      </strong>{' '}
      a month · {fmt2(quote.totalRepayable)} over {quote.termMonths} months
      {quote.aprcAvailable ? ` · APRC ${quote.aprcPct}%` : ''}
      <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
        Illustrative, not an offer. The bank’s own figures, quote{' '}
        {quote.quoteId.slice(0, 8)}.
      </span>
    </p>
  );
}
