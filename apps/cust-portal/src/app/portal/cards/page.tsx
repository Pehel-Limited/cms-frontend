'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TRANSACTIONS,
  bucketDaily,
  dailyCardSpend,
  isCardActivity,
  type BankAccount,
  type Transaction,
} from '@/lib/banking-data';
import { accountService, type AccountSource } from '@/services/api/account-service';
import { transactionService } from '@/services/api/transaction-service';
import {
  CARD_LIMIT_MAX,
  CARD_REQUEST_LABEL,
  CARD_STATUS_LABEL,
  cardService,
  expiryLabel,
  isBlocked,
  type CardControlsPatch,
  type CardRequestRecord,
  type CardRequestType,
  type CustomerCard,
} from '@/services/api/card-service';
import {
  AccountCardPlastic,
  MiniCardPlastic,
  type CardFace,
} from '@/components/banking/AccountCardPlastic';
import { DotMatrix } from '@/components/banking/BankCard';
import Glyph, { glyphFor, GlyphTile } from '@/components/ui/Glyph';

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function longDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const WINDOW_DAYS = 30;
const FETCH_DAYS = 122;

/** A revealed secret is shown briefly and then dropped, rather than left on the screen. */
const REVEAL_SECONDS = 20;

/** Only used if a card's account is not in the snapshot — the face still has to be drawn. */
const SCHEME_GRADIENT: Record<string, string> = {
  VISA: 'linear-gradient(135deg, #2d0e2b 0%, #4a1747 50%, #7f2b7b 100%)',
  MASTERCARD: 'linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #71717a 100%)',
};

const SCHEME_LABEL = { VISA: 'Visa', MASTERCARD: 'Mastercard' } as const;

/** The four switches the card record actually carries, and where each one lives on the card. */
type ControlKey = 'onlineEnabled' | 'contactlessEnabled' | 'atmEnabled' | 'internationalEnabled';
type LimitKey = 'contactlessLimit' | 'atmDailyLimit' | 'dailySpendLimit';

const CONTROLS: { key: ControlKey; label: string; desc: string; icon: string }[] = [
  { key: 'onlineEnabled', label: 'Online payments', desc: 'Use this card for online and in-app purchases', icon: 'globe' },
  { key: 'contactlessEnabled', label: 'Contactless payments', desc: 'Tap to pay at terminals without entering your PIN', icon: 'contactless' },
  { key: 'atmEnabled', label: 'ATM cash withdrawals', desc: 'Take cash from a machine against this account', icon: 'bank' },
  { key: 'internationalEnabled', label: 'International use', desc: 'Allow payments made outside the country', icon: 'current' },
];

const LIMITS: { key: LimitKey; label: string; max: number; hint: string }[] = [
  { key: 'contactlessLimit', label: 'Contactless per tap', max: CARD_LIMIT_MAX.contactless, hint: 'Above this the terminal asks for a PIN' },
  { key: 'atmDailyLimit', label: 'ATM cash per day', max: CARD_LIMIT_MAX.atmDaily, hint: 'Total cash this card can take in a day' },
  { key: 'dailySpendLimit', label: 'Card spend per day', max: CARD_LIMIT_MAX.dailySpend, hint: 'Total purchases across every channel in a day' },
];

/** The actions a customer can take when the card itself has gone. */
const REQUEST_ACTIONS: { type: CardRequestType; label: string; ghost?: boolean }[] = [
  { type: 'REPLACE_LOST', label: 'Report lost and replace' },
  { type: 'REPLACE_STOLEN', label: 'Report stolen and replace' },
  { type: 'CANCEL', label: 'Cancel this card', ghost: true },
];

function faceFor(card: CustomerCard, accounts: BankAccount[]): CardFace {
  const acc = accounts.find(a => a.id === card.accountId);
  return {
    label: card.nickname || acc?.typeLabel || acc?.name || `${SCHEME_LABEL[card.scheme]} card`,
    holder: card.cardHolderName,
    last4: card.panLast4,
    scheme: card.scheme,
    expiry: expiryLabel(card),
    gradient: acc?.gradient || SCHEME_GRADIENT[card.scheme] || SCHEME_GRADIENT.VISA,
    frozen: card.status === 'FROZEN',
    blocked: isBlocked(card.status) || card.status === 'CLOSED',
  };
}

const controlValue = (card: CustomerCard, key: ControlKey): boolean => Boolean(card[key]);

const limitValue = (card: CustomerCard, key: LimitKey): number => card[key];

/* ──────────────────────────────────────────────────────────────────
 * Data resolution
 *
 * Cards come from the bank's own issuing records; the account and payment halves
 * come from the same snapshots the rest of the portal uses, so a card's spending
 * can never disagree with the ledger it is drawn from.
 * ────────────────────────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

interface CardsPageData {
  cards: CustomerCard[];
  accounts: BankAccount[];
  transactions: Transaction[];
  accountSource: AccountSource;
}

async function resolveAll(): Promise<CardsPageData> {
  /* No sample fallback for cards: a fabricated plastic would tell the customer the bank has
     issued them something it has not. If this fails, the screen says so. */
  const cards = await cardService.getCards();
  const snapshot = await accountService.getAccountsSnapshot();

  const txn =
    snapshot.source === 'LIVE'
      ? await transactionService.getTransactionsSnapshot({
          from: new Date(Date.now() - FETCH_DAYS * 86400000).toISOString().slice(0, 10),
        })
      : {
          transactions: TRANSACTIONS,
          source: 'SAMPLE' as const,
          sampleReason: null,
          totalElements: TRANSACTIONS.length,
          truncated: false,
        };

  return {
    cards,
    accounts: snapshot.accounts,
    transactions: txn.transactions,
    accountSource: snapshot.source,
  };
}

function useCardsPage() {
  const [data, setData] = useState<CardsPageData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    resolveAll()
      .then(result => {
        if (!active) return;
        setData(result);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setData(null);
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  /** A control change returns the card it changed, so it sticks without refetching the list. */
  const patchCard = useCallback((next: CustomerCard) => {
    setData(prev =>
      prev ? { ...prev, cards: prev.cards.map(c => (c.cardId === next.cardId ? next : c)) } : prev
    );
  }, []);

  /** After a request, the card's own status may have moved on server-side. */
  const reloadCards = useCallback(async () => {
    setData(prev => (prev ? { ...prev, cards: [] } : prev));
    const cards = await cardService.getCards();
    setData(prev => (prev ? { ...prev, cards } : prev));
  }, []);

  return { data, state, retry, patchCard, reloadCards };
}

/** The dot matrix, the headline total and the payment count all come out of the same windowed
    rows, so they cannot drift apart. Three-day buckets keep the chart readable in a narrow panel. */
function useCardSeries(rows: Transaction[], scope?: { cardId: string; accountId: string }) {
  const series = useMemo(() => dailyCardSpend(rows, WINDOW_DAYS, scope), [rows, scope]);
  const chartSeries = useMemo(() => bucketDaily(series, 3), [series]);
  const total = series.reduce((sum, d) => sum + d.total, 0);
  const activeDays = series.filter(d => d.total > 0).length;
  const peak = series.reduce((m, d) => Math.max(m, d.total), 0);
  const cardRows = useMemo(
    () =>
      rows.filter(
        t =>
          t.direction === 'OUT' &&
          t.status === 'COMPLETED' &&
          Boolean(t.cardId || t.viaCard) &&
          (!scope || isCardActivity(t, scope))
      ),
    [rows, scope]
  );
  const windowStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (WINDOW_DAYS - 1));
    return d;
  }, []);
  const lastPaid = cardRows.reduce((max, t) => Math.max(max, new Date(t.date).getTime()), 0);
  const from = series.length ? series[0].date : null;
  const to = series.length ? series[series.length - 1].date : null;
  const range = from && to ? `${shortDate(from)} – ${shortDate(to)}` : `last ${WINDOW_DAYS} days`;

  return {
    chartSeries,
    total,
    payments: cardRows.filter(t => new Date(t.date) >= windowStart).length,
    activeDays,
    peak,
    range,
    lastPaid: lastPaid || null,
  };
}

/* ──────────────────────────────────────────────────────────────────
 * Pieces
 * ────────────────────────────────────────────────────────────────── */

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass-body">
      <div className="empty-state">
        <div className="empty-state-icon">
          <Glyph name="alert" className="h-6 w-6" />
        </div>
        <p className="empty-state-title">We couldn&apos;t load your cards</p>
        <p className="empty-state-text">
          The card service could not be reached. Nothing has been changed — no card has been
          frozen, enabled or revealed.
        </p>
        <button type="button" onClick={onRetry} className="btn btn-primary btn-sm mt-4">
          <Glyph name="subscription" className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}

function StatusChip({ card }: { card: CustomerCard }) {
  const expired = card.expired && card.status === 'ACTIVE';
  const tone =
    expired || card.status === 'CLOSED' || isBlocked(card.status)
      ? 'badge-error'
      : card.status === 'FROZEN'
        ? 'badge-warning'
        : 'badge-success';
  return (
    <span
      className={`badge ${tone} inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold`}
    >
      {expired ? 'Expired' : CARD_STATUS_LABEL[card.status]}
    </span>
  );
}

/**
 * One secret, revealed on demand and forgotten after a few seconds.
 *
 * The value lives in this component's state only — never a URL, never storage — because every
 * reveal writes an audit row server-side and the screen should not leave the secret behind after
 * the customer has read it.
 */
function RevealField({
  card,
  credential,
  label,
  standingValue,
  announce,
}: {
  card: CustomerCard;
  credential: 'PAN' | 'EXPIRY' | 'CVV' | 'PIN';
  label: string;
  /** What is shown when nothing has been revealed. */
  standingValue: string;
  announce: (message: string) => void;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Moving to another card drops the previous secret. */
  useEffect(() => {
    setValue(null);
    setError(null);
  }, [card.cardId]);

  useEffect(() => {
    if (value === null) return;
    const timer = window.setTimeout(() => {
      setValue(null);
      announce(`${label} hidden again`);
    }, REVEAL_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [value, label, announce]);

  const cannotReveal = isBlocked(card.status) || card.status === 'CLOSED' || card.expired;

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const revealed = await cardService.reveal(card.cardId, credential);
      setValue(revealed.value);
      announce(`${label} shown for ${REVEAL_SECONDS} seconds. This reveal was recorded.`);
    } catch (e) {
      const message = (e as { message?: string })?.message || 'That value is not available';
      setError(message);
      announce(`${label}: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-row">
      <span className="min-w-0 flex-1">
        <span
          className="block text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
        <span className="num block truncate text-base" style={{ color: 'var(--text-primary)' }}>
          {value ?? standingValue}
        </span>
        {error && (
          <span className="block text-xs" style={{ color: 'var(--down)' }}>
            {error}
          </span>
        )}
      </span>
      {value === null ? (
        <button
          type="button"
          onClick={reveal}
          disabled={busy || cannotReveal}
          className="pill-btn shrink-0 !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
          title={cannotReveal ? 'Not available for a blocked or expired card' : `Show ${label}`}
        >
          {busy ? 'Checking…' : 'Show'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setValue(null);
            announce(`${label} hidden`);
          }}
          className="pill-btn shrink-0 !px-3 !py-1.5 !text-xs"
        >
          Hide
        </button>
      )}
    </div>
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
  const { data, state, retry, patchCard, reloadCards } = useCardsPage();
  const [activeIdx, setActiveIdx] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requests, setRequests] = useState<CardRequestRecord[]>([]);
  const [confirming, setConfirming] = useState<CardRequestType | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [limitsDraft, setLimitsDraft] = useState<Record<string, string>>({});

  const cards = data?.cards ?? [];
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const rows = useMemo(() => data?.transactions ?? [], [data]);

  const card = cards[Math.min(activeIdx, Math.max(0, cards.length - 1))];
  const linkedAccount = card ? accounts.find(a => a.id === card.accountId) : undefined;
  const face = card ? faceFor(card, accounts) : null;
  const cardScope = useMemo(
    () => (card ? { cardId: card.cardId, accountId: card.accountId } : undefined),
    [card]
  );

  const series = useCardSeries(rows, cardScope);
  const book = useCardSeries(rows, undefined);

  const cardTxns = useMemo(
    () =>
      cardScope
        ? rows
            .filter(t => isCardActivity(t, cardScope))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 8)
        : [],
    [cardScope, rows]
  );

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  /* Requests, the name and the limits all belong to the selected card. */
  const cardId = card?.cardId;
  useEffect(() => {
    setConfirming(null);
    setActionError(null);
    if (!cardId) {
      setRequests([]);
      setNicknameDraft('');
      setLimitsDraft({});
      return;
    }
    setNicknameDraft(card?.nickname ?? '');
    setLimitsDraft(
      card
        ? {
            contactlessLimit: String(card.contactlessLimit),
            atmDailyLimit: String(card.atmDailyLimit),
            dailySpendLimit: String(card.dailySpendLimit),
          }
        : {}
    );
    let active = true;
    cardService
      .listRequests(cardId)
      .then(list => {
        if (active) setRequests(list);
      })
      .catch(() => {
        if (active) setRequests([]);
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  /** Runs one action and reports the failure in place rather than pretending it worked. */
  const run = async (key: string, action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(key);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (e) {
      const message = (e as { message?: string })?.message || 'That change could not be made';
      setActionError(message);
      announce(message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggleFreeze = async () => {
    if (!card || !face) return;
    const freezing = card.status !== 'FROZEN';
    const ok = await run(freezing ? 'Freeze' : 'Unfreeze', () =>
      cardService
        .setStatus(
          card.cardId,
          freezing ? 'FROZEN' : 'ACTIVE',
          freezing ? 'Frozen from the customer portal' : undefined
        )
        .then(patchCard)
    );
    if (ok) {
      announce(
        freezing
          ? `${face.label} is frozen. New payments are blocked until you unfreeze it.`
          : `${face.label} is active again.`
      );
    }
  };

  const toggleControl = async (key: ControlKey, value: boolean) => {
    if (!card) return;
    const label = CONTROLS.find(c => c.key === key)?.label ?? 'Control';
    const ok = await run(String(key), () =>
      cardService.updateControls(card.cardId, { [key]: value } as CardControlsPatch).then(patchCard)
    );
    if (ok) announce(`${label} ${value ? 'enabled' : 'disabled'}.`);
  };

  const saveLimits = async () => {
    if (!card) return;
    const patch: Partial<Record<LimitKey, number>> = {};
    for (const limit of LIMITS) {
      const raw = limitsDraft[String(limit.key)] ?? '';
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        const message = `${limit.label} must be a positive amount`;
        setActionError(message);
        announce(message);
        return;
      }
      if (value > limit.max) {
        const message = `${limit.label} cannot be above ${fmt(limit.max, card.currency)}`;
        setActionError(message);
        announce(message);
        return;
      }
      if (value !== limitValue(card, limit.key)) {
        patch[limit.key] = value;
      }
    }
    if (Object.keys(patch).length === 0) {
      announce('Limits are unchanged.');
      return;
    }
    const ok = await run('Limits', () =>
      cardService.updateControls(card.cardId, patch).then(patchCard)
    );
    if (ok) announce('Card limits updated.');
  };

  const saveNickname = async () => {
    if (!card) return;
    const trimmed = nicknameDraft.trim();
    const ok = await run('Name', () => cardService.rename(card.cardId, trimmed).then(patchCard));
    if (ok) {
      announce(trimmed ? `Card named “${trimmed}”.` : 'Card name cleared.');
      setNicknameDraft(trimmed);
    }
  };

  const fileRequest = async (type: CardRequestType) => {
    if (!card) return;
    const ok = await run('Request', () => cardService.createRequest(card.cardId, type));
    if (!ok) return;
    setConfirming(null);
    /* Lost and stolen change the card's own status server-side, so both the card and its
       requests are re-read rather than guessed at here. */
    await run('Reload', reloadCards);
    const fresh = await cardService.listRequests(card.cardId).catch(() => [] as CardRequestRecord[]);
    setRequests(fresh);
    announce(
      type === 'CANCEL'
        ? 'This card is cancelled. Nothing further can be spent on it.'
        : `${CARD_REQUEST_LABEL[type]} filed. The bank has to produce the replacement, so it stays pending until then.`
    );
  };

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

  const blocked = card ? isBlocked(card.status) || card.status === 'CLOSED' : false;
  const expired = Boolean(card?.expired);
  const unusable = blocked || expired;

  return (
    <div className="space-y-5">
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
            {state === 'loading' ? (
              <div className="card-art skeleton rounded-2xl" />
            ) : cards.length === 0 ? (
              <div
                className="card-art rounded-2xl border border-dashed"
                style={{ borderColor: 'var(--hairline-strong)' }}
                aria-hidden="true"
              />
            ) : (
              cards.map((c, i) => {
                let d = i - activeIdx;
                if (d > cards.length / 2) d -= cards.length;
                if (d < -cards.length / 2) d += cards.length;
                const featured = d === 0;
                return (
                  <button
                    key={c.cardId}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-label={faceFor(c, accounts).label}
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
                    <AccountCardPlastic face={faceFor(c, accounts)} />
                  </button>
                );
              })
            )}
          </div>

          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {state === 'loading'
                ? 'Reading your cards'
                : `${cards.length} card${cards.length === 1 ? '' : 's'} issued to you`}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1
                className="serif text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]"
                style={{ color: 'var(--text-primary)' }}
              >
                {face ? face.label : 'Your cards.'}
              </h1>
              {card && <StatusChip card={card} />}
            </div>

            {card && face ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {SCHEME_LABEL[card.scheme]} debit · <span className="font-mono">{card.panMasked}</span>{' '}
                · expires {face.expiry} ·{' '}
                {linkedAccount ? `spends from ${linkedAccount.name}` : 'on your account'}
              </p>
            ) : (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                A card appears here when the bank issues one against your accounts.
              </p>
            )}

            <div className="mt-6 space-y-2.5">
              <div className="stat-row">
                <span className="action-tile-icon h-9 w-9 rounded-xl">
                  <Glyph name="chart" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {state === 'loading' ? '—' : fmt(series.total, card?.currency)}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Spent on this card · last {WINDOW_DAYS} days
                  </span>
                </span>
              </div>

              <div className="stat-row">
                <span className="action-tile-icon h-9 w-9 rounded-xl">
                  <Glyph name="current" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {state === 'loading' || !linkedAccount
                      ? '—'
                      : fmt(linkedAccount.available, linkedAccount.currency)}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Available on the account it spends from
                  </span>
                </span>
              </div>

              <div className="stat-row">
                <span className="action-tile-icon h-9 w-9 rounded-xl">
                  <Glyph name="contactless" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {state === 'loading' ? '—' : book.payments}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    Card payments across all your cards · last {WINDOW_DAYS} days
                  </span>
                </span>
              </div>
            </div>

            {card && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleFreeze}
                  disabled={busy !== null || blocked}
                  className={card.status === 'FROZEN' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  <Glyph name="snowflake" className="h-3.5 w-3.5" />
                  {card.status === 'FROZEN' ? 'Unfreeze card' : 'Freeze card'}
                </button>
                <Link href="/portal/transactions" className="btn btn-ghost btn-sm">
                  All account activity
                </Link>
              </div>
            )}
          </div>
        </div>

        {card && (blocked || expired) && (
          <p className="glass-foot relative">
            {expired && !blocked
              ? 'This card is past its expiry date, so it cannot be used. Ask your relationship manager to issue a replacement.'
              : `${CARD_STATUS_LABEL[card.status]}${card.statusReason ? `: ${card.statusReason}` : ''}. Its controls are locked and a replacement has to be issued.`}
          </p>
        )}
      </section>

      {actionError && (
        <p className="glass-panel px-5 py-3 text-sm" role="status" style={{ color: 'var(--down)' }}>
          {actionError}
        </p>
      )}

      {/* ══ Cards | details ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel flex flex-col xl:col-span-4" aria-label="Your cards">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Your cards</h2>
              <p className="glass-sub">Select one to manage it.</p>
            </div>
            <Link href="/portal/accounts" className="ring-btn shrink-0 !h-9 !w-9" aria-label="Your accounts">
              <Glyph name="bank" className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>

          {state === 'loading' ? (
            <div className="px-6 pb-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="skeleton h-11 w-[68px] rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3.5 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="glass-body">
              <div className="empty-state !py-8">
                <div className="empty-state-icon">
                  <Glyph name="current" className="h-6 w-6" />
                </div>
                <p className="empty-state-title">No cards issued yet</p>
                <p className="empty-state-text">
                  A current account is normally issued a debit card. Nothing is recorded against
                  your accounts yet, so ask your relationship manager to order one.
                </p>
                <Link href="/portal/messages" className="btn btn-primary btn-sm mt-4">
                  Message your manager
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {cards.map((c, i) => {
                const selected = card?.cardId === c.cardId;
                const acc = accounts.find(a => a.id === c.accountId);
                return (
                  <button
                    key={c.cardId}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-pressed={selected}
                    className="glass-row w-full text-left"
                    style={selected ? { backgroundColor: 'var(--brand-soft)' } : undefined}
                  >
                    <MiniCardPlastic face={faceFor(c, accounts)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {faceFor(c, accounts).label}
                        </span>
                        {c.status !== 'ACTIVE' && (
                          <span className="badge badge-warning shrink-0 !py-0.5 !text-xs">
                            {CARD_STATUS_LABEL[c.status]}
                          </span>
                        )}
                      </span>
                      <span className="num block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {SCHEME_LABEL[c.scheme]} · •••• {c.panLast4} · expires {expiryLabel(c)}
                      </span>
                      {acc && (
                        <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                          {acc.name} · {fmt(acc.available, acc.currency)} available
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
        </section>

        {/* Card details */}
        <section className="glass-panel xl:col-span-8" aria-label="Card details">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Card details</h2>
              <p className="glass-sub">
                {card
                  ? `Issued ${longDate(card.issuedAt)}${
                      card.activatedAt ? ` · activated ${longDate(card.activatedAt)}` : ''
                    }`
                  : 'The number, expiry and codes on your card.'}
              </p>
            </div>
            {card && (
              <span className="chip shrink-0">
                {card.deliveryStatus === 'DELIVERED'
                  ? 'Card delivered'
                  : `Card ${card.deliveryStatus.toLowerCase().replace(/_/g, ' ')}`}
              </span>
            )}
          </div>

          {card ? (
            <>
              <div className="pb-2">
                <div className="glass-row">
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Card holder
                    </span>
                    <span className="block text-base" style={{ color: 'var(--text-primary)' }}>
                      {card.cardHolderName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {SCHEME_LABEL[card.scheme]} {card.cardType.toLowerCase()} card
                  </span>
                </div>

                <RevealField
                  card={card}
                  credential="PAN"
                  label="Card number"
                  standingValue={card.panMasked}
                  announce={announce}
                />
                <RevealField
                  card={card}
                  credential="EXPIRY"
                  label="Expiry date"
                  standingValue={face?.expiry ?? '—'}
                  announce={announce}
                />
                <RevealField
                  card={card}
                  credential="CVV"
                  label="CVV"
                  standingValue="•••"
                  announce={announce}
                />
                <RevealField
                  card={card}
                  credential="PIN"
                  label="PIN"
                  standingValue="••••"
                  announce={announce}
                />

                <div className="glass-row">
                  <span className="min-w-0 flex-1">
                    <label
                      className="block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                      htmlFor="card-nickname"
                    >
                      Name this card
                    </label>
                    <input
                      id="card-nickname"
                      className="input mt-1 max-w-xs !py-2 text-sm"
                      value={nicknameDraft}
                      maxLength={60}
                      placeholder={face?.label}
                      onChange={e => setNicknameDraft(e.target.value)}
                    />
                  </span>
                  <button
                    type="button"
                    onClick={saveNickname}
                    disabled={busy !== null || nicknameDraft.trim() === (card.nickname ?? '')}
                    className="btn btn-secondary btn-sm shrink-0 disabled:opacity-40"
                  >
                    {busy === 'Name' ? 'Saving…' : 'Save name'}
                  </button>
                </div>
              </div>

              <p className="glass-foot">
                Showing a card number, CVV or PIN is recorded against your profile, and the value
                disappears after {REVEAL_SECONDS} seconds. Nothing is revealed for a card that has
                been blocked or has expired.
              </p>
            </>
          ) : (
            <div className="glass-body">
              <div className="empty-state !py-8">
                <p className="empty-state-title">No card selected</p>
                <p className="empty-state-text">Issued cards appear on the left.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ══ Controls | spending ══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="glass-panel" aria-label="Card controls">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Card controls</h2>
              <p className="glass-sub">
                {card ? `${face?.label} · •••• ${card.panLast4}` : 'Choose a card to change its settings.'}
              </p>
            </div>
          </div>

          {card ? (
            <div className="pb-2">
              {CONTROLS.map(c => {
                const enabled = controlValue(card, c.key);
                return (
                  <div key={String(c.key)} className="glass-row">
                    <span className="action-tile-icon h-9 w-9 shrink-0 rounded-xl">
                      <Glyph name={c.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.label}
                      </span>
                      <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {unusable ? 'Unavailable while the card cannot be used' : c.desc}
                      </span>
                    </span>
                    <ControlSwitch
                      label={c.label}
                      checked={enabled}
                      disabled={busy !== null || unusable}
                      onChange={() => toggleControl(c.key, !enabled)}
                    />
                  </div>
                );
              })}

              <div className="glass-body !pb-0">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Limits
                </h3>
                <div className="mt-3 space-y-3">
                  {LIMITS.map(l => (
                    <div key={String(l.key)} className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {l.label}
                        </span>
                        <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                          {l.hint} · up to {fmt(l.max, card.currency)}
                        </span>
                      </span>
                      <label className="sr-only" htmlFor={`limit-${String(l.key)}`}>
                        {l.label}
                      </label>
                      <input
                        id={`limit-${String(l.key)}`}
                        type="number"
                        min={0}
                        max={l.max}
                        step={5}
                        value={limitsDraft[String(l.key)] ?? ''}
                        disabled={busy !== null || unusable}
                        onChange={e =>
                          setLimitsDraft(prev => ({ ...prev, [String(l.key)]: e.target.value }))
                        }
                        className="input w-28 !py-2 text-right text-sm tabular-nums disabled:opacity-40"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-4 w-full"
                  disabled={busy !== null || unusable}
                  onClick={saveLimits}
                >
                  {busy === 'Limits' ? 'Saving…' : 'Save limits'}
                </button>
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
        </section>

        <section className="glass-panel" aria-label="Card spending">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Card spending</h2>
              <p className="glass-sub">{card ? `${face?.label} · ${series.range}` : `All your cards · ${book.range}`}</p>
            </div>
            {series.lastPaid && (
              <span className="chip shrink-0">
                Last payment {shortDate(new Date(series.lastPaid).toISOString())}
              </span>
            )}
          </div>

          <div className="glass-body">
            <p className="num text-[26px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {state === 'loading' ? '—' : fmt(series.total, card?.currency)}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {series.activeDays
                ? `over ${series.activeDays} active day${series.activeDays === 1 ? '' : 's'} · ${series.payments} completed card payment${series.payments === 1 ? '' : 's'}`
                : 'nothing was paid on this card in this window'}
            </p>

            <div className="mt-5 flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <DotMatrix
                  data={series.chartSeries.map(d => d.total)}
                  box={{ width: 160, height: 56 }}
                  stretch
                  label={`Card spending in three-day totals over ${WINDOW_DAYS} days`}
                  format={(value, i) =>
                    `To ${shortDate(series.chartSeries[i].date)} · ${fmt(value, card?.currency)}`
                  }
                />
              </div>
              {series.peak > 0 && (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span className="chart-marker">{fmt(series.peak, card?.currency)}</span>
                  <span className="marker-leader h-8" aria-hidden="true" />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    peak day
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="glass-foot">
            Only completed payments the ledger attributes to this card are counted. Transfers, cash
            and direct debits sit against the account, not the plastic.
          </p>
        </section>
      </div>

      {/* ══ Activity | lost, stolen, cancel ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel xl:col-span-8" aria-label="Recent card activity">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">Recent card activity</h2>
              <p className="glass-sub">
                {card ? `Payments made on •••• ${card.panLast4}.` : 'Payments made on your cards.'}
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
                <p className="empty-state-title">No payments on this card yet</p>
                <p className="empty-state-text">
                  {card
                    ? `Nothing has been paid with •••• ${card.panLast4} in the history read. Transfers and direct debits are account activity, and they are on the transactions page.`
                    : 'Payments made with a card will appear here as soon as they post.'}
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
                  <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
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

        <section className="glass-panel xl:col-span-4" aria-label="Lost, stolen or cancelled cards">
          <div className="glass-head">
            <div>
              <h2 className="glass-title">If the card is gone</h2>
              <p className="glass-sub">Reporting it blocks the card permanently.</p>
            </div>
          </div>

          {card ? (
            <>
              <div className="px-6 pb-2 pt-1">
                {blocked ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    This card is {CARD_STATUS_LABEL[card.status].toLowerCase()}
                    {card.statusReason ? ` — ${card.statusReason.toLowerCase()}` : ''}. It cannot be
                    unblocked from here; the bank issues a replacement instead.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {REQUEST_ACTIONS.map(action => (
                      <div key={action.type}>
                        <button
                          type="button"
                          onClick={() => setConfirming(confirming === action.type ? null : action.type)}
                          disabled={busy !== null}
                          className={
                            action.ghost ? 'btn btn-ghost btn-sm w-full' : 'btn btn-secondary btn-sm w-full'
                          }
                        >
                          {action.label}
                        </button>
                        {confirming === action.type && (
                          <div
                            className="mt-2 rounded-2xl p-3 text-sm"
                            style={{ border: '1px solid var(--hairline-strong)' }}
                          >
                            <p style={{ color: 'var(--text-secondary)' }}>
                              {action.type === 'CANCEL'
                                ? 'Cancelling closes this card. Nothing can be spent on it again, and no replacement is sent.'
                                : 'This blocks the card immediately and files a replacement with the bank. It cannot be undone from the portal.'}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={busy !== null}
                                onClick={() => fileRequest(action.type)}
                              >
                                {busy === 'Request' ? 'Filing…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setConfirming(null)}
                              >
                                Not now
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-foot">
                {requests.length === 0 ? (
                  'No requests filed against this card.'
                ) : (
                  <ul className="space-y-2">
                    {requests.map(r => (
                      <li key={r.requestId} className="flex items-baseline justify-between gap-3 text-xs">
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {CARD_REQUEST_LABEL[r.requestType]}
                        </span>
                        <span className="shrink-0 font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {r.status === 'PENDING' ? 'awaiting the bank' : r.status.toLowerCase()} ·{' '}
                          {shortDate(new Date(r.createdAt).toISOString())}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="glass-body">
              <div className="empty-state !py-8">
                <p className="empty-state-title">Nothing to report</p>
                <p className="empty-state-text">These actions apply to an issued card.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
