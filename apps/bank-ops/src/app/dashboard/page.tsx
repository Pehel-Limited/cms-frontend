'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import AnimatedCounter, { AnimatedCurrency } from '@/components/AnimatedCounter';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PipelineStage,
  PerformanceMetrics,
  MissingItem,
} from '@/services/api/dashboard-service';
import { applicationService } from '@/services/api/applicationService';
import PriorityFocus from '@/components/dashboard/PriorityFocus';
import DashboardInsights from '@/components/dashboard/DashboardInsights';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
import config from '@/config';
import { useAppSelector } from '@/store';

/* ───── types & constants (unchanged) ────── */

type TimeframeFilter =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'all';

const TIMEFRAME_OPTIONS: { value: TimeframeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
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

function getStatusStyle(status: string): { bg: string; text: string; dot: string; ring: string } {
  if (COMPLETED_STATUSES.has(status))
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-200',
    };
  if (DECLINED_STATUSES.has(status))
    return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', ring: 'ring-red-200' };
  if (['SUBMITTED', 'PENDING_KYC', 'PENDING_DOCUMENTS'].includes(status))
    return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-200' };
  if (
    [
      'PENDING_CREDIT_CHECK',
      'PENDING_UNDERWRITING',
      'IN_UNDERWRITING',
      'REFERRED_TO_SENIOR',
    ].includes(status)
  )
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      ring: 'ring-amber-200',
    };
  if (['APPROVED', 'UNDERWRITING_APPROVED', 'CREDIT_APPROVED', 'KYC_APPROVED'].includes(status))
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-200',
    };
  if (
    [
      'OFFER_GENERATED',
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'PENDING_ESIGN',
      'ESIGN_COMPLETED',
    ].includes(status)
  )
    return {
      bg: 'bg-violet-50',
      text: 'text-violet-700',
      dot: 'bg-violet-500',
      ring: 'ring-violet-200',
    };
  if (
    [
      'PENDING_BOOKING',
      'BOOKING_IN_PROGRESS',
      'PENDING_DISBURSEMENT',
      'DISBURSEMENT_IN_PROGRESS',
    ].includes(status)
  )
    return {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      dot: 'bg-indigo-500',
      ring: 'ring-indigo-200',
    };
  return { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400', ring: 'ring-gray-200' };
}

function getSmartAction(item: WorklistItem): { label: string; actionable: boolean } {
  const status = item.status;
  if (COMPLETED_STATUSES.has(status)) return { label: 'Completed', actionable: false };
  if (DECLINED_STATUSES.has(status)) return { label: 'Closed', actionable: false };
  const map: Record<string, string> = {
    DRAFT: 'Submit Application',
    SUBMITTED: 'Begin Review',
    PENDING_KYC: 'Complete KYC',
    KYC_APPROVED: 'Proceed',
    PENDING_DOCUMENTS: 'Collect Documents',
    DOCUMENTS_RECEIVED: 'Review Documents',
    PENDING_CREDIT_CHECK: 'Run Credit Check',
    CREDIT_APPROVED: 'Send to Underwriting',
    PENDING_UNDERWRITING: 'Assign Underwriter',
    IN_UNDERWRITING: 'Awaiting Decision',
    UNDERWRITING_APPROVED: 'Review Decision',
    REFERRED_TO_SENIOR: 'Senior Review',
    REFERRED_TO_UNDERWRITER: 'Underwriter Review',
    PENDING_DECISION: 'Make Decision',
    APPROVED: 'Generate Offer',
    OFFER_GENERATED: 'Send Offer',
    OFFER_SENT: 'Awaiting Customer',
    OFFER_ACCEPTED: 'Prepare Signing',
    OFFER_COUNTERED: 'Review Counter',
    PENDING_CONDITIONS: 'Verify Conditions',
    CONDITIONS_MET: 'Proceed to Signing',
    PENDING_ESIGN: 'Confirm Signature',
    ESIGN_IN_PROGRESS: 'Awaiting Signature',
    ESIGN_COMPLETED: 'Initiate Booking',
    PENDING_BOOKING: 'Book Facility',
    BOOKING_IN_PROGRESS: 'Processing',
    PENDING_DISBURSEMENT: 'Disburse Funds',
    DISBURSEMENT_IN_PROGRESS: 'Processing',
  };
  return { label: map[status] || 'Follow Up', actionable: true };
}

/* ───── component ────── */

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | undefined>(undefined);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeFilter>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });
  const [kycLoadingId, setKycLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'action' | 'completed' | 'all'>('action');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const pipelineSummary = useMemo(() => {
    const stages = [
      {
        key: 'DRAFT',
        label: 'Draft',
        color: 'bg-slate-400',
        lightBg: 'bg-slate-50',
        textColor: 'text-slate-600',
      },
      {
        key: 'SUBMITTED',
        label: 'Submitted',
        color: 'bg-blue-500',
        lightBg: 'bg-blue-50',
        textColor: 'text-blue-600',
      },
      {
        key: 'UNDERWRITING',
        label: 'Underwriting',
        color: 'bg-amber-500',
        lightBg: 'bg-amber-50',
        textColor: 'text-amber-600',
      },
      {
        key: 'APPROVED',
        label: 'Approved',
        color: 'bg-emerald-500',
        lightBg: 'bg-emerald-50',
        textColor: 'text-emerald-600',
      },
      {
        key: 'OFFER',
        label: 'Offer',
        color: 'bg-violet-500',
        lightBg: 'bg-violet-50',
        textColor: 'text-violet-600',
      },
      {
        key: 'BOOKING',
        label: 'Booking',
        color: 'bg-indigo-500',
        lightBg: 'bg-indigo-50',
        textColor: 'text-indigo-600',
      },
    ];
    return stages.map(s => {
      const found = pipeline.find(p => p.stage?.toUpperCase().includes(s.key));
      return {
        ...s,
        count: found?.applicationCount || 0,
        value: found?.totalValue || 0,
        avgDays: found?.avgDaysInStage || 0,
      };
    });
  }, [pipeline]);

  /* ─── loading state ─── */
  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  /* ─── render ─── */
  /* ─── render ─── */
  return (
    <div className="space-y-5 p-1" style={{ color: 'var(--rm-text)' }}>

      {/* ══ PAGE HEADER ══ */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>
            Relationship Manager Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
            Welcome back, {user?.firstName}. Here&apos;s your portfolio overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTimeframe}
            onChange={e => setSelectedTimeframe(e.target.value as TimeframeFilter)}
            className="px-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
          >
            {TIMEFRAME_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={loadDashboardData}
            className="p-2 rounded-xl transition-colors hover:bg-cyan-500/10"
            style={{ color: 'var(--rm-text-muted)', border: '1px solid var(--rm-border)' }}
            title="Refresh data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {kpis && (
            <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              As of {new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* ══ KPI CARDS — 6-column grid ══ */}
      {kpis ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {/* Total Pipeline */}
          <div className="rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Total Pipeline</p>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(14,165,233,0.12)' }}>
                <svg className="w-4 h-4" style={{ color: '#0ea5e9' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>
              <AnimatedCurrency value={kpis.inProgressValue} />
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              <AnimatedCounter value={kpis.inProgressCount} /> active applications
            </p>
          </div>

          {/* In Review */}
          <div className="rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>In Review</p>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}>
                <svg className="w-4 h-4" style={{ color: '#6366f1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>
              <AnimatedCounter value={kpis.inProgressCount} />
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              active applications
            </p>
          </div>

          {/* Needs Attention */}
          <div
            onClick={() => setActiveTab('action')}
            className="rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Needs Action</p>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                <svg className="w-4 h-4" style={{ color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>
              <AnimatedCounter value={kpis.needsActionCount} />
            </p>
            <p className="text-xs mt-1" style={{ color: '#d97706' }}>applications</p>
          </div>

          {/* At Risk */}
          <div className="rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid rgba(239,68,68,0.35)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>At Risk</p>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}>
                <svg className="w-4 h-4" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>
              <AnimatedCounter value={kpis.stuckAtRiskCount} />
            </p>
            <p className="text-xs mt-1" style={{ color: '#dc2626' }}>applications</p>
          </div>

          {/* Conversion MTD */}
          <div className="rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Conversion (MTD)</p>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                <svg className="w-4 h-4" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--rm-text)' }}>
              {kpis.conversionRate30d ? `${Math.round(kpis.conversionRate30d)}%` : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>Target: 40%</p>
          </div>

          {/* Booked This Month */}
          <div className="rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Booked (MTD)</p>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(14,165,233,0.12)' }}>
                <svg className="w-4 h-4" style={{ color: '#0ea5e9' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--rm-text)' }}>
              <AnimatedCurrency value={kpis.bookedThisMonthValue} />
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              <AnimatedCounter value={kpis.bookedThisMonthCount} /> deals
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--rm-card)' }} />
          ))}
        </div>
      )}

      {/* ══ TODAY'S PRIORITIES ══ */}
      <PriorityFocus
        items={actionItems}
        onCompleteKyc={handleCompleteKyc}
        kycLoadingId={kycLoadingId}
      />

      {/* ══ SECONDARY STATS + AI INSIGHT ══ */}
      {kpis && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* 4 stat tiles */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                label: 'Upcoming Reviews',
                value: kpis.needsActionCount,
                sub: 'Next 7 days',
                icon: '📅',
                link: '/dashboard/applications',
                linkLabel: 'View calendar →',
              },
              {
                label: 'Needs Action',
                value: kpis.needsActionCount,
                sub: 'Awaiting your review',
                icon: '📄',
                link: '/dashboard/applications',
                linkLabel: 'Review items →',
              },
              {
                label: 'Customer Follow-ups',
                value: kpis.inProgressCount,
                sub: 'Due this week',
                icon: '👥',
                link: '/dashboard/customers',
                linkLabel: 'View follow-ups →',
              },
              {
                label: 'Booked / Approved',
                value: null,
                valueCurrency: kpis.approvedThisMonthValue,
                sub: `${kpis.approvedThisMonthCount} deals`,
                icon: '✅',
                link: '/dashboard/applications',
                linkLabel: 'View deals →',
              },
            ].map(tile => (
              <div key={tile.label} className="rounded-2xl p-4 flex flex-col justify-between"
                style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{tile.icon}</span>
                    <p className="text-xs font-medium" style={{ color: 'var(--rm-text-muted)' }}>{tile.label}</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>
                    {tile.valueCurrency !== undefined
                      ? <AnimatedCurrency value={tile.valueCurrency} />
                      : <AnimatedCounter value={tile.value ?? 0} />}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>{tile.sub}</p>
                </div>
                <Link href={tile.link} className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition-colors mt-3">
                  {tile.linkLabel}
                </Link>
              </div>
            ))}
          </div>

          {/* AI Insight panel */}
          <div className="lg:col-span-1 rounded-2xl p-4 relative overflow-hidden"
            style={{ backgroundColor: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">✨</span>
              <span className="text-xs font-bold text-cyan-400">AI Insight</span>
              <span className="text-[9px] font-bold text-cyan-500 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">BETA</span>
            </div>
            {kpis.stuckAtRiskCount > 0 ? (
              <>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--rm-text)' }}>
                  {kpis.stuckAtRiskCount} application{kpis.stuckAtRiskCount !== 1 ? 's are' : ' is'} at risk of SLA breach within the next 24 hours.
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--rm-text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--rm-text)' }}>Top recommendation:</span> Review and action pending applications to avoid SLA breach.
                </p>
              </>
            ) : (
              <p className="text-sm mb-3" style={{ color: 'var(--rm-text)' }}>
                All applications are on track. {kpis.needsActionCount > 0 ? `${kpis.needsActionCount} need your attention.` : 'Great work!'}
              </p>
            )}
            <Link href="/dashboard/applications" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              View all insights →
            </Link>
          </div>
        </div>
      )}

      {/* ══ QUICK ACTIONS ══ */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--rm-text-muted)' }}>Quick Actions</h2>
        <div className="rounded-2xl p-4 flex flex-wrap gap-3" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          {[
            { label: 'New Application', path: '/dashboard/applications/new', icon: '➕', color: 'from-cyan-500 to-blue-600' },
            { label: 'Add Customer', path: '/dashboard/customers/new', icon: '👤', color: 'from-violet-500 to-purple-600' },
            { label: 'All Applications', path: '/dashboard/applications', icon: '📋', color: 'from-indigo-500 to-blue-600' },
            { label: 'Customers', path: '/dashboard/customers', icon: '👥', color: 'from-teal-500 to-emerald-600' },
            { label: 'KYC / AML', path: '/dashboard/kyc', icon: '🛡️', color: 'from-amber-500 to-orange-600' },
            { label: 'Products', path: '/dashboard/products', icon: '📦', color: 'from-pink-500 to-rose-600' },
            { label: 'Accounts', path: '/dashboard/accounts', icon: '🏦', color: 'from-slate-500 to-slate-600' },
          ].map(a => (
            <button
              key={a.path}
              onClick={() => router.push(a.path)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
            >
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center text-xs text-white`}>
                {a.icon}
              </div>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* ══ PIPELINE BY STAGE ══ */}
      {pipelineSummary.some(s => s.count > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Pipeline by Stage</h2>
            <Link href="/dashboard/applications" className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition-colors">
              View pipeline →
            </Link>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            {/* Arrow flow */}
            <div className="flex overflow-x-auto no-scrollbar">
              {pipelineSummary.filter(s => s.count > 0 || true).map((stage, i) => {
                const colors: Record<string, { bg: string; text: string; border: string }> = {
                  DRAFT: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
                  SUBMITTED: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
                  UNDERWRITING: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
                  APPROVED: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
                  OFFER: { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
                  BOOKING: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
                };
                const c = colors[stage.key] ?? colors.DRAFT;
                return (
                  <div key={stage.key} className="flex-1 min-w-[100px] flex flex-col items-center px-3 py-4 relative group hover:bg-white/5 transition-colors"
                    style={{ borderRight: i < pipelineSummary.length - 1 ? '1px solid var(--rm-border)' : undefined }}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-2" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
                      <span className="text-sm font-bold" style={{ color: c.text }}>
                        <AnimatedCounter value={stage.count} />
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-center" style={{ color: 'var(--rm-text)' }}>{stage.label}</p>
                    {stage.avgDays > 0 && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--rm-text-muted)' }}>{Math.round(stage.avgDays)}d avg</p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: c.text }}>
                      {stage.value > 0 && <AnimatedCurrency value={stage.value} />}
                    </p>
                    {i < pipelineSummary.length - 1 && (
                      <svg className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--rm-text-muted)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Summary stats bar */}
            {kpis && (
              <div className="flex items-center gap-6 px-5 py-3 flex-wrap" style={{ borderTop: '1px solid var(--rm-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Total Pipeline</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--rm-text)' }}>
                    <AnimatedCurrency value={kpis.inProgressValue} />
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>{kpis.inProgressCount} applications</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Conversion Rate</p>
                  <p className="text-sm font-bold text-emerald-500">
                    {kpis.conversionRate30d ? `${Math.round(kpis.conversionRate30d)}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--rm-text-muted)' }}>Booked (MTD)</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--rm-text)' }}>
                    <AnimatedCurrency value={kpis.bookedThisMonthValue} />
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>{kpis.bookedThisMonthCount} deals</p>
                </div>
                <div className="ml-auto">
                  <Link href="/dashboard/applications" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: '#0ea5e9' }}>
                    View pipeline
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══ INSIGHTS (performance + blockers) ══ */}
      <DashboardInsights performance={performance} missingItems={missingItems} />

      {/* ══ LATEST APPLICATIONS WORKLIST ══ */}
      <section className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--rm-border)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>Latest Applications</h2>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--rm-border)' }}>
              {[
                { key: 'action' as const, label: 'Needs Action', count: actionItems.length },
                { key: 'completed' as const, label: 'Completed', count: completedItems.length + declinedItems.length },
                { key: 'all' as const, label: 'All', count: worklist.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.key ? '#0ea5e9' : 'transparent',
                    color: activeTab === tab.key ? '#fff' : 'var(--rm-text-secondary)',
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full"
                      style={{ backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.3)' : 'var(--rm-input)' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedFilter ?? ''}
              onChange={e => setSelectedFilter(e.target.value || undefined)}
              className="px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
            >
              <option value="">All Statuses</option>
              {['SUBMITTED','PENDING_KYC','PENDING_DOCUMENTS','PENDING_CREDIT_CHECK','IN_UNDERWRITING','APPROVED','OFFER_SENT','PENDING_ESIGN'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
            <Link href="/dashboard/applications"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}>
              View all
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* Table */}
        {sortedWorklist.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3 text-2xl" style={{ backgroundColor: 'var(--rm-input)' }}>
              {activeTab === 'action' ? '✅' : '📋'}
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
              {activeTab === 'action' ? 'No applications need action' : 'No applications found'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              {activeTab === 'action' ? "You're all caught up!" : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rm-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  {['Customer', 'Application', 'Amount', 'Status', 'Stage / Next Action', 'SLA', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--rm-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedWorklist.slice(0, 10).map(item => {
                  const style = getStatusStyle(item.status);
                  const action = getSmartAction(item);
                  const isOverdue = item.daysInCurrentStage > 5;
                  return (
                    <tr
                      key={item.applicationId}
                      className="transition-colors hover:bg-white/[0.03] cursor-pointer"
                      style={{ borderBottom: '1px solid var(--rm-border)' }}
                      onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}>
                            {(item.customerName || '?').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{item.customerName || '—'}</p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--rm-text-muted)' }}>{item.customerType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs" style={{ color: 'var(--rm-text-secondary)' }}>{item.applicationNumber}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--rm-text-muted)' }}>{item.productName}</p>
                      </td>
                      <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {formatCurrency(item.requestedAmount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {item.status.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {action.actionable ? (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/dashboard/applications/${item.applicationId}`); }}
                            className="flex items-center gap-1 text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition-colors whitespace-nowrap"
                          >
                            {action.label}
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{action.label}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.daysInCurrentStage > 0 && (
                          <span className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : 'text-emerald-500'}`}>
                            {item.daysInCurrentStage}d {isOverdue ? '⚠️' : '✓'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={e => e.stopPropagation()}
                          className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                          style={{ color: 'var(--rm-text-muted)' }}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {worklist.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 text-xs" style={{ borderTop: '1px solid var(--rm-border)', color: 'var(--rm-text-muted)' }}>
            <span>Showing {Math.min(sortedWorklist.length, 10)} of {worklist.length} applications</span>
            <Link href="/dashboard/applications" className="font-semibold text-cyan-500 hover:text-cyan-400 transition-colors">
              View all applications →
            </Link>
          </div>
        )}
      </section>

      {/* ══ SYSTEM STATUS ══ */}
      <div className="flex items-center gap-2 text-xs pb-2" style={{ color: 'var(--rm-text-muted)' }}>
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span>All systems operational</span>
        <span className="ml-auto">Last updated: {new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} AM</span>
      </div>

    </div>
  );
}
