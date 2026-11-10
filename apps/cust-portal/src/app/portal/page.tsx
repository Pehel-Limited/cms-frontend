'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RequestMoneyDialog } from '@/components/payments/RequestMoneyDialog';
import { PositionCard } from '@/components/dashboard/PositionCard';
import { AttentionCentre } from '@/components/dashboard/AttentionCentre';
import { ComingUp } from '@/components/dashboard/Outlook';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ApplicationProgress, RelationshipCard } from '@/components/dashboard/Relationship';
import { useAIPreferences } from '@/lib/ai-preferences';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useMessagingInbox } from '@/hooks/useMessagingInbox';
import {
  TERMINAL_STATUSES,
  buildAttention,
  buildUpcoming,
  featuredApplication,
  financialPosition,
  monthFlow,
} from '@/lib/dashboard-model';
import { LOAN_PURPOSE_LABELS } from '@/services/api/application-service';
import type { CustomerSignal } from '@/services/api/ai-signals-service';

const HIDE_KEY = 'cms-hide-balances';
const PURPOSES = LOAN_PURPOSE_LABELS as Record<string, string>;

/**
 * SuperBank overview — a personal financial command centre.
 *
 * It answers, in order: where do I stand, what needs me, what is coming, what changed, and
 * where is my borrowing. On a phone those are one column in that order; on a desktop the
 * money sits on the left and the relationship on the right. Every figure is derived from the
 * existing customer APIs (see lib/dashboard-model.ts) — nothing here needs a backend change.
 */
export default function PortalDashboard() {
  const { preferences, ready } = useAIPreferences();
  const { money, apps, tasks, cards, signals, reload } = useDashboardData(ready && preferences.insights);
  /* The shell already polls the inbox for its badge; this copy only needs to be roughly fresh. */
  const inbox = useMessagingInbox(60_000);

  const [requestOpen, setRequestOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(localStorage.getItem(HIDE_KEY) === '1'), []);
  const toggleHidden = () =>
    setHidden(v => {
      localStorage.setItem(HIDE_KEY, v ? '0' : '1');
      return !v;
    });

  const { accounts, transactions, accountSource, txnSource, historyStart, sampleReason } = money.data;
  const sample = txnSource === 'SAMPLE';

  const position = useMemo(() => financialPosition(accounts), [accounts]);
  const flow = useMemo(
    () => monthFlow(transactions, position.currency, new Date(), historyStart ?? undefined),
    [transactions, position.currency, historyStart]
  );

  const attention = useMemo(
    () =>
      buildAttention({
        tasks: tasks.data,
        apps: apps.data,
        inbox: inbox.rows,
        cards: cards.data,
        purposeLabels: PURPOSES,
      }),
    [tasks.data, apps.data, inbox.rows, cards.data]
  );

  const upcoming = useMemo(
    () => buildUpcoming(transactions, tasks.data, apps.data, PURPOSES),
    [transactions, tasks.data, apps.data]
  );

  const featured = useMemo(() => featuredApplication(apps.data), [apps.data]);
  const activeApps = apps.data.filter(a => !TERMINAL_STATUSES.has(a.status)).length;
  const featuredUpdates = useMemo<CustomerSignal[]>(
    () =>
      featured
        ? signals.filter(s => s.evidence?.applicationId === featured.applicationId)
        : [],
    [signals, featured]
  );

  const attentionLoading = apps.loading || tasks.loading || (inbox.loading && inbox.rows.length === 0);
  const attentionPartial = apps.failed || tasks.failed || cards.failed || Boolean(inbox.error);

  return (
    <div className="sb-dash">
      <h1 className="sr-only">Overview</h1>
      <p className="sr-only" aria-live="polite">
        {hidden ? 'Balances hidden' : 'Balances shown'}
      </p>

      {/* Mobile: one column in priority order (the `order-*` classes).
          Desktop: the column wrappers become real columns and the order is per column. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="contents lg:col-span-8 lg:flex lg:flex-col lg:gap-6">
          <div className="order-1">
            <PositionCard
              position={position}
              accounts={accounts}
              source={accountSource}
              sampleReason={sampleReason}
              loading={money.loading}
              hidden={hidden}
              onToggleHidden={toggleHidden}
              onRequest={() => setRequestOpen(true)}
            />
          </div>

          <div className="order-3">
            <ComingUp items={upcoming} loading={money.loading || tasks.loading} hidden={hidden} sample={sample} />
          </div>

          <div className="order-4">
            <RecentActivity
              transactions={transactions}
              flow={flow}
              loading={money.loading}
              hidden={hidden}
              sample={sample}
            />
          </div>
        </div>

        <div className="contents lg:col-span-4 lg:flex lg:flex-col lg:gap-6">
          <div className="order-2">
            <AttentionCentre
              items={attention}
              loading={attentionLoading}
              partialFailure={attentionPartial}
              onRetry={() => {
                reload();
                inbox.refresh();
              }}
            />
          </div>
          <div className="order-5">
            <ApplicationProgress
              featured={featured}
              activeCount={activeApps}
              totalCount={apps.data.length}
              updates={featuredUpdates}
              loading={apps.loading}
              failed={apps.failed}
              onRetry={reload}
            />
          </div>
          <div className="order-6">
            <RelationshipCard unread={inbox.unreadTotal} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center pb-2 text-sm">
        <Link href="/portal/insights" className="link-arrow">
          Where the money went <span data-arrow aria-hidden="true">→</span>
        </Link>
      </div>

      <RequestMoneyDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
