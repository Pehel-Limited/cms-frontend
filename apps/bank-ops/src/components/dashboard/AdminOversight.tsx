'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compactCurrency, formatCurrency } from '@/lib/format';
import { matchesFocus, STAGE_STATUSES } from '@/lib/dashboard-filters';
import {
  dashboardService,
  DashboardKpis,
  RmPortfolio,
  PipelineStage,
  AgingHeatmapCell,
  PerformanceMetrics,
  MissingItem,
  WorklistItem,
  TrendPoint,
  ChannelJourney,
} from '@/services/api/dashboard-service';
import PipelineOverview from '@/components/dashboard/PipelineOverview';
import AgingHeatmap from '@/components/dashboard/AgingHeatmap';
import DashboardInsights from '@/components/dashboard/DashboardInsights';
import TrendChart from '@/components/dashboard/TrendChart';
import ChannelJourneys from '@/components/dashboard/ChannelJourneys';
import { SortableHeader, SortConfig, handleSortToggle, sortData } from '@/components/SortableHeader';
import config from '@/config';

/* Status pills come from the shared map, so a status is the same colour here as
   it is on the RM dashboard and its queue. */
import { statusTone as statusPill } from '@/lib/statusTone';

/*
 * Portfolio oversight — the admin's bank-wide view of the lending book.
 *
 * The page is a board pack: the live pipeline position and a reading of it, then
 * the relationship-manager portfolio, the pipeline and flow, the quality and
 * blockers, and finally the customer-side journeys. Selecting an RM opens that
 * RM's queue; a stage, age, risk or outside-portfolio filter opens a bank-wide
 * matching list instead. The two drill-downs are mutually exclusive so the scope
 * is always one thing.
 *
 * The per-RM table carries an "Outside the RM portfolios" row derived from the
 * bank total minus the five RM books. Those applications are real live work
 * assigned to staff outside those portfolios, not ownerless — the previous page
 * dropped them from the table entirely.
 */

function humanise(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function rmLabel(rm: RmPortfolio): string {
  const name = [rm.firstName, rm.lastName].filter(Boolean).join(' ');
  return name || rm.username || 'Unknown';
}

function shareOf(part: number | undefined, whole: number | undefined): number {
  if (!whole || whole <= 0) return 0;
  return ((part ?? 0) / whole) * 100;
}

function sumOf<T>(rows: T[], pick: (row: T) => number | undefined): number {
  return rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
}

/* Submitted through offer: the live pipeline the bank KPI counts. Drafts and
   booking sit outside it, so the "outside the RM portfolios" drill-down uses the
   same boundary as the row it comes from. */
const LIVE_STATUSES = new Set<string>([
  ...Array.from(STAGE_STATUSES.SUBMITTED),
  ...Array.from(STAGE_STATUSES.UNDERWRITING),
  ...Array.from(STAGE_STATUSES.APPROVED),
  ...Array.from(STAGE_STATUSES.OFFER),
]);

async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
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

function ReadingChevron() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
      ))}
    </div>
  );
}

export default function AdminOversight() {
  const router = useRouter();
  const bankId = config.bank.defaultBankId;

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [rmPortfolios, setRmPortfolios] = useState<RmPortfolio[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [agingCells, setAgingCells] = useState<AgingHeatmapCell[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [journeys, setJourneys] = useState<ChannelJourney[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [flowLoading, setFlowLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'inProgressValue', direction: 'desc' });
  const [selectedRm, setSelectedRm] = useState<RmPortfolio | null>(null);
  const [rmWorklist, setRmWorklist] = useState<WorklistItem[]>([]);
  const [rmLoading, setRmLoading] = useState(false);

  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<{ stage: string; bucket: string } | null>(null);
  const [riskOnly, setRiskOnly] = useState(false);
  const [outsideOnly, setOutsideOnly] = useState(false);
  const [bankWorklist, setBankWorklist] = useState<WorklistItem[]>([]);
  const [focusLoading, setFocusLoading] = useState(false);

  const focusRef = useRef<HTMLElement | null>(null);
  const focusActive = !!(stageFilter || ageFilter || riskOnly || outsideOnly);
  const busy = loading || analysisLoading || flowLoading;

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await dashboardService.getOversightSummary(bankId);
      setKpis(summary.bankKpis);
      setRmPortfolios(summary.rmPortfolios || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load oversight data');
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, reloadKey]);

  // Pipeline, aging and performance are bank-wide and load independently.
  useEffect(() => {
    let cancelled = false;
    setAnalysisLoading(true);
    Promise.all([
      settle(dashboardService.getOversightPipeline(bankId)),
      settle(dashboardService.getOversightAgingHeatmap(bankId)),
      settle(dashboardService.getOversightInsights(bankId)),
    ]).then(([pipe, aging, insights]) => {
      if (cancelled) return;
      setPipeline(pipe.value ?? []);
      setAgingCells(aging.value ?? []);
      setPerformance(insights.value?.performance ?? null);
      setMissingItems(insights.value?.missingItems ?? []);
      setAnalysisLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bankId, reloadKey]);

  // Trend and journeys follow the selected RM; clear them while a new scope loads.
  useEffect(() => {
    if (!bankId) return;
    let cancelled = false;
    setFlowLoading(true);
    setTrends([]);
    setJourneys([]);
    Promise.all([
      settle(dashboardService.getOversightTrends(bankId, selectedRm?.rmUserId)),
      settle(dashboardService.getOversightJourneys(bankId, selectedRm?.rmUserId)),
    ]).then(([trendRows, journeyRows]) => {
      if (cancelled) return;
      setTrends(trendRows.value ?? []);
      setJourneys(journeyRows.value ?? []);
      setFlowLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRm, bankId, reloadKey]);

  // Drill-down: the selected RM's live queue.
  useEffect(() => {
    if (!selectedRm) {
      setRmWorklist([]);
      return;
    }
    let cancelled = false;
    setRmLoading(true);
    dashboardService
      .getOversightWorklist(bankId, selectedRm.rmUserId, undefined, 50)
      .then(items => {
        if (!cancelled) setRmWorklist(items);
      })
      .catch(() => {
        if (!cancelled) setRmWorklist([]);
      })
      .finally(() => {
        if (!cancelled) setRmLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRm, bankId, reloadKey]);

  // Bank-wide drill-through: load every RM's queue once a focus filter is active.
  useEffect(() => {
    if (!focusActive) {
      setBankWorklist([]);
      return;
    }
    let cancelled = false;
    setFocusLoading(true);
    dashboardService
      .getOversightWorklist(bankId, undefined, undefined, 200)
      .then(items => {
        if (!cancelled) setBankWorklist(items);
      })
      .catch(() => {
        if (!cancelled) setBankWorklist([]);
      })
      .finally(() => {
        if (!cancelled) setFocusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [focusActive, bankId, reloadKey]);

  /* A chart filter sits above the page, so bring its result into view rather
     than leaving the operator to hunt for it after clicking a stage or bucket. */
  useEffect(() => {
    if (!focusActive) return;
    const timer = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 90);
    return () => window.clearTimeout(timer);
  }, [focusActive, stageFilter, ageFilter, riskOnly, outsideOnly]);

  const clearFocus = useCallback(() => {
    setStageFilter(null);
    setAgeFilter(null);
    setRiskOnly(false);
    setOutsideOnly(false);
  }, []);

  const selectRm = useCallback(
    (rm: RmPortfolio | null) => {
      setSelectedRm(rm);
      clearFocus();
    },
    [clearFocus]
  );

  const toggleRisk = () => {
    setSelectedRm(null);
    setStageFilter(null);
    setAgeFilter(null);
    setOutsideOnly(false);
    setRiskOnly(value => !value);
  };

  const toggleOutsideRm = () => {
    setSelectedRm(null);
    setStageFilter(null);
    setAgeFilter(null);
    setRiskOnly(false);
    setOutsideOnly(value => !value);
  };

  const focusStage = (stage: string | null) => {
    setSelectedRm(null);
    setRiskOnly(false);
    setAgeFilter(null);
    setOutsideOnly(false);
    setStageFilter(stage);
  };

  const focusAge = (stage: string, bucket: string | null) => {
    setSelectedRm(null);
    setRiskOnly(false);
    setStageFilter(null);
    setOutsideOnly(false);
    setAgeFilter(bucket ? { stage, bucket } : null);
  };

  const rmNameById = useMemo(() => {
    const map = new Map<string, string>();
    rmPortfolios.forEach(rm => map.set(rm.rmUserId, rmLabel(rm)));
    return map;
  }, [rmPortfolios]);

  const rmIds = useMemo(() => new Set(rmPortfolios.map(rm => rm.rmUserId)), [rmPortfolios]);

  const focusItems = useMemo(
    () =>
      bankWorklist.filter(item => {
        if (outsideOnly) {
          if (rmIds.has(item.rmUserId)) return false;
          if (!LIVE_STATUSES.has(item.status)) return false;
        }
        if (riskOnly && !LIVE_STATUSES.has(item.status)) return false;
        return matchesFocus(item, { stageFilter, ageFilter, riskOnly });
      }),
    [bankWorklist, stageFilter, ageFilter, riskOnly, outsideOnly, rmIds]
  );

  const sortedRms = useMemo(() => sortData(rmPortfolios, sortConfig), [rmPortfolios, sortConfig]);
  const onSort = (field: string) => setSortConfig(current => handleSortToggle(field, current));

  const totalCustomers = useMemo(
    () => sumOf(rmPortfolios, rm => rm.customersCount),
    [rmPortfolios]
  );

  const rmTotals = useMemo(
    () => ({
      count: sumOf(rmPortfolios, rm => rm.inProgressCount),
      value: sumOf(rmPortfolios, rm => rm.inProgressValue),
      risk: sumOf(rmPortfolios, rm => rm.stuckAtRiskCount),
    }),
    [rmPortfolios]
  );

  /* The bank KPI is the live pipeline; the five portfolios do not cover all of
     it. These three are assigned to staff IDs outside the five RM books, not
     ownerless — the row says so. */
  const outsideCount = Math.max(0, (kpis?.inProgressCount ?? 0) - rmTotals.count);
  const outsideValue = Math.max(0, (kpis?.inProgressValue ?? 0) - rmTotals.value);
  const outsideRisk = Math.max(0, (kpis?.stuckAtRiskCount ?? 0) - rmTotals.risk);

  const riskShare = shareOf(kpis?.stuckAtRiskCount, kpis?.inProgressCount);

  const agingTotal = sumOf(agingCells, cell => cell.applicationCount);
  const aging30 = sumOf(
    agingCells.filter(cell => cell.ageBucket === '30+'),
    cell => cell.applicationCount
  );
  const aging30Share = shareOf(aging30, agingTotal);

  const journeyTotal = journeys.length;
  const journeyNotSubmitted = journeys.filter(journey => !journey.applicationId).length;
  const journeyNotSubmittedShare = shareOf(journeyNotSubmitted, journeyTotal);

  const conversion =
    kpis && kpis.conversionRate30d > 0 ? `${kpis.conversionRate30d.toFixed(1)}%` : '—';

  const readings = useMemo(() => {
    const rows: { href: string; title: string }[] = [];
    if (kpis) {
      rows.push({
        href: '#portfolio',
        title:
          outsideCount > 0
            ? 'Not every live application sits in an RM portfolio.'
            : 'Every live application sits in an RM portfolio.',
      });
      rows.push({
        href: '#portfolio',
        title:
          riskShare >= 50
            ? 'Most live applications are at risk.'
            : riskShare >= 25
              ? 'A large share of live applications is at risk.'
              : 'Most live applications are inside their status window.',
      });
    }
    if (agingTotal > 0) {
      rows.push({
        href: '#quality',
        title:
          aging30Share >= 50
            ? 'The aged book is weighted to 30+ days.'
            : 'Ageing is spread across the buckets.',
      });
    }
    if (journeyTotal > 0) {
      rows.push({
        href: '#journeys',
        title:
          journeyNotSubmittedShare >= 50
            ? 'Most customer-side journeys never reached submission.'
            : 'Most customer-side journeys have reached submission.',
      });
    }
    return rows;
  }, [kpis, outsideCount, riskShare, agingTotal, aging30Share, journeyTotal, journeyNotSubmittedShare]);

  return (
    <div className="space-y-9 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Toolbar ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Portfolio oversight
        </p>
        <button
          type="button"
          onClick={() => setReloadKey(key => key + 1)}
          disabled={busy}
          className="rounded-full p-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-muted)' }}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <svg
            className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* ══ Cover ══ */}
      <section
        className="rm-panel relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, color-mix(in srgb, var(--rm-brand) 12%, transparent), transparent 58%)',
        }}
        aria-label="Portfolio position"
      >
        <div className="grid gap-10 p-7 sm:p-9 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <h1
              className="serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
              style={{ color: 'var(--rm-text)' }}
            >
              Active pipeline
            </h1>

            {kpis ? (
              <>
                <p
                  className="num mt-6 text-5xl font-semibold leading-none tracking-tight sm:text-6xl"
                  title={formatCurrency(kpis.inProgressValue)}
                >
                  {compactCurrency(kpis.inProgressValue)}
                </p>
                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {rmPortfolios.length > 0 ? (
                    <>
                      Across <span className="num">{rmPortfolios.length}</span> relationship managers
                    </>
                  ) : (
                    'Across the relationship-manager book'
                  )}
                </p>
              </>
            ) : loading ? (
              <div className="mt-6 space-y-3" aria-hidden="true">
                <div
                  className="h-14 w-56 max-w-full rounded-2xl animate-pulse"
                  style={{ backgroundColor: 'var(--rm-input)' }}
                />
                <div
                  className="h-4 w-64 max-w-full rounded-xl animate-pulse"
                  style={{ backgroundColor: 'var(--rm-input)' }}
                />
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-base font-semibold">The portfolio could not be loaded.</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {error ?? 'Please try again.'}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey(key => key + 1)}
                  className="rm-btn rm-btn-solid mt-4"
                >
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
                {readings.map((reading, index) => (
                  <li
                    key={`${reading.href}-${index}`}
                    className="border-t py-3"
                    style={{ borderColor: 'var(--rm-hairline)' }}
                  >
                    <a href={reading.href} className="group flex items-start gap-3">
                      <span className="num pt-0.5 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="flex-1 text-sm font-medium leading-snug"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {reading.title}
                      </span>
                      <ReadingChevron />
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {busy ? 'Reading the portfolio…' : 'No portfolio facts available.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {error && kpis && (
        <div
          className="rm-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
          role="alert"
          style={{ color: 'var(--rm-text-secondary)' }}
        >
          <span>The latest portfolio could not be refreshed. Showing the last reading.</span>
          <button
            type="button"
            onClick={() => setReloadKey(key => key + 1)}
            className="rm-btn rm-btn-quiet"
          >
            Retry
          </button>
        </div>
      )}

      {/* ══ Metric strip ══ */}
      {kpis && (
        <section className="rm-panel" aria-label="Portfolio totals">
          <div className="rm-strip">
            <div className="rm-strip-cell">
              <div className="min-w-0">
                <p className="rm-strip-label">Applications in progress</p>
                <p className="rm-strip-note">On the book</p>
              </div>
              <p className="rm-strip-value num">{kpis.inProgressCount.toLocaleString()}</p>
            </div>

            <button
              type="button"
              onClick={toggleRisk}
              aria-pressed={riskOnly}
              title="Show the applications at risk"
              className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
              style={{
                border: 0,
                backgroundColor: riskOnly
                  ? 'color-mix(in srgb, var(--rm-warn) 10%, transparent)'
                  : 'transparent',
              }}
            >
              <div className="min-w-0">
                <p className="rm-strip-label">At risk</p>
                <p className="rm-strip-note">Past their status window</p>
              </div>
              <p className="rm-strip-value num" style={{ color: 'var(--rm-warn)' }}>
                {kpis.stuckAtRiskCount.toLocaleString()}
              </p>
            </button>

            <div className="rm-strip-cell">
              <div className="min-w-0">
                <p className="rm-strip-label">Booked this month</p>
                <p className="rm-strip-note">{kpis.bookedThisMonthCount} booked</p>
              </div>
              <p
                className="rm-strip-value num"
                title={formatCurrency(kpis.bookedThisMonthValue)}
              >
                {compactCurrency(kpis.bookedThisMonthValue)}
              </p>
            </div>

            <div className="rm-strip-cell">
              <div className="min-w-0">
                <p className="rm-strip-label">30-day conversion</p>
                <p className="rm-strip-note">Submitted → booked</p>
              </div>
              <p className="rm-strip-value num">{conversion}</p>
            </div>
          </div>
        </section>
      )}

      {/* ══ 01 Portfolio ══ */}
      <section id="portfolio" className="scroll-mt-6" aria-labelledby="portfolio-heading">
        <SectionHeader
          id="portfolio"
          index="01"
          title="Portfolio"
          note="Where the live pipeline sits, and who owns it."
        />

        <div className="space-y-5">
          <section className="rm-panel">
            <div className="rm-panel-head">
              <div className="min-w-0">
                <h2 className="rm-title">Relationship managers</h2>
                <p className="rm-sub">
                  <span className="num">{totalCustomers.toLocaleString()}</span> customers with a
                  relationship manager · select a row to review that RM&rsquo;s queue
                </p>
                <p className="mt-1 text-[13px] sm:hidden" style={{ color: 'var(--rm-text-muted)' }}>
                  Swipe the table for pipeline value, risk, booking and conversion.
                </p>
              </div>
            </div>
            <div className="rm-body">
              {loading && rmPortfolios.length === 0 && outsideCount === 0 ? (
                <PanelSkeleton rows={4} />
              ) : rmPortfolios.length === 0 && outsideCount === 0 ? (
                <p className="py-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No relationship managers with applications yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="rm-table w-full border-collapse min-w-[760px]">
                    <thead>
                      <tr>
                        <SortableHeader
                          label="Relationship manager"
                          field="firstName"
                          currentSort={sortConfig}
                          onSort={onSort}
                        />
                        <SortableHeader
                          label="Customers"
                          field="customersCount"
                          currentSort={sortConfig}
                          onSort={onSort}
                          align="right"
                        />
                        <SortableHeader
                          label="In progress"
                          field="inProgressCount"
                          currentSort={sortConfig}
                          onSort={onSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Pipeline value"
                          field="inProgressValue"
                          currentSort={sortConfig}
                          onSort={onSort}
                          align="right"
                        />
                        <SortableHeader
                          label="At risk"
                          field="stuckAtRiskCount"
                          currentSort={sortConfig}
                          onSort={onSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Booked (mth)"
                          field="bookedThisMonthCount"
                          currentSort={sortConfig}
                          onSort={onSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Conversion"
                          field="conversionRate30d"
                          currentSort={sortConfig}
                          onSort={onSort}
                          align="right"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRms.map(rm => {
                        const selected = selectedRm?.rmUserId === rm.rmUserId;
                        return (
                          <tr
                            key={rm.rmUserId}
                            tabIndex={0}
                            onClick={() => selectRm(selected ? null : rm)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                selectRm(selected ? null : rm);
                              }
                            }}
                            className="cursor-pointer"
                            title="Review this relationship manager's queue"
                            style={{
                              backgroundColor: selected ? 'var(--rm-brand-soft)' : undefined,
                            }}
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-medium" style={{ color: 'var(--rm-text)' }}>
                                {rmLabel(rm)}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                                {rm.department ? `${rm.department} · ` : ''}@{rm.username}
                              </div>
                            </td>
                            <td
                              className="num px-4 py-3.5 text-right"
                              style={{ color: 'var(--rm-text-secondary)' }}
                            >
                              {rm.customersCount.toLocaleString()}
                            </td>
                            <td
                              className="num px-4 py-3.5 text-right font-medium"
                              style={{ color: 'var(--rm-text)' }}
                            >
                              {rm.inProgressCount.toLocaleString()}
                            </td>
                            <td
                              className="num px-4 py-3.5 text-right"
                              style={{ color: 'var(--rm-text-secondary)' }}
                              title={formatCurrency(rm.inProgressValue)}
                            >
                              {compactCurrency(rm.inProgressValue)}
                            </td>
                            <td
                              className="num px-4 py-3.5 text-right"
                              style={{
                                color:
                                  rm.stuckAtRiskCount > 0
                                    ? 'var(--rm-warn)'
                                    : 'var(--rm-text-secondary)',
                              }}
                            >
                              {rm.stuckAtRiskCount.toLocaleString()}
                            </td>
                            <td
                              className="num px-4 py-3.5 text-right"
                              style={{ color: 'var(--rm-text-secondary)' }}
                            >
                              {rm.bookedThisMonthCount.toLocaleString()}
                            </td>
                            <td
                              className="num px-4 py-3.5 text-right"
                              style={{ color: 'var(--rm-text-secondary)' }}
                            >
                              {rm.conversionRate30d > 0 ? `${rm.conversionRate30d.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}

                      {outsideCount > 0 && (
                        <tr
                          tabIndex={0}
                          onClick={toggleOutsideRm}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleOutsideRm();
                            }
                          }}
                          className="cursor-pointer"
                          title="Show the applications assigned outside the five RM portfolios"
                          style={{
                            backgroundColor: outsideOnly ? 'var(--rm-brand-soft)' : undefined,
                          }}
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-medium" style={{ color: 'var(--rm-warn)' }}>
                              Outside the RM portfolios
                            </div>
                            <div className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                              Assigned outside these five relationship managers
                            </div>
                          </td>
                          <td
                            className="num px-4 py-3.5 text-right"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            —
                          </td>
                          <td
                            className="num px-4 py-3.5 text-right font-medium"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {outsideCount.toLocaleString()}
                          </td>
                          <td
                            className="num px-4 py-3.5 text-right"
                            style={{ color: 'var(--rm-text-secondary)' }}
                            title={formatCurrency(outsideValue)}
                          >
                            {compactCurrency(outsideValue)}
                          </td>
                          <td
                            className="num px-4 py-3.5 text-right"
                            style={{ color: 'var(--rm-warn)' }}
                          >
                            {outsideRisk.toLocaleString()}
                          </td>
                          <td
                            className="num px-4 py-3.5 text-right"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            —
                          </td>
                          <td
                            className="num px-4 py-3.5 text-right"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* ══ Selected RM's queue ══ */}
          {selectedRm && (
            <section className="rm-panel">
              <div className="rm-panel-head">
                <div className="min-w-0">
                  <h2 className="rm-title">{rmLabel(selectedRm)}&rsquo;s queue</h2>
                  <p className="rm-sub">
                    {rmLoading ? (
                      'Loading…'
                    ) : (
                      <>
                        <span className="num">{rmWorklist.length}</span> active applications
                      </>
                    )}
                    {selectedRm.department ? ` · ${selectedRm.department}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRm(null)}
                  className="rm-btn rm-btn-quiet shrink-0"
                >
                  Close
                </button>
              </div>
              <div className="rm-body">
                {rmLoading ? (
                  <PanelSkeleton rows={4} />
                ) : rmWorklist.length === 0 ? (
                  <p className="py-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    No active applications in this RM&rsquo;s queue.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="rm-table w-full border-collapse min-w-[720px]">
                      <thead>
                        <tr>
                          {['Application', 'Customer', 'Amount', 'Status', 'Next action', 'SLA'].map(
                            (heading, index) => (
                              <th
                                key={heading}
                                className={`px-4 py-3 text-sm font-medium ${
                                  index >= 2 && index !== 3 && index !== 4 ? 'text-right' : 'text-left'
                                }`}
                                style={{ color: 'var(--rm-text-muted)' }}
                              >
                                {heading}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {rmWorklist.map(item => {
                          const pill = statusPill(item.status);
                          return (
                            <tr
                              key={item.applicationId}
                              tabIndex={0}
                              onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                              onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  router.push(`/dashboard/applications/${item.applicationId}`);
                                }
                              }}
                              className="cursor-pointer"
                              title="Open application"
                            >
                              <td
                                className="num px-4 py-3.5 text-sm font-medium"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {item.applicationNumber}
                              </td>
                              <td
                                className="px-4 py-3.5 text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                {item.customerName}
                              </td>
                              <td
                                className="num px-4 py-3.5 text-right text-sm"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {formatCurrency(item.requestedAmount)}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                                  style={{ backgroundColor: pill.bg, color: pill.text }}
                                >
                                  {humanise(item.status)}
                                </span>
                              </td>
                              <td
                                className="px-4 py-3.5 text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                {humanise(item.nextAction || '')}
                              </td>
                              <td
                                className="num px-4 py-3.5 text-right text-sm"
                                style={{
                                  color: item.slaBreachDays
                                    ? 'var(--rm-down)'
                                    : 'var(--rm-text-muted)',
                                }}
                              >
                                {item.slaBreachDays ? `${item.slaBreachDays}d over` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="rm-foot">
                Queue, customer journeys and trend follow this relationship manager; pipeline, aging
                and blockers stay bank-wide. The queue includes drafts and booking, so it can be
                larger than the live count in the portfolio table.
              </div>
            </section>
          )}

          {/* ══ Bank-wide filter result ══ */}
          {focusActive && (
            <section ref={focusRef} id="focus-results" className="rm-panel scroll-mt-6">
              <div className="rm-panel-head">
                <div className="min-w-0">
                  <h2 className="rm-title">
                    {outsideOnly
                      ? 'Applications outside the RM portfolios'
                      : riskOnly
                        ? 'At-risk applications across all RMs'
                        : 'Matching applications across all RMs'}
                  </h2>
                  <p className="rm-sub">
                    {focusLoading
                      ? 'Loading…'
                      : outsideOnly
                        ? `${focusItems.length} in progress outside these five RM portfolios`
                        : riskOnly
                          ? `${focusItems.length} at or near their status window`
                          : `${focusItems.length} ${
                              focusItems.length === 1 ? 'application matches' : 'applications match'
                            } the selected filter`}
                  </p>
                </div>
                <button type="button" onClick={clearFocus} className="rm-btn rm-btn-quiet shrink-0">
                  Clear filter
                </button>
              </div>
              <div className="rm-body">
                {focusLoading ? (
                  <PanelSkeleton rows={5} />
                ) : focusItems.length === 0 ? (
                  <p className="py-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    No applications match this filter.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="rm-table w-full border-collapse min-w-[820px]">
                      <thead>
                        <tr>
                          {[
                            'Application',
                            'Customer',
                            'Relationship manager',
                            'Amount',
                            'Status',
                            'Next action',
                          ].map((heading, index) => (
                            <th
                              key={heading}
                              className={`px-4 py-3 text-sm font-medium ${
                                index === 3 ? 'text-right' : 'text-left'
                              }`}
                              style={{ color: 'var(--rm-text-muted)' }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {focusItems.map(item => {
                          const pill = statusPill(item.status);
                          const rmName = item.rmUserId ? rmNameById.get(item.rmUserId) : undefined;
                          return (
                            <tr
                              key={item.applicationId}
                              tabIndex={0}
                              onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                              onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  router.push(`/dashboard/applications/${item.applicationId}`);
                                }
                              }}
                              className="cursor-pointer"
                              title="Open application"
                            >
                              <td
                                className="num px-4 py-3.5 text-sm font-medium"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {item.applicationNumber}
                              </td>
                              <td
                                className="px-4 py-3.5 text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                {item.customerName}
                              </td>
                              <td
                                className="px-4 py-3.5 text-sm"
                                style={{
                                  color: rmName
                                    ? 'var(--rm-text-secondary)'
                                    : 'var(--rm-warn)',
                                }}
                              >
                                {rmName ?? 'Outside the list'}
                              </td>
                              <td
                                className="num px-4 py-3.5 text-right text-sm"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {formatCurrency(item.requestedAmount)}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                                  style={{ backgroundColor: pill.bg, color: pill.text }}
                                >
                                  {humanise(item.status)}
                                </span>
                              </td>
                              <td
                                className="px-4 py-3.5 text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                              >
                                {humanise(item.nextAction || '')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="rm-foot">
                {outsideOnly
                  ? 'These applications are in progress but assigned to staff outside the five RM portfolios above.'
                  : 'Bank-wide. Click a row to open the application; selecting an RM above shows that RM’s queue instead.'}
              </div>
            </section>
          )}
        </div>
      </section>

      {/* ══ 02 Pipeline and flow ══ */}
      <section id="pipeline" className="scroll-mt-6" aria-labelledby="pipeline-heading">
        <SectionHeader
          id="pipeline"
          index="02"
          title="Pipeline and flow"
          note="The funnel includes drafts and applications already in booking; the live count above does not."
        />
        <div className="space-y-5">
          {analysisLoading && pipeline.length === 0 ? (
            <div className="rm-panel h-56 animate-pulse" aria-hidden="true" />
          ) : (
            <PipelineOverview
              stages={pipeline}
              selectedStage={stageFilter}
              onStageSelect={focusStage}
            />
          )}
          {flowLoading && trends.length === 0 ? (
            <div className="rm-panel h-64 animate-pulse" aria-hidden="true" />
          ) : (
            <TrendChart
              points={trends}
              scopeLabel={selectedRm ? `${rmLabel(selectedRm)}’s book` : 'all RMs'}
            />
          )}
        </div>
      </section>

      {/* ══ 03 Quality and blockers ══ */}
      <section id="quality" className="scroll-mt-6" aria-labelledby="quality-heading">
        <SectionHeader
          id="quality"
          index="03"
          title="Quality and blockers"
          note="Where deals age, and what is holding them up."
        />
        <div className="space-y-5">
          {analysisLoading && agingCells.length === 0 ? (
            <div className="rm-panel h-64 animate-pulse" aria-hidden="true" />
          ) : (
            <AgingHeatmap
              cells={agingCells}
              onCellClick={(stage, bucket) => focusAge(stage, bucket)}
            />
          )}
          {analysisLoading && !performance && missingItems.length === 0 ? (
            <div className="rm-panel h-56 animate-pulse" aria-hidden="true" />
          ) : (
            <DashboardInsights performance={performance} missingItems={missingItems} />
          )}
        </div>
      </section>

      {/* ══ 04 Customer progress ══ */}
      <section id="journeys" className="scroll-mt-6" aria-labelledby="journeys-heading">
        <SectionHeader
          id="journeys"
          index="04"
          title="Customer progress"
          note="Journeys that have not reached the bank yet."
        />
        {flowLoading && journeys.length === 0 ? (
          <div className="rm-panel h-64 animate-pulse" aria-hidden="true" />
        ) : (
          <ChannelJourneys
            journeys={journeys}
            title={selectedRm ? `${rmLabel(selectedRm)}’s customers, in progress` : 'In progress with customers'}
            rmNameById={rmNameById}
            onSelectRm={rmUserId => {
              const rm = rmPortfolios.find(portfolio => portfolio.rmUserId === rmUserId) ?? null;
              selectRm(rm);
            }}
            collapsible
          />
        )}
      </section>

      {/* ══ Footer ══ */}
      <p className="pb-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        Bank-wide oversight across all relationship managers
        {lastUpdated && (
          <>
            {' '}
            · Last refreshed at{' '}
            <span className="num">
              {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
