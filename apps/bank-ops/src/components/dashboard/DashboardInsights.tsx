'use client';

import { useRouter } from 'next/navigation';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import ChartTooltip from './ChartTooltip';
import type { PerformanceMetrics, MissingItem } from '@/services/api/dashboard-service';

function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

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

const CATEGORY_META: Record<string, { path: string; color: string }> = {
  KYC: { path: IDENTITY_PATH, color: '#06b6d4' },
  IDENTITY: { path: IDENTITY_PATH, color: '#06b6d4' },
  AML: { path: SHIELD_PATH, color: '#3b82f6' },
  DOCUMENTS: { path: DOC_PATH, color: '#8b5cf6' },
  DOCUMENT: { path: DOC_PATH, color: '#8b5cf6' },
  CREDIT_CHECK: { path: CHART_PATH, color: '#f59e0b' },
  CREDIT: { path: CHART_PATH, color: '#f59e0b' },
  INCOME: { path: COIN_PATH, color: '#10b981' },
};

function metaFor(category: string) {
  const key = Object.keys(CATEGORY_META).find(k => category.toUpperCase().includes(k));
  return key ? CATEGORY_META[key] : { path: PIN_PATH, color: '#64748b' };
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
}

export default function DashboardInsights({ performance, missingItems }: Props) {
  const router = useRouter();

  if (!performance && missingItems.length === 0) return null;

  const declineSegments = performance
    ? [
        { label: 'Credit risk', value: performance.declinedCreditRisk ?? 0, color: '#ef4444' },
        { label: 'Fraud', value: performance.declinedFraud ?? 0, color: '#a855f7' },
        { label: 'Policy', value: performance.declinedPolicy ?? 0, color: '#f59e0b' },
        { label: 'Incomplete', value: performance.declinedIncomplete ?? 0, color: '#64748b' },
      ].filter(s => s.value > 0)
    : [];
  const declineTotal = declineSegments.reduce((s, x) => s + x.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Performance ─── */}
      {performance && (
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Performance
          </h2>
          <p className="text-sm mt-1 mb-6" style={{ color: 'var(--rm-text-muted)' }}>
            How quickly deals move, and where they drop out
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'To approval', value: performance.avgDaysToApproval, color: '#0ea5e9' },
              { label: 'Median', value: performance.medianDaysToApproval, color: '#8b5cf6' },
              { label: 'Approve → book', value: performance.avgDaysApprovalToBooked, color: '#10b981' },
            ].map(t => (
              <div key={t.label}>
                <p className="text-3xl font-semibold tracking-tight tabular-nums" style={{ color: t.color }}>
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
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: isWarn ? '#f59e0b' : 'var(--rm-text)' }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'rgba(127,127,127,0.15)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: isWarn ? '#f59e0b' : '#0ea5e9' }}
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
                <div className="relative w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={declineSegments}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="64%"
                        outerRadius="100%"
                        paddingAngle={2}
                        stroke="none"
                        animationDuration={700}
                      >
                        {declineSegments.map(s => (
                          <Cell key={s.label} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip content={p => <ChartTooltip {...p} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xl font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {declineTotal}
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {declineSegments.map(s => (
                    <div key={s.label} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="truncate" style={{ color: 'var(--rm-text-muted)' }}>
                        {s.label}
                      </span>
                      <span className="ml-auto font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
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
      <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          What&apos;s blocking
        </h2>
        <p className="text-sm mt-1 mb-6" style={{ color: 'var(--rm-text-muted)' }}>
          Missing information holding applications up
        </p>

        {missingItems.length === 0 ? (
          <div className="py-10 text-center">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(16,185,129,0.14)' }}
            >
              <svg className="h-6 w-6" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
              const meta = metaFor(mi.itemCategory);
              return (
                <div key={mi.itemCategory} className="flex items-center gap-4">
                  <span
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${meta.color}1f` }}
                  >
                    <svg className="w-5 h-5" style={{ color: meta.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={meta.path} />
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
    </div>
  );
}
