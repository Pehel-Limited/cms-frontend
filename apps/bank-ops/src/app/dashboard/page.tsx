'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { AnimatedCurrency } from '@/components/AnimatedCounter';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PipelineStage,
  PerformanceMetrics,
  MissingItem,
  AgingHeatmapCell,
} from '@/services/api/dashboard-service';
import { applicationService } from '@/services/api/applicationService';
import { aiCustomerIntelligenceService, CustomerSignalSummary } from '@/services/api/aiCustomerIntelligenceService';
import AttentionStrip from '@/components/dashboard/AttentionStrip';
import PipelineOverview from '@/components/dashboard/PipelineOverview';
import AgingHeatmap from '@/components/dashboard/AgingHeatmap';
import DashboardInsights from '@/components/dashboard/DashboardInsights';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
import config from '@/config';
import { useAppSelector } from '@/store';

type TimeframeFilter =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'all';

const TIMEFRAME_OPTIONS: { value: TimeframeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const TERMINAL_STATUSES = new Set([
  'BOOKED',
  'DISBURSED',
  'CANCELLED',
  'WITHDRAWN',
  'EXPIRED',
  'DECLINED',
  'KYC_REJECTED',
  'CREDIT_DECLINED',
  'UNDERWRITING_DECLINED',
  'OFFER_REJECTED',
  'OFFER_EXPIRED',
  'CLOSED',
  'ACTIVE',
]);

const COMPLETED_STATUSES = new Set(['BOOKED', 'DISBURSED', 'ACTIVE', 'CLOSED']);

const DECLINED_STATUSES = new Set([
  'DECLINED',
  'KYC_REJECTED',
  'CREDIT_DECLINED',
  'UNDERWRITING_DECLINED',
  'OFFER_REJECTED',
  'OFFER_EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  'EXPIRED',
]);

/* Tinted, theme-agnostic status colours — readable on light and dark surfaces. */
function getStatusStyle(status: string): { bg: string; text: string; dot: string } {
  if (COMPLETED_STATUSES.has(status))
    return { bg: 'rgba(16,185,129,0.14)', text: '#10b981', dot: '#10b981' };
  if (DECLINED_STATUSES.has(status))
    return { bg: 'rgba(239,68,68,0.13)', text: '#ef4444', dot: '#ef4444' };
  if (['SUBMITTED', 'PENDING_KYC', 'PENDING_DOCUMENTS'].includes(status))
    return { bg: 'rgba(14,165,233,0.14)', text: '#0ea5e9', dot: '#0ea5e9' };
  if (
    ['PENDING_CREDIT_CHECK', 'PENDING_UNDERWRITING', 'IN_UNDERWRITING', 'REFERRED_TO_SENIOR'].includes(
      status
    )
  )
    return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', dot: '#f59e0b' };
  if (['APPROVED', 'UNDERWRITING_APPROVED', 'CREDIT_APPROVED', 'KYC_APPROVED'].includes(status))
    return { bg: 'rgba(16,185,129,0.14)', text: '#10b981', dot: '#10b981' };
  if (
    ['OFFER_GENERATED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'PENDING_ESIGN', 'ESIGN_COMPLETED'].includes(
      status
    )
  )
    return { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6', dot: '#8b5cf6' };
  if (
    [
      'PENDING_BOOKING',
      'BOOKING_IN_PROGRESS',
      'PENDING_DISBURSEMENT',
      'DISBURSEMENT_IN_PROGRESS',
    ].includes(status)
  )
    return { bg: 'rgba(99,102,241,0.15)', text: '#6366f1', dot: '#6366f1' };
  return { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-secondary)', dot: '#94a3b8' };
}

function getSmartAction(item: WorklistItem): { label: string; actionable: boolean } {
  const status = item.status;
  if (COMPLETED_STATUSES.has(status)) return { label: 'Completed', actionable: false };
  if (DECLINED_STATUSES.has(status)) return { label: 'Closed', actionable: false };
  const map: Record<string, string> = {
    DRAFT: 'Submit application',
    SUBMITTED: 'Begin review',
    PENDING_KYC: 'Complete KYC',
    KYC_APPROVED: 'Proceed',
    PENDING_DOCUMENTS: 'Collect documents',
    DOCUMENTS_RECEIVED: 'Review documents',
    PENDING_CREDIT_CHECK: 'Run credit check',
    CREDIT_APPROVED: 'Send to underwriting',
    PENDING_UNDERWRITING: 'Assign underwriter',
    IN_UNDERWRITING: 'Awaiting decision',
    UNDERWRITING_APPROVED: 'Review decision',
    REFERRED_TO_SENIOR: 'Senior review',
    REFERRED_TO_UNDERWRITER: 'Underwriter review',
    PENDING_DECISION: 'Make decision',
    APPROVED: 'Generate offer',
    OFFER_GENERATED: 'Send offer',
    OFFER_SENT: 'Awaiting customer',
    OFFER_ACCEPTED: 'Prepare signing',
    OFFER_COUNTERED: 'Review counter',
    PENDING_CONDITIONS: 'Verify conditions',
    CONDITIONS_MET: 'Proceed to signing',
    PENDING_ESIGN: 'Confirm signature',
    ESIGN_IN_PROGRESS: 'Awaiting signature',
    ESIGN_COMPLETED: 'Initiate booking',
    PENDING_BOOKING: 'Book facility',
    BOOKING_IN_PROGRESS: 'Processing',
    PENDING_DISBURSEMENT: 'Disburse funds',
    DISBURSEMENT_IN_PROGRESS: 'Processing',
  };
  return { label: map[status] || 'Follow up', actionable: true };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [signalSummary, setSignalSummary] = useState<CustomerSignalSummary | null>(null);
  const [agingCells, setAgingCells] = useState<AgingHeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | undefined>(undefined);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeFilter>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });
  const [kycLoadingId, setKycLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'action' | 'completed' | 'all'>('action');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const bankId = config.bank.defaultBankId;

  useEffect(() => {
    loadDashboardData();
  }, [selectedFilter, selectedTimeframe]);

  const getTimeframeDate = (timeframe: TimeframeFilter): Date | null => {
    const now = new Date();
    switch (timeframe) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'this_week': {
        const d = now.getDay();
        const diff = now.getDate() - d + (d === 0 ? -6 : 1);
        return new Date(now.getFullYear(), now.getMonth(), diff);
      }
      case 'this_month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'last_30_days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'last_90_days':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const filterByTimeframe = (items: WorklistItem[]): WorklistItem[] => {
    const cutoffDate = getTimeframeDate(selectedTimeframe);
    if (!cutoffDate) return items;
    return items.filter(item => {
      const d = new Date(item.submittedAt || item.updatedAt);
      return d >= cutoffDate;
    });
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [kpisData, worklistData, pipelineData] = await Promise.all([
        dashboardService.getKpis(bankId),
        dashboardService.getWorklist(bankId, selectedFilter, 50),
        dashboardService.getPipeline(bankId),
      ]);
      setKpis(kpisData);
      setWorklist(filterByTimeframe(worklistData));
      setPipeline(pipelineData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }

    // Secondary insights — load independently so a failure never blocks the core dashboard
    dashboardService
      .getPerformanceMetrics(bankId)
      .then(setPerformance)
      .catch(() => setPerformance(null));
    dashboardService
      .getMissingItems(bankId)
      .then(setMissingItems)
      .catch(() => setMissingItems([]));
    dashboardService
      .getAgingHeatmap(bankId)
      .then(data => setAgingCells(Array.isArray(data) ? data : []))
      .catch(() => setAgingCells([]));
    aiCustomerIntelligenceService
      .getSignalSummary(bankId)
      .then(setSignalSummary)
      .catch(() => setSignalSummary(null));
  };

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  const handleCompleteKyc = async (applicationId: string) => {
    try {
      setKycLoadingId(applicationId);
      await applicationService.completeKyc(applicationId);
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to complete KYC:', error);
      alert('Failed to complete KYC. Please try again.');
    } finally {
      setKycLoadingId(null);
    }
  };

  const actionItems = useMemo(
    () => worklist.filter(i => !TERMINAL_STATUSES.has(i.status)),
    [worklist]
  );
  const completedItems = useMemo(
    () => worklist.filter(i => COMPLETED_STATUSES.has(i.status)),
    [worklist]
  );
  const declinedItems = useMemo(
    () => worklist.filter(i => DECLINED_STATUSES.has(i.status)),
    [worklist]
  );

  const displayWorklist = useMemo(() => {
    if (activeTab === 'action') return actionItems;
    if (activeTab === 'completed') return [...completedItems, ...declinedItems];
    return worklist;
  }, [activeTab, actionItems, completedItems, declinedItems, worklist]);

  const sortedWorklist = sortData(displayWorklist, sortConfig);

  /* AI banner copy — only ever states what the data actually supports. */
  const { aiHeadline, aiRecommendation } = useMemo(() => {
    if (!kpis) return { aiHeadline: '', aiRecommendation: '' };
    const highSev = signalSummary?.countsBySeverity?.HIGH ?? 0;
    const activeSignals = signalSummary?.totalActiveSignals ?? 0;
    const flagged = signalSummary?.customersWithActiveSignals ?? 0;
    const plural = (n: number) => (n === 1 ? '' : 's');

    if (highSev > 0)
      return {
        aiHeadline: `${highSev} high-severity signal${plural(highSev)} across ${flagged} customer${plural(flagged)}`,
        aiRecommendation: 'Review the flagged customers before progressing their applications.',
      };
    if (kpis.stuckAtRiskCount > 0)
      return {
        aiHeadline: `${kpis.stuckAtRiskCount} application${plural(kpis.stuckAtRiskCount)} stuck or breaching SLA`,
        aiRecommendation: 'Clear the blocked items first — they are the oldest risk in your pipeline.',
      };
    if (kpis.needsActionCount > 0)
      return {
        aiHeadline: `${kpis.needsActionCount} application${plural(kpis.needsActionCount)} waiting on you`,
        aiRecommendation: 'Work through the attention list to keep the pipeline moving.',
      };
    if (activeSignals > 0)
      return {
        aiHeadline: `${activeSignals} active customer signal${plural(activeSignals)}, nothing blocking`,
        aiRecommendation: 'Keep them under watch — no action needed yet.',
      };
    return { aiHeadline: 'Your portfolio is on track', aiRecommendation: '' };
  }, [kpis, signalSummary]);

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

  return (
    <div className="space-y-10 p-1 sm:p-2" style={{ color: 'var(--rm-text)' }}>
      {/* ══ HERO ══ */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {greeting()}, {user?.firstName}
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
                applications
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
              <button
                onClick={() => setActiveTab('action')}
                className="rounded-full px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706' }}
              >
                Needs action ·{' '}
                <span className="font-semibold tabular-nums">{kpis.needsActionCount}</span>
              </button>
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.13)', color: '#dc2626' }}
              >
                At risk · <span className="font-semibold tabular-nums">{kpis.stuckAtRiskCount}</span>
              </span>
              <span
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: 'rgba(16,185,129,0.14)', color: '#059669' }}
              >
                Booked this month ·{' '}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(kpis.bookedThisMonthValue)}
                </span>{' '}
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
          <select
            value={selectedTimeframe}
            onChange={e => setSelectedTimeframe(e.target.value as TimeframeFilter)}
            className="rounded-full px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            {TIMEFRAME_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={loadDashboardData}
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
          <button
            onClick={() => router.push('/dashboard/applications/new')}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            New application
          </button>
        </div>
      </header>

      {/* ══ ATTENTION ══ */}
      <AttentionStrip
        items={actionItems}
        onCompleteKyc={handleCompleteKyc}
        kycLoadingId={kycLoadingId}
      />

      {/* ══ PIPELINE ══ */}
      <PipelineOverview stages={pipeline} />

      {/* ══ AGING ══ */}
      <AgingHeatmap cells={agingCells} />

      {/* ══ PERFORMANCE + BLOCKERS ══ */}
      <DashboardInsights performance={performance} missingItems={missingItems} />

      {/* ══ AI BANNER ══ */}
      {kpis && aiHeadline && (
        <section
          className="rounded-3xl p-6 sm:p-7 flex items-start gap-4"
          style={{ backgroundColor: 'var(--rm-accent-muted)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--rm-card)' }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: 'var(--rm-accent)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
              {aiHeadline}
            </p>
            {aiRecommendation && (
              <p className="text-sm mt-1.5" style={{ color: 'var(--rm-text-secondary)' }}>
                {aiRecommendation}
              </p>
            )}
            {signalSummary && signalSummary.totalActiveSignals > 0 && (
              <p className="text-sm mt-1.5" style={{ color: 'var(--rm-text-muted)' }}>
                {signalSummary.totalActiveSignals} active signals across{' '}
                {signalSummary.customersWithActiveSignals} customers ·{' '}
                {signalSummary.countsBySeverity?.HIGH ?? 0} high severity
              </p>
            )}
            <Link
              href="/dashboard/customers"
              className="inline-flex items-center gap-1 text-sm font-medium mt-3 hover:underline"
              style={{ color: 'var(--rm-accent)' }}
            >
              View customer intelligence
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* ══ WORKLIST ══ */}
      <section>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Applications
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              {sortedWorklist.length} in view · click a column to sort
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-full p-1" style={{ backgroundColor: 'rgba(127,127,127,0.10)' }}>
              {(
                [
                  { key: 'action' as const, label: 'Needs action', count: actionItems.length },
                  {
                    key: 'completed' as const,
                    label: 'Completed',
                    count: completedItems.length + declinedItems.length,
                  },
                  { key: 'all' as const, label: 'All', count: worklist.length },
                ]
              ).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: activeTab === tab.key ? 'var(--rm-card)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--rm-text)' : 'var(--rm-text-muted)',
                  }}
                >
                  {tab.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
                </button>
              ))}
            </div>

            <select
              value={selectedFilter ?? ''}
              onChange={e => setSelectedFilter(e.target.value || undefined)}
              className="rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
            >
              <option value="">All statuses</option>
              {[
                'SUBMITTED',
                'PENDING_KYC',
                'PENDING_DOCUMENTS',
                'PENDING_CREDIT_CHECK',
                'IN_UNDERWRITING',
                'APPROVED',
                'OFFER_SENT',
                'PENDING_ESIGN',
              ].map(s => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)' }}>
          {sortedWorklist.length === 0 ? (
            <div className="py-20 text-center">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(16,185,129,0.14)' }}
              >
                <svg
                  className="w-7 h-7"
                  style={{ color: activeTab === 'action' ? '#10b981' : 'var(--rm-text-muted)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={
                      activeTab === 'action'
                        ? 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    }
                  />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                {activeTab === 'action' ? 'Nothing needs your action' : 'No applications found'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
                {activeTab === 'action' ? "You're all caught up." : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <SortableHeader
                      label="Customer"
                      field="customerName"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Application"
                      field="applicationNumber"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Amount"
                      field="requestedAmount"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <th
                      className="text-left px-5 py-3.5 text-sm font-medium whitespace-nowrap"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      Next action
                    </th>
                    <SortableHeader
                      label="SLA"
                      field="slaBreachDays"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedWorklist.slice(0, 10).map(item => {
                    const style = getStatusStyle(item.status);
                    const action = getSmartAction(item);
                    const breached = item.slaBreachDays !== null && item.slaBreachDays > 0;
                    const docsRequired = item.documentsRequiredCount ?? 0;
                    const docsSubmitted = item.documentsSubmittedCount ?? 0;
                    const blocker =
                      item.blockerReason && item.blockerReason !== 'NONE'
                        ? item.blockerReason.replace(/_/g, ' ').toLowerCase()
                        : null;

                    return (
                      <tr
                        key={item.applicationId}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                        onMouseEnter={e =>
                          (e.currentTarget.style.backgroundColor = 'rgba(127,127,127,0.06)')
                        }
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}
                            >
                              {(item.customerName || '?').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-base font-medium truncate"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {item.customerName || '—'}
                              </p>
                              <p className="text-sm truncate" style={{ color: 'var(--rm-text-muted)' }}>
                                {item.customerNumber || item.customerType}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                            {item.applicationNumber}
                          </p>
                          <p
                            className="text-sm truncate max-w-[180px]"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            {item.productName}
                          </p>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <p
                            className="text-base font-semibold tabular-nums"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {formatCurrency(item.requestedAmount)}
                          </p>
                          {item.approvedAmount > 0 && item.approvedAmount !== item.requestedAmount && (
                            <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                              approved {formatCurrency(item.approvedAmount)}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: style.dot }}
                            />
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          <p
                            className="text-sm mt-1.5 flex items-center gap-2"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            <span className="tabular-nums">
                              {docsSubmitted}/{docsRequired} docs
                            </span>
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              title={item.kycVerified ? 'KYC verified' : 'KYC pending'}
                              style={{ backgroundColor: item.kycVerified ? '#10b981' : '#ef4444' }}
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              title={item.amlCheckPassed ? 'AML passed' : 'AML pending'}
                              style={{ backgroundColor: item.amlCheckPassed ? '#10b981' : '#ef4444' }}
                            />
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {action.actionable ? (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                router.push(`/dashboard/applications/${item.applicationId}`);
                              }}
                              className="text-sm font-medium hover:underline whitespace-nowrap"
                              style={{ color: 'var(--rm-accent)' }}
                            >
                              {action.label}
                            </button>
                          ) : (
                            <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              {action.label}
                            </span>
                          )}
                          {blocker && (
                            <p
                              className="text-sm mt-1 truncate max-w-[180px]"
                              style={{ color: '#d97706' }}
                            >
                              {blocker}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1.5 text-sm font-medium"
                            style={{ color: breached ? '#ef4444' : '#10b981' }}
                            title={
                              breached
                                ? `SLA breached by ${item.slaBreachDays} day(s)`
                                : `${item.daysInCurrentStage ?? 0} day(s) in current stage`
                            }
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth={1.8}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d={
                                  breached
                                    ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                    : 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                }
                              />
                            </svg>
                            {breached
                              ? `+${item.slaBreachDays}d over`
                              : `${item.daysInCurrentStage ?? 0}d in stage`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {worklist.length > 0 && (
            <div
              className="flex items-center justify-between px-5 py-4 text-sm"
              style={{ borderTop: '1px solid var(--rm-border)', color: 'var(--rm-text-muted)' }}
            >
              <span>
                Showing {Math.min(sortedWorklist.length, 10)} of {worklist.length}
              </span>
              <Link
                href="/dashboard/applications"
                className="font-medium hover:underline"
                style={{ color: 'var(--rm-accent)' }}
              >
                View all applications
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══ STATUS ══ */}
      <div
        className="flex items-center gap-2.5 text-sm pb-2 flex-wrap"
        style={{ color: 'var(--rm-text-muted)' }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: kpis ? '#10b981' : '#f59e0b' }}
        />
        <span>{kpis ? 'Data loaded' : 'Some data could not be loaded'}</span>
        {lastUpdated && (
          <span className="ml-auto tabular-nums">
            Updated{' '}
            {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {loading && !kpis && (
        <div className="sr-only" role="status">
          Loading dashboard
        </div>
      )}
    </div>
  );
}
