'use client';

import Link from 'next/link';
import Glyph from '@/components/ui/Glyph';
import type { Quote } from '@/services/api/quote-service';

const fmt2 = (n: number) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface RailStep {
  key: string;
  label: string;
}

/**
 * The persistent left rail of the application studio: where the customer is,
 * what is still ahead, and the one figure the whole application resolves to.
 * Position is stated, never scored — the ring counts steps, not points.
 */
export function ApplicationRail({
  steps,
  activeIndex,
  onStepClick,
  savedReference,
  productName,
  quote,
  quoting,
  quoteError,
  onRetryQuote,
}: {
  steps: RailStep[];
  activeIndex: number;
  onStepClick: (index: number) => void;
  savedReference?: string | null;
  productName?: string | null;
  quote: Quote | null;
  quoting: boolean;
  quoteError: string | null;
  onRetryQuote: () => void;
}) {
  const position = Math.min(Math.max(activeIndex + 1, 1), steps.length);
  const ringProgress = position / steps.length;

  return (
    <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
      <div className="glass-panel overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href="/portal/applications"
                className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                <span aria-hidden="true">&larr;</span> All applications
              </Link>
              <h2 className="serif mt-2 text-[22px] font-medium leading-tight">
                New application
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Step {position} of {steps.length}
              </p>
            </div>

            <div className="relative h-14 w-14 shrink-0" aria-hidden="true">
              <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--hairline)"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringProgress)}
                  style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {position}/{steps.length}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {savedReference ? (
              <span className="chip !py-1 !text-xs">
                <Glyph name="check" className="h-3.5 w-3.5" strokeWidth={2} />
                Draft saved
              </span>
            ) : (
              <span className="chip !py-1 !text-xs">Draft not saved yet</span>
            )}
            {productName && (
              <span className="chip max-w-full !py-1 !text-xs">
                <span className="truncate">{productName}</span>
              </span>
            )}
          </div>

          <ol className="mt-5">
            {steps.map((step, i) => {
              const isActive = i === activeIndex;
              const isComplete = i < activeIndex;
              return (
                <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px"
                      style={{
                        backgroundColor: isComplete ? 'var(--brand)' : 'var(--hairline-strong)',
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => isComplete && onStepClick(i)}
                    disabled={!isComplete && !isActive}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Step ${i + 1} of ${steps.length}: ${step.label}${
                      isComplete ? ' (completed)' : isActive ? ' (current step)' : ' (not reached yet)'
                    }`}
                    className="group relative z-10 flex flex-1 items-start gap-3 text-left disabled:cursor-default"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors"
                      style={
                        isActive
                          ? {
                              borderColor: 'var(--brand)',
                              backgroundColor: 'var(--brand)',
                              color: '#fff',
                              boxShadow: '0 6px 14px -8px rgba(69,32,75,.9)',
                            }
                          : isComplete
                            ? {
                                borderColor: 'var(--brand)',
                                backgroundColor: 'var(--brand-soft)',
                                color: 'var(--brand-on-soft)',
                              }
                            : {
                                borderColor: 'var(--hairline-strong)',
                                color: 'var(--text-muted)',
                                backgroundColor: 'transparent',
                              }
                      }
                      aria-hidden="true"
                    >
                      {isComplete ? <Glyph name="check" className="h-3.5 w-3.5" strokeWidth={2.4} /> : i + 1}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span
                        className="block text-sm leading-5"
                        style={{
                          color: isActive
                            ? 'var(--text-primary)'
                            : isComplete
                              ? 'var(--text-secondary)'
                              : 'var(--text-muted)',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="mt-0.5 block text-[11px] font-medium" style={{ color: 'var(--brand-on-soft)' }}>
                          You are here
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div
        className="mt-4 overflow-hidden rounded-[28px] p-5 text-white"
        style={{
          background: 'var(--tile-active)',
          boxShadow: 'var(--tile-active-shadow)',
        }}
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Indicative repayment
        </p>

        {quote ? (
          <>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[30px] font-bold leading-none tracking-tight tabular-nums">
                {fmt2(quote.monthlyRepayment)}
              </span>
              <span className="text-xs font-medium text-white/60">/ month</span>
            </p>
            <p className="mt-2 text-xs text-white/70">
              {fmt2(quote.totalRepayable)} over {quote.termMonths} months
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                {quote.aprcAvailable ? `APRC ${quote.aprcPct}%` : 'APRC not published'}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                {quote.calculatedRatePct}% rate
              </span>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-white/50">
              Illustrative, not an offer. Quote {quote.quoteId.slice(0, 8)}, issued by the bank
              today.
            </p>
          </>
        ) : quoteError ? (
          <>
            <p className="mt-2 text-sm text-white/80">{quoteError}</p>
            <button
              type="button"
              onClick={onRetryQuote}
              className="mt-3 text-xs font-semibold text-white underline underline-offset-4"
            >
              Try again
            </button>
          </>
        ) : quoting ? (
          <p className="mt-2 text-sm text-white/70">Getting your quote from the bank…</p>
        ) : (
          <p className="mt-2 text-sm leading-5 text-white/70">
            {productName
              ? 'Enter an amount and term to see the bank’s quote.'
              : 'Your repayment appears here once you choose a product.'}
          </p>
        )}
      </div>
    </aside>
  );
}

/** The phone equivalent: position as segments, with the live figure kept close. */
export function ApplicationMobileProgress({
  steps,
  activeIndex,
  quote,
  quoting,
}: {
  steps: RailStep[];
  activeIndex: number;
  quote: Quote | null;
  quoting: boolean;
}) {
  const position = Math.min(Math.max(activeIndex + 1, 1), steps.length);
  return (
    <div className="glass-panel mb-4 p-4 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
          Step {position} of {steps.length}
        </p>
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {steps[activeIndex]?.label}
        </p>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {steps.map((step, i) => (
          <span
            key={step.key}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor: i <= activeIndex ? 'var(--brand)' : 'var(--hairline-strong)',
            }}
          />
        ))}
      </div>
      {quote && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Indicative repayment
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {fmt2(quote.monthlyRepayment)}/mo
          </span>
        </div>
      )}
      {quoting && !quote && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Getting your quote…
        </p>
      )}
    </div>
  );
}
