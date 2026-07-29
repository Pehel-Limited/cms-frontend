'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import {
  aiCreditJourneyService,
  DEFAULT_INTENT_OPTIONS,
  type CreditJourney,
  type CreditNeedFacts,
  type IntentOption,
} from '@/services/api/ai-credit-journey-service';
import {
  productService,
  matchProductsForIntent,
  PRODUCT_TYPE_LABELS,
  type LoanProduct,
} from '@/services/api/product-service';

/* ─── helpers ────────────────────────────────────────────────── */

function formatFactValue(key: string, value: unknown, facts: CreditNeedFacts): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'estimatedCost') {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return '—';
    return formatCurrency(n, facts.currency || 'EUR');
  }
  return String(value).replace(/_/g, ' ');
}

const FACT_LABELS: Record<string, string> = {
  purpose: 'Purpose',
  assetCondition: 'Condition',
  estimatedCost: 'Estimated amount',
  currency: 'Currency',
  targetDate: 'Target date',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-white/10 ${className}`} />;
}

/** Builds an application-wizard link that carries the confirmed credit need
 * (product, amount, purpose, target date) so the customer doesn't have to
 * re-enter details already captured by the AI assistant. */
function buildApplyHref(product: LoanProduct, facts: CreditNeedFacts): string {
  const params = new URLSearchParams({ product: product.productCode });
  if (facts.purpose) params.set('purpose', facts.purpose);
  if (facts.estimatedCost != null) params.set('amount', String(facts.estimatedCost));
  if (facts.targetDate) params.set('targetDate', facts.targetDate);
  return `/portal/applications/new?${params.toString()}`;
}

/* ─── Review / confirmation card ────────────────────────────── */

function ReviewCard({
  facts,
  status,
  onConfirm,
  onRequestRevision,
  busy,
}: {
  facts: CreditNeedFacts;
  status: string;
  onConfirm: () => void;
  onRequestRevision: (updates: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [purpose, setPurpose] = useState(facts.purpose || '');
  const [estimatedCost, setEstimatedCost] = useState(
    facts.estimatedCost != null ? String(facts.estimatedCost) : ''
  );
  const [currency, setCurrency] = useState(facts.currency || 'EUR');
  const [targetDate, setTargetDate] = useState(facts.targetDate || '');

  const isPresented = status === 'PRESENTED';
  const isConfirmed = status === 'CONFIRMED';

  function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    onRequestRevision({
      purpose,
      estimatedCost: estimatedCost === '' ? null : parseFloat(estimatedCost),
      currency,
      targetDate: targetDate || null,
    });
    setEditing(false);
  }

  return (
    <div
      className="rounded-2xl p-5 shadow-sm"
      style={{
        backgroundColor: isConfirmed ? undefined : 'var(--surface-card)',
        border: isConfirmed ? '1px solid rgb(167 243 208)' : '1px solid var(--surface-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isConfirmed ? 'Confirmed credit need' : 'Review your credit need'}
        </h3>
        {isConfirmed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirmed
          </span>
        )}
        {facts.needsClarification && !isConfirmed && (
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            Needs more info
          </span>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['purpose', 'assetCondition', 'estimatedCost', 'targetDate'] as const).map(key => (
            <div key={key}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {FACT_LABELS[key]}
              </p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {formatFactValue(key, (facts as unknown as Record<string, unknown>)[key], facts)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submitRevision} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Purpose code
            </label>
            <input
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Estimated amount
            </label>
            <input
              type="number"
              value={estimatedCost}
              onChange={e => setEstimatedCost(e.target.value)}
              className="input text-sm"
              placeholder="e.g. 25000"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Currency
            </label>
            <input
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Target date
            </label>
            <input
              type="date"
              value={targetDate ?? ''}
              onChange={e => setTargetDate(e.target.value)}
              className="input text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <button type="submit" disabled={busy} className="btn btn-primary text-xs px-4 py-2">
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost text-xs px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isPresented && !editing && (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
          <button
            onClick={onConfirm}
            disabled={busy || facts.needsClarification}
            title={facts.needsClarification ? 'Answer the question above before confirming' : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7f2b7b] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#5e1f5b] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirm &amp; continue
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
            style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}
          >
            Edit details
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */

export default function AiAssistantPage() {
  const [journey, setJourney] = useState<CreditJourney | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notEnabled, setNotEnabled] = useState(false);
  const [intentOptions, setIntentOptions] = useState<IntentOption[]>(DEFAULT_INTENT_OPTIONS);
  const [matchedProducts, setMatchedProducts] = useState<LoanProduct[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [journey?.recentMessages.length]);

  // Once the credit need is confirmed, fetch the bank's products and refine
  // them down to the ones relevant for this purpose/amount instead of
  // showing a generic "browse all products" link.
  useEffect(() => {
    const review = journey?.currentReview;
    if (!review || review.status !== 'CONFIRMED') {
      setMatchedProducts([]);
      return;
    }
    let cancelled = false;
    setLoadingMatches(true);
    productService
      .getProducts()
      .then(all => {
        if (cancelled) return;
        setMatchedProducts(
          matchProductsForIntent(all, review.facts.purpose, review.facts.estimatedCost)
        );
      })
      .catch(() => {
        if (!cancelled) setMatchedProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMatches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [journey?.currentReview?.reviewId, journey?.currentReview?.status]);

  function handleApiError(err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 404) {
      setNotEnabled(true);
    } else {
      setError(e?.message || 'Something went wrong. Please try again.');
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft('');
    try {
      const result = journey
        ? await aiCreditJourneyService.sendMessage(journey.journeyId, text)
        : await aiCreditJourneyService.start(text);
      setJourney(result);
      setIntentOptions(result.intentOptions);
    } catch (err) {
      handleApiError(err);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectIntent(code: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = journey
        ? await aiCreditJourneyService.selectIntent(journey.journeyId, code)
        : await aiCreditJourneyService.start(undefined, code);
      setJourney(result);
      setIntentOptions(result.intentOptions);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!journey?.currentReview || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiCreditJourneyService.confirmReview(
        journey.journeyId,
        journey.currentReview.reviewId
      );
      setJourney(result);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestRevision(updates: Record<string, unknown>) {
    if (!journey?.currentReview || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiCreditJourneyService.requestRevision(
        journey.journeyId,
        journey.currentReview.reviewId,
        updates
      );
      setJourney(result);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  const messages = journey?.recentMessages ?? [];
  const review = journey?.currentReview ?? null;
  const isUnavailable = journey?.status === 'AI_PROVIDER_UNAVAILABLE';

  if (notEnabled) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/portal"
          className="mb-4 inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to overview
        </Link>
        <div
          className="rounded-2xl p-8 text-center shadow-sm"
          style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--surface-input)' }}
          >
            <svg className="h-7 w-7 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Rayva AI Assistant isn&apos;t available yet
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            This preview feature isn&apos;t enabled for your bank yet. You can still apply for a
            product using the standard application flow.
          </p>
          <Link
            href="/portal/products"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5e1f5b]"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="mesh-hero aurora relative overflow-hidden rounded-3xl p-6 text-white shadow-float">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Rayva AI Credit Assistant</h1>
            <p className="text-xs text-white/75 mt-0.5">
              Tell me what you need credit for, in your own words — I&apos;ll help you get started.
            </p>
          </div>
        </div>
      </div>

      {isUnavailable && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          The AI assistant is temporarily unavailable. Please choose one of the options below to continue.
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Conversation */}
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
      >
        <div ref={scrollRef} className="max-h-[420px] min-h-[180px] overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Start by describing what you need credit for, or pick an option below.
              </p>
            </div>
          )}
          {messages.map(msg => {
            const mine = msg.role === 'CUSTOMER';
            const isNotice = msg.role === 'SYSTEM_NOTICE';
            return (
              <div key={msg.messageId} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    mine ? 'rounded-br-sm bg-[#7f2b7b] text-white' : 'rounded-bl-sm'
                  }`}
                  style={
                    !mine
                      ? {
                          backgroundColor: isNotice ? 'rgba(16,185,129,0.1)' : 'var(--surface-input)',
                          color: 'var(--text-primary)',
                        }
                      : undefined
                  }
                >
                  {!mine && (
                    <p className="text-[10px] font-bold mb-1 text-[#7f2b7b] dark:text-purple-300">
                      {isNotice ? 'Rayva' : 'Rayva AI'}
                    </p>
                  )}
                  {msg.content}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-3"
                style={{ backgroundColor: 'var(--surface-input)' }}
              >
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-bounce" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Intent option chips */}
        {intentOptions.length > 0 && (!review || review.status !== 'CONFIRMED') && (
          <div className="px-5 pb-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem' }}>
            {intentOptions.map(opt => (
              <button
                key={opt.code}
                onClick={() => handleSelectIntent(opt.code)}
                disabled={busy}
                title={opt.description}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Describe what you need credit for..."
            disabled={busy}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
            style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: draft.trim() ? '#7f2b7b' : 'var(--surface-input)' }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
            </svg>
          </button>
        </form>
      </div>

      {/* Review card */}
      {review && (
        <ReviewCard
          facts={review.facts}
          status={review.status}
          onConfirm={handleConfirm}
          onRequestRevision={handleRequestRevision}
          busy={busy}
        />
      )}

      {review?.status === 'CONFIRMED' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Matching products for you
          </h3>

          {loadingMatches && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          )}

          {!loadingMatches && matchedProducts.length === 0 && (
            <div
              className="rounded-2xl p-5 text-center text-sm shadow-sm"
              style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}
            >
              We couldn&apos;t find an exact match — browse the full catalogue instead.
            </div>
          )}

          {!loadingMatches && matchedProducts.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matchedProducts.slice(0, 4).map(p => {
                const fits =
                  review.facts.estimatedCost != null &&
                  review.facts.estimatedCost >= p.minLoanAmount &&
                  review.facts.estimatedCost <= p.maxLoanAmount;
                return (
                  <div
                    key={p.productId}
                    className="rounded-2xl p-4 shadow-sm flex flex-col"
                    style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {p.productName}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {PRODUCT_TYPE_LABELS[p.productType] || p.productType}
                        </p>
                      </div>
                      {fits && (
                        <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Best match
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)} &middot;{' '}
                      {p.minInterestRate}%–{p.maxInterestRate}% p.a.
                    </p>
                    <Link
                      href={buildApplyHref(p, review.facts)}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7f2b7b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5e1f5b]"
                    >
                      Apply for {p.productName} →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-center">
            <Link
              href="/portal/products"
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Or browse all products →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
