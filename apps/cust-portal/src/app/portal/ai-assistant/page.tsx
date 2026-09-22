'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import {
  aiCreditJourneyService,
  DEFAULT_INTENT_OPTIONS,
  BORROWER_SEGMENT_OPTIONS,
  ASSET_CATEGORY_OPTIONS,
  requiresBorrowerSegment,
  requiresAssetCategory,
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
  if (value === null || value === undefined || value === '' || value === 'UNKNOWN' || value === 'NOT_APPLICABLE') {
    return '—';
  }
  if (key === 'estimatedCost') {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return '—';
    return formatCurrency(n, facts.currency || 'EUR');
  }
  if (key === 'borrowerSegment') {
    return BORROWER_SEGMENT_OPTIONS.find(o => o.value === value)?.label ?? String(value).replace(/_/g, ' ');
  }
  if (key === 'assetCategory') {
    return ASSET_CATEGORY_OPTIONS.find(o => o.value === value)?.label ?? String(value).replace(/_/g, ' ');
  }
  return String(value).replace(/_/g, ' ');
}

const FACT_LABELS: Record<string, string> = {
  purpose: 'Purpose',
  assetCondition: 'Condition',
  estimatedCost: 'Estimated amount',
  currency: 'Currency',
  targetDate: 'Target date',
  borrowerSegment: 'Borrower type',
  assetCategory: 'Asset / equipment type',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
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
  const [borrowerSegment, setBorrowerSegment] = useState(facts.borrowerSegment || 'UNKNOWN');
  const [assetCategory, setAssetCategory] = useState(facts.assetCategory || 'NOT_APPLICABLE');

  const isPresented = status === 'PRESENTED';
  const isConfirmed = status === 'CONFIRMED';
  const showBorrowerSegment = requiresBorrowerSegment(facts.purpose);
  const showAssetCategory = requiresAssetCategory(facts.purpose);

  function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    onRequestRevision({
      purpose,
      estimatedCost: estimatedCost === '' ? null : parseFloat(estimatedCost),
      currency,
      targetDate: targetDate || null,
      borrowerSegment,
      assetCategory,
    });
    setEditing(false);
  }

  return (
    <div
      className="panel p-5"
      style={
        isConfirmed
          ? { borderColor: 'rgba(16,185,129,0.45)', boxShadow: 'none' }
          : undefined
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="panel-title">
          {isConfirmed ? 'Confirmed credit need' : 'Review your credit need'}
        </h2>
        {isConfirmed && (
          <span className="badge badge-success shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirmed
          </span>
        )}
        {facts.needsClarification && !isConfirmed && (
          <span className="badge badge-warning shrink-0">Needs more info</span>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              'purpose',
              'assetCondition',
              'estimatedCost',
              'targetDate',
              ...(showBorrowerSegment ? (['borrowerSegment'] as const) : []),
              ...(showAssetCategory ? (['assetCategory'] as const) : []),
            ] as const
          ).map(key => (
            <div key={key}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {FACT_LABELS[key]}
              </p>
              <p className="mt-0.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatFactValue(key, (facts as unknown as Record<string, unknown>)[key], facts)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submitRevision} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="review-purpose">
              Purpose code
            </label>
            <input
              id="review-purpose"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-amount">
              Estimated amount
            </label>
            <input
              id="review-amount"
              type="number"
              value={estimatedCost}
              onChange={e => setEstimatedCost(e.target.value)}
              className="input"
              placeholder="e.g. 25000"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-currency">
              Currency
            </label>
            <input
              id="review-currency"
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-target-date">
              Target date
            </label>
            <input
              id="review-target-date"
              type="date"
              value={targetDate ?? ''}
              onChange={e => setTargetDate(e.target.value)}
              className="input"
            />
          </div>
          {showBorrowerSegment && (
            <div>
              <label className="field-label" htmlFor="review-borrower-segment">
                Who is this for?
              </label>
              <select
                id="review-borrower-segment"
                value={borrowerSegment}
                onChange={e => setBorrowerSegment(e.target.value)}
                className="select"
              >
                {BORROWER_SEGMENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showAssetCategory && (
            <div>
              <label className="field-label" htmlFor="review-asset-category">
                Asset or equipment type
              </label>
              <select
                id="review-asset-category"
                value={assetCategory}
                onChange={e => setAssetCategory(e.target.value)}
                className="select"
              >
                {ASSET_CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-primary">
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isPresented && !editing && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 pt-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <button
            onClick={onConfirm}
            disabled={busy || facts.needsClarification}
            title={facts.needsClarification ? 'Answer the question above before confirming' : undefined}
            className="btn btn-primary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirm and continue
          </button>
          <button onClick={() => setEditing(true)} disabled={busy} className="btn btn-secondary">
            Edit details
          </button>
          {facts.needsClarification && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Answer the question above to continue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */

export default function AiAssistantPage() {
  const router = useRouter();
  const [journey, setJourney] = useState<CreditJourney | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notEnabled, setNotEnabled] = useState(false);
  const [intentOptions, setIntentOptions] = useState<IntentOption[]>(DEFAULT_INTENT_OPTIONS);
  const [matchedProducts, setMatchedProducts] = useState<LoanProduct[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [preparingProductId, setPreparingProductId] = useState<string | null>(null);
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
          matchProductsForIntent(
            all,
            review.facts.purpose,
            review.facts.estimatedCost,
            review.facts.borrowerSegment,
            review.facts.assetCategory
          )
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

  async function handleStartApplication(product: LoanProduct) {
    if (!journey || preparingProductId) return;
    setPreparingProductId(product.productId);
    setError(null);
    try {
      const result = await aiCreditJourneyService.prepareApplication(journey.journeyId, product.productId);
      router.push(`/portal/applications/${result.applicationId}`);
    } catch (err) {
      handleApiError(err);
      setPreparingProductId(null);
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
      <div className="mx-auto max-w-2xl">
        <Link
          href="/portal"
          className="mb-4 inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to overview
        </Link>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--brand-on-soft)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h1 className="empty-state-title">The AI assistant isn&apos;t available yet</h1>
          <p className="empty-state-text">
            This preview feature isn&apos;t enabled for your bank yet. You can still apply for a
            product using the standard application flow.
          </p>
          <Link href="/portal/products" className="btn btn-primary mt-5">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="mesh-hero aurora relative overflow-hidden rounded-3xl p-6 text-white shadow-float">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rayva AI credit assistant</h1>
            <p className="mt-1 text-sm text-white/75">
              Tell me what you need credit for, in your own words — I&apos;ll help you get started.
            </p>
          </div>
        </div>
      </div>

      {isUnavailable && (
        <div className="alert alert-warning" role="status">
          <span className="flex-1 text-sm">
            The AI assistant is temporarily unavailable. Choose one of the options below to continue.
          </span>
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          <span className="flex-1 text-sm">{error}</span>
          {draft.trim() && (
            <button onClick={() => handleSend()} className="btn btn-sm btn-outline shrink-0">
              Try again
            </button>
          )}
        </div>
      )}

      {/* Conversation */}
      <div className="panel">
        <div
          ref={scrollRef}
          className="max-h-[420px] min-h-[180px] space-y-4 overflow-y-auto p-5"
          role="region"
          aria-label="Conversation with Rayva AI, scrollable"
          tabIndex={0}
        >
          <div role="log" aria-live="polite" aria-relevant="additions text" className="space-y-4">
            {messages.length === 0 && (
              <div className="py-8 text-center">
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
                    className={`max-w-xs rounded-2xl px-4 py-3 text-base leading-relaxed lg:max-w-md ${
                      mine ? 'rounded-br-sm text-white' : 'rounded-bl-sm'
                    }`}
                    style={
                      mine
                        ? { backgroundColor: 'var(--brand)' }
                        : {
                            backgroundColor: isNotice ? 'rgba(16,185,129,0.14)' : 'var(--surface-input)',
                            color: 'var(--text-primary)',
                          }
                    }
                  >
                    {!mine && (
                      <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
                        {isNotice ? 'Rayva' : 'Rayva AI'}
                      </p>
                    )}
                    {mine && <span className="sr-only">You said: </span>}
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
                  <span className="sr-only">Rayva AI is typing…</span>
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intent option chips */}
        {intentOptions.length > 0 && (!review || review.status !== 'CONFIRMED') && (
          <div
            className="flex flex-wrap gap-2 px-5 pb-4 pt-4"
            style={{ borderTop: '1px solid var(--surface-border)' }}
          >
            <h2 className="sr-only">Suggested options</h2>
            {intentOptions.map(opt => (
              <button
                key={opt.code}
                onClick={() => handleSelectIntent(opt.code)}
                disabled={busy}
                title={opt.description}
                className="chip transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="px-5 py-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <label className="field-label" htmlFor="ai-message">
            Your message
          </label>
          <div className="flex items-center gap-3">
            <input
              id="ai-message"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Describe what you need credit for…"
              disabled={busy}
              autoComplete="off"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send message"
              className="btn btn-primary h-11 w-11 shrink-0 rounded-xl p-0"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
              </svg>
            </button>
          </div>
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
        <div className="space-y-4">
          <h2 className="section-title">Matching products</h2>

          {loadingMatches && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </div>
          )}

          {!loadingMatches && matchedProducts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="empty-state-title">No matching products</p>
              <p className="empty-state-text">
                We couldn&apos;t match this request to a product. You can still browse the full
                catalogue.
              </p>
              <Link href="/portal/products" className="btn btn-secondary btn-sm mt-4">
                Browse all products
              </Link>
            </div>
          )}

          {!loadingMatches && matchedProducts.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {matchedProducts.slice(0, 4).map(p => {
                const fits =
                  review.facts.estimatedCost != null &&
                  review.facts.estimatedCost >= p.minLoanAmount &&
                  review.facts.estimatedCost <= p.maxLoanAmount;
                return (
                  <div key={p.productId} className="panel flex flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {p.productName}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {PRODUCT_TYPE_LABELS[p.productType] || p.productType}
                        </p>
                      </div>
                      {fits && <span className="badge badge-success shrink-0">Matches your amount</span>}
                    </div>
                    <p className="mt-3 text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(p.minLoanAmount)} – {formatCurrency(p.maxLoanAmount)}
                      {' · '}
                      {p.minInterestRate}%–{p.maxInterestRate}% p.a.
                    </p>
                    <button
                      onClick={() => handleStartApplication(p)}
                      disabled={preparingProductId !== null}
                      className="btn btn-primary btn-sm mt-4 self-start"
                    >
                      {preparingProductId === p.productId
                        ? 'Starting your application…'
                        : 'Start this application'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!loadingMatches && matchedProducts.length > 0 && (
            <p className="text-center text-sm">
              <Link
                href="/portal/products"
                className="font-medium transition-colors hover:underline"
                style={{ color: 'var(--brand-on-soft)' }}
              >
                Or browse all products
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
