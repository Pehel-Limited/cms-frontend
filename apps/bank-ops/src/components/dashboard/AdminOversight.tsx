'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import AnimatedCounter, { AnimatedCurrency } from '@/components/AnimatedCounter';
import { matchesFocus } from '@/lib/dashboard-filters';
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
} from '@/services/api/dashboard-service';
import PipelineOverview from '@/components/dashboard/PipelineOverview';
import AgingHeatmap from '@/components/dashboard/AgingHeatmap';
import DashboardInsights from '@/components/dashboard/DashboardInsights';
import TrendChart from '@/components/dashboard/TrendChart';
import { SortableHeader, SortConfig, handleSortToggle, sortData } from '@/components/SortableHeader';
import config from '@/config';
import { useAppSelector } from '@/store';

/* Tinted status pill colours that read on both light and dark themes. */
function statusPill(status: string): { bg: string; text: string } {
  if (['BOOKED', 'DISBURSED', 'APPROVED', 'UNDERWRITING_APPROVED', 'ESIGN_COMPLETED'].includes(status))
    return { bg: 'rgba(16,185,129,0.14)', text: '#10b981' };
  if (['DECLINED', 'CANCELLED', 'WITHDRAWN', 'REJECTED'].includes(status))
    return { bg: 'rgba(239,68,68,0.13)', text: '#ef4444' };
  if (['SUBMITTED', 'PENDING_KYC', 'PENDING_DOCUMENTS'].includes(status))
    return { bg: 'rgba(14,165,233,0.14)', text: '#0ea5e9' };
  if (['REFERRED_TO_UNDERWRITER', 'IN_UNDERWRITING', 'PENDING_UNDERWRITING', 'REFERRED_TO_SENIOR'].includes(status))
    return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' };
  if (['OFFER_GENERATED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'PENDING_ESIGN'].includes(status))
    return { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' };
  return { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-secondary)' };
}

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

export default function AdminOversight() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const bankId = config.bank.defaultBankId;

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [rmPortfolios, setRmPortfolios] = useState<RmPortfolio[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [agingCells, setAgingCells] = useState<AgingHeatmapCell[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'inProgressValue', direction: 'desc' });
  const [selectedRm, setSelectedRm] = useState<RmPortfolio | null>(null);
  const [rmWorklist, setRmWorklist] = useState<WorklistItem[]>([]);
  const [rmLoading, setRmLoading] = useState(false);

  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<{ stage: string; bucket: string } | null>(null);
  const [riskOnly, setRiskOnly] = useState(false);
  const [bankWorklist, setBankWorklist] = useState<WorklistItem[]>([]);
  const [focusLoading, setFocusLoading] = useState(false);

  const focusActive = !!(stageFilter || ageFilter || riskOnly);

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
  }, [loadSummary]);

  // Secondary panels load independently so one failure never blanks the page.
  useEffect(() => {
    dashboardService.getOversightPipeline(bankId).then(setPipeline).catch(() => setPipeline([]));
    dashboardService.getOversightAgingHeatmap(bankId).then(setAgingCells).catch(() => setAgingCells([]));
    dashboardService
      .getOversightInsights(bankId)
      .then(ins => {
        setPerformance(ins.performance);
        setMissingItems(ins.missingItems || []);
      })
      .catch(() => {
        setPerformance(null);
        setMissingItems([]);
      });
  }, [bankId]);

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
  }, [selectedRm, bankId]);

  // Trend follows the same drill-down as the queue: all RMs, or the selected one.
  useEffect(() => {
    if (!bankId) return;
    let cancelled = false;
    dashboardService
      .getOversightTrends(bankId, selectedRm?.rmUserId)
      .then(data => {
        if (!cancelled) setTrends(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setTrends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRm, bankId]);

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
  }, [focusActive, bankId]);

  const rmNameById = useMemo(() => {
    const m = new Map<string, string>();
    rmPortfolios.forEach(r => m.set(r.rmUserId, rmLabel(r)));
    return m;
  }, [rmPortfolios]);

  const focusItems = useMemo(
    () => bankWorklist.filter(item => matchesFocus(item, { stageFilter, ageFilter, riskOnly })),
    [bankWorklist, stageFilter, ageFilter, riskOnly]
  );

  const sortedRms = useMemo(() => sortData(rmPortfolios, sortConfig), [rmPortfolios, sortConfig]);
  const onSort = (field: string) => setSortConfig(c => handleSortToggle(field, c));
  const totalCustomers = useMemo(
    () => rmPortfolios.reduce((s, r) => s + (r.customersCount || 0), 0),
    [rmPortfolios]
  );

  return (
    <div className="space-y-10 p-1 sm:p-2 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ HERO ══ */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Portfolio oversight{user?.firstName ? ` · ${user.firstName}` : ''}
          </p>

          {kpis ? (
            <>
              <h1
                className="mt-3 text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums leading-none"
                style={{ color: 'var(--rm-text)' }}
              >
                <AnimatedCurrency value={kpis.inProgressValue} />
              </h1>
              <p className="mt-4 text-base" style={{ color: 'var(--rm-text-muted)' }}>
                Active pipeline across{' '}
                <span className="font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {kpis.inProgressCount}
                </span>{' '}
                applications and{' '}
                <span className="font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {rmPortfolios.length}
                </span>{' '}
                relationship managers
              </p>
            </>
          ) : (
            <div
              className="mt-4 h-14 w-72 max-w-full rounded-2xl animate-pulse"
              style={{ backgroundColor: 'var(--rm-card)' }}
            />
          )}

          {kpis && (
            <div className="mt-7 flex flex-wrap gap-2.5">
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706' }}
              >
                Needs action ·{' '}
                <span className="font-semibold tabular-nums">
                  <AnimatedCounter value={kpis.needsActionCount} />
                </span>
              </span>
              <button
                onClick={() => setRiskOnly(v => !v)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-0.5 ${riskOnly ? 'ring-2' : ''}`}
                style={{
                  backgroundColor: 'rgba(239,68,68,0.13)',
                  color: '#dc2626',
                  ...(riskOnly ? ({ '--tw-ring-color': '#dc2626' } as React.CSSProperties) : {}),
                }}
                title="Toggle at-risk filter across all RMs"
              >
                At risk ·{' '}
                <span className="font-semibold tabular-nums">
                  <AnimatedCounter value={kpis.stuckAtRiskCount} />
                </span>
              </button>
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: 'rgba(16,185,129,0.14)', color: '#059669' }}
              >
                Booked this month ·{' '}
                <span className="font-semibold tabular-nums">{formatCurrency(kpis.bookedThisMonthValue)}</span>{' '}
                ({kpis.bookedThisMonthCount})
              </span>
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
              >
                <span className="font-semibold tabular-nums">
                  {kpis.conversionRate30d > 0 ? `${kpis.conversionRate30d.toFixed(1)}%` : '—'}
                </span>{' '}
                conversion, submitted → booked
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadSummary}
            className="p-2.5 rounded-full transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-muted)' }}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <section
          className="rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
              Couldn’t load oversight data
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {error}
            </p>
          </div>
          <button
            onClick={loadSummary}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            Retry
          </button>
        </section>
      )}

      {/* ══ PER-RM PORTFOLIO TABLE ══ */}
      <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
            Relationship managers
          </h2>
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            <span className="tabular-nums">{rmPortfolios.length}</span> RMs ·{' '}
            <span className="tabular-nums">{totalCustomers}</span> customers · select a row to view their queue
          </p>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
            ))}
          </div>
        ) : rmPortfolios.length === 0 ? (
          <p className="mt-6 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            No relationship managers with applications yet.
          </p>
        ) : (
          <div className="mt-6 -mx-6 sm:-mx-7 overflow-x-auto">
            <table className="w-full border-collapse min-w-[880px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                  <SortableHeader label="Relationship manager" field="firstName" currentSort={sortConfig} onSort={onSort} />
                  <SortableHeader label="Customers" field="customersCount" currentSort={sortConfig} onSort={onSort} align="right" />
                  <SortableHeader label="In progress" field="inProgressCount" currentSort={sortConfig} onSort={onSort} align="right" />
                  <SortableHeader label="Pipeline value" field="inProgressValue" currentSort={sortConfig} onSort={onSort} align="right" />
                  <SortableHeader label="Needs action" field="needsActionCount" currentSort={sortConfig} onSort={onSort} align="right" />
                  <SortableHeader label="At risk" field="stuckAtRiskCount" currentSort={sortConfig} onSort={onSort} align="right" />
                  <SortableHeader label="Booked (mth)" field="bookedThisMonthCount" currentSort={sortConfig} onSort={onSort} align="right" />
                  <SortableHeader label="Conversion" field="conversionRate30d" currentSort={sortConfig} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedRms.map(rm => {
                  const selected = selectedRm?.rmUserId === rm.rmUserId;
                  return (
                    <tr
                      key={rm.rmUserId}
                      onClick={() => setSelectedRm(selected ? null : rm)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid var(--rm-border)',
                        backgroundColor: selected ? 'var(--rm-accent-muted)' : undefined,
                      }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium" style={{ color: 'var(--rm-text)' }}>
                          {rmLabel(rm)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          {rm.department ? `${rm.department} · ` : ''}@{rm.username}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                        {rm.customersCount}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-medium" style={{ color: 'var(--rm-text)' }}>
                        {rm.inProgressCount}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                        {formatCurrency(rm.inProgressValue)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: rm.needsActionCount > 0 ? '#d97706' : 'var(--rm-text-secondary)' }}>
                        {rm.needsActionCount}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: rm.stuckAtRiskCount > 0 ? '#dc2626' : 'var(--rm-text-secondary)' }}>
                        {rm.stuckAtRiskCount}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                        {rm.bookedThisMonthCount}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                        {rm.conversionRate30d > 0 ? `${rm.conversionRate30d.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ══ DRILL-DOWN: selected RM's queue ══ */}
      {selectedRm && (
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                {rmLabel(selectedRm)}’s queue
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {rmLoading ? 'Loading…' : `${rmWorklist.length} active applications`}
                {selectedRm.department ? ` · ${selectedRm.department}` : ''}
              </p>
            </div>
            <button
              onClick={() => setSelectedRm(null)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-card-hover)', color: 'var(--rm-text-secondary)' }}
            >
              Close
            </button>
          </div>

          {!rmLoading && rmWorklist.length === 0 ? (
            <p className="mt-6 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              No active applications in this RM’s queue.
            </p>
          ) : (
            <div className="mt-6 -mx-6 sm:-mx-7 overflow-x-auto">
              <table className="w-full border-collapse min-w-[760px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    {['Application', 'Customer', 'Amount', 'Status', 'Next action', 'SLA'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3.5 text-sm font-medium ${i >= 2 && i !== 3 && i !== 4 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--rm-text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rmWorklist.map(item => {
                    const pill = statusPill(item.status);
                    return (
                      <tr
                        key={item.applicationId}
                        onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                        className="cursor-pointer transition-colors hover:opacity-90"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                      >
                        <td className="px-5 py-3.5 text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                          {item.applicationNumber}
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {item.customerName}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right tabular-nums" style={{ color: 'var(--rm-text)' }}>
                          {formatCurrency(item.requestedAmount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                            style={{ backgroundColor: pill.bg, color: pill.text }}
                          >
                            {humanise(item.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {humanise(item.nextAction || '')}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right tabular-nums" style={{ color: item.slaBreachDays ? '#dc2626' : 'var(--rm-text-muted)' }}>
                          {item.slaBreachDays ? `${item.slaBreachDays}d over` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ══ BANK-WIDE PIPELINE ══ */}
      <PipelineOverview
        stages={pipeline}
        selectedStage={stageFilter}
        onStageSelect={s => {
          setStageFilter(s);
          setAgeFilter(null);
        }}
      />

      {/* ══ TREND ══ */}
      <TrendChart points={trends} scopeLabel={selectedRm ? `${rmLabel(selectedRm)}’s book` : 'all RMs'} />

      {/* ══ BANK-WIDE AGING ══ */}
      <AgingHeatmap
        cells={agingCells}
        onCellClick={(stage, bucket) => {
          setAgeFilter(bucket ? { stage, bucket } : null);
          setStageFilter(null);
        }}
      />

      {/* ══ DRILL-THROUGH FOCUS (bank-wide, across RMs) ══ */}
      {focusActive && (
        <section className="rounded-3xl p-6 sm:p-7 animate-fade-in" style={{ backgroundColor: 'var(--rm-card)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                Matching applications across all RMs
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {focusLoading ? 'Loading…' : `${focusItems.length} applications match the selected filter`}
              </p>
            </div>
            <button
              onClick={() => {
                setStageFilter(null);
                setAgeFilter(null);
                setRiskOnly(false);
              }}
              className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-card-hover)', color: 'var(--rm-text-secondary)' }}
            >
              Clear filter
            </button>
          </div>

          {!focusLoading && focusItems.length === 0 ? (
            <p className="mt-6 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              No applications match this filter.
            </p>
          ) : (
            <div className="mt-6 -mx-6 sm:-mx-7 overflow-x-auto">
              <table className="w-full border-collapse min-w-[860px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    {['Application', 'Customer', 'Relationship manager', 'Amount', 'Status', 'Next action'].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-3.5 text-sm font-medium ${i === 3 ? 'text-right' : 'text-left'}`}
                          style={{ color: 'var(--rm-text-muted)' }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {focusItems.map(item => {
                    const pill = statusPill(item.status);
                    return (
                      <tr
                        key={item.applicationId}
                        onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                        className="cursor-pointer transition-colors hover:opacity-90"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                      >
                        <td className="px-5 py-3.5 text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                          {item.applicationNumber}
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {item.customerName}
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {rmNameById.get(item.rmUserId) || 'Unassigned'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right tabular-nums" style={{ color: 'var(--rm-text)' }}>
                          {formatCurrency(item.requestedAmount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                            style={{ backgroundColor: pill.bg, color: pill.text }}
                          >
                            {humanise(item.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {humanise(item.nextAction || '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ══ BANK-WIDE INSIGHTS ══ */}
      <DashboardInsights performance={performance} missingItems={missingItems} />

      {/* ══ FOOTER ══ */}
      <p className="text-sm pb-2" style={{ color: 'var(--rm-text-muted)' }}>
        Bank-wide oversight across all relationship managers
        {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString()}` : ''}
      </p>
    </div>
  );
}
