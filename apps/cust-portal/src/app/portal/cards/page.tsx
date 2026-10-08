'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CARDS,
  TRANSACTIONS,
  dailyCardSpend,
  getAccount,
  type PaymentCard,
  type Transaction,
} from '@/lib/banking-data';
import { BankCard } from '@/components/banking/BankCard';
import Glyph, { glyphFor, GlyphTile } from '@/components/ui/Glyph';

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const WINDOW_DAYS = 30;

type ControlKey = 'online' | 'contactless';

const SCHEME_LABEL: Record<PaymentCard['scheme'], string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
};

const TYPE_LABEL: Record<PaymentCard['type'], string> = {
  DEBIT: 'debit card',
  CREDIT: 'credit card',
};

/** The three switches the card model actually carries. There is no ATM or
    international control behind these accounts, so none is offered. */
const CONTROLS: { key: ControlKey; label: string; desc: string; icon: string }[] = [
  { key: 'online', label: 'Online payments', desc: 'Use this card for online and in-app purchases', icon: 'globe' },
  { key: 'contactless', label: 'Contactless payments', desc: 'Tap to pay at terminals without entering your PIN', icon: 'contactless' },
];

/* ──────────────────────────────────────────────────────────────────
 * Data resolution
 *
 * Every figure on this page is summed from the card's own transactions over an
 * explicitly labelled window, so the headline total, the comb and the payment
 * count can never disagree with each other.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

/** The comb, the headline total and the day count all come out of this one
    series, so they cannot drift apart. */
function useCardSeries(cardId: string | undefined) {
  const series = useMemo(() => dailyCardSpend(WINDOW_DAYS, cardId), [cardId]);
  const total = series.reduce((sum, d) => sum + d.total, 0);
  const activeDays = series.filter(d => d.total > 0).length;
  const peak = series.reduce((m, d) => Math.max(m, d.total), 0);
  const from = series.length ? series[0].date : null;
  const to = series.length ? series[series.length - 1].date : null;
  const range = from && to ? `${shortDate(from)} – ${shortDate(to)}` : `last ${WINDOW_DAYS} days`;
  return { series, total, activeDays, peak, range };
}

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

/* ────────────────────────────────────────────────────────────────── */

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass-body">
      <div className="empty-state">
        <div className="empty-state-icon">
          <Glyph name="alert" className="h-6 w-6" />
        </div>
        <p className="empty-state-title">We couldn&apos;t load your cards</p>
        <p className="empty-state-text">
          Something went wrong while reading your card data. Your card settings have not been changed.
        </p>
        <button type="button" onClick={onRetry} className="btn btn-primary btn-sm mt-4">
          <Glyph name="subscription" className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}

function MiniPlastic({ card }: { card: PaymentCard }) {
  return (
    <span aria-hidden="true" className="mini-plastic" style={{ background: card.gradient }}>
      <span className="mini-plastic-word">Rayva</span>
      <span className="mini-plastic-chip" />
      <span className="mini-plastic-scheme">{card.scheme === 'VISA' ? 'VISA' : 'MC'}</span>
    </span>
  );
}

function ControlSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: checked ? 'var(--brand)' : 'var(--hairline-strong)' }}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────── */

export default function CardsPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Partial<Pick<PaymentCard, 'frozen' | ControlKey>>>>({});
  const [announcement, setAnnouncement] = useState('');
  const { data, state, retry } = useCardsData();

  const cards = useMemo(() => {
    const base = data?.cards ?? [];
    return base.map(c => ({ ...c, ...overrides[c.id] }));
  }, [data, overrides]);

  const card = cards[Math.min(activeIdx, Math.max(0, cards.length - 1))];
  const linkedAccount = card ? getAccount(card.linkedAccountId) : undefined;

  const cardTxns = useMemo(
    () => (card ? (data?.transactionsByCard[card.id] ?? []).slice(0, 8) : []),
    [card, data]
  );

  const { series, total: cardTotal, activeDays, peak, range } = useCardSeries(card?.id);

  /* The book-wide figure is the same series without the card filter, so it can
     never disagree with the per-card total above it. */
  const book = useCardSeries(undefined);
  const frozenCount = cards.filter(c => c.frozen).length;
  const activeCount = cards.length - frozenCount;

  const creditLimit = card?.creditLimit ?? 0;
  const creditUsed = card?.creditUsed ?? 0;
  const creditPct = creditLimit > 0 ? Math.min(100, Math.round((creditUsed / creditLimit) * 100)) : 0;

  const setControl = useCallback(
    (cardId: string, key: 'frozen' | ControlKey, value: boolean, announce: string) => {
      setOverrides(prev => ({ ...prev, [cardId]: { ...prev[cardId], [key]: value } }));
      setAnnouncement(announce);
    },
    []
  );

  if (state === 'error') {
    return (
      <div className="space-y-5">
        <section className="glass-panel">
          <div className="glass-head">
            <h1 className="glass-title">Cards</h1>
          </div>
          <LoadError onRetry={retry} />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Screen-reader announcement for card setting changes */}
      <p className="sr-only" aria-live="polite">{announcement}</p>

      {/* ══ HERO: the plastic, and what it is doing ══ */}
      <section className="glass-panel relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(38rem 22rem at 8% 0%, var(--brand-soft), transparent 62%), radial-gradient(30rem 20rem at 100% 100%, var(--tile-bg-hover), transparent 60%)',
          }}
        />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
          <div className="card-fan overflow-hidden">
            {cards.map((c, i) => {
              let d = i - activeIdx;
              if (d > cards.length / 2) d -= cards.length;
              if (d < -cards.length / 2) d += cards.length;
              const featured = d === 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-label={c.label}
                  aria-pressed={featured}
                  className="fan-card"
                  style={{
                    transform: `translateX(calc(var(--fan-step) * ${d})) translateY(${
                      featured ? 'var(--fan-lift)' : 'var(--fan-drop)'
                    }) scale(${featured ? 1 : 0.9}) rotate(${d * -2}deg)`,
                    zIndex: 30 - Math.abs(d) * 10,
                    opacity: featured ? 1 : Math.abs(d) === 1 ? 0.62 : 0.32,
                    filter: featured ? 'none' : 'saturate(0.65)',
                  }}
                >
                  <BankCard card={c} />
                </button>
              );
            })}
          </div>

          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {state === 'loading' ? 'Loading cards' : `${cards.length} cards on your profile`}
            </p>
            <h1
              className="serif mt-2 text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]"
              style={{ color: 'var(--text-primary)' }}
            >
              {card ? `${card.label}, on your terms.` : 'Your cards.'}
            </h1>
            {card && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {SCHEME_LABEL[card.scheme]} {TYPE_LABEL[card.type]} ending {card.last4} · expires {card.expiry}
                {linkedAccount ? ` · linked to ${linkedAccount.name}` : ''}
              </p>
            )}

            <div className="mt-6 space-y-2.5">
              <div className="stat-row">
                <span className="action-tile-icon h-9 w-9 rounded-xl">
                  <Glyph name="current" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {state === 'loading' ? '—' : activeCount}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {activeCount === 1 ? 'Card available' : 'Cards available'}
                  </span>
                </span>
              </div>

              <div className="stat-row">
                <span className="action-tile-icon h-9 w-9 rounded-xl">
                  <Glyph name="chart" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {state === 'loading' ? '—' : fmt(book.total)}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Card spending · last {WINDOW_DAYS} days
                  </span>
                </span>
              </div>

              <div className="stat-row">
                <span className="action-tile-icon h-9 w-9 rounded-xl">
                  <Glyph name="snowflake" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {state === 'loading' ? '—' : frozenCount}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {frozenCount === 1 ? 'Card frozen' : 'Cards frozen'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Cards list | controls + spending, then activity ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Your cards */}
        <section className="glass-panel flex flex-col xl:col-span-4" aria-label="Your cards">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Your cards</h2>
              <p className="glass-sub">Select one to control it.</p>
            </div>
            <Link
              href="/portal/products"
              className="ring-btn shrink-0 !h-9 !w-9"
              aria-label="Explore other cards"
            >
              <Glyph name="plus" className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>

          {state === 'loading' ? (
            <div className="px-6 pb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="skeleton h-11 w-[68px] rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3.5 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {cards.map((c, i) => {
                const selected = card?.id === c.id;
                const acc = getAccount(c.linkedAccountId);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-pressed={selected}
                    className="glass-row w-full text-left"
                    style={selected ? { backgroundColor: 'var(--brand-soft)' } : undefined}
                  >
                    <MiniPlastic card={c} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {c.label}
                        </span>
                        {c.frozen && (
                          <span className="badge badge-warning shrink-0 !py-0.5 !text-xs">Frozen</span>
                        )}
                      </span>
                      <span className="num block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {SCHEME_LABEL[c.scheme]} {TYPE_LABEL[c.type]} · •••• {c.last4}
                      </span>
                      {acc && (
                        <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                          Linked to {acc.name}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                      <Glyph name="chevron" className="h-4 w-4 -rotate-90" strokeWidth={2} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {card && linkedAccount && (
            <div className="glass-foot mt-auto">
              <Link href={`/portal/accounts/${linkedAccount.id}`} className="link-arrow text-xs">
                {linkedAccount.name} · {fmt(linkedAccount.available, linkedAccount.currency)} available
                <span data-arrow aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5 xl:col-span-8">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Controls */}
            <section className="glass-panel" aria-label="Card controls">
              <div className="glass-head">
                <div>
                  <h2 className="glass-title">Card controls</h2>
                  <p className="glass-sub">
                    {card ? `${card.label} · •••• ${card.last4}` : 'Choose a card to change its settings.'}
                  </p>
                </div>
              </div>

              {card ? (
                <div className="pb-2">
                  {CONTROLS.map(c => {
                    const enabled = Boolean(card[c.key]);
                    return (
                      <div key={c.key} className="glass-row">
                        <span className="action-tile-icon h-9 w-9 shrink-0 rounded-xl">
                          <Glyph name={c.icon} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {c.label}
                          </span>
                          <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                            {card.frozen ? 'Unavailable while the card is frozen' : c.desc}
                          </span>
                        </span>
                        <ControlSwitch
                          label={c.label}
                          checked={enabled}
                          disabled={card.frozen}
                          onChange={() =>
                            setControl(card.id, c.key, !enabled, `${c.label} ${!enabled ? 'enabled' : 'disabled'}`)
                          }
                        />
                      </div>
                    );
                  })}

                  <div className="glass-row">
                    <span className="action-tile-icon h-9 w-9 shrink-0 rounded-xl">
                      <Glyph name="snowflake" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {card.frozen ? 'Unfreeze card' : 'Freeze card'}
                      </span>
                      <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        Temporarily block all new payments on this card
                      </span>
                    </span>
                    <ControlSwitch
                      label="Freeze card"
                      checked={card.frozen}
                      disabled={false}
                      onChange={() =>
                        setControl(
                          card.id,
                          'frozen',
                          !card.frozen,
                          card.frozen ? `${card.label} unfrozen.` : `${card.label} frozen. New payments are blocked.`
                        )
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="glass-body">
                  <div className="empty-state !py-8">
                    <p className="empty-state-title">No card selected</p>
                    <p className="empty-state-text">When a card is issued it will appear on the left.</p>
                  </div>
                </div>
              )}

              {card?.frozen && (
                <p className="glass-foot">
                  This card is frozen. Online and contactless payments stay off until you unfreeze it.
                </p>
              )}
            </section>

            {/* Spending */}
            <section className="glass-panel" aria-label="Card spending">
              <div className="glass-head">
                <div>
                  <h2 className="glass-title">Card spending</h2>
                  <p className="glass-sub">{range}</p>
                </div>
                {card?.type === 'CREDIT' && typeof card.apr === 'number' && (
                  <span className="chip num shrink-0">{card.apr}% APR</span>
                )}
              </div>

              <div className="glass-body">
                <p className="num text-[26px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {fmt(cardTotal)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activeDays
                    ? `over ${activeDays} active day${activeDays === 1 ? '' : 's'}`
                    : 'no completed card payments in this window'}
                </p>

                <div className="mt-5 flex items-end gap-3">
                  <div className="thin-bars flex-1">
                    {series.map(d => (
                      <span
                        key={d.date}
                        className="thin-bar"
                        data-zero={d.total === 0 || undefined}
                        data-active={(d.total === peak && d.total > 0) || undefined}
                        title={`${shortDate(d.date)} · ${fmt(d.total)}`}
                        style={{ height: d.total > 0 ? `${Math.max(5, (d.total / (peak || 1)) * 100)}%` : '2%' }}
                      />
                    ))}
                  </div>
                  {peak > 0 && (
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <span className="chart-marker">{fmt(peak)}</span>
                      <span className="marker-leader h-8" aria-hidden="true" />
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        peak day
                      </span>
                    </div>
                  )}
                </div>

                {card?.type === 'CREDIT' && creditLimit > 0 && (
                  <div
                    className="mt-6"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={creditLimit}
                    aria-valuenow={creditUsed}
                    aria-label={`Credit used: ${fmt(creditUsed)} of a ${fmt(creditLimit)} limit`}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Credit used
                      </span>
                      <span className="num text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {fmt(creditUsed)} of {fmt(creditLimit)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--tile-bg)' }}>
                      <div className="h-full rounded-full" style={{ width: `${creditPct}%`, backgroundColor: 'var(--brand)' }} />
                    </div>
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {creditPct}% used · {fmt(Math.max(0, creditLimit - creditUsed))} available. The bank reports
                      this balance; it is not derived from the payments above.
                    </p>
                  </div>
                )}
              </div>

              <p className="glass-foot">
                {card?.type === 'CREDIT'
                  ? 'Only payments made on this card are counted. Transfers and direct debits sit against the account, not the plastic.'
                  : 'Only completed payments made on this card are counted. Pending and declined rows are in the activity list below.'}
              </p>
            </section>
          </div>

          {/* Activity */}
          <section className="glass-panel" aria-label="Recent card activity">
            <div className="glass-head">
              <div>
                <h2 className="glass-title">Recent card activity</h2>
                <p className="glass-sub">
                  {card ? `Everything posted or pending on •••• ${card.last4}.` : 'Payments made on your cards.'}
                </p>
              </div>
              <Link href="/portal/transactions" className="pill-btn shrink-0 !px-3 !py-1.5 !text-xs">
                View all
              </Link>
            </div>

            {cardTxns.length === 0 ? (
              <div className="glass-body">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Glyph name="current" className="h-6 w-6" />
                  </div>
                  <p className="empty-state-title">No activity on this card</p>
                  <p className="empty-state-text">
                    Payments made with {card ? `•••• ${card.last4}` : 'this card'} will appear here as soon as they post.
                  </p>
                  <Link href="/portal/transactions" className="btn btn-secondary btn-sm mt-4">
                    Browse all transactions
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                {cardTxns.map((t: Transaction) => (
                  <div key={t.id} className="glass-row">
                    <GlyphTile name={glyphFor(t.category)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t.merchant}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t.category} · {shortDate(t.date)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs font-medium"
                      style={{
                        color:
                          t.status === 'PENDING'
                            ? 'var(--text-muted)'
                            : t.status === 'DECLINED'
                              ? 'var(--down)'
                              : 'var(--text-muted)',
                      }}
                    >
                      {t.status === 'PENDING' ? 'Pending' : t.status === 'DECLINED' ? 'Declined' : 'Completed'}
                    </span>
                    <p
                      className="num w-24 shrink-0 text-right text-sm font-semibold"
                      style={t.direction === 'IN' ? { color: 'var(--up)' } : { color: 'var(--text-primary)' }}
                    >
                      {t.direction === 'IN' ? '+' : '−'}
                      {fmt(t.amount, t.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
