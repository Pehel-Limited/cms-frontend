'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import type { WorklistItem } from '@/services/api/dashboard-service';

/* Humanise a SCREAMING_SNAKE next-action / status into Title Case */
function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const ACTION_LABELS: Record<string, string> = {
  COMPLETE_KYC: 'Complete KYC',
  COLLECT_DOCUMENTS: 'Collect Documents',
  REVIEW_DOCUMENTS: 'Review Documents',
  RUN_CREDIT_CHECK: 'Run Credit Check',
  ASSIGN_UNDERWRITER: 'Assign Underwriter',
  MAKE_DECISION: 'Make Decision',
  GENERATE_OFFER: 'Generate Offer',
  SEND_OFFER: 'Send Offer',
  BOOK_FACILITY: 'Book Facility',
  DISBURSE_FUNDS: 'Disburse Funds',
};

function actionLabel(item: WorklistItem): string {
  if (item.nextAction && ACTION_LABELS[item.nextAction]) return ACTION_LABELS[item.nextAction];
  if (item.nextAction) return humanise(item.nextAction);
  return 'Review';
}

type Urgency = {
  rank: number; // higher = more urgent
  label: string;
  badge: string; // tailwind classes for the ribbon
  glow: string; // ring/shadow accent
  bar: string; // accent strip color
};

function urgencyOf(item: WorklistItem): Urgency {
  if (item.slaBreachDays !== null && item.slaBreachDays > 0)
    return {
      rank: 1000 + item.slaBreachDays,
      label: `SLA breached · +${item.slaBreachDays}d`,
      badge: 'bg-red-500/15 text-red-200 ring-red-400/30',
      glow: 'ring-red-400/30',
      bar: 'bg-gradient-to-b from-red-400 to-rose-500',
    };
  if (item.daysInCurrentStage > 7)
    return {
      rank: 500 + item.daysInCurrentStage,
      label: `Overdue · ${item.daysInCurrentStage}d in stage`,
      badge: 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
      glow: 'ring-amber-300/25',
      bar: 'bg-gradient-to-b from-amber-300 to-orange-400',
    };
  if (item.priorityScore >= 70)
    return {
      rank: 200 + item.priorityScore,
      label: 'High priority',
      badge: 'bg-violet-400/15 text-violet-200 ring-violet-300/30',
      glow: 'ring-violet-300/25',
      bar: 'bg-gradient-to-b from-violet-300 to-fuchsia-400',
    };
  return {
    rank: item.priorityScore,
    label: `${item.daysInCurrentStage}d in stage`,
    badge: 'bg-cyan-400/15 text-cyan-100 ring-cyan-300/25',
    glow: 'ring-white/10',
    bar: 'bg-gradient-to-b from-cyan-300 to-blue-400',
  };
}

interface Props {
  items: WorklistItem[];
  onCompleteKyc: (applicationId: string) => void;
  kycLoadingId: string | null;
}

export default function PriorityFocus({ items, onCompleteKyc, kycLoadingId }: Props) {
  const router = useRouter();

  const focus = useMemo(() => {
    return [...items]
      .map(item => ({ item, urgency: urgencyOf(item) }))
      .sort((a, b) => b.urgency.rank - a.urgency.rank)
      .slice(0, 3);
  }, [items]);

  const breachedCount = useMemo(
    () => items.filter(i => i.slaBreachDays !== null && i.slaBreachDays > 0).length,
    [items]
  );

  if (focus.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1628] via-[#132952] to-[#1d2f63] p-5 sm:p-6 shadow-xl animate-slide-up">
      {/* decorative glow */}
      <div className="absolute -top-16 right-10 w-56 h-56 bg-cyan-400/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 text-[#0a1628] shadow-lg">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L4.5 12.5h6L9 22l9-12h-6z" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-semibold text-white leading-tight">Today&apos;s Focus</h2>
              <p className="text-[11px] text-blue-200/70">
                Smart-ranked by SLA, priority &amp; time-in-stage
              </p>
            </div>
          </div>
          {breachedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200 ring-1 ring-red-400/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
              </span>
              {breachedCount} breaching SLA
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {focus.map(({ item, urgency }, idx) => {
            const isKyc = item.status === 'PENDING_KYC' || item.nextAction === 'COMPLETE_KYC';
            const docTotal = item.documentsRequiredCount || 0;
            const docDone = item.documentsSubmittedCount || 0;
            const docPct = docTotal > 0 ? Math.min(100, Math.round((docDone / docTotal) * 100)) : 0;

            return (
              <div
                key={item.applicationId}
                onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-white/[0.06] p-4 ring-1 ${urgency.glow} backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.1] hover:-translate-y-0.5`}
              >
                {/* priority rank chip */}
                <span className="absolute right-3 top-3 text-[10px] font-bold text-white/30">
                  #{idx + 1}
                </span>
                {/* accent strip */}
                <span className={`absolute left-0 top-0 h-full w-1 ${urgency.bar}`} />

                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${urgency.badge}`}>
                  {urgency.label}
                </span>

                <div className="mt-2.5">
                  <p className="text-sm font-semibold text-white truncate">{item.customerName}</p>
                  <p className="text-[11px] text-blue-200/60">
                    {item.applicationNumber} · {item.productName}
                  </p>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-blue-200/50">Amount</p>
                    <p className="text-lg font-bold text-white tabular-nums">
                      {formatCurrency(item.requestedAmount)}
                    </p>
                  </div>
                  {/* status chips */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${item.kycVerified ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-blue-200/60'}`}>
                        KYC {item.kycVerified ? '✓' : '·'}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${item.amlCheckPassed ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-blue-200/60'}`}>
                        AML {item.amlCheckPassed ? '✓' : '·'}
                      </span>
                    </div>
                    {docTotal > 0 && (
                      <span className="text-[10px] text-blue-200/60">
                        Docs {docDone}/{docTotal}
                      </span>
                    )}
                  </div>
                </div>

                {/* doc progress */}
                {docTotal > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${docPct === 100 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                      style={{ width: `${docPct}%` }}
                    />
                  </div>
                )}

                {/* blocker / next action */}
                {item.blockerReason && (
                  <p className="mt-2.5 line-clamp-1 text-[11px] text-blue-200/70">
                    <span className="text-amber-300/80">⚠</span> {item.blockerReason}
                  </p>
                )}

                {/* CTA */}
                <div className="mt-3">
                  {isKyc ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onCompleteKyc(item.applicationId);
                      }}
                      disabled={kycLoadingId === item.applicationId}
                      className="w-full rounded-xl bg-white py-2 text-xs font-bold text-[#0a1628] transition-colors hover:bg-blue-50 disabled:opacity-50"
                    >
                      {kycLoadingId === item.applicationId ? 'Processing…' : 'Complete KYC'}
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        router.push(`/dashboard/applications/${item.applicationId}`);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
                    >
                      {actionLabel(item)}
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
