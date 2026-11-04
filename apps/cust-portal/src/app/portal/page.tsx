'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RequestMoneyDialog } from '@/components/payments/RequestMoneyDialog';
import { useAIPreferences } from '@/lib/ai-preferences';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNTS,
  TRANSACTIONS,
  setActiveTransactions,
  recentTransactions,
  groupTransactionsByDay,
  type BankAccount,
  type Transaction,
} from '@/lib/banking-data';
import { accountService, type AccountSource } from '@/services/api/account-service';
import { transactionService, type TransactionSource } from '@/services/api/transaction-service';
import { AccountPlastic } from '@/components/banking/AccountPlastic';
import { EyeToggle } from '@/components/ui/EyeToggle';
import Glyph, { CurrencyGlyph, glyphFor, GlyphTile } from '@/components/ui/Glyph';
import {
  taskService,
  type TaskCountResponse,
} from '@/services/api/task-service';
import {
  applicationService,
  type LoanApplication,
  STATUS_LABELS,
  STATUS_COLORS,
  LOAN_PURPOSE_LABELS,
  type LoanPurpose,
} from '@/services/api/application-service';
import { aiSignalsService, type CustomerSignal } from '@/services/api/ai-signals-service';

/* ─── helpers ──────────────────────────────────────────────── */
function fmtEUR(n: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function txTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function signedEUR(n: number): string {
  return `${n >= 0 ? '+' : '−'}${fmtEUR(Math.abs(n))}`;
}

/* The fetch keeps 92 days so the recent rows stay populated even if the live feed
   lags; the panel itself only ever shows the newest handful. */
const FETCH_DAYS = 92;
const ACTIVITY_ROWS = 6;

/* Quiet, informational progress: where an application actually sits in the
   lifecycle. Shown as a plain step line, not as a score or reward. */
const JOURNEY_STEPS = ['Applied', 'Identity & KYC', 'Documents', 'Credit review', 'Offer', 'Signing & funding'];
const JOURNEY_MATCH: string[][] = [
  ['DRAFT', 'SUBMITTED', 'RETURNED'],
  ['PENDING_KYC', 'KYC_APPROVED', 'KYC_REJECTED'],
  ['PENDING_DOCUMENTS', 'DOCUMENTS_RECEIVED'],
  [
    'PENDING_CREDIT_CHECK',
    'CREDIT_APPROVED',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_DECISION',
    'UNDERWRITING_APPROVED',
  ],
  [
    'APPROVED',
    'OFFER_GENERATED',
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'OFFER_COUNTERED',
    'PENDING_CONDITIONS',
    'CONDITIONS_MET',
  ],
  [
    'PENDING_ESIGN',
    'ESIGN_IN_PROGRESS',
    'ESIGN_COMPLETED',
    'PENDING_BOOKING',
    'BOOKING_IN_PROGRESS',
    'BOOKED',
    'PENDING_DISBURSEMENT',
    'DISBURSEMENT_IN_PROGRESS',
    'DISBURSED',
  ],
];

function journeyStep(status: string): number {
  return JOURNEY_MATCH.findIndex(m => m.includes(status));
}

/** How urgently this application needs the customer, not the bank. */
function appUrgency(app: LoanApplication): number {
  if (app.status === 'RETURNED' || app.lomsStatus === 'RETURNED') return 5;
  if (['PENDING_ESIGN', 'ESIGN_IN_PROGRESS'].includes(app.status)) return 4;
  if (
    app.offerValidUntil != null &&
    !app.offerAccepted &&
    new Date(app.offerValidUntil).getTime() > Date.now()
  ) {
    return 3;
  }
  if ((app.documentsPendingCount ?? 0) > 0) return 2;
  if (app.status === 'DRAFT') return 1;
  return 0;
}

const appNeedsYou = (app: LoanApplication) => appUrgency(app) > 0;

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

const SIGNAL_ACRONYMS: Record<string, string> = {
  Kyc: 'KYC',
  Aml: 'AML',
  Ai: 'AI',
  Otp: 'OTP',
};

function formatSignalType(signalType: string): string {
  return signalType
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .split(' ')
    .map(w => SIGNAL_ACRONYMS[w] ?? w)
    .join(' ');
}

/* ─── small presentational pieces ────────────────────────────── */

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      style={{ borderColor: 'var(--hairline-strong)', color: 'var(--text-secondary)' }}
    >
      {children}
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/* The verbs, not the destinations — the bottom bar already carries Home, Accounts,
   Payments and Applications on a phone. */
type ProductTile =
  | { href: string; label: string; glyph: string }
  | { request: true; label: string };

/* Ask Rayva keeps its permanent home in the top bar, so the six tile slots go to
   verbs and destinations that are not already one tap away everywhere else. */
const PRODUCT_TILES: ProductTile[] = [
  { href: '/portal/payments', label: 'Send money', glyph: 'send' },
  { request: true, label: 'Request money' },
  { href: '/portal/payments', label: 'Pay bills', glyph: 'Bills' },
  { href: '/portal/cards', label: 'Cards', glyph: 'current' },
  { href: '/portal/products', label: 'Loans', glyph: 'bank' },
  { href: '/portal/documents', label: 'Statements', glyph: 'doc' },
];

/* ─── main component ─────────────────────────────────────────── */
export default function PortalDashboard() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const { preferences, ready } = useAIPreferences();

  /* Accounts are fetched first, and lines are only requested when those accounts are
     real. Sample accounts next to a live transaction list — or the reverse — would put
     two different customers on one screen, so the halves move over together. */
  const [accounts, setAccounts] = useState<BankAccount[]>(ACCOUNTS);
  const [accountSource, setAccountSource] = useState<AccountSource>('SAMPLE');
  const [txnSource, setTxnSource] = useState<TransactionSource>('SAMPLE');
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const acct = await accountService.getAccountsSnapshot();
      if (cancelled) return;

      const txn =
        acct.source === 'LIVE'
          ? await transactionService.getTransactionsSnapshot({
              from: new Date(Date.now() - FETCH_DAYS * 86400000).toISOString().slice(0, 10),
            })
          : {
              transactions: TRANSACTIONS,
              source: 'SAMPLE' as TransactionSource,
              sampleReason: acct.sampleReason ?? ('NO_LIVE_ACCOUNTS' as const),
              totalElements: TRANSACTIONS.length,
              truncated: false,
            };
      if (cancelled) return;

      setActiveTransactions(txn.transactions);
      setAccounts(acct.accounts);
      setAccountSource(acct.source);
      setTxnSource(txn.source);
      setDataReady(true);
    })().catch(() => {
      /* Both services already degrade to labelled sample data internally, so reaching here
         means something unexpected; the sample set stays on screen rather than a blank page. */
      if (!cancelled) setDataReady(true);
    });
    return () => {
      cancelled = true;
      setActiveTransactions(TRANSACTIONS);
    };
  }, []);

  const txns = useMemo(() => recentTransactions(ACTIVITY_ROWS), [dataReady]);
  const txnGroups = useMemo(() => groupTransactionsByDay(txns), [txns]);
  /* The primary account also decides the request-money tile's currency symbol. */
  const mainCurrency =
    accounts.find(a => a.primary)?.currency ??
    accounts.find(a => a.type === 'CURRENT')?.currency ??
    accounts[0]?.currency ??
    'EUR';
  /* One switch for the whole page: hiding the card amounts hides the activity
     amounts too, so a shoulder-surfer gets nothing. */
  const mask = (value: string) => (hideBalance ? '••••••' : value);

  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [appLoading, setAppLoading] = useState(true);
  const [taskCount, setTaskCount] = useState(0);
  const [realSignals, setRealSignals] = useState<CustomerSignal[]>([]);

  useEffect(() => {
    applicationService
      .list(0, 100)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setAppLoading(false));
    taskService
      .countPending()
      .then((r: TaskCountResponse) => setTaskCount(r.pendingCount))
      .catch(() => setTaskCount(0));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRealSignals([]);
    if (!ready || !preferences.insights) return;
    aiSignalsService.getSignals()
      .then(s => { if (!cancelled) setRealSignals(s.activeSignals || []); })
      .catch(() => { if (!cancelled) setRealSignals([]); });
    return () => { cancelled = true; };
  }, [ready, preferences.insights]);

  /* Updates are folded into the application rows rather than shown as their own
     band: the same status repeated in a separate strip and again on each row
     read as noise. The detail lives in the application's own review. */
  const signalsByApp = useMemo(() => {
    const map = new Map<string, CustomerSignal[]>();
    realSignals.forEach(sig => {
      const id = typeof sig.evidence?.applicationId === 'string' ? sig.evidence.applicationId : null;
      if (!id) return;
      const bucket = map.get(id);
      if (bucket) bucket.push(sig);
      else map.set(id, [sig]);
    });
    return map;
  }, [realSignals]);

  const terminal = useMemo(
    () => new Set(['COMPLETED','WITHDRAWN','CANCELLED','DECLINED','EXPIRED','UNDERWRITING_DECLINED','CREDIT_DECLINED','KYC_REJECTED','OFFER_REJECTED','OFFER_EXPIRED','CLOSED']),
    []
  );
  const activeApps = useMemo(() => apps.filter(a => !terminal.has(a.status)), [apps, terminal]);
  const featuredApp = useMemo(() => {
    const active = [...activeApps];
    if (active.length > 0) {
      active.sort(
        (a, b) =>
          appUrgency(b) - appUrgency(a) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return active[0];
    }
    return (
      [...apps].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0] ?? null
    );
  }, [apps, activeApps]);

  return (
    <div className="stagger space-y-5">
      {/* The top bar renders the page name as a <p> so each page owns its single
          <h1>; this page's heading is not part of the visual design. */}
      <h1 className="sr-only">Overview</h1>

      {/* ══ Accounts ══
          First after login: what the customer holds, as the plastics themselves
          rather than one total drawn over them. The eye hides every amount on the
          page, this section's and the activity below. */}
      <section className="glass-panel" aria-label="Your accounts">
        <div className="glass-head flex-col gap-3 sm:flex-row">
          <div className="min-w-0">
            <h2 className="glass-title">Accounts</h2>
            <p className="glass-sub">
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · tap one to open it ·{' '}
              {accountSource === 'LIVE' ? 'Live balances' : 'Sample data'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EyeToggle hidden={hideBalance} onToggle={() => setHideBalance(v => !v)} />
            <PillLink href="/portal/accounts">View all</PillLink>
          </div>
        </div>

        <div className="acct-list">
          {accounts.map(acc => (
            <Link key={acc.id} href={`/portal/accounts/${acc.id}`} aria-label={acc.name}>
              <AccountPlastic acc={acc} hidden={hideBalance} />
            </Link>
          ))}
        </div>
      </section>

      {/* Screen-reader announcement for the balance visibility toggle */}
      <p className="sr-only" aria-live="polite">
        {hideBalance ? 'Balances hidden' : 'Balances shown'}
      </p>

      {/* ══ Products at your fingertips ══
          The verbs, under the balances. */}
      <section aria-label="Banking products and services">
        <div className="mb-3 px-1">
          <h2 className="serif text-[21px] font-medium" style={{ color: 'var(--text-primary)' }}>
            At your fingertips
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            Everyday banking, one tap away.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          {PRODUCT_TILES.map(tile => {
            const body = (
              <>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {'request' in tile ? (
                    <CurrencyGlyph currency={mainCurrency} className="h-8 w-8" strokeWidth={1.6} />
                  ) : (
                    <Glyph name={tile.glyph} className="h-8 w-8" strokeWidth={1.6} />
                  )}
                </span>
                <span
                  className="whitespace-nowrap text-[13px] font-medium lg:text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {tile.label}
                </span>
              </>
            );
            const tileClass =
              'group flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border px-1 py-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:min-h-[136px] sm:px-2';
            const tileStyle = {
              borderColor: 'var(--hairline)',
              backgroundColor: 'var(--tile-bg)',
            };

            return 'href' in tile ? (
              <Link key={tile.label} href={tile.href} className={tileClass} style={tileStyle}>
                {body}
              </Link>
            ) : (
              <button
                key={tile.label}
                type="button"
                onClick={() => setRequestOpen(true)}
                aria-haspopup="dialog"
                className={tileClass}
                style={tileStyle}
              >
                {body}
              </button>
            );
          })}
        </div>
      </section>

      {/* ══ Recent activity ══ */}
      <section className="glass-panel overflow-hidden" aria-label="Recent activity">
        <div className="glass-head">
          <div>
            <h2 className="glass-title">Recent activity</h2>
            <p className="glass-sub">
              {txnSource === 'LIVE'
                ? 'Your newest movements'
                : 'Sample activity — this profile has no live transaction feed'}
            </p>
          </div>
          <PillLink href="/portal/transactions">View all</PillLink>
        </div>
        {txnGroups.length === 0 ? (
          <p className="px-6 pb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Nothing has moved through your accounts yet. Transactions appear here as soon as they do.
          </p>
        ) : (
          <div className="pb-2">
            {txnGroups.map(group => {
              const net = group.items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
              return (
                <div key={group.label}>
                  <div className="flex items-center justify-between px-6 pb-2 pt-5">
                    <span className="dash-day">{group.label}</span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {mask(signedEUR(net))}
                    </span>
                  </div>
                  <div className="divide-token">
                    {group.items.map((t: Transaction) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      >
                        <GlyphTile name={glyphFor(t.category)} className="h-10 w-10 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t.merchant}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t.category} · {txTime(t.date)}
                          </p>
                        </div>
                        {/* Amount carries its own caption, so the state reads without
                            a badge competing for the same row space. */}
                        <div className="shrink-0 text-right">
                          <p
                            className={`num text-base font-semibold ${t.direction === 'IN' ? 'delta-up' : ''}`}
                            style={t.direction !== 'IN' ? { color: 'var(--text-primary)' } : undefined}
                          >
                            {t.direction === 'IN' ? '+' : '−'}{mask(fmtEUR(t.amount))}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t.direction === 'IN'
                              ? 'Income'
                              : t.status === 'PENDING'
                                ? 'Pending'
                                : t.status === 'DECLINED'
                                  ? 'Declined'
                                  : 'Spending'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══ Applications + relationship ══ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="glass-panel overflow-hidden xl:col-span-8" aria-label="Loans and applications">
          <div className="glass-head">
            <div className="flex items-center gap-2">
              <h2 className="glass-title">Loans &amp; applications</h2>
              {taskCount > 0 && <span className="badge badge-warning">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>}
            </div>
            <PillLink href="/portal/applications">View all</PillLink>
          </div>
          {appLoading ? (
            <div className="space-y-3 px-6 pb-6">
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !featuredApp ? (
            <div className="px-6 pb-6">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="empty-state-title">No applications yet</p>
                <p className="empty-state-text">When you apply for a loan or credit product, you&apos;ll be able to track its progress here.</p>
                <Link href="/portal/products" className="btn btn-primary btn-sm mt-4">Explore products</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-token">
                {[featuredApp].map(app => {
                  const updates = signalsByApp.get(app.applicationId) ?? [];
                  const step = journeyStep(app.status);
                  const needsYou = appNeedsYou(app);

                  return (
                    <Link
                      key={app.applicationId}
                      href={`/portal/applications/${app.applicationId}`}
                      className="group flex items-start gap-4 px-6 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      <div className="dash-icon dash-icon-sq h-11 w-11 shrink-0">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {app.product?.productName || LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
                          </p>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-700'}`}>
                            {STATUS_LABELS[app.status] || app.status}
                          </span>
                          {needsYou && <span className="badge badge-primary">Needs you</span>}
                          {updates.length > 0 && (
                            <span
                              className="dash-update-chip"
                              title={updates.map(s => formatSignalType(s.signalType)).join(', ')}
                            >
                              {updates.length} update{updates.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {app.applicationNumber} · {formatCurrency(app.requestedAmount)}
                        </p>
                        {!terminal.has(app.status) && step >= 0 && (
                          <div className="mt-3">
                            <div className="flex items-center gap-1.5" aria-hidden="true">
                              {JOURNEY_STEPS.map((s, i) => {
                                const reached = i <= step;
                                return (
                                  <span
                                    key={s}
                                    className="h-1.5 flex-1 rounded-full"
                                    style={{
                                      backgroundColor: reached
                                        ? 'var(--brand)'
                                        : 'var(--hairline-strong)',
                                      opacity: reached && i < step ? 0.55 : 1,
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              Step {step + 1} of {JOURNEY_STEPS.length} · {JOURNEY_STEPS[step]}
                            </p>
                          </div>
                        )}
                      </div>
                      <svg
                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        style={{ color: 'var(--text-muted)' }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
              <div
                className="glass-foot flex flex-wrap items-center justify-between gap-2 !text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>{activeApps.length} active · {apps.length} total</span>
                <Link href="/portal/products" className="link-arrow">
                  Apply for more <span data-arrow aria-hidden="true">→</span>
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Relationship manager + support */}
        <section
          className="glass-panel flex flex-col justify-center overflow-hidden xl:col-span-4"
          aria-label="Your relationship manager"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'var(--brand-soft)',
                  color: 'var(--brand-on-soft)',
                  border: '1px solid var(--hairline)',
                }}
                aria-hidden="true"
              >
                <Glyph name="user" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="serif text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                  Your relationship manager
                </h2>
                <p className="mt-0.5 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                  Here to help with your accounts and applications.
                </p>
              </div>
            </div>

            <Link href="/portal/messages" className="btn btn-primary btn-sm mt-5 w-full">
              <Glyph name="send" className="h-3.5 w-3.5" strokeWidth={2} />
              Message your manager
            </Link>
          </div>
        </section>
      </div>

      {/* The bands that used to sit here — spending categories, daily spend, card
          usage — are on Insights, which the overview now only points at. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 text-sm">
        <Link href="/portal/insights" className="link-arrow">
          Where the money went <span data-arrow aria-hidden="true">→</span>
        </Link>
      </div>

      <RequestMoneyDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
