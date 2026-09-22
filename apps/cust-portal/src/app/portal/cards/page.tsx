'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CARDS, TRANSACTIONS, getAccount, type PaymentCard, type Transaction } from '@/lib/banking-data';
import { BankCard } from '@/components/banking/BankCard';

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type ControlKey = 'online' | 'contactless';

const SCHEME_LABEL: Record<PaymentCard['scheme'], string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
};

const TYPE_LABEL: Record<PaymentCard['type'], string> = {
  DEBIT: 'Debit card',
  CREDIT: 'Credit card',
};

const CONTROLS: { key: ControlKey; label: string; desc: string }[] = [
  { key: 'online', label: 'Online payments', desc: 'Use this card for online and in-app purchases' },
  { key: 'contactless', label: 'Contactless payments', desc: 'Tap to pay at terminals without entering your PIN' },
];

/* ──────────────────────────────────────────────────────────────────
 * Data resolution — card activity, limits and spend are all read from the
 * banking dataset for the card that is actually selected.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

interface CardsData {
  cards: PaymentCard[];
  transactionsByCard: Record<string, Transaction[]>;
}

function resolveCards(): CardsData {
  if (!CARDS.length) throw new Error('No cards returned');
  const transactionsByCard: Record<string, Transaction[]> = {};
  CARDS.forEach(c => {
    transactionsByCard[c.id] = TRANSACTIONS.filter(t => t.cardId === c.id).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });
  return { cards: CARDS, transactionsByCard };
}

function useCardsData() {
  const [data, setData] = useState<CardsData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setData(resolveCards());
        setState('ready');
      } catch {
        setData(null);
        setState('error');
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { data, state, retry };
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-token">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3.5 w-1/2" />
          </div>
          <div className="skeleton h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div className="p-5">
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="empty-state-title">We couldn&apos;t load {what}</p>
        <p className="empty-state-text">Something went wrong while reading your card data. Your card settings have not been changed.</p>
        <button type="button" onClick={onRetry} className="btn btn-primary btn-sm mt-4">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Try again
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

export default function CardsPage() {
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Partial<Pick<PaymentCard, 'frozen' | ControlKey>>>>({});
  const [announcement, setAnnouncement] = useState('');
  const { data, state, retry } = useCardsData();

  const cards = useMemo(() => {
    const base = data?.cards ?? [];
    return base.map(c => ({ ...c, ...overrides[c.id] }));
  }, [data, overrides]);
  const card = cards[Math.min(activeCardIdx, Math.max(0, cards.length - 1))];
  const linkedAccount = card ? getAccount(card.linkedAccountId) : undefined;
  const cardTxns = useMemo(
    () => (card ? (data?.transactionsByCard[card.id] ?? []).slice(0, 8) : []),
    [card, data]
  );

  const setControl = useCallback(
    (cardId: string, key: 'frozen' | ControlKey, value: boolean, announce: string) => {
      setOverrides(prev => ({ ...prev, [cardId]: { ...prev[cardId], [key]: value } }));
      setAnnouncement(announce);
    },
    []
  );

  const creditLimit = card?.creditLimit ?? 0;
  const creditUsed = card?.creditUsed ?? 0;
  const creditPct = creditLimit > 0 ? Math.min(100, Math.round((creditUsed / creditLimit) * 100)) : 0;

  /* A single, page-level failure state — one honest message and one retry,
     rather than the same error repeated inside every panel. */
  if (state === 'error') {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Cards</h1>
            <p className="page-subtitle">Manage the settings, limits and activity for each of your cards.</p>
          </div>
        </div>
        <div className="panel">
          <LoadError onRetry={retry} what="your cards" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cards</h1>
          <p className="page-subtitle">Manage the settings, limits and activity for each of your cards.</p>
        </div>
        <Link href="/portal/products" className="btn btn-primary shrink-0">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Explore cards
        </Link>
      </div>

      {/* Screen-reader announcement for card setting changes */}
      <p className="sr-only" aria-live="polite">{announcement}</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left: card switcher + card art */}
        <div className="space-y-6 xl:col-span-2">
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Your cards</h2>
              {state === 'ready' && <span className="chip tabular-nums">{cards.length} cards</span>}
            </div>

            {state === 'loading' ? (
              <ListSkeleton rows={4} />
            ) : cards.length === 0 ? (
              <div className="p-5">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                  </div>
                  <p className="empty-state-title">No cards yet</p>
                  <p className="empty-state-text">When you order a card it will appear here so you can control its settings.</p>
                  <Link href="/portal/products" className="btn btn-primary btn-sm mt-4">Explore cards</Link>
                </div>
              </div>
            ) : (
              <div className="divide-token">
                {cards.map((c, i) => {
                  const acc = getAccount(c.linkedAccountId);
                  const isSelected = card?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCardIdx(i)}
                      aria-pressed={isSelected}
                      className="w-full px-5 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      style={{
                        backgroundColor: isSelected ? 'var(--brand-soft)' : undefined,
                        borderLeft: `3px solid ${isSelected ? 'var(--brand)' : 'transparent'}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                          style={{ background: c.gradient }}
                        >
                          <span className="h-3 w-5 rounded-sm border-2 border-white/60" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {c.label}
                            </span>
                            {c.frozen && <span className="badge badge-warning shrink-0 !py-0.5 !text-xs">Frozen</span>}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
                            {SCHEME_LABEL[c.scheme]} {TYPE_LABEL[c.type].toLowerCase()} · •••• {c.last4}
                          </span>
                          {acc && (
                            <span className="mt-0.5 block truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                              Linked to {acc.name}
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card art + actions */}
          {state === 'loading' ? (
            <div className="panel">
              <div className="panel-body space-y-4">
                <div className="skeleton aspect-[1.586] w-full rounded-2xl" />
                <div className="skeleton h-10 w-full rounded-xl" />
              </div>
            </div>
          ) : card ? (
            <div className="panel">
              <div className="panel-body space-y-4">
                <BankCard card={card} />

                {linkedAccount && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Linked to {linkedAccount.name} · expires {card.expiry}
                  </p>
                )}

                {card.frozen && (
                  <div className="alert alert-warning">
                    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>This card is frozen. All new payments are blocked until you unfreeze it.</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setControl(
                        card.id,
                        'frozen',
                        !card.frozen,
                        card.frozen
                          ? `${card.label} unfrozen. Payments are allowed again.`
                          : `${card.label} frozen. New payments are blocked.`
                      )
                    }
                    aria-pressed={card.frozen}
                    className="btn btn-secondary btn-sm"
                  >
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
                    </svg>
                    {card.frozen ? 'Unfreeze card' : 'Freeze card'}
                  </button>
                  <Link href="/portal/messages" className="btn btn-ghost btn-sm">
                    Report a problem
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: controls, usage, activity */}
        <div className="space-y-6 xl:col-span-3">
          {/* Card controls */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Card controls</h2>
              {card && <span className="chip">•••• {card.last4}</span>}
            </div>
            {state === 'loading' ? (
              <ListSkeleton rows={2} />
            ) : !card ? null : (
              <div className="divide-token">
                {CONTROLS.map(c => {
                  const enabled = Boolean(card[c.key]);
                  const labelId = `control-${card.id}-${c.key}`;
                  return (
                    <div key={c.key} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p id={labelId} className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                          {c.label}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {card.frozen ? 'Unavailable while the card is frozen' : c.desc}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-labelledby={labelId}
                        disabled={card.frozen}
                        onClick={() =>
                          setControl(card.id, c.key, !enabled, `${c.label} ${!enabled ? 'enabled' : 'disabled'}`)
                        }
                        className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: enabled ? 'var(--brand)' : 'var(--surface-border-strong)' }}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Usage */}
          {state === 'loading' ? (
            <div className="panel">
              <div className="panel-body space-y-3">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-7 w-40" />
                <div className="skeleton h-1.5 w-full" />
              </div>
            </div>
          ) : card ? (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  {card.type === 'CREDIT' ? 'Credit used' : 'Spending this month'}
                </h2>
                {card.type === 'CREDIT' && typeof card.apr === 'number' && (
                  <span className="chip tabular-nums">{card.apr}% APR</span>
                )}
              </div>
              <div className="panel-body">
                {card.type === 'CREDIT' ? (
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={creditLimit}
                    aria-valuenow={creditUsed}
                    aria-label={`Credit used: ${fmt(creditUsed)} of a ${fmt(creditLimit)} limit`}
                  >
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {fmt(creditUsed)}
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-input)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${creditPct}%`, backgroundColor: 'var(--brand)' }}
                      />
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {creditPct}% of your {fmt(creditLimit)} limit · {fmt(Math.max(0, creditLimit - creditUsed))} available
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {fmt(card.spentThisMonth ?? 0)}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {cardTxns.length
                        ? `From ${cardTxns.length} card payment${cardTxns.length === 1 ? '' : 's'} in your recent activity`
                        : 'No card payments recorded yet'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Card activity */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Recent card activity</h2>
              <Link href="/portal/transactions" className="link-arrow">
                View all <span data-arrow aria-hidden="true">→</span>
              </Link>
            </div>

            {state === 'loading' ? (
              <ListSkeleton rows={4} />
            ) : cardTxns.length === 0 ? (
              <div className="p-5">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                  </div>
                  <p className="empty-state-title">No activity on this card</p>
                  <p className="empty-state-text">
                    Payments made with {card ? `•••• ${card.last4}` : 'this card'} will appear here as soon as they post.
                  </p>
                  <Link href="/portal/transactions" className="btn btn-secondary btn-sm mt-4">Browse all transactions</Link>
                </div>
              </div>
            ) : (
              <div className="divide-token">
                {cardTxns.map((t: Transaction) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                      style={{ backgroundColor: 'var(--surface-input)' }}
                    >
                      {t.glyph || '✨'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t.merchant}
                      </p>
                      <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t.category} · {shortDate(t.date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-base font-bold tabular-nums ${t.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                        style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                      >
                        {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount, t.currency)}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t.status === 'PENDING' ? 'Pending' : t.status === 'DECLINED' ? 'Declined' : 'Completed'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
