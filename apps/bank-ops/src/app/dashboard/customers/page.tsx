'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { customerService, type Customer } from '@/services/api/customerService';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';
import {
  SortableHeader,
  type SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

/* ------------------------------------------------------------------ */
/* Derivation helpers — every value below comes from the Customer record */
/* ------------------------------------------------------------------ */

/** Declared annual figure for the relationship (revenue for entities, income for people). */
function declaredIncomeOf(c: Customer): number {
  return c.annualRevenue ?? c.annualIncome ?? 0;
}

function isActive(c: Customer): boolean {
  return (c.customerStatus || '').toUpperCase() === 'ACTIVE';
}

function isAtRisk(c: Customer): boolean {
  const r = (c.riskRating || '').toUpperCase();
  return r === 'HIGH' || r === 'VERY_HIGH' || r === 'POOR' || r === 'BAD';
}

function needsKycReview(c: Customer): boolean {
  const k = (c.kycStatus || '').toUpperCase();
  return k === '' || k === 'NOT_STARTED' || k === 'PENDING' || k === 'EXPIRED' || k === 'REJECTED';
}

function kycTone(c: Customer): Tone {
  const k = (c.kycStatus || '').toUpperCase();
  if (/APPROV|COMPLET|VERIF/.test(k)) return 'positive';
  if (k === 'REJECTED') return 'negative';
  if (needsKycReview(c)) return 'warning';
  return 'neutral';
}

function riskTone(c: Customer): Tone {
  const r = (c.riskRating || '').toUpperCase();
  if (!r || r === 'NOT_RATED') return 'neutral';
  if (r === 'LOW') return 'positive';
  if (r === 'MEDIUM') return 'warning';
  return 'negative';
}

/** Whole months between `since` and today (0 when unknown/invalid). */
function monthsSince(since?: string): number {
  if (!since) return 0;
  const start = new Date(since);
  if (isNaN(start.getTime())) return 0;
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months > 0 ? months : 0;
}

function tenureLabel(months: number): string {
  if (months <= 0) return '—';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `${y}y ${m}m` : `${m}m`;
}

function segmentOf(c: Customer): string {
  return c.customerSegment || customerService.formatCustomerType(c.customerType);
}

function compactCurrency(n: number): string {
  const sym = getCurrencySymbol();
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sym}${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}K`;
  return formatCurrency(n);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/* Theme-aware tones — colour is always paired with a text label        */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

const TONE_BG: Record<Tone, string> = {
  neutral: 'rgba(127,127,127,0.12)',
  positive: 'rgba(16,185,129,0.14)',
  warning: 'rgba(245,158,11,0.16)',
  negative: 'rgba(239,68,68,0.14)',
  accent: 'var(--rm-accent-muted)',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'var(--rm-text-muted)',
  positive: '#10b981',
  warning: '#f59e0b',
  negative: '#ef4444',
  accent: 'var(--rm-accent)',
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
      style={{ backgroundColor: TONE_BG[tone], color: 'var(--rm-text)' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: TONE_DOT[tone] }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
      aria-hidden="true"
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Row view-model (adds the derived fields the sorter can address)      */
/* ------------------------------------------------------------------ */

type CustomerRow = Customer & {
  rowName: string;
  rowSegment: string;
  rowIndustry: string;
  rowIncome: number;
  rowTenureMonths: number;
  rowKyc: string;
  rowRisk: string;
};

const SORT_CLASS = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);
  const [kycOnly, setKycOnly] = useState(false);
  const [tab, setTab] = useState<'list' | 'segments'>('list');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'rowName',
    direction: 'asc',
  });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customerService.searchCustomers({ searchTerm: '' });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError('We could not load your customers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  /* Distinct filter values from real data */
  const segmentOptions = useMemo(
    () => Array.from(new Set(customers.map(segmentOf))).filter(Boolean).sort(),
    [customers]
  );
  const industryOptions = useMemo(
    () =>
      Array.from(new Set(customers.map(c => c.industrySector).filter(Boolean) as string[])).sort(),
    [customers]
  );

  /* Summary figures — all derived from the loaded records */
  const metrics = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter(isActive).length,
      atRisk: customers.filter(isAtRisk).length,
      kycReview: customers.filter(needsKycReview).length,
    };
  }, [customers]);

  const rows = useMemo<CustomerRow[]>(
    () =>
      customers.map(c => {
        const months = monthsSince(c.customerSince);
        return {
          ...c,
          rowName: customerService.getCustomerName(c),
          rowSegment: segmentOf(c),
          rowIndustry: c.industrySector || '—',
          rowIncome: declaredIncomeOf(c),
          rowTenureMonths: months,
          rowKyc: c.kycStatus || '',
          rowRisk: c.riskRating || '',
        };
      }),
    [customers]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = rows.filter(c => {
      if (term) {
        const haystack = [
          c.rowName,
          c.primaryEmail || '',
          c.primaryPhone || '',
          c.customerNumber || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (segmentFilter && c.rowSegment !== segmentFilter) return false;
      if (industryFilter && c.industrySector !== industryFilter) return false;
      if (riskOnly && !isAtRisk(c)) return false;
      if (kycOnly && !needsKycReview(c)) return false;
      return true;
    });
    return sortData(list, sortConfig);
  }, [rows, searchTerm, segmentFilter, industryFilter, riskOnly, kycOnly, sortConfig]);

  /* Segment breakdown for the segments tab */
  const segmentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; income: number }>();
    customers.forEach(c => {
      const key = segmentOf(c);
      const cur = map.get(key) || { count: 0, income: 0 };
      cur.count += 1;
      cur.income += declaredIncomeOf(c);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [customers]);

  const recentlyAdded = useMemo(
    () =>
      [...customers]
        .filter(c => c.customerSince)
        .sort(
          (a, b) =>
            new Date(b.customerSince || 0).getTime() - new Date(a.customerSince || 0).getTime()
        )
        .slice(0, 4),
    [customers]
  );

  const hasFilters = !!(searchTerm || segmentFilter || industryFilter || riskOnly || kycOnly);
  const clearFilters = () => {
    setSearchTerm('');
    setSegmentFilter('');
    setIndustryFilter('');
    setRiskOnly(false);
    setKycOnly(false);
  };

  const fieldStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    color: 'var(--rm-text)',
    border: '1px solid var(--rm-border)',
  };

  const cardStyle: React.CSSProperties = { backgroundColor: 'var(--rm-card)' };

  return (
    <div className="space-y-6">
      {/* ══ Header ══ */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            Customers
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
            {loading
              ? 'Loading your customer portfolio…'
              : error
                ? 'Customer portfolio unavailable'
                : `${metrics.total} customer${metrics.total === 1 ? '' : 's'} in your portfolio`}
          </p>
        </div>
        <Link
          href="/dashboard/customers/new"
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--rm-accent)' }}
        >
          Add customer
        </Link>
      </header>

      {/* ══ Error ══ */}
      {error && (
        <section
          role="alert"
          className="rounded-3xl p-6 flex items-start gap-4 flex-wrap"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
        >
          <svg
            className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
              {error}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              Nothing was lost — you can retry the request.
            </p>
          </div>
          <button
            onClick={loadCustomers}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            Retry
          </button>
        </section>
      )}

      {/* ══ Portfolio summary ══ */}
      {!error && (
        <section
          aria-label="Portfolio summary"
          className="rounded-3xl p-6"
          style={cardStyle}
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div
                    className="h-3.5 w-24 rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                  <div
                    className="h-7 w-16 rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Customers
                </dt>
                <dd
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {metrics.total.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Active relationships
                </dt>
                <dd
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {metrics.active.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  High risk rating
                </dt>
                <dd
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {metrics.atRisk.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  KYC review needed
                </dt>
                <dd
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {metrics.kycReview.toLocaleString()}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* ══ Left column ══ */}
        <div className="space-y-6 min-w-0">
          {/* Filters */}
          <section aria-label="Customer filters" className="rounded-3xl p-6" style={cardStyle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="customer-search"
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  Search
                </label>
                <input
                  id="customer-search"
                  type="search"
                  placeholder="Name, email, phone or customer number"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label
                  htmlFor="customer-segment"
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  Segment
                </label>
                <select
                  id="customer-segment"
                  value={segmentFilter}
                  onChange={e => setSegmentFilter(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm"
                  style={fieldStyle}
                >
                  <option value="">All segments</option>
                  {segmentOptions.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {industryOptions.length > 0 && (
                <div>
                  <label
                    htmlFor="customer-industry"
                    className="block text-sm mb-1.5"
                    style={{ color: 'var(--rm-text-secondary)' }}
                  >
                    Industry
                  </label>
                  <select
                    id="customer-industry"
                    value={industryFilter}
                    onChange={e => setIndustryFilter(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm"
                    style={fieldStyle}
                  >
                    <option value="">All industries</option>
                    {industryOptions.map(i => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setRiskOnly(v => !v)}
                aria-pressed={riskOnly}
                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: riskOnly ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                  color: riskOnly ? 'var(--rm-accent)' : 'var(--rm-text-secondary)',
                }}
              >
                High risk rating
                <span className="ml-1.5 tabular-nums">{metrics.atRisk}</span>
              </button>
              <button
                type="button"
                onClick={() => setKycOnly(v => !v)}
                aria-pressed={kycOnly}
                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: kycOnly ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                  color: kycOnly ? 'var(--rm-accent)' : 'var(--rm-text-secondary)',
                }}
              >
                KYC review needed
                <span className="ml-1.5 tabular-nums">{metrics.kycReview}</span>
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto rounded-full px-4 py-2 text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {/* Tabs */}
          <div>
            <div
              role="tablist"
              aria-label="Customer views"
              className="flex gap-1 rounded-full p-1 w-fit"
              style={{ backgroundColor: 'rgba(127,127,127,0.10)' }}
            >
              {(
                [
                  { key: 'list' as const, label: 'Customer list', id: 'customers-tab-list' },
                  { key: 'segments' as const, label: 'Segments', id: 'customers-tab-segments' },
                ]
              ).map(t => (
                <button
                  key={t.key}
                  id={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.key}
                  aria-controls={`panel-${t.key}`}
                  tabIndex={tab === t.key ? 0 : -1}
                  onClick={() => setTab(t.key)}
                  className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: tab === t.key ? 'var(--rm-card)' : 'transparent',
                    color: tab === t.key ? 'var(--rm-text)' : 'var(--rm-text-muted)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Customer list panel ── */}
            <div
              role="tabpanel"
              id="panel-list"
              aria-labelledby="customers-tab-list"
              tabIndex={0}
              hidden={tab !== 'list'}
              className="mt-6"
            >
              {loading ? (
                <ListSkeleton />
              ) : error ? null : customers.length === 0 ? (
                <EmptyCard
                  title="No customers yet"
                  body="Add your first customer to start building the portfolio."
                  action={
                    <Link
                      href="/dashboard/customers/new"
                      className="rounded-full px-4 py-2 text-sm font-medium hover:underline"
                      style={{ color: 'var(--rm-accent)' }}
                    >
                      Add customer
                    </Link>
                  }
                />
              ) : filtered.length === 0 ? (
                <EmptyCard
                  title="No customers match these filters"
                  body="Try widening the search or clearing the filters."
                  action={
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-full px-4 py-2 text-sm font-medium hover:underline"
                      style={{ color: 'var(--rm-accent)' }}
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <section className="rounded-3xl overflow-hidden" style={cardStyle}>
                  <div
                    className="flex items-center justify-between gap-3 flex-wrap px-5 py-4"
                    style={{ borderBottom: '1px solid var(--rm-border)' }}
                  >
                    <h2
                      className="text-xl font-semibold tracking-tight"
                      style={{ color: 'var(--rm-text)' }}
                    >
                      Customer list
                    </h2>
                    <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                      Showing {filtered.length} of {customers.length} · select a column to sort
                    </p>
                  </div>

                  <div
                    role="region"
                    aria-label="Customer list, horizontally scrollable"
                    tabIndex={0}
                    className="overflow-x-auto"
                  >
                    <table className="w-full" aria-label="Customers">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                          <SortableHeader
                            label="Customer"
                            field="rowName"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            className={SORT_CLASS}
                          />
                          <SortableHeader
                            label="Segment"
                            field="rowSegment"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            className={SORT_CLASS}
                          />
                          <SortableHeader
                            label="Industry"
                            field="rowIndustry"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            className={SORT_CLASS}
                          />
                          <SortableHeader
                            label="Revenue / income"
                            field="rowIncome"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            align="right"
                            className={SORT_CLASS}
                          />
                          <SortableHeader
                            label="Customer since"
                            field="rowTenureMonths"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            className={SORT_CLASS}
                          />
                          <SortableHeader
                            label="KYC"
                            field="rowKyc"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            className={SORT_CLASS}
                          />
                          <SortableHeader
                            label="Risk rating"
                            field="rowRisk"
                            currentSort={sortConfig}
                            onSort={handleSort}
                            className={SORT_CLASS}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(c => (
                          <tr
                            key={c.customerId}
                            className="cursor-pointer transition-colors"
                            style={{ borderBottom: '1px solid var(--rm-border)' }}
                            onMouseEnter={e =>
                              (e.currentTarget.style.backgroundColor = 'rgba(127,127,127,0.06)')
                            }
                            onMouseLeave={e =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                            onClick={() =>
                              router.push(`/dashboard/customers/${c.customerId}`)
                            }
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <Initials name={c.rowName} />
                                <div className="min-w-0">
                                  <Link
                                    href={`/dashboard/customers/${c.customerId}`}
                                    onClick={e => e.stopPropagation()}
                                    className="block text-base font-medium truncate hover:underline"
                                    style={{ color: 'var(--rm-text)' }}
                                  >
                                    {c.rowName}
                                  </Link>
                                  <p
                                    className="text-sm truncate"
                                    style={{ color: 'var(--rm-text-muted)' }}
                                  >
                                    {c.customerNumber || customerService.formatCustomerType(c.customerType)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className="text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                {c.rowSegment}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className="text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                {c.rowIndustry}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <span
                                className="text-base font-medium tabular-nums"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {c.rowIncome > 0 ? compactCurrency(c.rowIncome) : '—'}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <p
                                className="text-sm tabular-nums"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {tenureLabel(c.rowTenureMonths)}
                              </p>
                              <p
                                className="text-sm"
                                style={{ color: 'var(--rm-text-muted)' }}
                              >
                                {formatDate(c.customerSince)}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <Pill tone={kycTone(c)}>
                                {c.kycStatus ? c.kycStatus.replace(/_/g, ' ') : 'No record'}
                              </Pill>
                            </td>
                            <td className="px-5 py-4">
                              <Pill tone={riskTone(c)}>
                                {c.riskRating ? c.riskRating.replace(/_/g, ' ') : 'Not rated'}
                              </Pill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {/* ── Segments panel ── */}
            <div
              role="tabpanel"
              id="panel-segments"
              aria-labelledby="customers-tab-segments"
              tabIndex={0}
              hidden={tab !== 'segments'}
              className="mt-6"
            >
              {loading ? (
                <ListSkeleton />
              ) : error ? null : segmentBreakdown.length === 0 ? (
                <EmptyCard
                  title="No segments to show"
                  body="Segments appear once customers have been added."
                />
              ) : (
                <section aria-label="Customer segments" className="space-y-4">
                  <h2
                    className="text-xl font-semibold tracking-tight"
                    style={{ color: 'var(--rm-text)' }}
                  >
                    Segments
                  </h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {segmentBreakdown.map(seg => {
                      const pct = metrics.total
                        ? Math.round((seg.count / metrics.total) * 100)
                        : 0;
                      return (
                        <li key={seg.name} className="rounded-3xl p-6" style={cardStyle}>
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className="text-base font-medium"
                              style={{ color: 'var(--rm-text)' }}
                            >
                              {seg.name}
                            </p>
                            <span
                              className="text-sm tabular-nums shrink-0"
                              style={{ color: 'var(--rm-text-muted)' }}
                            >
                              {seg.count} customer{seg.count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p
                            className="mt-3 text-base font-medium tabular-nums"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {seg.income > 0 ? compactCurrency(seg.income) : '—'}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            Declared revenue or income · {pct}% of customers
                          </p>
                          <div
                            className="mt-3 h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: 'var(--rm-input)' }}
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: 'var(--rm-accent)' }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>

        {/* ══ Sidebar ══ */}
        <aside className="space-y-6" aria-label="Portfolio insights">
          <section className="rounded-3xl p-6" style={cardStyle}>
            <h2
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Needs attention
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              Select a filter to narrow the customer list.
            </p>
            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setRiskOnly(v => !v);
                  setTab('list');
                }}
                aria-pressed={riskOnly}
                className="w-full text-left rounded-2xl px-5 py-4 transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: riskOnly ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                }}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    High risk rating
                  </span>
                  <span
                    className="text-base font-semibold tabular-nums"
                    style={{ color: 'var(--rm-text)' }}
                  >
                    {loading ? '—' : metrics.atRisk}
                  </span>
                </span>
                <span
                  className="block text-sm mt-1"
                  style={{ color: 'var(--rm-text-muted)' }}
                >
                  {riskOnly ? 'Filter applied' : 'Not filtered'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setKycOnly(v => !v);
                  setTab('list');
                }}
                aria-pressed={kycOnly}
                className="w-full text-left rounded-2xl px-5 py-4 transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: kycOnly ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                }}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    KYC review needed
                  </span>
                  <span
                    className="text-base font-semibold tabular-nums"
                    style={{ color: 'var(--rm-text)' }}
                  >
                    {loading ? '—' : metrics.kycReview}
                  </span>
                </span>
                <span
                  className="block text-sm mt-1"
                  style={{ color: 'var(--rm-text-muted)' }}
                >
                  {kycOnly ? 'Filter applied' : 'Not filtered'}
                </span>
              </button>
            </div>
          </section>

          <section className="rounded-3xl p-6" style={cardStyle}>
            <h2
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Recently onboarded
            </h2>
            {loading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                ))}
              </div>
            ) : recentlyAdded.length === 0 ? (
              <p className="text-sm mt-3" style={{ color: 'var(--rm-text-muted)' }}>
                No onboarding dates recorded yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y" style={{ borderColor: 'var(--rm-border)' }}>
                {recentlyAdded.map(c => {
                  const name = customerService.getCustomerName(c);
                  return (
                    <li key={c.customerId}>
                      <Link
                        href={`/dashboard/customers/${c.customerId}`}
                        className="flex items-center gap-3 px-0 py-4 hover:underline"
                      >
                        <Initials name={name} />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-base font-medium truncate"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {name}
                          </span>
                          <span
                            className="block text-sm"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            Onboarded {formatDate(c.customerSince)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {loading && (
        <p role="status" className="sr-only">
          Loading customers
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function ListSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rm-border)' }}>
        <div
          className="h-5 w-40 rounded-full animate-pulse"
          style={{ backgroundColor: 'var(--rm-input)' }}
        />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--rm-border)' }}
        >
          <div
            className="h-10 w-10 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: 'var(--rm-input)' }}
          />
          <div className="flex-1 space-y-2">
            <div
              className="h-4 w-1/3 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--rm-input)' }}
            />
            <div
              className="h-3 w-1/5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--rm-input)' }}
            />
          </div>
          <div
            className="h-6 w-20 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: 'var(--rm-input)' }}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl py-16 px-6 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--rm-input)' }}
      >
        <svg
          className="w-7 h-7"
          style={{ color: 'var(--rm-text-muted)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          />
        </svg>
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
        {title}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
