'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { MoneySheet } from '@/components/retail/MoneySheet';
import { useRetailEligibility } from '@/hooks/useRetailEligibility';
import {
  formatEuro,
  retailService,
  type MoneyRequest,
  type SendDraft,
} from '@/services/api/retail-service';

type Tab = 'RECEIVED' | 'SENT';

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Waiting',
  VIEWED: 'Viewed',
  PAYMENT_PENDING: 'Payment in progress',
  PAID_SANDBOX: 'Paid (sandbox)',
  PAID: 'Paid',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export default function RequestsPage() {
  const eligible = useRetailEligibility();
  const [tab, setTab] = useState<Tab>('RECEIVED');
  const [items, setItems] = useState<MoneyRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState<SendDraft | null>(null);

  const load = useCallback(async (direction: Tab) => {
    setError(null);
    setItems(null);
    try {
      setItems(await retailService.requests(direction));
    } catch (err) {
      setError((err as { message?: string }).message ?? 'We couldn’t load your requests.');
    }
  }, []);

  useEffect(() => {
    if (eligible === true) void load(tab);
  }, [eligible, tab, load]);

  const act = async (request: MoneyRequest, action: 'decline' | 'cancel' | 'pay') => {
    setBusyId(request.requestId);
    setError(null);
    try {
      if (action === 'pay') {
        setPayDraft(await retailService.payRequest(request.requestId));
      } else if (action === 'decline') {
        await retailService.declineRequest(request.requestId);
        await load(tab);
      } else {
        await retailService.cancelRequest(request.requestId);
        await load(tab);
      }
    } catch (err) {
      setError((err as { message?: string }).message ?? 'That didn’t work. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (eligible === false) {
    return (
      <div className="space-y-5">
        <PageHero title="Requests" subtitle="Money requests are available to personal customers." />
        <div className="glass-panel p-6" data-testid="not-eligible">
          <Link href="/portal/payments" className="pill-btn inline-flex">
            Back to payments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="Requests"
        subtitle="Money you’ve asked for and money people have asked you for."
      />

      <section className="glass-panel" aria-label="Money requests">
        <div className="flex gap-2 px-5 pt-5" role="tablist" aria-label="Request direction">
          {(['RECEIVED', 'SENT'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              data-testid={`tab-${t.toLowerCase()}`}
              className={tab === t ? 'pill-btn pill-btn-solid' : 'pill-btn'}
              onClick={() => setTab(t)}
            >
              {t === 'RECEIVED' ? 'Received' : 'Sent'}
            </button>
          ))}
        </div>

        {error && (
          <p className="px-5 py-4 text-sm" role="alert">
            {error}
          </p>
        )}

        {!error && items === null && (
          <ul className="space-y-3 px-5 py-4" aria-busy="true" aria-label="Loading">
            {[0, 1].map(i => (
              <li key={i} className="h-20 rounded-2xl motion-safe:animate-pulse" style={{ backgroundColor: 'var(--tile-bg)' }} />
            ))}
          </ul>
        )}

        {items && items.length === 0 && (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }} data-testid="requests-empty">
            {tab === 'RECEIVED' ? 'No one has asked you for money.' : 'You haven’t requested any money yet.'}
          </p>
        )}

        {items && items.length > 0 && (
          <ul className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
            {items.map(request => (
              <li key={request.requestId} className="px-5 py-4" data-testid="request-row">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {request.direction === 'RECEIVED'
                        ? `${request.counterpartyName} asked you for`
                        : `You asked ${request.counterpartyName} for`}{' '}
                      <span className="num">{formatEuro(request.amountMinor, request.currency)}</span>
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {request.purpose}
                    </p>
                  </div>
                  <span className="chip text-[11px]" data-testid="request-status">
                    {STATUS_LABEL[request.status] ?? request.status}
                  </span>
                </div>
                {request.statusNote && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {request.statusNote}
                  </p>
                )}
                {(request.canPay || request.canDecline || request.canCancel) && (
                  <div className="mt-3 flex gap-2">
                    {request.canPay && (
                      <button
                        type="button"
                        className="pill-btn pill-btn-solid"
                        disabled={busyId === request.requestId}
                        onClick={() => void act(request, 'pay')}
                      >
                        Pay
                      </button>
                    )}
                    {request.canDecline && (
                      <button
                        type="button"
                        className="pill-btn"
                        disabled={busyId === request.requestId}
                        onClick={() => void act(request, 'decline')}
                      >
                        Decline
                      </button>
                    )}
                    {request.canCancel && (
                      <button
                        type="button"
                        className="pill-btn"
                        disabled={busyId === request.requestId}
                        onClick={() => void act(request, 'cancel')}
                      >
                        Cancel request
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <MoneySheet
        open={payDraft !== null}
        mode="send"
        initialDraft={payDraft}
        onClose={() => {
          setPayDraft(null);
          void load(tab);
        }}
        onCompleted={() => void load(tab)}
      />
    </div>
  );
}
