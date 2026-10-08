'use client';

import { useRouter } from 'next/navigation';
import { DottedRing, rampTone } from '@/components/dashboard/DotMatrix';
import type { PerformanceMetrics, MissingItem } from '@/services/api/dashboard-service';

function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* Outline paths only, and no per-category hue: an icon tile identifies *what*
   kind of thing is missing, not how urgent it is, so it stays monochrome and
   inherits whatever colour the surrounding text carries. */
const IDENTITY_PATH = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
const SHIELD_PATH =
  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z';
const DOC_PATH =
  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
const CHART_PATH =
  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
const COIN_PATH =
  'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const PIN_PATH =
  'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z';

const CATEGORY_PATHS: Record<string, string> = {
  KYC: IDENTITY_PATH,
  IDENTITY: IDENTITY_PATH,
  AML: SHIELD_PATH,
  DOCUMENTS: DOC_PATH,
  DOCUMENT: DOC_PATH,
  CREDIT_CHECK: CHART_PATH,
  CREDIT: CHART_PATH,
  INCOME: COIN_PATH,
};

function pathFor(category: string): string {
  const key = Object.keys(CATEGORY_PATHS).find(k => category.toUpperCase().includes(k));
  return key ? CATEGORY_PATHS[key] : PIN_PATH;
}

function daysAgo(iso: string): string {
  if (!iso) return '';
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (d === 0) return 'today';
  if (d === 1) return '1 day';
  return `${d} days`;
}

interface Props {
  performance: PerformanceMetrics | null;
  missingItems: MissingItem[];
  /** The RM dashboard moved these into its action band; admin still shows them here. */
  showBlockers?: boolean;
}

export default function DashboardInsights({ performance, missingItems, showBlockers = true }: Props) {
  const router = useRouter();

  if (!performance && (missingItems.length === 0 || !showBlockers)) return null;

  /* Reasons for decline are nominal, so they take a plum ramp rather than four
     unrelated hues — the ramp is the same encoding the customer portal uses for
     any part-of-whole split. */
  const declineSegments = performance
    ? [
        { label: 'Credit risk', value: performance.declinedCreditRisk ?? 0 },
        { label: 'Fraud', value: performance.declinedFraud ?? 0 },
        { label: 'Policy', value: performance.declinedPolicy ?? 0 },
        { label: 'Incomplete', value: performance.declinedIncomplete ?? 0 },
      ]
        .filter(s => s.value > 0)
        .map((s, i, all) => ({ ...s, opacity: rampTone(i, all.length) }))
    : [];
  const declineTotal = declineSegments.reduce((s, x) => s + x.value, 0);

  return (
    <div className={`grid grid-cols-1 gap-6 ${showBlockers ? 'lg:grid-cols-2' : ''}`}>
      {/* ─── Performance ─── */}
      {performance && (
        <section className="rm-panel p-6 sm:p-7">
          <h2 className="rm-title">
            Performance
          </h2>
          <p className="text-sm mt-1 mb-6" style={{ color: 'var(--rm-text-muted)' }}>
            How quickly deals move, and where they drop out
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'To approval', value: performance.avgDaysToApproval },
              { label: 'Median', value: performance.medianDaysToApproval },
              { label: 'Approve → book', value: performance.avgDaysApprovalToBooked },
            ].map(t => (
              <div key={t.label}>
                <p className="num text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                  {t.value > 0 ? Math.round(t.value) : '—'}
                  {t.value > 0 && <span className="text-base font-medium">d</span>}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
                  {t.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {[
              { label: 'Rework rate', value: performance.reworkRate, warn: 15 },
              { label: 'Post-approval dropout', value: performance.postApprovalDropoutRate, warn: 10 },
              { label: 'Referred to underwriting', value: performance.referralToUnderwritingRate, warn: 100 },
            ].map(r => {
              const pct = Math.round(r.value ?? 0);
              const isWarn = (r.value ?? 0) > r.warn;
              return (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {r.label}
                    </span>
                    <span
                      className="num text-sm font-semibold"
                      style={{ color: isWarn ? 'var(--rm-warn)' : 'var(--rm-text)' }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--rm-hairline-strong)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: isWarn ? 'var(--rm-warn)' : 'var(--rm-brand)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {declineTotal > 0 && (
            <div className="mt-7 pt-6" style={{ borderTop: '1px solid var(--rm-border)' }}>
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--rm-text-secondary)' }}>
                Why deals were declined
              </p>
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <DottedRing
                    segments={declineSegments.map(s => ({ value: s.value, opacity: s.opacity }))}
                    size={112}
                    dots={52}
                    label={`${declineTotal} declined: ${declineSegments
                      .map(s => `${s.label} ${s.value}`)
                      .join(', ')}`}
                  >
                    <span className="num text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
                      {declineTotal}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>
                      declined
                    </span>
                  </DottedRing>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {declineSegments.map(s => (
                    <div key={s.label} className="flex items-center gap-2.5 text-sm">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--rm-brand)', opacity: s.opacity }}
                      />
                      <span className="truncate" style={{ color: 'var(--rm-text-muted)' }}>
                        {s.label}
                      </span>
                      <span className="num ml-auto font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── Blockers ─── */}
      {showBlockers && (
      <section className="rm-panel p-6 sm:p-7">
        <h2 className="rm-title">
          What&apos;s blocking
        </h2>
        <p className="text-sm mt-1 mb-6" style={{ color: 'var(--rm-text-muted)' }}>
          Missing information holding applications up
        </p>

        {missingItems.length === 0 ? (
          <div className="py-10 text-center">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--rm-brand-soft)' }}
            >
              <svg className="h-6 w-6" style={{ color: 'var(--rm-up)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
              Nothing blocked
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              Your pipeline is flowing cleanly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {missingItems.slice(0, 5).map(mi => {
              return (
                <div key={mi.itemCategory} className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: 'var(--rm-glass)',
                      border: '1px solid var(--rm-hairline)',
                      color: 'var(--rm-text-secondary)',
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={pathFor(mi.itemCategory)} />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium truncate" style={{ color: 'var(--rm-text)' }}>
                      {humanise(mi.itemCategory)}
                    </p>
                    <p className="text-sm truncate" style={{ color: 'var(--rm-text-muted)' }}>
                      {mi.oldestCaseDate ? `Oldest waiting ${daysAgo(mi.oldestCaseDate)}` : 'Awaiting action'}
                      {mi.sampleApplicationNumbers?.length > 0 &&
                        ` · ${mi.sampleApplicationNumbers.slice(0, 2).join(', ')}`}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums"
                    style={{ backgroundColor: 'rgba(127,127,127,0.12)', color: 'var(--rm-text)' }}
                  >
                    {mi.applicationCount}
                  </span>
                </div>
              );
            })}
            <button
              onClick={() => router.push('/dashboard/applications')}
              className="mt-2 w-full rounded-full py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(127,127,127,0.10)', color: 'var(--rm-text)' }}
            >
              Resolve in applications
            </button>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
