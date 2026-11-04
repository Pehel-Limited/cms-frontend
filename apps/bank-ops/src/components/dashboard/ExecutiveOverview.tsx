'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import config from '@/config';
import { useAppSelector } from '@/store';
import { compactCurrency, formatCurrency } from '@/lib/format';
import KpiRow, { StageBar, type KpiCard } from '@/components/dashboard/KpiRow';
import { DotGroups, DotMatrix, DottedRing, rampTone } from '@/components/dashboard/DotMatrix';
import {
  bankAnalyticsService,
  type AnalyticsPeriod,
  type BankExecutiveOverview,
  type ChannelMix,
  type MonthlyBankFlow,
} from '@/services/api/bank-analytics-service';
import {
  dashboardService,
  type DashboardKpis,
  type RmPortfolio,
  type TrendPoint,
} from '@/services/api/dashboard-service';
import { userService, type User } from '@/services/api/userService';
import { customerService, type Customer } from '@/services/api/customerService';
import { aiKnowledgeService, type KnowledgeSource } from '@/services/api/aiKnowledgeService';

/*
 * Bank-wide executive overview.
 *
 * The page is a board pack, not a data dump: one deposit position, one reading of it, then four
 * sections that answer what moved, what funds the book, who the bank serves and what sits behind
 * it. Every figure comes from account-service, the dashboard oversight endpoints, or the user,
 * customer and AI-register services. Nothing is invented, and October — the part-month — never
 * enters a total or a delta.
 *
 * Where a measure an executive would expect genuinely cannot be sourced, the page says so at the
 * foot rather than substituting a proxy.
 */

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
];

/** Weekly origination buckets. 12 fits the pipeline card at the pitch the dot grids use. */
const ORIGINATION_WEEKS = 12;

/** Sign-in recency window, in days. */
const RECENT_SIGN_IN_DAYS = 30;

const STATUS_ORDER = ['ACTIVE', 'DORMANT', 'FROZEN', 'CLOSED'];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  DORMANT: 'Dormant',
  FROZEN: 'Frozen',
  CLOSED: 'Closed',
};

const LABEL_OVERRIDES: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  BUSINESS: 'Business',
  CORPORATE: 'Corporate',
  SOLE_TRADER: 'Sole trader',
  APPROVED: 'Approved',
  PENDING: 'Pending',
  CLEAR: 'Clear',
  NOT_RATED: 'Not rated',
  GOOD: 'Good',
  EXCELLENT: 'Excellent',
  FAIR: 'Fair',
  UNSEGMENTED: 'Unsegmented',
  SME: 'SME',
  MICRO: 'Micro',
  RETAIL: 'Retail',
  PREMIUM: 'Premium',
  CURRENT_ACCOUNT: 'Current accounts',
  SAVINGS_ACCOUNT: 'Savings accounts',
  MULTI_CURRENCY: 'Multi-currency',
  REVOLVING_CREDIT: 'Revolving credit',
  LOAN_ACCOUNT: 'Loan accounts',
};

/* Outline glyphs drawn in currentColor on a token-painted tile. No subject gets its own hue. */
const GLYPH = {
  temple: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6v3H3V9zM3 21h18',
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
  refresh:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  chevron: 'M9 5l7 7-7 7',
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

function monthYearLabel(yyyyMm: string): string {
  const d = new Date(`${yyyyMm}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMm;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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

function displayLabel(value: string): string {
  if (LABEL_OVERRIDES[value]) return LABEL_OVERRIDES[value];
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

/** compactCurrency prepends the symbol, so a negative would read €-8.4M. */
function signedCompactCurrency(value: number): string {
  return `${value < 0 ? '−' : ''}${compactCurrency(Math.abs(value))}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';
  const days = Math.floor((Date.now() - then) / 86400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function roleText(roles?: string[]): string {
  const first = (roles ?? [])[0];
  return first ? displayLabel(first) : 'No role';
}

function staffName(u: User): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.fullName || u.username;
}

function initialsOf(u: User): string {
  const parts = [u.firstName, u.lastName].filter(Boolean) as string[];
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (u.username || '?').charAt(0).toUpperCase();
}

function chartCell(count: number): number {
  if (count <= 6) return 12;
  if (count <= 13) return 8;
  return 4;
}

/** Resolve a promise into a value-or-error pair so one failing panel never blanks another. */
async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ─── layout primitives ─── */

function Panel({
  id,
  title,
  note,
  aside,
  children,
  foot,
  className = '',
}: {
  id: string;
  title: string;
  note?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
  className?: string;
}) {
  const headingId = `exec-${id}`;
  return (
    <section
      id={id}
      className={`rm-panel flex h-full scroll-mt-6 flex-col ${className}`}
      aria-labelledby={headingId}
    >
      <div className="rm-panel-head">
        <div className="min-w-0">
          <h3 className="rm-title" id={headingId}>
            {title}
          </h3>
          {note && <p className="rm-sub">{note}</p>}
        </div>
        {aside}
      </div>
      <div className="rm-body flex-1">{children}</div>
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

function Unavailable({ title = 'Unavailable right now', note }: { title?: string; note?: string }) {
  return (
    <div className="flex flex-col items-start gap-1 py-6">
      <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
        {title}
      </p>
      {note && (
        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {note}
        </p>
      )}
    </div>
  );
}

function Anchor({
  label,
  value,
  note,
  tone = 'var(--rm-text)',
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </p>
      <p className="num mt-1 text-[30px] font-semibold leading-none tracking-tight" style={{ color: tone }}>
        {value}
      </p>
      {note && (
        <p className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {note}
        </p>
      )}
    </div>
  );
}

/** Labelled figure — quiet by design, so it never competes with the section anchors. */
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
      <p className="num mt-1 text-xl font-semibold" style={{ color: tone }} title={hint}>
        {value}
      </p>
    </div>
  );
}

function Bar({
  pct,
  color = 'var(--rm-brand)',
  height = 8,
  opacity = 1,
}: {
  pct: number;
  color?: string;
  height?: number;
  opacity?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: 'var(--rm-hairline-strong)' }}
      role="presentation"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: color, opacity }}
      />
    </div>
  );
}

type Segment = { label: string; value: number; opacity?: number; title?: string };

/** One proportional bar. Every segment states its own value in its title. */
function StackBar({
  segments,
  label,
  height = 9,
}: {
  segments: Segment[];
  label: string;
  height?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: 'var(--rm-hairline)' }}
      role="img"
      aria-label={label}
    >
      {segments
        .filter(s => s.value > 0)
        .map(s => (
          <span
            key={s.label}
            title={s.title ?? `${s.label}: ${s.value.toLocaleString()}`}
            style={{
              flexGrow: s.value,
              flexBasis: 0,
              backgroundColor: 'var(--rm-brand)',
              opacity: s.opacity ?? 1,
            }}
          />
        ))}
    </div>
  );
}

/** Month labels under a dot grid, positioned on the grid's own slot centres. */
function Axis({ labels, positions }: { labels: (string | null)[]; positions: number[] }) {
  return (
    <div className="relative mt-2 h-4" aria-hidden="true">
      {labels.map((text, i) =>
        text ? (
          <span
            key={`${text}-${i}`}
            className="num absolute -translate-x-1/2 whitespace-nowrap text-xs"
            style={{ left: `${positions[i] * 100}%`, color: 'var(--rm-text-muted)' }}
          >
            {text}
          </span>
        ) : null
      )}
    </div>
  );
}

function tickLabel(month: string, index: number, total: number): string | null {
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const step = total <= 6 ? 1 : total <= 13 ? 2 : 4;
  if (index % step !== 0) return null;
  const short = d.toLocaleDateString('en-GB', { month: 'short' });
  if (index === 0 || d.getMonth() === 0) {
    return `${short} ${String(d.getFullYear()).slice(2)}`;
  }
  return short;
}

function CompositionRow({
  label,
  detail,
  value,
  share,
  opacity = 1,
}: {
  label: string;
  detail?: string;
  value: string;
  share: number;
  opacity?: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2 sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
          {label}
        </p>
        {detail && (
          <p className="truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {detail}
          </p>
        )}
      </div>
      <div className="hidden w-16 shrink-0 sm:block">
        <Bar pct={share} height={6} opacity={opacity} />
      </div>
      <div className="w-20 shrink-0 text-right">
        <p className="num text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
          {value}
        </p>
        <p className="num text-xs sm:hidden" style={{ color: 'var(--rm-text-muted)' }}>
          {percentText(share, 0)}
        </p>
      </div>
      <p
        className="num hidden w-10 shrink-0 text-right text-sm sm:block"
        style={{ color: 'var(--rm-text-muted)' }}
      >
        {percentText(share, 0)}
      </p>
    </div>
  );
}

/** A verification distribution, led by the count still waiting. */
function VerificationBlock({
  title,
  rows,
  total,
}: {
  title: string;
  rows: [string, number][];
  total: number;
}) {
  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  const awaiting = sorted
    .filter(([key]) => key === 'PENDING' || key === 'UNKNOWN')
    .reduce((sum, [, count]) => sum + count, 0);
  const label = sorted.map(([key, count]) => `${displayLabel(key)} ${count}`).join(', ');

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
          {title}
        </p>
        <p className="num text-sm" style={{ color: awaiting > 0 ? 'var(--rm-warn)' : 'var(--rm-up)' }}>
          {awaiting > 0 ? `${awaiting.toLocaleString()} awaiting` : 'None awaiting'}
        </p>
      </div>
      <div className="mt-3">
        <StackBar
          segments={sorted.map(([key, count], i) => ({
            label: displayLabel(key),
            value: count,
            opacity: rampTone(i, sorted.length),
            title: `${displayLabel(key)}: ${count.toLocaleString()} (${percentText(shareOf(count, total), 0)})`,
          }))}
          label={`${title}: ${label}`}
          height={9}
        />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
        {sorted.map(([key, count], i) => (
          <div key={key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--rm-brand)', opacity: rampTone(i, sorted.length) }}
                aria-hidden="true"
              />
              <span className="truncate" style={{ color: 'var(--rm-text-secondary)' }}>
                {displayLabel(key)}
              </span>
            </span>
            <span className="num shrink-0 font-medium" style={{ color: 'var(--rm-text)' }}>
              {count.toLocaleString()}
              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--rm-text-muted)' }}>
                {percentText(shareOf(count, total), 0)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A compact distribution of one text field across the population it describes. */
function Distribution({
  title,
  rows,
  total,
  more = 0,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  more?: number;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
          {rows.length} {rows.length === 1 ? 'group' : 'groups'}
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map(([key, count], i) => (
          <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--rm-brand)', opacity: rampTone(i, rows.length) }}
                aria-hidden="true"
              />
              <span className="truncate" style={{ color: 'var(--rm-text-secondary)' }}>
                {displayLabel(key)}
              </span>
            </span>
            <span className="num font-medium" style={{ color: 'var(--rm-text)' }}>
              {count.toLocaleString()}
            </span>
            <span className="num text-right text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              {percentText(shareOf(count, total), 0)}
            </span>
          </div>
        ))}
      </div>
      {more > 0 && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
          and {more} smaller {more === 1 ? 'group' : 'groups'}.
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  id,
  index,
  title,
  note,
}: {
  id: string;
  index: string;
  title: string;
  note: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <span className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
          {index}
        </span>
        <h2 id={`${id}-heading`} className="serif text-2xl font-medium" style={{ color: 'var(--rm-text)' }}>
          {title}
        </h2>
        <span
          className="mb-1.5 hidden flex-1 border-t sm:block"
          style={{ borderColor: 'var(--rm-hairline)' }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {note}
      </p>
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
  const [reloadKey, setReloadKey] = useState(0);

  const [overview, setOverview] = useState<BankExecutiveOverview | null>(null);
  const [lending, setLending] = useState<DashboardKpis | null>(null);
  const [portfolios, setPortfolios] = useState<RmPortfolio[] | null>(null);
  const [flows, setFlows] = useState<MonthlyBankFlow[] | null>(null);
  const [channels, setChannels] = useState<ChannelMix[] | null>(null);
  const [origination, setOrigination] = useState<TrendPoint[] | null>(null);
  const [staff, setStaff] = useState<User[] | null>(null);
  const [rosterTotal, setRosterTotal] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);

  const [coreLoading, setCoreLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [lendingError, setLendingError] = useState<string | null>(null);
  const [panelsError, setPanelsError] = useState<{ customers: boolean; staff: boolean; sources: boolean }>({
    customers: false,
    staff: false,
    sources: false,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);

  const refresh = useCallback(() => setReloadKey(k => k + 1), []);

  /* The balance sheet and the lending book load independently: a 403 on the oversight
     endpoint must not take the deposit position with it. */
  useEffect(() => {
    let cancelled = false;
    setCoreLoading(true);
    setCoreError(null);

    Promise.all([
      settle(bankAnalyticsService.getOverview(bankId)),
      settle(dashboardService.getOversightSummary(bankId)),
    ]).then(([book, summary]) => {
      if (cancelled) return;

      if (book.value) {
        setOverview(book.value);
        setLastUpdated(new Date());
      } else {
        setCoreError(errorText(book.error, 'The balance sheet could not be read.'));
      }

      if (summary.value) {
        setLending(summary.value.bankKpis ?? null);
        setPortfolios(summary.value.rmPortfolios ?? []);
        setLendingError(null);
      } else {
        setLendingError(errorText(summary.error, 'Lending oversight could not be read.'));
      }

      setCoreLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bankId, reloadKey]);

  /* Transactions and channels follow the window control; the registers do not. */
  useEffect(() => {
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesError(null);

    // One extra month so the part-month can be dropped and exactly `period` complete
    // months remain. The backend caps the request at 36 months.
    const fetchMonths = Math.min(36, period + 1);

    Promise.all([
      settle(bankAnalyticsService.getMonthlyFlows(bankId, fetchMonths)),
      settle(bankAnalyticsService.getChannelMix(bankId, period)),
    ]).then(([flowRows, channelRows]) => {
      if (cancelled) return;
      if (flowRows.value) setFlows(flowRows.value);
      if (channelRows.value) setChannels(channelRows.value);
      if (!flowRows.value && !channelRows.value) {
        setSeriesError(errorText(flowRows.error ?? channelRows.error, 'Transaction analytics could not be read.'));
      } else if (!flowRows.value) {
        setSeriesError(errorText(flowRows.error, 'Transaction analytics could not be read.'));
      }
      setSeriesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bankId, period, reloadKey]);

  /* Registers load once and degrade individually. */
  useEffect(() => {
    let cancelled = false;
    setPanelsLoading(true);

    Promise.all([
      settle(dashboardService.getOversightTrends(bankId, undefined, ORIGINATION_WEEKS)),
      settle(
        userService.getUsers({
          userType: 'BANK_USER',
          page: 0,
          size: 200,
          sort: 'createdAt,desc',
        })
      ),
      settle(customerService.getAllCustomers()),
      settle(aiKnowledgeService.listSources(bankId)),
    ]).then(([trendRows, roster, customerRows, sourceRows]) => {
      if (cancelled) return;
      if (trendRows.value) setOrigination(trendRows.value);
      if (roster.value) {
        setStaff(roster.value.content ?? []);
        setRosterTotal(typeof roster.value.totalElements === 'number' ? roster.value.totalElements : null);
      }
      if (customerRows.value) setCustomers(customerRows.value);
      if (sourceRows.value) setSources(Array.isArray(sourceRows.value) ? sourceRows.value : null);
      setPanelsError({
        customers: !customerRows.value,
        staff: !roster.value,
        sources: !sourceRows.value,
      });
      setPanelsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bankId, reloadKey]);

  /* ─── derived readings ─── */

  /** Months shown in the charts. The part-month is dropped, never drawn as a collapse. */
  const seriesFlows = useMemo(() => (flows ?? []).filter(f => !f.partial), [flows]);
  const completeFlows = useMemo(() => seriesFlows.filter(f => f.recorded), [seriesFlows]);
  const latest = completeFlows[completeFlows.length - 1];
  const prior = completeFlows[completeFlows.length - 2];
  const firstRecorded = completeFlows[0];
  const windowMonths = completeFlows.length;
  const unrecordedMonths = seriesFlows.filter(f => !f.recorded).length;
  const latestLabel = latest ? monthYearLabel(latest.month) : '—';
  const priorLabel = prior ? monthYearLabel(prior.month) : null;

  const windowValue = sumOf(completeFlows, f => f.totalValue);
  const windowSettled = sumOf(completeFlows, f => f.settledCount);
  const windowFailed = sumOf(completeFlows, f => f.failedCount);
  const windowReversed = sumOf(completeFlows, f => f.reversalCount);
  const windowExcepted = windowFailed + windowReversed;
  const peakValueMonth = completeFlows.reduce<MonthlyBankFlow | undefined>(
    (best, row) => ((row.totalValue ?? 0) > (best?.totalValue ?? 0) ? row : best),
    undefined
  );
  const windowCredit = sumOf(completeFlows, f => f.creditValue);
  const windowDebit = sumOf(completeFlows, f => f.debitValue);
  const windowFee = sumOf(completeFlows, f => f.feeIncome);
  const windowInterest = sumOf(completeFlows, f => f.interestReceived);
  const windowPaid = sumOf(completeFlows, f => f.interestPaid);
  const windowIncome = windowFee + windowInterest;
  const windowNet = windowIncome - windowPaid;
  const windowRepayments = sumOf(completeFlows, f => f.repayments);
  const windowDisbursements = sumOf(completeFlows, f => f.disbursements);

  const feeShare = shareOf(windowFee, windowIncome);
  const interestShare = shareOf(windowInterest, windowIncome);
  const creditShare = shareOf(windowCredit, windowCredit + windowDebit);
  const debitShare = shareOf(windowDebit, windowCredit + windowDebit);

  const valueDelta = deltaOf(
    latest?.totalValue,
    prior?.totalValue,
    `${latest ? monthYearLabel(latest.month) : ''} against ${priorLabel ?? ''}`
  );
  const netDelta = deltaOf(
    netIncomeOf(latest),
    netIncomeOf(prior),
    `${latest ? monthYearLabel(latest.month) : ''} against ${priorLabel ?? ''}`
  );
  const accountsDelta = deltaOf(
    latest?.activeAccounts,
    prior?.activeAccounts,
    `${latest ? monthYearLabel(latest.month) : ''} against ${priorLabel ?? ''}`
  );

  const depositMix = useMemo(() => {
    const rows = overview?.depositBook ?? [];
    const total = overview?.depositBookTotal;
    return [...rows]
      .sort((a, b) => b.ledgerBalance - a.ledgerBalance)
      .map((row, i) => ({
        ...row,
        label: displayLabel(row.type),
        share: shareOf(row.ledgerBalance, total),
        opacity: rampTone(i, rows.length),
      }));
  }, [overview]);

  const advanceMix = useMemo(() => {
    const rows = overview?.advanceBook ?? [];
    const total = overview?.advanceBookTotal;
    return rows.map((row, i) => ({
      ...row,
      label: displayLabel(row.type),
      share: shareOf(row.ledgerBalance, total),
      opacity: rampTone(i, rows.length),
    }));
  }, [overview]);

  const channelTones = useMemo(() => {
    const rows = channels ?? [];
    const map = new Map<string, number>();
    rows.forEach((row, i) => map.set(row.channel, rampTone(i, rows.length)));
    return map;
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
      staffSignedInRecently: roster.filter(
        s => s.lastLoginAt && new Date(s.lastLoginAt).getTime() >= since
      ).length,
    };
  }, [staff, tally]);

  const customerTotal = customers?.length ?? 0;
  const pendingKyc = posture.byKyc.find(([key]) => key === 'PENDING')?.[1] ?? 0;
  const withLogin = (customers ?? []).filter(c => c.portalUsername).length;

  const recentStaff = useMemo(() => {
    const since = Date.now() - RECENT_SIGN_IN_DAYS * 86400_000;
    return [...(staff ?? [])]
      .filter(s => s.lastLoginAt && new Date(s.lastLoginAt).getTime() >= since)
      .sort(
        (a, b) => new Date(b.lastLoginAt ?? 0).getTime() - new Date(a.lastLoginAt ?? 0).getTime()
      )
      .slice(0, 5);
  }, [staff]);

  const rmStaffCount = staff
    ? staff.filter(s => (s.roles ?? []).some(role => /relationship/i.test(role))).length
    : null;
  const notSignedInRecently =
    staff === null ? null : Math.max(0, staff.length - posture.staffSignedInRecently);

  const lifecycleRows = useMemo(() => {
    const rows = overview?.lifecycle?.byStatus ?? [];
    return STATUS_ORDER.map(status => rows.find(row => row.status === status)).filter(
      (row): row is NonNullable<typeof row> => Boolean(row)
    );
  }, [overview]);

  const lifecycleCount = sumOf(lifecycleRows, row => row.accountCount);
  const lifecycleBalance = sumOf(lifecycleRows, row => row.balance);
  const dormantRow = lifecycleRows.find(row => row.status === 'DORMANT');
  const dormantShare = shareOf(dormantRow?.balance, lifecycleBalance);

  const lastOpening = useMemo(() => {
    const rows = seriesFlows.length ? seriesFlows : flows ?? [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].accountsOpened > 0) return rows[i];
    }
    return null;
  }, [seriesFlows, flows]);

  const openingPhrase = !lastOpening
    ? 'No account has opened in this window.'
    : lastOpening.month === seriesFlows[seriesFlows.length - 1]?.month
      ? `Last opened ${monthYearLabel(lastOpening.month)}.`
      : `No account opened since ${monthYearLabel(lastOpening.month)}.`;

  const portfolioCount = sumOf(portfolios ?? [], p => p.inProgressCount);
  const portfolioValue = sumOf(portfolios ?? [], p => p.inProgressValue);
  const portfolioRisk = sumOf(portfolios ?? [], p => p.stuckAtRiskCount);
  const outsidePortfolioCount = Math.max(0, (lending?.inProgressCount ?? 0) - portfolioCount);
  const outsidePortfolioValue = Math.max(0, (lending?.inProgressValue ?? 0) - portfolioValue);
  const outsidePortfolioRisk = Math.max(0, (lending?.stuckAtRiskCount ?? 0) - portfolioRisk);

  const riskShare = shareOf(lending?.stuckAtRiskCount, lending?.inProgressCount);
  const kycShare = shareOf(pendingKyc, customerTotal);

  const readings = useMemo(() => {
    const rows: { href: string; title: string }[] = [];
    if (overview) {
      const ldr = overview.loanToDepositPercent ?? 0;
      rows.push({
        href: '#funding',
        title:
          ldr < 50
            ? 'Deposits far exceed lending.'
            : ldr > 100
              ? 'Lending exceeds deposits.'
              : 'Lending is broadly matched to deposits.',
      });
    }
    if (windowIncome > 0) {
      rows.push({
        href: '#income',
        title:
          feeShare >= 55
            ? 'Fees, not interest, carry income.'
            : feeShare <= 45
              ? 'Lending interest carries income.'
              : 'Fees and interest contribute evenly.',
      });
    }
    if (lending && lending.inProgressCount > 0) {
      rows.push({
        href: '#lending',
        title:
          riskShare >= 50
            ? 'Most live applications are at risk.'
            : riskShare >= 25
              ? 'A large share of applications are at risk.'
              : 'Live applications are largely on track.',
      });
    }
    if (customerTotal > 0) {
      rows.push({
        href: '#customers',
        title:
          kycShare >= 50
            ? 'Most customers await verification.'
            : kycShare >= 25
              ? 'A large share of customers await verification.'
              : 'Most customers are verified.',
      });
    }
    return rows;
  }, [overview, windowIncome, feeShare, lending, riskShare, customerTotal, kycShare]);

  const kpiCards: KpiCard[] = useMemo(() => {
    if (!overview) return [];

    const micro = (values: number[], label: string, format: (v: number, i: number) => string) => (
      <DotMatrix
        data={values}
        box={{ width: 140, height: 38 }}
        color="var(--rm-brand)"
        label={label}
        format={format}
      />
    );

    return [
      {
        key: 'advances',
        label: 'Advanced to customers',
        tone: 'accent',
        value: (
          <span title={formatCurrency(overview.advanceBookTotal)}>
            {compactCurrency(overview.advanceBookTotal)}
          </span>
        ),
        note: 'revolving and term lending',
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
        note: latest ? `${latest.settledCount.toLocaleString()} settled lines` : 'No complete month',
        delta: valueDelta,
        icon: <Glyph path={GLYPH.payments} />,
        visual: latest
          ? micro(
              seriesFlows.map(f => f.totalValue ?? 0),
              'Value settled by month',
              (v, i) => `${monthLabel(seriesFlows[i]?.month ?? '')}: ${compactCurrency(v)}`
            )
          : undefined,
      },
      {
        key: 'income',
        label: 'Net income',
        tone: 'accent',
        value: latest ? compactCurrency(netIncomeOf(latest)) : '—',
        note: latest ? 'after deposit interest' : 'No complete month',
        delta: netDelta,
        icon: <Glyph path={GLYPH.money} />,
        visual: latest
          ? micro(
              seriesFlows.map(f => Math.max(0, netIncomeOf(f))),
              'Net income by month',
              (v, i) => `${monthLabel(seriesFlows[i]?.month ?? '')}: ${compactCurrency(v)}`
            )
          : undefined,
      },
      {
        key: 'accounts',
        label: 'Accounts in use',
        tone: 'accent',
        value: latest ? latest.activeAccounts.toLocaleString() : '—',
        note: latest
          ? `moved by ${latest.activeCustomers.toLocaleString()} customers`
          : 'No complete month',
        delta: accountsDelta,
        icon: <Glyph path={GLYPH.people} />,
        visual: latest
          ? micro(
              seriesFlows.map(f => f.activeAccounts),
              'Accounts transacting by month',
              (v, i) => `${monthLabel(seriesFlows[i]?.month ?? '')}: ${v.toLocaleString()} accounts`
            )
          : undefined,
      },
      {
        key: 'pipeline',
        label: 'Applications in progress',
        tone: 'accent',
        value: lending ? lending.inProgressCount.toLocaleString() : '—',
        note: portfolios?.length
          ? `${portfolios.length} relationship managers`
          : lending
            ? 'bank-wide'
            : 'Unavailable',
        icon: <Glyph path={GLYPH.lending} />,
        visual:
          origination && origination.length > 0 ? (
            <div className="text-right">
              {micro(
                origination.map(p => p.submittedCount),
                'Applications submitted per week',
                (v, i) => `${origination[i]?.weekStart ?? ''}: ${v.toLocaleString()} submitted`
              )}
              <p className="mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                Weekly submissions
              </p>
            </div>
          ) : undefined,
      },
    ];
  }, [
    overview,
    latest,
    valueDelta,
    netDelta,
    accountsDelta,
    seriesFlows,
    lending,
    portfolios,
    origination,
  ]);

  const busy = coreLoading || seriesLoading || panelsLoading;
  const asOf = overview?.balancesAsOf ? new Date(overview.balancesAsOf) : null;
  const asOfLabel =
    asOf && !Number.isNaN(asOf.getTime())
      ? asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  const chartCount = seriesFlows.length;
  const chartWidth = chartCount * chartCell(chartCount) * 2;
  const chartPositions = seriesFlows.map((_, i) => (i + 0.5) / Math.max(1, chartCount));
  const chartLabels = seriesFlows.map((f, i) => tickLabel(f.month, i, chartCount));

  const groupedCell = 4;
  const groupedSlot = 2 * groupedCell * 2 + groupedCell * 2;
  const groupedWidth = Math.max(0, chartCount * groupedSlot - groupedCell * 2);
  const groupedPositions = seriesFlows.map(
    (_, i) => (i * groupedSlot + 2 * groupedCell) / Math.max(1, groupedWidth)
  );

  return (
    <div className="space-y-9 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Toolbar ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Executive overview
        </p>
        <div className="flex items-center gap-2.5">
          <span className="hidden text-sm sm:inline" style={{ color: 'var(--rm-text-muted)' }}>
            Series
          </span>
          <div
            className="flex rounded-full p-1"
            style={{ backgroundColor: 'var(--rm-glass)', border: '1px solid var(--rm-glass-border)' }}
            role="group"
            aria-label="Series window"
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
            onClick={refresh}
            disabled={busy}
            className="rounded-full p-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-glass)', color: 'var(--rm-text-muted)' }}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <Glyph path={GLYPH.refresh} className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ══ Cover ══ */}
      <section
        className="rm-panel relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, color-mix(in srgb, var(--rm-brand) 12%, transparent), transparent 58%)',
        }}
        aria-label="Bank position"
      >
        <div className="grid gap-10 p-7 sm:p-9 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <div className="min-w-0">
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Bank position
            </p>
            <h1
              className="serif mt-2 text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
              style={{ color: 'var(--rm-text)' }}
            >
              Customer money the bank holds
            </h1>

            {overview ? (
              <>
                <p className="num mt-6 text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
                  {compactCurrency(overview.depositBookTotal)}
                </p>
                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {asOfLabel ? (
                    <>
                      As at <span className="num">{asOfLabel}</span>
                    </>
                  ) : (
                    'Latest recorded balance'
                  )}
                  {' · '}
                  <span className="num">{overview.depositHolders.toLocaleString()}</span> deposit holders
                </p>

                <div className="mt-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                      Where it sits
                    </p>
                    <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Share of deposits
                    </p>
                  </div>
                  <div className="mt-2.5">
                    <StackBar
                      segments={depositMix.map(slice => ({
                        label: slice.label,
                        value: slice.ledgerBalance,
                        opacity: slice.opacity,
                        title: `${slice.label}: ${formatCurrency(slice.ledgerBalance)} (${percentText(
                          slice.share,
                          1
                        )})`,
                      }))}
                      label={`Deposit mix: ${depositMix
                        .map(slice => `${slice.label} ${percentText(slice.share, 0)}`)
                        .join(', ')}`}
                      height={12}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                    {depositMix.map(slice => (
                      <div key={slice.type} className="flex min-w-0 items-start gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: 'var(--rm-brand)', opacity: slice.opacity }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                            {slice.label}
                          </p>
                          <p className="num mt-0.5 text-sm font-semibold">
                            {compactCurrency(slice.ledgerBalance)}{' '}
                            <span className="text-xs font-normal" style={{ color: 'var(--rm-text-muted)' }}>
                              {percentText(slice.share, 0)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : coreLoading ? (
              <div className="mt-6 space-y-3" aria-hidden="true">
                <div className="h-14 w-56 max-w-full rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="h-4 w-72 max-w-full rounded-xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="h-3 w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-base font-semibold">The bank&rsquo;s figures could not be loaded.</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {coreError ?? 'Please try again.'}
                </p>
                <button type="button" onClick={refresh} className="rm-btn rm-btn-solid mt-4">
                  Try again
                </button>
              </div>
            )}
          </div>

          <div
            className="min-w-0 xl:border-l xl:pl-8"
            style={{ borderColor: 'var(--rm-hairline)' }}
          >
            <p className="serif text-lg font-medium" style={{ color: 'var(--rm-text)' }}>
              The reading
            </p>
            {readings.length > 0 ? (
              <ol className="mt-2">
                {readings.map((reading, i) => (
                  <li
                    key={reading.href}
                    className="border-t py-3.5"
                    style={{ borderColor: 'var(--rm-hairline)' }}
                  >
                    <a href={reading.href} className="group flex items-start gap-3">
                      <span className="num pt-0.5 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="flex-1 text-sm font-medium leading-snug"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {reading.title}
                      </span>
                      <Glyph
                        path={GLYPH.chevron}
                        className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
                      />
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {busy ? 'Reading the figures…' : 'No figures available to read.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {coreError && overview && (
        <div
          className="rm-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
          role="alert"
          style={{ color: 'var(--rm-text-secondary)' }}
        >
          <span>The latest bank position could not be refreshed. Showing the last reading.</span>
          <button type="button" onClick={refresh} className="rm-btn rm-btn-quiet">
            Retry
          </button>
        </div>
      )}

      {/* ══ KPI band ══ */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Latest complete month ·{' '}
            <span className="num" style={{ color: 'var(--rm-text-secondary)' }}>
              {latestLabel}
            </span>
          </p>
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {priorLabel ? (
              <>
                Changes compare with <span className="num">{priorLabel}</span>.
              </>
            ) : (
              'No prior month to compare.'
            )}
          </p>
        </div>
        {overview ? (
          <KpiRow cards={kpiCards} size="large" />
        ) : coreLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rm-panel h-40 animate-pulse" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <Unavailable title="Position metrics are unavailable." note="The balance sheet could not be read." />
        )}
      </div>

      {/* ══ 01 Performance ══ */}
      <section id="performance" className="scroll-mt-6">
        <SectionHeader
          id="performance"
          index="01"
          title="Performance"
          note="What moved through the bank, and what it kept."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <Panel
            id="payments"
            title="Payments and activity"
            note="Settled transactions and the value behind them, by month."
            className="xl:col-span-7"
            foot={
              seriesFlows.length ? (
                <span>
                  The window ends at {latestLabel}. October is in progress and is left out of every
                  total and comparison.
                  {unrecordedMonths > 0 && firstRecorded && (
                    <>
                      {' '}
                      Transaction history begins {monthYearLabel(firstRecorded.month)}; the{' '}
                      {unrecordedMonths} earlier {unrecordedMonths === 1 ? 'column is' : 'columns are'}{' '}
                      empty because nothing was recorded.
                    </>
                  )}
                </span>
              ) : null
            }
          >
            {seriesLoading && !flows ? (
              <PanelSkeleton rows={4} />
            ) : !flows || completeFlows.length === 0 ? (
              <Unavailable
                title="Transaction analytics are unavailable."
                note={seriesError ?? 'No settled transactions were returned for this window.'}
              />
            ) : (
              <div className="space-y-7">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <Anchor
                    label={`Settled in ${windowMonths} complete months`}
                    value={compactCurrency(windowValue)}
                  />
                  <Figure
                    label="Settled transactions"
                    value={windowSettled.toLocaleString()}
                    hint={`${windowSettled.toLocaleString()} transactions in a settled state`}
                  />
                  <Figure
                    label="Failed or reversed"
                    value={windowExcepted.toLocaleString()}
                    tone="var(--rm-down)"
                    hint={`${percentText(shareOf(windowExcepted, windowSettled + windowExcepted), 2)} of attempted lines`}
                  />
                </div>

                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                      Transactions settled, by month
                    </p>
                    <div className="mt-3" style={{ width: chartWidth }}>
                      <DotMatrix
                        data={seriesFlows.map(f => f.settledCount)}
                        cell={chartCell(chartCount)}
                        rows={8}
                        label={`Settled transactions per month across ${chartCount} months`}
                        format={(v, i) =>
                          `${monthYearLabel(seriesFlows[i]?.month ?? '')}: ${v.toLocaleString()} settled`
                        }
                      />
                      <Axis labels={chartLabels} positions={chartPositions} />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                      Value credited against debited
                    </p>
                    <div className="mt-3">
                      <StackBar
                        segments={[
                          {
                            label: 'Credited',
                            value: windowCredit,
                            opacity: 1,
                            title: `Credited to accounts: ${formatCurrency(windowCredit)} (${percentText(
                              creditShare,
                              1
                            )})`,
                          },
                          {
                            label: 'Debited',
                            value: windowDebit,
                            opacity: 0.45,
                            title: `Debited from accounts: ${formatCurrency(windowDebit)} (${percentText(
                              debitShare,
                              1
                            )})`,
                          },
                        ]}
                        label={`Value credited ${percentText(creditShare, 1)} against debited ${percentText(
                          debitShare,
                          1
                        )}`}
                        height={10}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: 'var(--rm-brand)' }}
                            aria-hidden="true"
                          />
                          Credited
                        </p>
                        <p className="num mt-1 text-lg font-semibold">{compactCurrency(windowCredit)}</p>
                        <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          {percentText(creditShare, 1)} of value
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: 'var(--rm-brand)', opacity: 0.45 }}
                            aria-hidden="true"
                          />
                          Debited
                        </p>
                        <p className="num mt-1 text-lg font-semibold">{compactCurrency(windowDebit)}</p>
                        <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          {percentText(debitShare, 1)} of value
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Internal transfers are included, so this is payment traffic, not a cash position.
                    </p>

                    <div
                      className="mt-4 border-t pt-3 text-sm"
                      style={{ borderColor: 'var(--rm-hairline)', color: 'var(--rm-text-muted)' }}
                    >
                      <p>
                        <span className="num">{windowFailed.toLocaleString()}</span> failed and{' '}
                        <span className="num">{windowReversed.toLocaleString()}</span> reversed across
                        the window.
                      </p>
                      {peakValueMonth && (
                        <p className="mt-1">
                          The highest-value month was{' '}
                          <span style={{ color: 'var(--rm-text-secondary)' }}>
                            {monthYearLabel(peakValueMonth.month)}
                          </span>{' '}
                          at{' '}
                          <span className="num" style={{ color: 'var(--rm-text-secondary)' }}>
                            {compactCurrency(peakValueMonth.totalValue ?? 0)}
                          </span>
                          .
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            id="income"
            title="Income"
            note="Fee and lending-interest income, before operating costs."
            className="xl:col-span-5"
            foot={
              windowIncome > 0 ? (
                <span>
                  Depositors are paid quarterly while fees and lending interest are monthly. No
                  operating costs are recorded, so this is income, not profit.
                </span>
              ) : null
            }
          >
            {seriesLoading && !flows ? (
              <PanelSkeleton rows={4} />
            ) : !flows || completeFlows.length === 0 ? (
              <Unavailable
                title="Income analytics are unavailable."
                note={seriesError ?? undefined}
              />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <Anchor label={`Earned in ${windowMonths} complete months`} value={compactCurrency(windowIncome)} />
                  <Figure
                    label="Paid to depositors"
                    value={compactCurrency(windowPaid)}
                    tone="var(--rm-down)"
                    hint="Interest credited to deposit accounts over the window"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <p style={{ color: 'var(--rm-text-secondary)' }}>Fees</p>
                      <p className="num font-semibold">{compactCurrency(windowFee)}</p>
                    </div>
                    <div className="mt-1.5">
                      <Bar pct={feeShare} />
                    </div>
                    <p className="num mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                      {percentText(feeShare, 0)} of income
                    </p>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <p style={{ color: 'var(--rm-text-secondary)' }}>Lending interest</p>
                      <p className="num font-semibold">{compactCurrency(windowInterest)}</p>
                    </div>
                    <div className="mt-1.5">
                      <Bar pct={interestShare} color="var(--rm-brand-strong)" />
                    </div>
                    <p className="num mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                      {percentText(interestShare, 0)} of income
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                    Fees against lending interest, by month
                  </p>
                  <div className="mt-3" style={{ width: groupedWidth }}>
                    <DotGroups
                      series={[
                        {
                          name: 'Fees',
                          values: seriesFlows.map(f => f.feeIncome ?? 0),
                          color: 'var(--rm-brand)',
                        },
                        {
                          name: 'Lending interest',
                          values: seriesFlows.map(f => f.interestReceived ?? 0),
                          color: 'var(--rm-brand-strong)',
                        },
                      ]}
                      cell={groupedCell}
                      rows={8}
                      label={`Fee and lending-interest income per month across ${chartCount} months`}
                      format={(name, v, i) =>
                        `${monthYearLabel(seriesFlows[i]?.month ?? '')} · ${name}: ${compactCurrency(v)}`
                      }
                    />
                    <Axis labels={chartLabels} positions={groupedPositions} />
                  </div>
                </div>

                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  After deposit interest, the bank kept{' '}
                  <span className="num font-semibold" style={{ color: 'var(--rm-text)' }}>
                    {compactCurrency(windowNet)}
                  </span>{' '}
                  across the window.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </section>

      {/* ══ 02 Balance sheet ══ */}
      <section id="balance" className="scroll-mt-6">
        <SectionHeader
          id="balance"
          index="02"
          title="Balance sheet"
          note="What funds the book, and how much of it is put to work."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <Panel
            id="funding"
            title="Funding and liquidity"
            note="The deposit base against the loan book."
            className="xl:col-span-7"
            foot={
              overview ? (
                <span>
                  Liquidity is derived from the deposit and advance books. No central-bank or
                  interbank position exists.
                </span>
              ) : null
            }
          >
            {!overview ? (
              coreLoading ? (
                <PanelSkeleton rows={5} />
              ) : (
                <Unavailable title="Funding data are unavailable." note={coreError ?? undefined} />
              )
            ) : (
              <div className="space-y-6">
                <div className="grid gap-7 sm:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="flex flex-col items-center justify-center">
                    <DottedRing
                      size={176}
                      dots={68}
                      segments={[
                        { value: overview.advanceBookTotal, opacity: 1 },
                        {
                          value: Math.max(0, overview.depositBookTotal - overview.advanceBookTotal),
                          opacity: 0.3,
                        },
                      ]}
                      label={`Advances of ${formatCurrency(
                        overview.advanceBookTotal
                      )} against deposits of ${formatCurrency(overview.depositBookTotal)}`}
                    >
                      <span className="num text-2xl font-semibold">
                        {percentText(overview.loanToDepositPercent)}
                      </span>
                      <span className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        loan to deposit
                      </span>
                    </DottedRing>
                    <p className="mt-3 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      <span className="num font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {compactCurrency(overview.liquidity?.surplusFunding ?? 0)}
                      </span>{' '}
                      remains unlent.
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                      Advances out
                    </p>
                    {advanceMix.map(slice => (
                      <div key={slice.type} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                            {slice.label}
                          </p>
                          <p className="num text-sm font-semibold">
                            {compactCurrency(slice.ledgerBalance)}
                          </p>
                        </div>
                        <div className="mt-1.5">
                          <Bar pct={slice.share} height={6} opacity={slice.opacity} />
                        </div>
                        <div
                          className="mt-1 flex items-baseline justify-between gap-3 text-xs"
                          style={{ color: 'var(--rm-text-muted)' }}
                        >
                          <span>
                            {slice.accountCount} accounts · {compactCurrency(slice.accruedInterest ?? 0)}{' '}
                            accrued
                          </span>
                          <span className="num">{percentText(slice.share, 0)}</span>
                        </div>
                      </div>
                    ))}

                    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
                      <Figure
                        label="Payable on demand"
                        value={compactCurrency(overview.liquidity?.payableBalance ?? 0)}
                        hint="Available balance across deposit accounts"
                      />
                      <Figure
                        label="Holds on balances"
                        value={compactCurrency(overview.liquidity?.holdsAmount ?? 0)}
                      />
                      <Figure
                        label="Pending debits"
                        value={compactCurrency(overview.liquidity?.pendingDebits ?? 0)}
                      />
                      <Figure
                        label="Pending credits"
                        value={compactCurrency(overview.liquidity?.pendingCredits ?? 0)}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-5" style={{ borderColor: 'var(--rm-hairline)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                    Five largest depositors
                  </p>
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

                  {overview.topDepositors.length > 0 && (
                    <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-brand-soft)' }}>
                      <p className="text-sm font-semibold" style={{ color: 'var(--rm-brand-on-soft)' }}>
                        Concentrated funding
                      </p>
                      <div className="mt-2">
                        <StackBar
                          segments={[
                            {
                              label: 'Top ten depositors',
                              value: overview.topTenDepositSharePercent ?? 0,
                              opacity: 1,
                              title: `Top ten: ${percentText(overview.topTenDepositSharePercent, 1)} of deposits`,
                            },
                            {
                              label: 'Other deposit holders',
                              value: Math.max(0, 100 - (overview.topTenDepositSharePercent ?? 0)),
                              opacity: 0.3,
                              title: `Other holders: ${percentText(
                                Math.max(0, 100 - (overview.topTenDepositSharePercent ?? 0)),
                                1
                              )} of deposits`,
                            },
                          ]}
                          label={`Deposit concentration: the top ten hold ${percentText(
                            overview.topTenDepositSharePercent,
                            1
                          )}`}
                          height={7}
                        />
                      </div>
                      <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        The top ten hold{' '}
                        <span className="num font-semibold">
                          {percentText(overview.topTenDepositSharePercent, 1)}
                        </span>{' '}
                        of deposits. The other{' '}
                        <span className="num">
                          {Math.max(
                            0,
                            overview.depositHolders - overview.topDepositors.length
                          ).toLocaleString()}
                        </span>{' '}
                        deposit holders share the remaining{' '}
                        <span className="num">
                          {percentText(Math.max(0, 100 - (overview.topTenDepositSharePercent ?? 0)), 1)}
                        </span>
                        .
                        {overview.topDepositors
                          .slice(0, 5)
                          .every(d => (d.partyType ?? '').toUpperCase() === 'BUSINESS') &&
                          ' All five largest are businesses.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            id="lending"
            title="Lending book"
            note="Applications in flight across every relationship manager."
            className="xl:col-span-5"
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
            foot={
              lending ? (
                <span>
                  Bookings and signatures carry no populated dates, so weekly activity is charted on
                  submissions and decisions only.
                </span>
              ) : null
            }
          >
            {!lending ? (
              coreLoading ? (
                <PanelSkeleton rows={5} />
              ) : (
                <Unavailable
                  title="Lending oversight is unavailable."
                  note={lendingError ?? 'This account cannot read the bank-wide lending book.'}
                />
              )
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <Anchor
                    label="In progress"
                    value={compactCurrency(lending.inProgressValue)}
                    note="requested value, not yet advanced"
                  />
                  <Figure
                    label="At risk"
                    value={lending.stuckAtRiskCount.toLocaleString()}
                    tone="var(--rm-warn)"
                    hint={`${percentText(riskShare, 0)} of live applications are past their status window`}
                  />
                  <Figure
                    label="Booked this month"
                    value={lending.bookedThisMonthCount.toLocaleString()}
                    hint={formatCurrency(lending.bookedThisMonthValue)}
                  />
                  <Figure
                    label="Submitted → booked"
                    value={
                      lending.conversionRate30d > 0 ? `${lending.conversionRate30d.toFixed(1)}%` : '—'
                    }
                    hint="Thirty-day conversion from submission to booking"
                  />
                </div>

                {lending.approvedThisMonthCount === 0 && lending.declinedThisMonthCount === 0 && (
                  <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    No approvals or declines were recorded this month.
                  </p>
                )}

                {portfolios && portfolios.length > 0 && (
                  <div>
                    <div
                      className="flex items-baseline justify-between gap-2 border-b pb-2 text-xs"
                      style={{ borderColor: 'var(--rm-hairline-strong)', color: 'var(--rm-text-muted)' }}
                    >
                      <span>Relationship manager</span>
                      <span className="num">Live · value · risk</span>
                    </div>
                    {portfolios.map(rm => (
                      <div
                        key={rm.rmUserId}
                        className="flex items-center gap-3 border-b py-2 last:border-0"
                        style={{ borderColor: 'var(--rm-hairline)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                            {[rm.firstName, rm.lastName].filter(Boolean).join(' ') || rm.username}
                          </p>
                          <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                            {rm.department ?? rm.jobTitle ?? 'Relationship manager'}
                          </p>
                        </div>
                        <p className="num w-7 shrink-0 text-right text-sm">{rm.inProgressCount}</p>
                        <p className="num w-16 shrink-0 text-right text-sm">
                          {compactCurrency(rm.inProgressValue)}
                        </p>
                        <p
                          className="num w-10 shrink-0 text-right text-xs"
                          style={{
                            color: rm.stuckAtRiskCount > 0 ? 'var(--rm-warn)' : 'var(--rm-text-muted)',
                          }}
                        >
                          {rm.stuckAtRiskCount}
                        </p>
                      </div>
                    ))}
                    {outsidePortfolioCount > 0 && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-warn)' }}>
                            Outside the RM list
                          </p>
                          <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                            Not among the five RMs
                          </p>
                        </div>
                        <p className="num w-7 shrink-0 text-right text-sm">{outsidePortfolioCount}</p>
                        <p className="num w-16 shrink-0 text-right text-sm">
                          {compactCurrency(outsidePortfolioValue)}
                        </p>
                        <p className="num w-10 shrink-0 text-right text-xs" style={{ color: 'var(--rm-warn)' }}>
                          {outsidePortfolioRisk}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-brand-soft)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--rm-brand-on-soft)' }}>
                    The book is contracting
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Repaid
                      </p>
                      <p className="num mt-0.5 text-lg font-semibold">
                        {compactCurrency(windowRepayments)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Advanced
                      </p>
                      <p className="num mt-0.5 text-lg font-semibold">
                        {compactCurrency(windowDisbursements)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Net{' '}
                    <span className="num font-semibold" style={{ color: 'var(--rm-text)' }}>
                      {signedCompactCurrency(windowDisbursements - windowRepayments)}
                    </span>{' '}
                    across {windowMonths} months.
                  </p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </section>

      {/* ══ 03 Customers and reach ══ */}
      <section id="customers" className="scroll-mt-6">
        <SectionHeader
          id="customers"
          index="03"
          title="Customers and reach"
          note="Who the bank serves, and where the traffic arrives."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <Panel
            id="compliance"
            title="Customers and compliance"
            note="The register, and how far verification has progressed."
            className="xl:col-span-7"
            foot={
              customers ? (
                <span>
                  The customer service returns the register without a bank identifier; these figures
                  are unfiltered.
                </span>
              ) : null
            }
          >
            {!customers || customers.length === 0 ? (
              panelsLoading ? (
                <PanelSkeleton rows={4} />
              ) : (
                <Unavailable
                  title={panelsError.customers ? 'Customer register is unavailable.' : 'No customers on file.'}
                  note={panelsError.customers ? 'The customer service did not respond.' : undefined}
                />
              )
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="num text-3xl font-semibold leading-none">
                      {customers.length.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      customers on file ·{' '}
                      {posture.byType.map(([key, count]) => `${count} ${displayLabel(key).toLowerCase()}`).join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
                  <VerificationBlock title="KYC verification" rows={posture.byKyc} total={customerTotal} />
                  <VerificationBlock title="AML screening" rows={posture.byAml} total={customerTotal} />
                  <Distribution title="Risk rating" rows={posture.byRisk} total={customerTotal} />
                  <Distribution
                    title="Segment"
                    rows={posture.bySegment.slice(0, 5)}
                    total={customerTotal}
                    more={Math.max(0, posture.bySegment.length - 5)}
                  />
                </div>
              </div>
            )}
          </Panel>

          <Panel
            id="channels"
            title="How money reaches the bank"
            note="Card leads volume; SEPA leads value."
            className="xl:col-span-5"
            foot={
              channels?.length ? (
                <span>
                  No branch or API traffic exists in the book. Channel totals cover the last {period}{' '}
                  months to date, including October.
                </span>
              ) : null
            }
          >
            {!channels || channels.length === 0 ? (
              seriesLoading ? (
                <PanelSkeleton rows={4} />
              ) : (
                <Unavailable
                  title="Channel mix is unavailable."
                  note={seriesError ?? 'No settled transactions were returned for this window.'}
                />
              )
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                      Share of transactions
                    </p>
                    <p className="num text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      {sumOf(channels, c => c.transactionCount).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2">
                    <StackBar
                      segments={channels.map(channel => ({
                        label: channel.channelDisplay,
                        value: channel.transactionCount,
                        opacity: channelTones.get(channel.channel) ?? 1,
                        title: `${channel.channelDisplay}: ${channel.transactionCount.toLocaleString()} lines (${percentText(
                          channel.countSharePercent,
                          1
                        )})`,
                      }))}
                      label={`Transaction share by channel: ${channels
                        .map(c => `${c.channelDisplay} ${percentText(c.countSharePercent, 1)}`)
                        .join(', ')}`}
                      height={9}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                      Share of value
                    </p>
                    <p className="num text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      {compactCurrency(sumOf(channels, c => c.totalValue))}
                    </p>
                  </div>
                  <div className="mt-2">
                    <StackBar
                      segments={channels.map(channel => ({
                        label: channel.channelDisplay,
                        value: channel.totalValue ?? 0,
                        opacity: channelTones.get(channel.channel) ?? 1,
                        title: `${channel.channelDisplay}: ${formatCurrency(
                          channel.totalValue ?? 0
                        )} (${percentText(channel.valueSharePercent, 1)})`,
                      }))}
                      label={`Value share by channel: ${channels
                        .map(c => `${c.channelDisplay} ${percentText(c.valueSharePercent, 1)}`)
                        .join(', ')}`}
                      height={9}
                    />
                  </div>
                </div>

                <div>
                  <div
                    className="flex items-baseline justify-between gap-2 border-b pb-2 text-xs"
                    style={{ borderColor: 'var(--rm-hairline-strong)', color: 'var(--rm-text-muted)' }}
                  >
                    <span>Channel</span>
                    <span className="num">
                      Lines · value<span className="hidden sm:inline"> · share</span>
                    </span>
                  </div>
                  {channels.map(channel => (
                    <div
                      key={channel.channel}
                      className="flex items-center gap-2 border-b py-2 text-sm last:border-0"
                      style={{ borderColor: 'var(--rm-hairline)' }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: 'var(--rm-brand)',
                          opacity: channelTones.get(channel.channel) ?? 1,
                        }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--rm-text-secondary)' }}>
                        {channel.channelDisplay}
                      </span>
                      <span className="num w-16 shrink-0 text-right">
                        {channel.transactionCount.toLocaleString()}
                      </span>
                      <span className="num w-16 shrink-0 text-right">
                        {compactCurrency(channel.totalValue ?? 0)}
                      </span>
                      <span
                        className="num hidden w-16 shrink-0 text-right text-xs sm:block"
                        style={{ color: 'var(--rm-text-muted)' }}
                      >
                        {percentText(channel.countSharePercent, 0)} · {percentText(channel.valueSharePercent, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </section>

      {/* ══ 04 Accounts and platform ══ */}
      <section id="accounts" className="scroll-mt-6">
        <SectionHeader
          id="accounts"
          index="04"
          title="Accounts and platform"
          note="The account base, and the people and systems behind it."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <Panel
            id="accounts-panel"
            title="Accounts"
            note="The book by lifecycle state."
            className="xl:col-span-7"
            foot={
              overview?.closedPosition ? (
                <span>
                  Closed accounts still carry{' '}
                  {formatCurrency(overview.closedPosition.closedBalance)} on their last balance row,
                  excluded from the deposit total.
                </span>
              ) : null
            }
          >
            {!overview?.lifecycle ? (
              coreLoading ? (
                <PanelSkeleton rows={4} />
              ) : (
                <Unavailable title="Account lifecycle is unavailable." note={coreError ?? undefined} />
              )
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="num text-3xl font-semibold leading-none">
                      {lifecycleCount.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      accounts across deposits and lending
                    </p>
                  </div>
                  <p
                    className="rounded-full px-3.5 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--rm-brand-soft)',
                      color: 'var(--rm-brand-on-soft)',
                    }}
                  >
                    {openingPhrase.replace(/\.$/, '')}
                  </p>
                </div>

                <div>
                  <StackBar
                    segments={lifecycleRows.map((row, i) => ({
                      label: STATUS_LABEL[row.status] ?? displayLabel(row.status),
                      value: row.accountCount,
                      opacity: [1, 0.6, 0.35, 0.16][STATUS_ORDER.indexOf(row.status)] ?? rampTone(i, lifecycleRows.length),
                      title: `${STATUS_LABEL[row.status] ?? row.status}: ${row.accountCount.toLocaleString()} accounts`,
                    }))}
                    label={`Account lifecycle: ${lifecycleRows
                      .map(row => `${STATUS_LABEL[row.status] ?? row.status} ${row.accountCount}`)
                      .join(', ')}`}
                    height={12}
                  />
                </div>

                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {lifecycleRows.map(row => {
                    const tone = [1, 0.6, 0.35, 0.16][STATUS_ORDER.indexOf(row.status)] ?? 1;
                    return (
                      <div
                        key={row.status}
                        className="flex items-center gap-3 border-b py-2 text-sm last:border-0"
                        style={{ borderColor: 'var(--rm-hairline)' }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: 'var(--rm-brand)', opacity: tone }}
                          aria-hidden="true"
                        />
                        <span className="flex-1" style={{ color: 'var(--rm-text-secondary)' }}>
                          {STATUS_LABEL[row.status] ?? displayLabel(row.status)}
                        </span>
                        <span className="num font-medium">{row.accountCount.toLocaleString()}</span>
                        <span className="num w-20 text-right" style={{ color: 'var(--rm-text-muted)' }}>
                          {compactCurrency(row.balance)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {seriesFlows.length > 0 ? (
                  <div className="grid gap-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                        Opened against closed, by month
                      </p>
                      <div className="mt-3" style={{ width: groupedWidth }}>
                        <DotGroups
                          series={[
                            {
                              name: 'Opened',
                              values: seriesFlows.map(f => f.accountsOpened),
                              color: 'var(--rm-up)',
                            },
                            {
                              name: 'Closed',
                              values: seriesFlows.map(f => f.accountsClosed),
                              color: 'var(--rm-down)',
                            },
                          ]}
                          cell={groupedCell}
                          rows={9}
                          label={`Accounts opened against closed, by month across ${chartCount} months`}
                          format={(name, v, i) =>
                            `${monthYearLabel(seriesFlows[i]?.month ?? '')} · ${name}: ${v}`
                          }
                        />
                        <Axis labels={chartLabels} positions={groupedPositions} />
                      </div>
                      <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        <span className="num">
                          {sumOf(seriesFlows, f => f.accountsOpened).toLocaleString()}
                        </span>{' '}
                        opened ·{' '}
                        <span className="num">
                          {sumOf(seriesFlows, f => f.accountsClosed).toLocaleString()}
                        </span>{' '}
                        closed over the window. Dormancy is only readable on the accounts that carry
                        an activity timestamp.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-1">
                      <Figure
                        label="Mean account age"
                        value={`${Math.round(overview.lifecycle.averageAgeDays ?? 0).toLocaleString()} days`}
                        hint="Time since each live account was opened"
                      />
                      <Figure
                        label="Dormant share of balances"
                        value={percentText(dormantShare, 1)}
                        hint="Share of the account book sitting in dormant accounts"
                      />
                      <Figure
                        label="With recorded activity"
                        value={`${overview.lifecycle.withRecordedActivity.toLocaleString()} of ${overview.lifecycle.totalAccounts.toLocaleString()}`}
                        hint="Dormancy cannot be detected on accounts with no last-activity timestamp"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5">
                    <Figure
                      label="Mean account age"
                      value={`${Math.round(overview.lifecycle.averageAgeDays ?? 0).toLocaleString()} days`}
                    />
                    <Figure label="Dormant share of balances" value={percentText(dormantShare, 1)} />
                    <Figure
                      label="With recorded activity"
                      value={`${overview.lifecycle.withRecordedActivity.toLocaleString()} of ${overview.lifecycle.totalAccounts.toLocaleString()}`}
                    />
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel
            id="platform"
            title="People and platform"
            note="Who can sign in, and what the assistant answers from."
            className="xl:col-span-5"
            foot={
              <span>Sign-in is a single last-login timestamp per user; no history is stored.</span>
            }
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Figure
                label="Bank staff"
                value={rosterTotal === null ? '—' : rosterTotal.toLocaleString()}
                hint="Bank users with access to this portal"
              />
              <Figure
                label="Customer logins"
                value={customers === null ? '—' : withLogin.toLocaleString()}
                hint="Customers with portal credentials"
              />
              <Figure
                label="AI knowledge sources"
                value={sources === null ? '—' : sources.length.toLocaleString()}
                hint={
                  sources
                    ? `${sources.filter(s => s.status === 'ACTIVE').length} active`
                    : 'Unavailable right now'
                }
              />
              <Figure
                label={`Not signed in for ${RECENT_SIGN_IN_DAYS} days`}
                value={notSignedInRecently === null ? '—' : notSignedInRecently.toLocaleString()}
                tone={notSignedInRecently ? 'var(--rm-warn)' : undefined}
                hint="Staff with no sign-in inside the window, including accounts that have never signed in"
              />
            </div>

            <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--rm-hairline)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Recent staff access
                </p>
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  <span className="num">{posture.staffSignedInRecently}</span> in {RECENT_SIGN_IN_DAYS}{' '}
                  days
                </p>
              </div>

              {staff === null ? (
                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Staff activity is unavailable right now.
                </p>
              ) : recentStaff.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No staff sign-in in the last {RECENT_SIGN_IN_DAYS} days.
                </p>
              ) : (
                <div className="mt-1">
                  {recentStaff.map(person => (
                    <div
                      key={person.userId}
                      className="flex items-center gap-3 border-b py-2 last:border-0"
                      style={{ borderColor: 'var(--rm-hairline)' }}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'var(--rm-brand-soft)',
                          color: 'var(--rm-brand-on-soft)',
                        }}
                        aria-hidden="true"
                      >
                        {initialsOf(person)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                          {staffName(person)}
                        </p>
                        <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          {roleText(person.roles)}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {timeAgo(person.lastLoginAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {rmStaffCount !== null && staff && (
                <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  <span className="num">{rmStaffCount}</span> relationship managers ·{' '}
                  <span className="num">{staff.length - rmStaffCount}</span> other staff.
                </p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <AdminTile href="/dashboard/admin/users" label="Bank users" />
              <AdminTile href="/dashboard/customers" label="Customers" />
              <AdminTile href="/dashboard/admin/ai-knowledge" label="AI sources" />
            </div>
          </Panel>
        </div>
      </section>

      {/* ══ Coverage ══ */}
      <section className="rm-panel" aria-labelledby="exec-coverage-heading">
        <h2 className="sr-only" id="exec-coverage-heading">
          What this page cannot answer
        </h2>
        <button
          type="button"
          onClick={() => setCoverageOpen(open => !open)}
          aria-expanded={coverageOpen}
          className="rm-panel-head w-full text-left"
        >
          <div className="min-w-0">
            <span className="rm-title block">What this page cannot answer</span>
            <span className="rm-sub block">A silence here is not a zero.</span>
          </div>
          <span
            className="mt-1 shrink-0 transition-transform"
            style={{ color: 'var(--rm-text-muted)', transform: coverageOpen ? 'rotate(90deg)' : 'none' }}
          >
            <Glyph path={GLYPH.chevron} className="h-5 w-5" />
          </span>
        </button>
        {coverageOpen && (
          <div className="rm-body">
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
          </div>
        )}
      </section>

      <p className="pb-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        Figures are read from the account, transaction, dashboard, user and customer services at load
        time.
        {firstRecorded && <> Transaction history begins {monthYearLabel(firstRecorded.month)}.</>}
        {lastUpdated && (
          <>
            {' '}
            Last refreshed at{' '}
            <span className="num">
              {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            .
          </>
        )}
        {busy ? ' Refreshing…' : ''}
      </p>
    </div>
  );
}

const AdminTile = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-75"
    style={{ borderColor: 'var(--rm-hairline-strong)', color: 'var(--rm-text-secondary)' }}
  >
    <span className="truncate">{label}</span>
    <Glyph path={GLYPH.chevron} className="h-4 w-4 shrink-0" />
  </Link>
);

/**
 * Honest limits of the platform's data, each verified against the live schema. This is not a
 * disclaimer block for styling: if a source appears for any of these, delete the entry rather
 * than leaving it stale.
 */
const COVERAGE: [string, string][] = [
  [
    'Treasury and liquidity operations',
    'No central-bank placement, interbank funding, securities holding or FX position exists. Liquidity is derived from deposits and advances only.',
  ],
  [
    'Profit and loss',
    'There is no general ledger, trial balance or expense table. Income here is fee and interest traffic; with no costs recorded, no profit can be stated.',
  ],
  [
    'Credit quality and arrears',
    'The delinquency and repayment-schedule tables hold no rows and every arrears column is zero, so non-performing loans and provisioning cannot be reported.',
  ],
  [
    'Bookings and signatures over time',
    'Those dates are unpopulated on every application, so weekly lending activity is charted on submissions and decisions alone.',
  ],
  [
    'Branches, cards and ATMs as an estate',
    'No branch, card-issuing or ATM asset tables exist. Channel volumes appear, but the estate behind them is not modelled.',
  ],
  [
    'Closures before the lifecycle seed',
    'Closings are recorded only from the point the lifecycle data begins, so earlier closures are invisible.',
  ],
  [
    'Account activity timestamps',
    'A last-activity timestamp exists on a minority of accounts, so dormancy is under-detected and the dormant balance is a floor.',
  ],
];
