'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import config from '@/config';
import { useAppSelector } from '@/store';
import { compactCurrency, formatCurrency } from '@/lib/format';
import KpiRow, { ShareBar, StageBar, type KpiCard } from '@/components/dashboard/KpiRow';
import { DotGroups, DotMatrix, DottedRing, rampTone } from '@/components/dashboard/DotMatrix';
import {
  bankAnalyticsService,
  type AnalyticsPeriod,
  type BankExecutiveOverview,
  type ChannelMix,
  type MonthlyBankFlow,
} from '@/services/api/bank-analytics-service';
import { dashboardService, type DashboardKpis, type TrendPoint } from '@/services/api/dashboard-service';
import { userService, type User } from '@/services/api/userService';
import { customerService, type Customer } from '@/services/api/customerService';
import { aiKnowledgeService, type KnowledgeSource } from '@/services/api/aiKnowledgeService';

/*
 * Bank-wide executive overview.
 *
 * Every figure is a service response: account and transaction aggregates from account-service,
 * bank-wide lending from the dashboard oversight endpoints, and the user and customer registers
 * from bff-admin. Nothing on this page is invented.
 *
 * Where a measure an executive would expect genuinely cannot be sourced, the page says so in
 * words — see "What this page cannot answer" at the foot — rather than substituting a proxy.
 */

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
];

/** Weekly origination buckets. 12 fits its column at the pitch the dot grids use. */
const ORIGINATION_WEEKS = 12;

/** Sign-in recency window, in days. */
const RECENT_SIGN_IN_DAYS = 30;

/* Outline glyphs taken verbatim from the Heroicons already in this app, drawn in currentColor on
   a token-painted tile. No subject gets its own hue — the theme decides colour. */
const GLYPH = {
  bank: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  deposits:
    'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  payments:
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  money:
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  people:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  lending:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  shield:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332-.477-4.5 1.253',
  refresh:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  chevron: 'M9 5l7 7-7 7',
  temple: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6v3H3V9zM3 21h18',
};

function Glyph({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

/* ─── formatting ─── */

function monthLabel(yyyyMm: string): string {
  const d = new Date(`${yyyyMm}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMm;
  return d.toLocaleDateString('en-GB', { month: 'short' });
}

function percentText(value?: number | null, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

/** Signed change between two real periods, or null when there is nothing to compare. */
function deltaOf(current?: number | null, prior?: number | null, label = '') {
  if (current === undefined || current === null || !prior) return null;
  return { pct: ((current - prior) / prior) * 100, label };
}

function sumOf<T>(rows: T[], pick: (row: T) => number | undefined): number {
  return rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
}

function netIncomeOf(m?: MonthlyBankFlow): number {
  if (!m) return 0;
  return (m.feeIncome ?? 0) + (m.interestReceived ?? 0) - (m.interestPaid ?? 0);
}

/** A share of a stated whole, guarding the zero denominator rather than printing Infinity. */
function shareOf(part: number | undefined, whole: number | undefined): number {
  if (!whole || whole <= 0) return 0;
  return ((part ?? 0) / whole) * 100;
}

/* ─── layout primitives ─── */

function Panel({
  id,
  title,
  note,
  aside,
  children,
  foot,
}: {
  id: string;
  title: string;
  note?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  const headingId = `exec-${id}`;
  return (
    <section className="rm-panel" aria-labelledby={headingId}>
      <div className="rm-panel-head">
        <div className="min-w-0">
          <h2 className="rm-title" id={headingId}>
            {title}
          </h2>
          {note && <p className="rm-sub">{note}</p>}
        </div>
        {aside}
      </div>
      <div className="rm-body">{children}</div>
      {foot && <div className="rm-foot">{foot}</div>}
    </section>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
      ))}
    </div>
  );
}

/** Labelled figure — quiet by design, so it never competes with the hero or the KPI band. */
function Figure({
  label,
  value,
  hint,
  tone = 'var(--rm-text)',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </p>
      <p className="num mt-1 text-lg font-semibold" style={{ color: tone }} title={hint}>
        {value}
      </p>
    </div>
  );
}

/** One proportional row: name, a bar against the stated whole, and the amount. */
function CompositionRow({
  label,
  detail,
  value,
  share,
  tone = 'var(--rm-brand)',
}: {
  label: string;
  detail?: string;
  value: string;
  share: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium capitalize" style={{ color: 'var(--rm-text)' }}>
          {label}
        </p>
        {detail && (
          <p className="truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {detail}
          </p>
        )}
      </div>
      <div className="w-24 shrink-0">
        <ShareBar pct={share} color={tone} />
      </div>
      <p className="num w-24 shrink-0 text-right text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
        {value}
      </p>
      <p className="num w-14 shrink-0 text-right text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {percentText(share, 0)}
      </p>
    </div>
  );
}

/** Dot grids keep their own width, so a wider window scrolls rather than squashing the dots. */
function ScrollGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'thin' }}>
      {children}
    </div>
  );
}

/* ─── the page ─── */

export default function ExecutiveOverview() {
  const { user } = useAppSelector(state => state.auth);

  const bankId = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(config.auth.userKey);
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored?.bankId) return stored.bankId as string;
        }
      } catch {
        /* unreadable session — fall back to the configured bank */
      }
    }
    return user?.bankId || config.bank.defaultBankId;
  }, [user?.bankId]);

  const [period, setPeriod] = useState<AnalyticsPeriod>(12);

  const [overview, setOverview] = useState<BankExecutiveOverview | null>(null);
  const [lending, setLending] = useState<DashboardKpis | null>(null);
  const [flows, setFlows] = useState<MonthlyBankFlow[] | null>(null);
  const [channels, setChannels] = useState<ChannelMix[] | null>(null);
  const [origination, setOrigination] = useState<TrendPoint[] | null>(null);
  const [staff, setStaff] = useState<User[] | null>(null);
  const [rosterTotal, setRosterTotal] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* The balance-sheet read is the spine: it gates the skeleton and owns the page error state. */
  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [book, summary] = await Promise.all([
        bankAnalyticsService.getOverview(bankId),
        dashboardService.getOversightSummary(bankId),
      ]);
      setOverview(book);
      setLending(summary?.bankKpis ?? null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Executive overview failed:', err);
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  /* Every other panel loads independently and degrades to "unavailable" — one failure never
     blanks the page, and the balance sheet above still reads. */
  useEffect(() => {
    let cancelled = false;
    setPanelsLoading(true);

    const track = <T,>(p: Promise<T>): Promise<T | null> =>
      p.catch(err => {
        console.warn('Executive panel failed:', err);
        return null;
      });

    Promise.all([
      track(bankAnalyticsService.getMonthlyFlows(bankId, period)),
      track(bankAnalyticsService.getChannelMix(bankId, period)),
      track(dashboardService.getOversightTrends(bankId, undefined, ORIGINATION_WEEKS)),
      track(
        userService.getUsers({
          userType: 'BANK_USER',
          page: 0,
          size: 200,
          sort: 'createdAt,desc',
        })
      ),
      track(customerService.getAllCustomers()),
      track(aiKnowledgeService.listSources(bankId)),
    ])
      .then(([flowRows, channelRows, trendRows, roster, customerRows, sourceRows]) => {
        if (cancelled) return;
        if (flowRows) setFlows(flowRows);
        if (channelRows) setChannels(channelRows);
        if (trendRows) setOrigination(trendRows);
        if (roster) {
          setStaff(roster.content ?? []);
          setRosterTotal(typeof roster.totalElements === 'number' ? roster.totalElements : null);
        }
        if (customerRows) setCustomers(customerRows);
        if (sourceRows) setSources(Array.isArray(sourceRows) ? sourceRows : null);
      })
      .finally(() => {
        if (!cancelled) setPanelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bankId, period]);

  /* ─── derived readings ─── */

  /** Months comparable with each other. A part-month never feeds a delta. */
  const comparable = useMemo(() => (flows ?? []).filter(f => f.recorded && !f.partial), [flows]);
  const latest = comparable[comparable.length - 1];
  const prior = comparable[comparable.length - 2];
  const newest = flows && flows.length ? flows[flows.length - 1] : undefined;
  const windowMonths = (flows ?? []).filter(f => f.recorded).length;

  /** Months since an account was last opened, counted back from the newest in the window. */
  const openingGap = useMemo(() => {
    const rows = flows ?? [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].accountsOpened > 0) return rows.length - 1 - i;
    }
    return null;
  }, [flows]);

  const channelSplit = useMemo(() => {
    const rows = channels ?? [];
    const pick = (names: string[]) => rows.filter(c => names.includes(c.channel));
    return {
      selfService: pick(['ONLINE_BANKING', 'MOBILE_APP']),
      bankRun: pick(['INTERNAL', 'BATCH']),
      branch: rows.find(c => c.channel === 'BRANCH')?.transactionCount ?? 0,
      api: rows.find(c => c.channel === 'API')?.transactionCount ?? 0,
    };
  }, [channels]);

  const tally = useCallback(
    (pick: (c: Customer) => string | undefined, fallback: string): [string, number][] => {
      const map = new Map<string, number>();
      (customers ?? []).forEach(c => {
        const key = pick(c) || fallback;
        map.set(key, (map.get(key) ?? 0) + 1);
      });
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    },
    [customers]
  );

  const posture = useMemo(() => {
    const since = Date.now() - RECENT_SIGN_IN_DAYS * 86400_000;
    const roster = staff ?? [];
    return {
      byType: tally(c => c.customerType, 'Unspecified'),
      byKyc: tally(c => c.kycStatus, 'Unknown'),
      byAml: tally(c => c.amlCheckStatus, 'Unknown'),
      byRisk: tally(c => c.riskRating, 'Not rated'),
      bySegment: tally(c => c.customerSegment, 'Unsegmented'),
      withLogin: roster.length ? (customers ?? []).filter(c => c.portalUsername).length : null,
      staffSignedInRecently: roster.filter(s => s.lastLoginAt && new Date(s.lastLoginAt).getTime() >= since)
        .length,
      staffNeverSignedIn: roster.filter(s => !s.lastLoginAt).length,
    };
  }, [staff, tally]);

  const incomeEarned = (latest?.interestReceived ?? 0) + (latest?.feeIncome ?? 0);

  const kpiCards: KpiCard[] = useMemo(() => {
    if (!overview) return [];
    return [
      {
        key: 'advances',
        label: 'Advanced to customers',
        tone: 'accent',
        value: <span title={formatCurrency(overview.advanceBookTotal)}>{compactCurrency(overview.advanceBookTotal)}</span>,
        note: 'funded entirely from deposits',
        icon: <Glyph path={GLYPH.temple} />,
        visual: (
          <StageBar
            segments={overview.advanceBook.map((slice, i) => ({
              label: slice.type,
              value: slice.ledgerBalance,
              color: 'var(--rm-brand)',
              opacity: rampTone(i, overview.advanceBook.length),
            }))}
          />
        ),
      },
      {
        key: 'volume',
        label: 'Value settled',
        tone: 'accent',
        value: latest ? compactCurrency(latest.totalValue ?? 0) : '—',
        note: latest
          ? `${latest.month} · ${latest.transactionCount.toLocaleString()} lines`
          : 'No complete month recorded',
        delta: deltaOf(latest?.totalValue, prior?.totalValue, `${latest?.month} against ${prior?.month}`),
        icon: <Glyph path={GLYPH.payments} />,
      },
      {
        key: 'income',
        label: 'Net income',
        tone: 'green',
        value: latest ? compactCurrency(netIncomeOf(latest)) : '—',
        note: latest
          ? `${latest.month} · fees ${compactCurrency(latest.feeIncome ?? 0)} less deposit interest`
          : 'No complete month recorded',
        delta: deltaOf(netIncomeOf(latest), netIncomeOf(prior), `${latest?.month} against ${prior?.month}`),
        icon: <Glyph path={GLYPH.money} />,
      },
      {
        key: 'engagement',
        label: 'Customers transacting',
        tone: 'accent',
        value: latest ? latest.activeCustomers.toLocaleString() : '—',
        note: latest
          ? `${latest.month} · across ${latest.activeAccounts} accounts`
          : 'No complete month recorded',
        icon: <Glyph path={GLYPH.people} />,
      },
      {
        key: 'pipeline',
        label: 'Applications in progress',
        tone: 'violet',
        value: lending ? lending.inProgressCount.toLocaleString() : '—',
        note: lending ? `${compactCurrency(lending.inProgressValue)} not yet advanced` : undefined,
        icon: <Glyph path={GLYPH.lending} />,
      },
    ];
  }, [overview, latest, prior, lending]);

  return (
    <div className="space-y-10 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Executive overview
          </p>
          <h1 className="serif mt-2 text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
            {overview ? (
              compactCurrency(overview.depositBookTotal)
            ) : (
              <span
                className="block h-12 w-64 max-w-full rounded-2xl animate-pulse"
                style={{ backgroundColor: 'var(--rm-card)' }}
                aria-hidden="true"
              />
            )}
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Customer money the bank holds
            {overview?.balancesAsOf && (
              <>
                {' '}
                as at{' '}
                <span className="num">
                  {new Date(overview.balancesAsOf).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </>
            )}
          </p>

          {overview && (
            <div className="mt-6 flex flex-wrap gap-2.5">
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: 'var(--rm-brand-soft)', color: 'var(--rm-brand-on-soft)' }}
              >
                <span className="num font-semibold">{percentText(overview.loanToDepositPercent)}</span> loan
                to deposit
              </span>
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--rm-up) 14%, transparent)',
                  color: 'var(--rm-up)',
                }}
              >
                <span className="num font-semibold">
                  {compactCurrency(overview.liquidity?.surplusFunding ?? 0)}
                </span>{' '}
                surplus funding
              </span>
              {customers && (
                <span
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--rm-warn) 15%, transparent)',
                    color: 'var(--rm-warn)',
                  }}
                >
                  <span className="num font-semibold">
                    {posture.byKyc.find(([k]) => k === 'PENDING')?.[1] ?? 0}
                  </span>{' '}
                  customers await KYC
                </span>
              )}
              {lastUpdated && (
                <span
                  className="rounded-full px-4 py-2 text-sm"
                  style={{ backgroundColor: 'var(--rm-glass)', color: 'var(--rm-text-muted)' }}
                >
                  Updated{' '}
                  <span className="num">
                    {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className="flex rounded-full p-1"
            style={{ backgroundColor: 'var(--rm-glass)', border: '1px solid var(--rm-glass-border)' }}
            role="group"
            aria-label="Reporting period"
          >
            {PERIODS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                aria-pressed={period === p.value}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={
                  period === p.value
                    ? { backgroundColor: 'var(--rm-brand)', color: '#fff' }
                    : { color: 'var(--rm-text-secondary)' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="rounded-full p-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-glass)', color: 'var(--rm-text-muted)' }}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <Glyph path={GLYPH.refresh} className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && (
        <section
          className="rm-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
              The bank&rsquo;s figures could not be loaded
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {error}
            </p>
          </div>
          <button type="button" onClick={loadOverview} className="rm-btn rm-btn-solid shrink-0">
            Try again
          </button>
        </section>
      )}

      {/* ══ KPI band ══ */}
      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rm-panel h-32 animate-pulse" aria-hidden="true" />
          ))}
        </div>
      ) : (
        kpiCards.length > 0 && <KpiRow cards={kpiCards} />
      )}

      {/* ══ Payments and activity ══ */}
      <Panel
        id="payments"
        title="Payments and activity"
        note={`What moved through the bank in the last ${period} months, one column per calendar month.`}
        foot={
          flows?.length ? (
            <span>
              {newest?.partial
                ? `${monthLabel(newest.month)} is the part-month to the last booked line, so it is left out of every comparison above.`
                : 'Every month in the window is complete.'}{' '}
              {windowMonths} of {flows.length} months hold any booked activity at all.
            </span>
          ) : null
        }
      >
        {panelsLoading && !flows ? (
          <PanelSkeleton rows={4} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                Settled lines, {latest ? monthLabel(latest.month) : 'last complete month'}
              </p>
              <p className="num mt-1 text-3xl font-semibold">
                {(latest?.settledCount ?? 0).toLocaleString()}
              </p>
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                of {(latest?.transactionCount ?? 0).toLocaleString()} recorded,{' '}
                {(latest?.failedCount ?? 0) + (latest?.reversalCount ?? 0)} failed or reversed
              </p>
              <ScrollGrid>
                <DotMatrix
                  data={(flows ?? []).map(f => f.settledCount)}
                  box={{ width: 300, height: 66 }}
                  label={`Settled transactions per month across ${period} months`}
                  format={(v, i) => `${flows?.[i]?.month}: ${v.toLocaleString()} settled`}
                />
              </ScrollGrid>
            </div>

            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                Value settled, {latest ? monthLabel(latest.month) : 'last complete month'}
              </p>
              <p className="num mt-1 text-3xl font-semibold">{compactCurrency(latest?.totalValue ?? 0)}</p>
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {compactCurrency(latest?.creditValue ?? 0)} credited · {compactCurrency(latest?.debitValue ?? 0)}{' '}
                debited
              </p>
              <ScrollGrid>
                <DotMatrix
                  data={(flows ?? []).map(f => f.totalValue ?? 0)}
                  box={{ width: 300, height: 66 }}
                  color="var(--rm-brand-strong)"
                  label={`Value settled per month across ${period} months`}
                  format={(v, i) => `${flows?.[i]?.month}: ${compactCurrency(v)}`}
                />
              </ScrollGrid>
            </div>

            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                Accounts and customers engaged
              </p>
              <p className="num mt-1 text-3xl font-semibold">
                {(latest?.activeAccounts ?? 0).toLocaleString()}
              </p>
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                accounts moved by {latest?.activeCustomers ?? 0} distinct customers
              </p>
              <ScrollGrid>
                <DotGroups
                  series={[
                    {
                      name: 'Accounts',
                      values: (flows ?? []).map(f => f.activeAccounts),
                      color: 'var(--rm-brand)',
                    },
                    {
                      name: 'Customers',
                      values: (flows ?? []).map(f => f.activeCustomers),
                      color: 'var(--rm-brand-strong)',
                    },
                  ]}
                  rows={9}
                  cell={4}
                  label="Accounts and distinct customers transacting, by month"
                  format={(name, v, i) => `${flows?.[i]?.month} · ${name}: ${v.toLocaleString()}`}
                />
              </ScrollGrid>
            </div>
          </div>
        )}
      </Panel>

      {/* ══ Earnings ══ */}
      <Panel
        id="income"
        title="What the book earns"
        note="Fee and interest traffic read off settled transactions. Not an accounting profit — the platform holds no general ledger."
        foot={
          flows?.length ? (
            <span>
              Across {windowMonths} recorded months the bank took{' '}
              <span className="num">{compactCurrency(sumOf(flows, f => f.feeIncome))}</span> in fees and{' '}
              <span className="num">{compactCurrency(sumOf(flows, f => f.interestReceived))}</span> in loan
              interest, and paid{' '}
              <span className="num">{compactCurrency(sumOf(flows, f => f.interestPaid))}</span> to
              depositors. Operating costs are recorded nowhere, so no profit figure exists to show.
            </span>
          ) : null
        }
      >
        {panelsLoading && !flows ? (
          <PanelSkeleton rows={4} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Income received, {latest ? monthLabel(latest.month) : 'last complete month'}
              </p>
              <CompositionRow
                label="Interest charged on lending"
                detail="Debited to borrowers on credit accounts"
                value={compactCurrency(latest?.interestReceived ?? 0)}
                share={shareOf(latest?.interestReceived, incomeEarned)}
              />
              <CompositionRow
                label="Account and payment fees"
                detail="Fee lines booked to customers"
                value={compactCurrency(latest?.feeIncome ?? 0)}
                share={shareOf(latest?.feeIncome, incomeEarned)}
                tone="var(--rm-brand-strong)"
              />

              <div className="mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-4">
                <Figure
                  label="Paid to depositors"
                  value={compactCurrency(latest?.interestPaid ?? 0)}
                  hint="Interest credited on deposit accounts — the cost of holding them"
                  tone="var(--rm-down)"
                />
                <Figure
                  label="Repaid on lending"
                  value={compactCurrency(latest?.repayments ?? 0)}
                  tone="var(--rm-up)"
                />
                <Figure label="Advanced as loans" value={compactCurrency(latest?.disbursements ?? 0)} />
                <Figure
                  label="Card spend"
                  value={compactCurrency(latest?.cardValue ?? 0)}
                  hint={`${(latest?.cardCount ?? 0).toLocaleString()} card lines`}
                />
              </div>
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {(flows ?? []).filter(f => (f.interestPaid ?? 0) > 0).length === 0
                  ? 'No interest has been credited to depositors in this window, so the payout column is empty rather than zero by policy.'
                  : `Depositors were paid interest in ${
                      (flows ?? []).filter(f => (f.interestPaid ?? 0) > 0).length
                    } of these months — it is credited on a longer cycle than it is charged.`}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Earned against paid out
              </p>
              <ScrollGrid>
                <DotGroups
                  series={[
                    {
                      name: 'Earned',
                      values: (flows ?? []).map(f => (f.interestReceived ?? 0) + (f.feeIncome ?? 0)),
                      color: 'var(--rm-brand)',
                    },
                    {
                      name: 'Paid out',
                      values: (flows ?? []).map(f => f.interestPaid ?? 0),
                      color: 'var(--rm-down)',
                    },
                  ]}
                  rows={9}
                  cell={4}
                  label="Income earned against interest paid to depositors, by month"
                  format={(name, v, i) => `${flows?.[i]?.month} · ${name}: ${compactCurrency(v)}`}
                />
              </ScrollGrid>
            </div>
          </div>
        )}
      </Panel>

      {/* ══ Funding and liquidity ══ */}
      <Panel
        id="funding"
        title="Funding and liquidity"
        note="Where the money the bank holds comes from, and how much of it is committed to borrowers."
      >
        {!overview ? (
          <PanelSkeleton rows={5} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col items-center">
              <DottedRing
                size={184}
                dots={70}
                segments={[
                  { value: overview.advanceBookTotal, opacity: 1 },
                  {
                    value: Math.max(0, overview.depositBookTotal - overview.advanceBookTotal),
                    opacity: 0.22,
                  },
                ]}
                label={`Advances of ${formatCurrency(overview.advanceBookTotal)} against deposits of ${formatCurrency(
                  overview.depositBookTotal
                )}`}
              >
                <span className="num text-2xl font-semibold">
                  {percentText(overview.loanToDepositPercent)}
                </span>
                <span className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  loan to deposit
                </span>
              </DottedRing>
              <p className="mt-4 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Deposits alone fund every advance, leaving{' '}
                <span className="num">{compactCurrency(overview.liquidity?.surplusFunding ?? 0)}</span>.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Deposits held
              </p>
              {overview.depositBook.map(slice => (
                <CompositionRow
                  key={slice.type}
                  label={slice.type.replace(/_/g, ' ')}
                  detail={`${slice.accountCount} accounts`}
                  value={compactCurrency(slice.ledgerBalance)}
                  share={shareOf(slice.ledgerBalance, overview.depositBookTotal)}
                />
              ))}
              <p className="mt-6 text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Advances out
              </p>
              {overview.advanceBook.map(slice => (
                <CompositionRow
                  key={slice.type}
                  label={slice.type.replace(/_/g, ' ')}
                  detail={`${slice.accountCount} accounts · ${compactCurrency(
                    slice.accruedInterest ?? 0
                  )} interest accrued`}
                  value={compactCurrency(slice.ledgerBalance)}
                  share={shareOf(slice.ledgerBalance, overview.advanceBookTotal)}
                  tone="var(--rm-brand-strong)"
                />
              ))}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-y-5">
                <Figure
                  label="Payable on demand"
                  value={compactCurrency(overview.liquidity?.payableBalance ?? 0)}
                  hint="Available balance across deposit accounts"
                />
                <Figure label="Holds on balances" value={compactCurrency(overview.liquidity?.holdsAmount ?? 0)} />
                <Figure label="Pending debits" value={compactCurrency(overview.liquidity?.pendingDebits ?? 0)} />
                <Figure label="Pending credits" value={compactCurrency(overview.liquidity?.pendingCredits ?? 0)} />
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                    Deposit concentration
                  </p>
                  <p className="num text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {percentText(overview.topTenDepositSharePercent, 0)} in ten names
                  </p>
                </div>
                {overview.topDepositors.slice(0, 5).map(depositor => (
                  <CompositionRow
                    key={depositor.partyId}
                    label={depositor.name}
                    detail={`${depositor.accountCount} ${
                      depositor.accountCount === 1 ? 'account' : 'accounts'
                    }${depositor.partyType ? ` · ${depositor.partyType.toLowerCase()}` : ''}`}
                    value={compactCurrency(depositor.balance)}
                    share={depositor.sharePercent ?? 0}
                  />
                ))}
                <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Held across <span className="num">{overview.depositHolders}</span> deposit holders.
                </p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* ══ Channels ══ */}
      <Panel
        id="channels"
        title="How money reaches the bank"
        note={`Every settled line in the last ${period} months, by the channel it arrived on. Bar shows share of line count.`}
        foot={
          channels?.length ? (
            <span>
              <span className="num">{sumOf(channelSplit.selfService, c => c.transactionCount).toLocaleString()}</span>{' '}
              lines came through online and mobile banking carrying{' '}
              <span className="num">
                {compactCurrency(sumOf(channelSplit.selfService, c => c.totalValue))}
              </span>
              , while <span className="num">{sumOf(channelSplit.bankRun, c => c.transactionCount).toLocaleString()}</span>{' '}
              bank-run internal and batch lines moved{' '}
              <span className="num">{compactCurrency(sumOf(channelSplit.bankRun, c => c.totalValue))}</span>.{' '}
              {channelSplit.branch === 0 && channelSplit.api === 0
                ? 'No branch or API traffic exists in the book at all.'
                : `Branch ${channelSplit.branch.toLocaleString()} lines · API ${channelSplit.api.toLocaleString()}.`}
            </span>
          ) : null
        }
      >
        {!channels || channels.length === 0 ? (
          <PanelSkeleton rows={4} />
        ) : (
          <div className="grid gap-x-10 gap-y-1 lg:grid-cols-2">
            {channels.map(channel => (
              <CompositionRow
                key={channel.channel}
                label={channel.channelDisplay}
                detail={`${channel.transactionCount.toLocaleString()} lines · ${percentText(
                  channel.valueSharePercent
                )} of value`}
                value={compactCurrency(channel.totalValue ?? 0)}
                share={channel.countSharePercent ?? 0}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* ══ Accounts and lifecycle ══ */}
      <Panel
        id="accounts"
        title="Accounts"
        note="The book by lifecycle state, and how it has opened and closed. Balances here combine deposits held and advances out, so they are larger than the deposit total in the header."
        foot={
          flows?.length ? (
            <span>
              {openingGap === null
                ? 'No account openings fall inside this window at all.'
                : openingGap === 0
                  ? 'An account was opened this month.'
                  : `The last recorded opening was ${openingGap} ${
                      openingGap === 1 ? 'month' : 'months'
                    } ago in this window, while closures continued.`}{' '}
              {overview?.closedPosition
                ? `Closed accounts still carry ${formatCurrency(
                    overview.closedPosition.closedBalance
                  )} on their last balance row; that money is held out of the deposit total above rather than quietly dropped.`
                : ''}
            </span>
          ) : null
        }
      >
        {!overview?.lifecycle ? (
          <PanelSkeleton rows={4} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Lifecycle of{' '}
                <span className="num">{overview.lifecycle.totalAccounts}</span> accounts
              </p>
              {overview.lifecycle.byStatus.map(slice => (
                <CompositionRow
                  key={slice.status}
                  label={slice.status.toLowerCase()}
                  detail={
                    slice.status === 'DORMANT'
                      ? 'Idle for over 60 days — every one is a savings or reserve balance'
                      : slice.status === 'FROZEN'
                        ? 'Held for payment review after reversed or failed instructions'
                        : slice.status === 'CLOSED'
                          ? `${slice.closedCount} with a recorded closing date`
                          : undefined
                  }
                  value={compactCurrency(slice.balance)}
                  share={shareOf(slice.accountCount, overview.lifecycle!.totalAccounts)}
                  tone={
                    slice.status === 'CLOSED'
                      ? 'var(--rm-text-muted)'
                      : slice.status === 'FROZEN'
                        ? 'var(--rm-warn)'
                        : 'var(--rm-brand)'
                  }
                />
              ))}
              <div className="mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-3">
                <Figure
                  label="Mean account age"
                  value={`${Math.round(overview.lifecycle.averageAgeDays ?? 0).toLocaleString()} days`}
                  hint="Time since each live account was opened"
                />
                <Figure
                  label="With a recorded last activity"
                  value={`${overview.lifecycle.withRecordedActivity} of ${overview.lifecycle.totalAccounts}`}
                  hint="Dormancy cannot be detected on accounts with no activity timestamp"
                />
                <Figure
                  label="Operational accounts"
                  value={(overview.lifecycle.operationalAccounts ?? 0).toLocaleString()}
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Opened against closed
              </p>
              <ScrollGrid>
                <DotGroups
                  series={[
                    { name: 'Opened', values: (flows ?? []).map(f => f.accountsOpened), color: 'var(--rm-up)' },
                    { name: 'Closed', values: (flows ?? []).map(f => f.accountsClosed), color: 'var(--rm-down)' },
                  ]}
                  rows={7}
                  cell={4}
                  label="Accounts opened against accounts closed, by month"
                  format={(name, v, i) => `${flows?.[i]?.month} · ${name}: ${v}`}
                />
              </ScrollGrid>
              <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Net{' '}
                <span className="num">
                  {`${
                    sumOf(flows ?? [], f => f.accountsOpened) - sumOf(flows ?? [], f => f.accountsClosed) >= 0
                      ? '+'
                      : ''
                  }${sumOf(flows ?? [], f => f.accountsOpened) - sumOf(flows ?? [], f => f.accountsClosed)}`}
                </span>{' '}
                accounts across the window.
              </p>
            </div>
          </div>
        )}
      </Panel>

      {/* ══ Lending book ══ */}
      <Panel
        id="lending"
        title="Lending book"
        note="Applications in flight across every relationship manager — money not yet advanced."
        aside={
          <Link
            href="/dashboard"
            className="rm-btn shrink-0"
            style={{ backgroundColor: 'var(--rm-glass)', color: 'var(--rm-text-secondary)' }}
          >
            Full oversight
            <Glyph path={GLYPH.chevron} className="h-4 w-4" />
          </Link>
        }
      >
        {!lending ? (
          <PanelSkeleton rows={3} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3">
              <Figure
                label="Approved this month"
                value={lending.approvedThisMonthCount}
                hint={formatCurrency(lending.approvedThisMonthValue)}
              />
              <Figure
                label="Booked this month"
                value={lending.bookedThisMonthCount}
                hint={formatCurrency(lending.bookedThisMonthValue)}
              />
              <Figure label="Declined this month" value={lending.declinedThisMonthCount} tone="var(--rm-down)" />
              <Figure label="Needs action" value={lending.needsActionCount} tone="var(--rm-warn)" />
              <Figure label="At risk" value={lending.stuckAtRiskCount} tone="var(--rm-down)" />
              <Figure
                label="Submitted to booked"
                value={lending.conversionRate30d > 0 ? `${lending.conversionRate30d.toFixed(1)}%` : '—'}
              />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Weekly submissions and decisions
              </p>
              {origination && origination.length > 0 ? (
                <>
                  <ScrollGrid>
                    <DotGroups
                      series={[
                        {
                          name: 'Submitted',
                          values: origination.map(p => p.submittedCount),
                          color: 'var(--rm-brand)',
                        },
                        {
                          name: 'Approved',
                          values: origination.map(p => p.approvedCount),
                          color: 'var(--rm-up)',
                        },
                        {
                          name: 'Declined',
                          values: origination.map(p => p.declinedCount),
                          color: 'var(--rm-down)',
                        },
                      ]}
                      rows={7}
                      cell={3}
                      label="Applications submitted, approved and declined, by week"
                      format={(name, v, i) => `${origination[i]?.weekStart} · ${name}: ${v}`}
                    />
                  </ScrollGrid>
                  <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Bookings and signatures carry no populated date in the source, so only submissions and
                    decisions can be charted over time.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {panelsLoading ? 'Loading…' : 'No submissions or decisions recorded.'}
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* ══ Customers and compliance posture ══ */}
      <Panel
        id="customers"
        title="Customers and compliance"
        note="The register the bank holds, and how far through checks each customer is."
        foot={
          customers ? (
            <span>
              {customers.length} customers are returned by the customer service for this deployment. That
              endpoint carries no bank identifier, so the client cannot filter it to one bank.
            </span>
          ) : null
        }
      >
        {!customers || customers.length === 0 ? (
          <PanelSkeleton rows={4} />
        ) : (
          <div className="grid gap-x-10 gap-y-9 lg:grid-cols-3">
            <Tally title="By customer type" rows={posture.byType} total={customers.length} />
            <Tally title="KYC status" rows={posture.byKyc} total={customers.length} />
            <Tally title="AML screening" rows={posture.byAml} total={customers.length} tone="var(--rm-warn)" />
            <Tally
              title="Risk rating"
              rows={posture.byRisk}
              total={customers.length}
              tone="var(--rm-brand-strong)"
            />
            <Tally
              title="Segment"
              rows={posture.bySegment.slice(0, 6)}
              total={customers.length}
              more={posture.bySegment.length - 6}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Relationship shape
              </p>
              <div className="mt-3 flex items-center gap-5">
                <DottedRing
                  size={132}
                  dots={48}
                  segments={posture.byType.map((entry, i) => ({
                    value: entry[1],
                    opacity: rampTone(i, posture.byType.length),
                  }))}
                  label={`Customers by type across ${customers.length} on file`}
                >
                  <span className="num text-xl font-semibold">{customers.length.toLocaleString()}</span>
                  <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    customers
                  </span>
                </DottedRing>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  {posture.byType.map(([key, value], i) => (
                    <li key={key} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--rm-brand)', opacity: rampTone(i, posture.byType.length) }}
                        aria-hidden="true"
                      />
                      <span className="num">{value.toLocaleString()}</span>{' '}
                      <span className="capitalize">{key.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {posture.withLogin !== null && (
                <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  <span className="num">{posture.withLogin}</span> of these have portal credentials on their
                  record.
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* ══ People and platform ══ */}
      <Panel
        id="people"
        title="People and platform"
        note="Who can sign in, whether they have, and what the assistant answers from."
      >
        <div className="grid gap-8 lg:grid-cols-4">
          <div>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Bank staff
            </p>
            <p className="num mt-1 text-3xl font-semibold">
              {rosterTotal === null ? '—' : rosterTotal.toLocaleString()}
            </p>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              with access to this portal
            </p>
            <AdminLink href="/dashboard/admin/staff" label="Staff roster and status" />
          </div>

          <div>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Staff signed in recently
            </p>
            <p className="num mt-1 text-3xl font-semibold">
              {staff === null ? '—' : posture.staffSignedInRecently}
            </p>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              in the last {RECENT_SIGN_IN_DAYS} days
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--rm-warn)' }}>
              Each user record carries one last-sign-in timestamp, and the session and activity tables hold
              no rows, so sign-in can be counted but never charted over time.
            </p>
          </div>

          <div>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Customer logins
            </p>
            <p className="num mt-1 text-3xl font-semibold">{posture.withLogin ?? '—'}</p>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              of {customers ? customers.length.toLocaleString() : '—'} customers on file
            </p>
            <AdminLink href="/dashboard/customers" label="Customer register" />
          </div>

          <div>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              AI knowledge sources
            </p>
            <p className="num mt-1 text-3xl font-semibold">{sources === null ? '—' : sources.length}</p>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {sources
                ? `${sources.filter(s => s.status === 'ACTIVE').length} active · ${
                    sources.filter(s => s.status === 'DRAFT').length
                  } draft`
                : 'Unavailable right now'}
            </p>
            <div className="mt-3 flex flex-col items-start gap-2">
              <AdminLink href="/dashboard/admin/ai-knowledge" label="Manage sources" />
              <AdminLink href="/dashboard/admin/pending-users" label="Pending activations" />
            </div>
          </div>
        </div>
      </Panel>

      {/* ══ What this page cannot answer ══ */}
      <Panel
        id="coverage"
        title="What this page cannot answer"
        note="Stated plainly so a silence is not read as a zero."
      >
        <ul className="grid gap-x-10 gap-y-4 text-sm sm:grid-cols-2">
          {COVERAGE.map(([heading, body]) => (
            <li key={heading} className="flex gap-3">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--rm-text-muted)' }}>
                <Glyph path={GLYPH.shield} className="h-4 w-4" />
              </span>
              <span>
                <span className="font-medium" style={{ color: 'var(--rm-text)' }}>
                  {heading}.
                </span>{' '}
                <span style={{ color: 'var(--rm-text-muted)' }}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="pb-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        Figures are read from the account, transaction, dashboard, user and customer services at load time.
        {panelsLoading ? ' Some panels are still refreshing.' : ''}
      </p>
    </div>
  );
}

const AdminLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
    style={{ color: 'var(--rm-accent)' }}
  >
    {label}
    <Glyph path={GLYPH.chevron} className="h-4 w-4" />
  </Link>
);

/**
 * Honest limits of the platform's data, each verified against the live schema on 2026-10-18.
 * This is not a disclaimer block for styling: if a source appears for any of these, delete the
 * entry rather than leaving it stale.
 */
const COVERAGE: [string, string][] = [
  [
    'Treasury and liquidity operations',
    'No central-bank placement, interbank funding, securities holding or FX position exists anywhere in the schema. The liquidity panel is derived from customer deposits and advances only.',
  ],
  [
    'Profit and loss',
    'There is no general ledger, trial balance or expense table. Income here is fee and interest traffic; with no costs recorded, no profit can be stated.',
  ],
  [
    'Credit quality and arrears',
    'The delinquency and repayment-schedule tables hold no rows and every arrears column on the balance table is zero, so non-performing loans and provisioning cannot be reported.',
  ],
  [
    'Bookings and signatures over time',
    'Those date columns are unpopulated on every application, so lending history is charted on submissions and decisions alone.',
  ],
  [
    'Branches, cards and ATMs as an estate',
    'No branch, card-issuing or ATM asset tables exist. Physical-channel volumes appear in the channel mix, but the estate behind them is not modelled.',
  ],
  [
    'Account closures before the seed',
    'Closings are only recorded from the point the lifecycle data begins; the account table had no closed_at values at all before 2026-10-18.',
  ],
];

/** A distribution of one text field across the population it describes. */
function Tally({
  title,
  rows,
  total,
  tone = 'var(--rm-brand)',
  more = 0,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  tone?: string;
  more?: number;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
          {title}
        </p>
        <p className="num text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {rows.length} {rows.length === 1 ? 'value' : 'values'}
        </p>
      </div>
      {rows.map(([key, value]) => (
        <CompositionRow
          key={key}
          label={key.toLowerCase().replace(/_/g, ' ')}
          value={value.toLocaleString()}
          share={shareOf(value, total)}
          tone={tone}
        />
      ))}
      {more > 0 && (
        <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          and {more} smaller {more === 1 ? 'group' : 'groups'}.
        </p>
      )}
    </div>
  );
}
