'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, compactCurrency } from '@/lib/format';
import AnimatedCounter, { AnimatedCurrency } from '@/components/AnimatedCounter';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PerformanceMetrics,
  MissingItem,
  AgingHeatmapCell,
  TrendPoint,
  ChannelJourney,
} from '@/services/api/dashboard-service';
import { applicationService } from '@/services/api/applicationService';
import { aiCustomerIntelligenceService, CustomerSignalSummary } from '@/services/api/aiCustomerIntelligenceService';
import AgingHeatmap from '@/components/dashboard/AgingHeatmap';
import DashboardInsights from '@/components/dashboard/DashboardInsights';
import TrendChart from '@/components/dashboard/TrendChart';
import ChannelJourneys from '@/components/dashboard/ChannelJourneys';
import RecentActivity from '@/components/dashboard/RecentActivity';
import ApplicationBoard from '@/components/dashboard/ApplicationBoard';
import { ActionQueue, RequirementWaits, RiskWatch } from '@/components/dashboard/ActionBand';
import KpiRow, { type KpiCard } from '@/components/dashboard/KpiRow';
import { DotMatrix } from '@/components/dashboard/DotMatrix';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
import config from '@/config';
import { useAppSelector } from '@/store';
import { isAdminRole } from '@/lib/roles';
import AdminOversight from '@/components/dashboard/AdminOversight';
import {
  COLUMNS,
  type ColumnKey,
  UNCLASSIFIED,
  awaitsCustomer,
  columnOf,
  isDeclined,
  isDone,
  isLive,
  isRmAction,
  nextActionLabel,
  riskOf,
} from '@/lib/application-buckets';

/* How many queue rows the dashboard asks for. See the note in loadDashboardData. */
const QUEUE_LIMIT = 200;

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

/* The status vocabulary lives in one place (`lib/application-buckets`) so a live
   application means the same thing on the board, in the action band and in the
   queue tabs below. It used to be restated here as three local sets plus a
   `getSmartAction` map that had drifted from the view's own `next_action`. */

/* Pipeline funnel stages and aging buckets are mapped in a shared helper so the
   RM and Admin dashboards drill through identically. */
import { matchesFocus } from '@/lib/dashboard-filters';

/* Status colour comes from the shared map so a status is the same colour on the
   queue, the dashboard and the admin oversight table. */
import { statusTone as getStatusStyle } from '@/lib/statusTone';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAppSelector(state => state.auth);
  // Admins get bank-wide cross-RM oversight; RMs (and everyone else) get their own queue.
  return isAdminRole(user) ? <AdminOversight /> : <RmDashboard />;
}

function RmDashboard() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [signalSummary, setSignalSummary] = useState<CustomerSignalSummary | null>(null);
  const [agingCells, setAgingCells] = useState<AgingHeatmapCell[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [journeys, setJourneys] = useState<ChannelJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | undefined>(undefined);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeFilter>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });
  const [kycLoadingId, setKycLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'action' | 'completed' | 'all'>('action');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [ageFilter, setAgeFilter] = useState<{ stage: string; bucket: string } | null>(null);
  const [columnFilter, setColumnFilter] = useState<ColumnKey | null>(null);
  const [segment, setSegment] = useState('ALL');

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
      const [kpisData, worklistData] = await Promise.all([
        dashboardService.getKpis(bankId),
        // The board, the action band, the at-risk list and the queue all read this
        // one list, so it asks for the book rather than a top-50 page. Anything
        // beyond the cap is disclosed in the board's footer rather than hidden in a
        // column count.
        dashboardService.getWorklist(bankId, selectedFilter, QUEUE_LIMIT),
      ]);
      setKpis(kpisData);
      setWorklist(filterByTimeframe(worklistData));
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
    dashboardService
      .getTrends(bankId)
      .then(data => setTrends(Array.isArray(data) ? data : []))
      .catch(() => setTrends([]));
    dashboardService
      .getJourneys(bankId)
      .then(data => setJourneys(Array.isArray(data) ? data : []))
      .catch(() => setJourneys([]));
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

  /* One scoped list feeds the board, the action band and the queue, so a figure in
     any of them is a fact about the same rows. The KPI cards read the bank's own
     aggregates, which no segment or column can narrow — the strip below the cards
     says so while a segment is picked. */
  const scoped = useMemo(
    () => (segment === 'ALL' ? worklist : worklist.filter(i => i.customerType === segment)),
    [worklist, segment]
  );
  const actionItems = useMemo(() => scoped.filter(i => isLive(i.status)), [scoped]);
  const completedItems = useMemo(() => scoped.filter(i => isDone(i.status)), [scoped]);
  const declinedItems = useMemo(() => scoped.filter(i => isDeclined(i.status)), [scoped]);

  const displayWorklist = useMemo(() => {
    const base =
      activeTab === 'action'
        ? actionItems
        : activeTab === 'completed'
          ? [...completedItems, ...declinedItems]
          : scoped;
    return base.filter(item => matchesFocus(item, { columnFilter, ageFilter }));
  }, [activeTab, actionItems, completedItems, declinedItems, scoped, columnFilter, ageFilter]);

  const sortedWorklist = sortData(displayWorklist, sortConfig);

  /* The only audit route is per-application, so this feed is assembled from the
     two timestamps the worklist already carries. Sorted newest first. */
  const activity = useMemo(() => {
    const events = worklist.flatMap(w => [
      {
        id: `${w.applicationId}:updated`,
        who: w.customerName || w.applicationNumber,
        what: `Moved to ${w.status.replace(/_/g, ' ').toLowerCase()}`,
        when: w.updatedAt,
      },
      {
        id: `${w.applicationId}:submitted`,
        who: w.customerName || w.applicationNumber,
        what: 'Submitted application',
        when: w.submittedAt,
      },
    ]);
    return events
      .filter(e => e.when)
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 6);
  }, [worklist]);

  /* Three derived work queues, all read off the view's own `next_action` and
     `blocker_reason` — so "waiting on you" is the bank&apos;s classification of the
     step, not a guess made from the status name. Declared before the banner below
     because a useMemo evaluates its dependency array on the spot. */
  const waitingItems = useMemo(() => actionItems.filter(awaitsCustomer), [actionItems]);
  const rmActionItems = useMemo(() => actionItems.filter(isRmAction), [actionItems]);
  const overdueCount = useMemo(
    () => actionItems.filter(i => (riskOf(i)?.over ?? 0) > 0).length,
    [actionItems]
  );

  /* AI banner copy — only ever states what the data actually supports. */
  const { aiHeadline, aiRecommendation } = useMemo(() => {
    const highSev = signalSummary?.countsBySeverity?.HIGH ?? 0;
    const activeSignals = signalSummary?.totalActiveSignals ?? 0;
    const flagged = signalSummary?.customersWithActiveSignals ?? 0;
    const plural = (n: number) => (n === 1 ? '' : 's');

    if (highSev > 0)
      return {
        aiHeadline: `${highSev} high-severity signal${plural(highSev)} across ${flagged} customer${plural(flagged)}`,
        aiRecommendation: 'Review the flagged customers before progressing their applications.',
      };
    /* The same two counts the cards and the action band show — the banner leads the
       eye, so it must not lead with a different number. */
    if (overdueCount > 0)
      return {
        aiHeadline: `${overdueCount} application${plural(overdueCount)} idle past its stage window`,
        aiRecommendation: 'Clear the blocked items first — they are the oldest risk in your pipeline.',
      };
    if (rmActionItems.length > 0)
      return {
        aiHeadline: `${rmActionItems.length} application${plural(rmActionItems.length)} waiting on a step you can take`,
        aiRecommendation: 'Work through the action list to keep the pipeline moving.',
      };
    if (activeSignals > 0)
      return {
        aiHeadline: `${activeSignals} active customer signal${plural(activeSignals)}, nothing blocking`,
        aiRecommendation: 'Keep them under watch — no action needed yet.',
      };
    return { aiHeadline: 'Your portfolio is on track', aiRecommendation: '' };
  }, [signalSummary, overdueCount, rmActionItems]);

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

  /* Weekly buckets are the only real time series the backend exposes, so they are
     the only figure allowed a "vs last month" delta: last four weeks against the
     four before them. Everything else on this page is either a point-in-time count
     or a distribution over rows that actually exist. */
  const submittedSeries = useMemo(() => trends.map(t => t.submittedCount), [trends]);
  const submittedTotal = useMemo(() => trends.reduce((s, t) => s + t.submittedCount, 0), [trends]);
  const submittedDelta = useMemo(() => {
    if (trends.length < 8) return null;
    const recent = trends.slice(-4).reduce((s, t) => s + t.submittedCount, 0);
    const prior = trends.slice(-8, -4).reduce((s, t) => s + t.submittedCount, 0);
    return prior > 0 ? ((recent - prior) / prior) * 100 : null;
  }, [trends]);

  /* Counted and valued from the same rows the board stacks into columns, so the
     cards above it and the columns below cannot drift apart. `v_dashboard_pipeline`
     groups over its own status CASE and its idle columns measure time since the row
     was last written, which is why it no longer feeds these numbers. */
  const liveByStage = useMemo(() => {
    const counts = COLUMNS.map(c => actionItems.filter(i => columnOf(i.status) === c.key).length);
    const values = COLUMNS.map(
      c => actionItems.filter(i => columnOf(i.status) === c.key).reduce((sum, i) => sum + i.requestedAmount, 0)
    );
    return { counts, values };
  }, [actionItems]);
  const liveValue = useMemo(() => actionItems.reduce((sum, i) => sum + i.requestedAmount, 0), [actionItems]);

  const waitingIdle = useMemo(
    () =>
      [...waitingItems]
        .sort((a, b) => b.daysInCurrentStage - a.daysInCurrentStage)
        .map(i => i.daysInCurrentStage),
    [waitingItems]
  );
  const actionByStage = useMemo(
    () => COLUMNS.map(c => rmActionItems.filter(i => columnOf(i.status) === c.key).length),
    [rmActionItems]
  );

  /* Five cards, five different figures. The counts that also head a panel below
     (action required, at risk, outstanding) are not repeated up here — this row
     owns the book's size, its value, its intake rate and what the customer holds. */
  const kpiCards: KpiCard[] = kpis
    ? [
        {
          key: 'active',
          label: 'Active applications',
          tone: 'accent',
          value: <AnimatedCounter value={actionItems.length} />,
          note: 'on your board, not yet booked or closed',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375h-16.5m16.5 0a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.375m15.75 0v11.25a2.25 2.25 0 01-2.25 2.25H6.75a2.25 2.25 0 01-2.25-2.25V6.375" />
            </svg>
          ),
          visual: (
            <DotMatrix
              data={liveByStage.counts}
              cell={4}
              rows={6}
              label="Active applications in each pipeline stage"
              format={(v, i) => `${COLUMNS[i].label}: ${v}`}
            />
          ),
        },
        {
          key: 'value',
          label: 'Value in pipeline',
          tone: 'violet',
          value: <AnimatedCurrency value={liveValue} />,
          note: `requested across ${liveByStage.counts.filter(n => n > 0).length} stages`,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          visual: (
            <DotMatrix
              data={liveByStage.values}
              cell={4}
              rows={6}
              label="Requested value held by each pipeline stage"
              format={(v, i) => `${COLUMNS[i].label}: ${compactCurrency(v)}`}
            />
          ),
        },
        {
          key: 'submitted',
          label: `Submitted · ${trends.length} weeks`,
          tone: 'green',
          value: <span className="num">{submittedTotal}</span>,
          note: submittedDelta === null ? 'not enough history for a change' : `${trends.length} weekly buckets`,
          delta:
            submittedDelta === null
              ? null
              : { pct: submittedDelta, label: 'Last 4 weeks against the 4 before them' },
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          ),
          visual: (
            <DotMatrix
              data={submittedSeries}
              cell={4}
              rows={6}
              label={`Applications submitted per week over ${submittedSeries.length} weeks`}
              format={(v, i) => `${trends[i]?.weekStart}: ${v} submitted`}
            />
          ),
        },
        {
          key: 'customer',
          label: 'Waiting on the customer',
          tone: 'amber',
          value: <AnimatedCounter value={waitingItems.length} />,
          note: 'their KYC, documents, offer or signature',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.992 0M12 6v6l4 2" />
            </svg>
          ),
          visual: (
            <DotMatrix
              data={waitingIdle}
              cell={4}
              rows={6}
              label={`Days idle for each of the ${waitingIdle.length} applications waiting on a customer`}
              format={v => `${v} days idle`}
            />
          ),
        },
        {
          key: 'action',
          label: 'Action required',
          tone: 'red',
          value: <AnimatedCounter value={rmActionItems.length} />,
          note: 'a step you can take right now',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          ),
          visual: (
            <DotMatrix
              data={actionByStage}
              cell={4}
              rows={6}
              color="var(--rm-down)"
              label="Actionable applications by pipeline stage"
              format={(v, i) => `${COLUMNS[i].label}: ${v}`}
            />
          ),
        },
      ]
    : [];

  /* Everything the reference put in its KPI cards but this backend only reports as
     a month-to-date total, in one hairline row so the cards stay a decision aid. */
  const monthStrip = kpis
    ? [
        {
          label: 'Approved this month',
          value: formatCurrency(kpis.approvedThisMonthValue),
          note: `${kpis.approvedThisMonthCount} decided yes`,
        },
        {
          label: 'Booked this month',
          value: formatCurrency(kpis.bookedThisMonthValue),
          note: `${kpis.bookedThisMonthCount} ${kpis.bookedThisMonthCount === 1 ? 'facility' : 'facilities'}`,
        },
        {
          label: 'Declined this month',
          value: <span className="num">{kpis.declinedThisMonthCount}</span>,
          note: 'closed without lending',
        },
        {
          label: 'Conversion, 30 days',
          value: <span className="num">{kpis.conversionRate30d.toFixed(1)}%</span>,
          note: 'submitted that reached booking',
        },
      ]
    : [];

  return (
    <div className="space-y-5 p-1 sm:p-2 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ HERO ═ */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="serif text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]" style={{ color: 'var(--rm-text)' }}>
            {greeting()}, {user?.firstName}
          </h1>
          <p className="mt-2 text-base" style={{ color: 'var(--rm-text-muted)' }}>
            {TIMEFRAME_OPTIONS.find(o => o.value === selectedTimeframe)?.label === 'All time'
              ? 'Every application in your book, ordered by what needs a move.'
              : `Applications submitted ${TIMEFRAME_OPTIONS.find(o => o.value === selectedTimeframe)?.label.toLowerCase() ?? ''}, ordered by what needs a move.`}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={selectedTimeframe}
            onChange={e => setSelectedTimeframe(e.target.value as TimeframeFilter)}
            aria-label="Filter by timeframe"
            className="rounded-full px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            {TIMEFRAME_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={loadDashboardData}
            className="rounded-full p-2.5 transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-muted)' }}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => router.push('/dashboard/applications/new')}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 inline-flex items-center gap-2"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New application
          </button>
        </div>
      </header>

      {(columnFilter || ageFilter || segment !== 'ALL') && (
        <div className="flex items-center gap-2 flex-wrap animate-fade-in">
          <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Filtered by
          </span>
          {segment !== 'ALL' && (
            <button
              onClick={() => setSegment('ALL')}
              className="rounded-full px-3 py-1 text-sm font-medium inline-flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
            >
              {segment === 'BUSINESS' ? 'Business' : 'Individual'} customers
              <span aria-hidden>×</span>
            </button>
          )}
          {columnFilter && (
            <button
              onClick={() => setColumnFilter(null)}
              className="rounded-full px-3 py-1 text-sm font-medium inline-flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
            >
              {COLUMNS.find(c => c.key === columnFilter)?.label ?? 'Other statuses'}
              <span aria-hidden>×</span>
            </button>
          )}
          {ageFilter && (
            <button
              onClick={() => setAgeFilter(null)}
              className="rounded-full px-3 py-1 text-sm font-medium inline-flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
            >
              {ageFilter.stage.replace(/_/g, ' ')} · {ageFilter.bucket}d
              <span aria-hidden>×</span>
            </button>
          )}
          <button
            onClick={() => {
              setColumnFilter(null);
              setAgeFilter(null);
              setSegment('ALL');
            }}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--rm-text-secondary)' }}
          >
            Clear all
          </button>
          <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            · only “Submitted”, the month row and the requirements panel stay book-wide
          </span>
        </div>
      )}

      {/* ══ KPI ROW ══ */}
      {kpis && <KpiRow cards={kpiCards} />}

      {/* ══ MONTH TO DATE ══ */}
      {monthStrip.length > 0 && (
        <section className="rm-panel">
          <div className="rm-strip">
            {monthStrip.map(cell => (
              <div key={cell.label} className="rm-strip-cell">
                <p className="rm-strip-label">{cell.label}</p>
                <p className="rm-strip-value">{cell.value}</p>
                <p className="rm-strip-note">{cell.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ PIPELINE BOARD ══ */}
      <ApplicationBoard
        items={scoped}
        loading={loading}
        selectedColumn={columnFilter}
        onColumnSelect={c => {
          setColumnFilter(c);
          setAgeFilter(null);
          /* The queue only holds the rows its tab names, so bring the tab to the set
             that can show what was just clicked — a Completed column under the Needs
             action tab would otherwise filter the table down to nothing. */
          if (c === 'done') setActiveTab('completed');
          else if (c === UNCLASSIFIED) setActiveTab('all');
          else if (c) setActiveTab('action');
        }}
        segment={segment}
        onSegmentChange={setSegment}
        capped={worklist.length >= QUEUE_LIMIT}
      />

      {/* ══ ACT | MISSING ══ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rm-fill">
          <ActionQueue
            items={actionItems}
            onCompleteKyc={handleCompleteKyc}
            kycLoadingId={kycLoadingId}
          />
        </div>
        <div className="rm-fill">
          <RequirementWaits items={missingItems} />
        </div>
        <div className="rm-fill">
          <RiskWatch items={actionItems} />
        </div>
      </div>

      {/* ══ VOLUME | WITH THE CUSTOMER | ACTIVITY ══ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rm-fill xl:col-span-5">
          <TrendChart points={trends} scopeLabel="your book" />
        </div>
        <div className="rm-fill xl:col-span-4">
          <ChannelJourneys journeys={journeys} />
        </div>
        <div className="rm-fill xl:col-span-3">
          <RecentActivity items={activity} loading={loading} />
        </div>
      </div>

      {/* ══ IDLE SPREAD | PERFORMANCE ══ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rm-fill xl:col-span-5">
          <AgingHeatmap
            cells={agingCells}
            onCellClick={(stage, bucket) => {
              setAgeFilter(bucket ? { stage, bucket } : null);
            }}
          />
        </div>
        <div className="rm-fill xl:col-span-7">
          <DashboardInsights performance={performance} missingItems={[]} showBlockers={false} />
        </div>
      </div>

      {/* ══ AI BANNER ══ */}
      {kpis && aiHeadline && (
        <section
          className="rm-panel p-6 sm:p-7 flex items-start gap-4"
          style={{ background: 'var(--rm-accent-muted)' }}
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
            <p className="serif text-xl font-medium leading-snug" style={{ color: 'var(--rm-text)' }}>
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
            <h2 className="rm-title">Applications</h2>
            <p className="rm-sub">
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
              className="rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
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

        <div className="rm-panel overflow-hidden">
          {sortedWorklist.length === 0 ? (
            <div className="py-20 text-center">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'color-mix(in srgb, var(--rm-up) 14%, transparent)' }}
              >
                <svg
                  className="w-7 h-7"
                  style={{ color: activeTab === 'action' ? 'var(--rm-up)' : 'var(--rm-text-muted)' }}
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
              <table className="rm-table w-full">
                <thead>
                  <tr>
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
                    const actionable = isRmAction(item);
                    const actionText = actionable
                      ? nextActionLabel(item)
                      : isDone(item.status)
                        ? 'Completed'
                        : 'Closed';
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
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg,#7f2b7b,#b155ac)' }}
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
                              style={{ backgroundColor: item.kycVerified ? 'var(--rm-up)' : 'var(--rm-down)' }}
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              title={item.amlCheckPassed ? 'AML passed' : 'AML pending'}
                              style={{ backgroundColor: item.amlCheckPassed ? 'var(--rm-up)' : 'var(--rm-down)' }}
                            />
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {actionable ? (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                router.push(`/dashboard/applications/${item.applicationId}`);
                              }}
                              className="text-sm font-medium hover:underline whitespace-nowrap"
                              style={{ color: 'var(--rm-accent)' }}
                            >
                              {actionText}
                            </button>
                          ) : (
                            <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              {actionText}
                            </span>
                          )}
                          {blocker && (
                            <p
                              className="text-sm mt-1 truncate max-w-[180px]"
                              style={{ color: 'var(--rm-warn)' }}
                            >
                              {blocker}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1.5 text-sm font-medium"
                            style={{ color: breached ? 'var(--rm-down)' : 'var(--rm-up)' }}
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
          style={{ backgroundColor: kpis ? 'var(--rm-up)' : 'var(--rm-warn)' }}
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
