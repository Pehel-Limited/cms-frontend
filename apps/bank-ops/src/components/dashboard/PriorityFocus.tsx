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
  return 'Review Now';
}

type Urgency = {
  rank: number; // higher = more urgent
  accent: string; // left strip + accent colour (hex)
  slaLabel: string; // top-right SLA status
  slaColor: string;
  riskLabel: string; // risk level label
  riskColor: string;
};

function urgencyOf(item: WorklistItem): Urgency {
  const breached = item.slaBreachDays !== null && item.slaBreachDays > 0;
  const overdue = item.daysInCurrentStage > 7;
  const score = item.priorityScore ?? 0;

  const risk =
    score >= 70 || breached
      ? { riskLabel: 'High Risk', riskColor: '#ef4444' }
      : score >= 40 || overdue
        ? { riskLabel: 'Medium Risk', riskColor: '#f59e0b' }
        : { riskLabel: 'Low Risk', riskColor: '#10b981' };

  const sla = breached
    ? { slaLabel: `Breached +${item.slaBreachDays}d`, slaColor: '#ef4444' }
    : overdue
      ? { slaLabel: `${item.daysInCurrentStage}d in stage`, slaColor: '#f59e0b' }
      : { slaLabel: 'On track', slaColor: '#10b981' };

  const rank = breached
    ? 1000 + (item.slaBreachDays ?? 0)
    : overdue
      ? 500 + item.daysInCurrentStage
      : score;
  const accent = breached ? '#ef4444' : overdue ? '#f59e0b' : score >= 40 ? '#8b5cf6' : '#0ea5e9';

  return { rank, accent, ...sla, ...risk };
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

  if (focus.length === 0) return null;

  return (
    <section>
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
            Today&apos;s Priorities
          </h2>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"
          style={{ color: 'var(--rm-accent)' }}
        >
          View all priorities
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {focus.map(({ item, urgency }) => {
          const isKyc = item.status === 'PENDING_KYC' || item.nextAction === 'COMPLETE_KYC';
          return (
            <div
              key={item.applicationId}
              onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
              className="relative overflow-hidden rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
            >
              {/* left accent strip */}
              <span className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: urgency.accent }} />

              <div className="p-4 pl-5">
                {/* header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${urgency.accent}1f`, color: urgency.accent }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--rm-text)' }}>
                        {item.customerName || '—'}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--rm-text-muted)' }}>
                        {item.productName || '—'}
                      </p>
                      <span
                        className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                      >
                        {item.applicationNumber}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>SLA</p>
                    <p className="text-xs font-semibold" style={{ color: urgency.slaColor }}>{urgency.slaLabel}</p>
                    <p className="text-[11px] font-medium mt-1" style={{ color: urgency.riskColor }}>{urgency.riskLabel}</p>
                  </div>
                </div>

                {/* detail row */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--rm-border)' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Amount</p>
                    <p className="text-sm font-bold tabular-nums truncate" style={{ color: 'var(--rm-text)' }}>
                      {formatCurrency(item.requestedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Stage</p>
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--rm-text-secondary)' }}>
                      {humanise(item.status)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Age</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                      {item.daysSinceSubmitted > 0 ? `${item.daysSinceSubmitted}d` : 'New'}
                    </p>
                  </div>
                </div>

                {/* actions */}
                <div className="flex items-center gap-3 mt-3">
                  {isKyc ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onCompleteKyc(item.applicationId);
                      }}
                      disabled={kycLoadingId === item.applicationId}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--rm-accent)' }}
                    >
                      {kycLoadingId === item.applicationId ? 'Processing…' : 'Complete KYC'}
                      {kycLoadingId !== item.applicationId && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        router.push(`/dashboard/applications/${item.applicationId}`);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: 'var(--rm-accent)' }}
                    >
                      {actionLabel(item)}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      router.push(`/dashboard/applications/${item.applicationId}`);
                    }}
                    className="text-xs font-semibold hover:underline whitespace-nowrap"
                    style={{ color: 'var(--rm-accent)' }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
