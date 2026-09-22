'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import type { WorklistItem } from '@/services/api/dashboard-service';

function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const ACTION_LABELS: Record<string, string> = {
  COMPLETE_KYC: 'Complete KYC',
  COLLECT_DOCUMENTS: 'Collect documents',
  REVIEW_DOCUMENTS: 'Review documents',
  RUN_CREDIT_CHECK: 'Run credit check',
  ASSIGN_UNDERWRITER: 'Assign underwriter',
  MAKE_DECISION: 'Make decision',
  GENERATE_OFFER: 'Generate offer',
  SEND_OFFER: 'Send offer',
  BOOK_FACILITY: 'Book facility',
  DISBURSE_FUNDS: 'Disburse funds',
};

function actionLabel(item: WorklistItem): string {
  if (item.nextAction && ACTION_LABELS[item.nextAction]) return ACTION_LABELS[item.nextAction];
  if (item.nextAction) return humanise(item.nextAction);
  return 'Review';
}

type Urgent = { item: WorklistItem; breached: boolean; overdue: boolean; accent: string };

function toUrgent(item: WorklistItem): Urgent | null {
  const breached = item.slaBreachDays !== null && item.slaBreachDays > 0;
  const overdue = item.daysInCurrentStage > 7;
  const high = (item.priorityScore ?? 0) >= 70;
  if (!breached && !overdue && !high) return null;
  return {
    item,
    breached,
    overdue,
    accent: breached ? '#ef4444' : overdue ? '#f59e0b' : '#8b5cf6',
  };
}

interface Props {
  items: WorklistItem[];
  onCompleteKyc: (applicationId: string) => void;
  kycLoadingId: string | null;
}

export default function AttentionStrip({ items, onCompleteKyc, kycLoadingId }: Props) {
  const router = useRouter();

  const urgent = useMemo(
    () =>
      items
        .map(toUrgent)
        .filter((u): u is Urgent => u !== null)
        .sort((a, b) => {
          const ab = a.item.slaBreachDays ?? 0;
          const bb = b.item.slaBreachDays ?? 0;
          if (ab !== bb) return bb - ab;
          return (b.item.priorityScore ?? 0) - (a.item.priorityScore ?? 0);
        })
        .slice(0, 6),
    [items]
  );

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Needs your attention
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            {urgent.length > 0
              ? `${urgent.length} application${urgent.length === 1 ? '' : 's'} at risk of slipping`
              : 'Nothing is at risk right now'}
          </p>
        </div>
        {urgent.length > 0 && (
          <button
            onClick={() => router.push('/dashboard/applications')}
            className="text-sm font-medium shrink-0 hover:underline"
            style={{ color: 'var(--rm-accent)' }}
          >
            View all
          </button>
        )}
      </div>

      {urgent.length === 0 ? (
        <div
          className="rounded-3xl p-8 text-center"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          <div
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: 'rgba(16,185,129,0.14)' }}
          >
            <svg className="w-6 h-6" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
            You&apos;re all caught up
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            No applications are breaching SLA or waiting on you.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mx-1 px-1">
          {urgent.map(({ item, breached, accent }) => {
            const isKyc = item.status === 'PENDING_KYC' || item.nextAction === 'COMPLETE_KYC';
            return (
              <article
                key={item.applicationId}
                onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                className="relative w-[290px] shrink-0 snap-start overflow-hidden rounded-3xl p-5 cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--rm-card)' }}
              >
                <span className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: accent }} />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate" style={{ color: 'var(--rm-text)' }}>
                      {item.customerName || '—'}
                    </p>
                    <p className="text-sm truncate mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
                      {item.productName || humanise(item.status)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                    style={{ backgroundColor: `${accent}1f`, color: accent }}
                  >
                    {breached ? `+${item.slaBreachDays}d over SLA` : `${item.daysInCurrentStage}d in stage`}
                  </span>
                </div>

                <p
                  className="mt-4 text-2xl font-semibold tracking-tight tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {formatCurrency(item.requestedAmount)}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm truncate" style={{ color: 'var(--rm-text-muted)' }}>
                    {humanise(item.status)}
                  </span>
                  {isKyc ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onCompleteKyc(item.applicationId);
                      }}
                      disabled={kycLoadingId === item.applicationId}
                      className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--rm-accent)' }}
                    >
                      {kycLoadingId === item.applicationId ? 'Working…' : 'Complete KYC'}
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        router.push(`/dashboard/applications/${item.applicationId}`);
                      }}
                      className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: 'var(--rm-accent)' }}
                    >
                      {actionLabel(item)}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
