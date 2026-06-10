'use client';

import { useRouter } from 'next/navigation';
import type { PerformanceMetrics, MissingItem } from '@/services/api/dashboard-service';

/* Humanise a SCREAMING_SNAKE category into Title Case */
function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const CATEGORY_META: Record<string, { glyph: string; tint: string }> = {
  KYC: { glyph: '🪪', tint: 'bg-cyan-50 text-cyan-600' },
  AML: { glyph: '🛡️', tint: 'bg-blue-50 text-blue-600' },
  DOCUMENTS: { glyph: '📄', tint: 'bg-violet-50 text-violet-600' },
  DOCUMENT: { glyph: '📄', tint: 'bg-violet-50 text-violet-600' },
  CREDIT_CHECK: { glyph: '📊', tint: 'bg-amber-50 text-amber-600' },
  INCOME: { glyph: '💷', tint: 'bg-emerald-50 text-emerald-600' },
  IDENTITY: { glyph: '🪪', tint: 'bg-cyan-50 text-cyan-600' },
};

function metaFor(category: string) {
  const key = Object.keys(CATEGORY_META).find(k => category.toUpperCase().includes(k));
  return key ? CATEGORY_META[key] : { glyph: '📌', tint: 'bg-slate-100 text-slate-500' };
}

function daysAgo(iso: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.max(0, Math.floor(ms / 86400000));
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

  // decline reason breakdown
  const declineSegments = performance
    ? [
        { label: 'Credit risk', value: performance.declinedCreditRisk, color: '#ef4444' },
        { label: 'Fraud', value: performance.declinedFraud, color: '#a855f7' },
        { label: 'Policy', value: performance.declinedPolicy, color: '#f59e0b' },
        { label: 'Incomplete', value: performance.declinedIncomplete, color: '#64748b' },
      ].filter(s => s.value > 0)
    : [];
  const declineTotal = declineSegments.reduce((s, x) => s + x.value, 0);

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up"
      style={{ animationDelay: '250ms' }}
    >
      {/* ─── Performance ─── */}
      {performance && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-soft p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Performance
            </h2>
            <span className="text-[11px] text-slate-400">Rolling average</span>
          </div>

          {/* speed tiles */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Avg to approval',
                value: performance.avgDaysToApproval,
                suffix: 'd',
                accent: 'from-blue-500 to-cyan-500',
              },
              {
                label: 'Median to approval',
                value: performance.medianDaysToApproval,
                suffix: 'd',
                accent: 'from-violet-500 to-purple-500',
              },
              {
                label: 'Approval → booked',
                value: performance.avgDaysApprovalToBooked,
                suffix: 'd',
                accent: 'from-emerald-500 to-teal-500',
              },
            ].map(t => (
              <div key={t.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className={`bg-gradient-to-r ${t.accent} bg-clip-text text-2xl font-bold text-transparent tabular-nums`}>
                  {t.value > 0 ? Math.round(t.value) : '—'}
                  {t.value > 0 && <span className="text-sm">{t.suffix}</span>}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-slate-500">{t.label}</p>
              </div>
            ))}
          </div>

          {/* quality rates */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Rework rate', value: performance.reworkRate, warn: 15 },
              { label: 'Post-approval dropout', value: performance.postApprovalDropoutRate, warn: 10 },
              { label: 'Referral → UW', value: performance.referralToUnderwritingRate, warn: 100 },
            ].map(r => {
              const pct = Math.round(r.value);
              const isWarn = r.value > r.warn;
              return (
                <div key={r.label} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{r.label}</span>
                    <span className={`text-xs font-bold tabular-nums ${isWarn ? 'text-amber-600' : 'text-slate-700'}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${isWarn ? 'bg-amber-400' : 'bg-blue-400'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* decline reasons */}
          {declineTotal > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Decline reasons</span>
                <span className="text-[11px] text-slate-400">{declineTotal} total</span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                {declineSegments.map(s => (
                  <div
                    key={s.label}
                    style={{ width: `${(s.value / declineTotal) * 100}%`, background: s.color }}
                    title={`${s.label}: ${s.value}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {declineSegments.map(s => (
                  <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-slate-500">{s.label}</span>
                    <span className="font-semibold text-slate-700">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Pipeline blockers ─── */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-soft p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Pipeline Blockers
          </h2>
          <span className="text-[11px] text-slate-400">What&apos;s holding things up</span>
        </div>

        {missingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
              <svg className="h-6 w-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Nothing blocked</p>
            <p className="text-xs text-slate-400">Your pipeline is flowing cleanly.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {missingItems.slice(0, 5).map(mi => {
              const meta = metaFor(mi.itemCategory);
              return (
                <div
                  key={mi.itemCategory}
                  className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50/60"
                >
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg ${meta.tint}`}>
                    {meta.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{humanise(mi.itemCategory)}</p>
                    <p className="text-[11px] text-slate-400">
                      {mi.oldestCaseDate ? `Oldest waiting ${daysAgo(mi.oldestCaseDate)}` : 'Awaiting action'}
                      {mi.sampleApplicationNumbers?.length > 0 &&
                        ` · ${mi.sampleApplicationNumbers.slice(0, 2).join(', ')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700 tabular-nums">
                      {mi.applicationCount}
                    </span>
                    <svg className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => router.push('/dashboard/applications')}
              className="mt-1 w-full rounded-xl border border-dashed border-slate-200 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600"
            >
              Resolve in Applications →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
