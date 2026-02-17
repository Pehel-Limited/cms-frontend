'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PipelineStage,
} from '@/services/api/dashboard-service';
import { applicationService } from '@/services/api/applicationService';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
import config from '@/config';

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
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
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
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-slate-100">
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
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ──── Hero banner ──── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a3a7a] via-[#1e4da0] to-[#3b82f6]">
        {/* decorative shapes */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-100"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,60 L0,30 Q360,0 720,30 Q1080,60 1440,30 L1440,60 Z" />
        </svg>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
          {/* Top row: timeframe + refresh */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-blue-100 text-sm">
              Here&apos;s what&apos;s happening with your applications
            </p>
            <div className="flex items-center gap-2">
              <select
                value={selectedTimeframe}
                onChange={e => setSelectedTimeframe(e.target.value as TimeframeFilter)}
                className="px-3 py-1.5 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-sm text-white focus:ring-2 focus:ring-white/40 focus:border-transparent [&>option]:text-gray-900"
              >
                {TIMEFRAME_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={loadDashboardData}
                className="p-2 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-white hover:bg-white/20 transition-colors"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* KPI strip — like VTB's balance/account cards */}
          {kpis && (
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {/* Total Pipeline */}
              <div className="min-w-[200px] flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wider mb-1">
                  Total Pipeline
                </p>
                <p className="text-3xl font-bold text-white tabular-nums">
                  {formatCurrency(kpis.inProgressValue)}
                </p>
                <p className="text-blue-200 text-xs mt-1">
                  {kpis.inProgressCount} active applications
                </p>
              </div>
              {/* In Progress */}
              <div className="min-w-[160px] flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {kpis.inProgressCount}
                  </p>
                  <p className="text-blue-200 text-xs">In Progress</p>
                </div>
              </div>
              {/* Needs Action */}
              <div
                onClick={() => setActiveTab('action')}
                className="min-w-[160px] flex-shrink-0 bg-amber-400/20 backdrop-blur-md border border-amber-300/30 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:bg-amber-400/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-amber-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {kpis.needsActionCount}
                  </p>
                  <p className="text-amber-200 text-xs">Needs Action</p>
                </div>
              </div>
              {/* At Risk */}
              <div className="min-w-[160px] flex-shrink-0 bg-red-400/20 backdrop-blur-md border border-red-300/30 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-red-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {kpis.stuckAtRiskCount}
                  </p>
                  <p className="text-red-200 text-xs">At Risk</p>
                </div>
              </div>
              {/* Conversion */}
              <div className="min-w-[160px] flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-emerald-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {kpis.conversionRate30d ? `${Math.round(kpis.conversionRate30d)}%` : '—'}
                  </p>
                  <p className="text-blue-200 text-xs">Conversion (30d)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 space-y-6">
        {/* ──── What's New / Alerts — horizontal scrollable strips ──── */}
        {kpis && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              What&apos;s new
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar" ref={scrollRef}>
              {kpis.needsActionCount > 0 && (
                <div
                  className="min-w-[220px] flex-shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setActiveTab('action')}
                >
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {kpis.needsActionCount}
                  </span>
                  <p className="text-sm text-slate-600 leading-snug">
                    applications need
                    <br />
                    your action
                  </p>
                  <button className="ml-auto text-slate-300 hover:text-slate-500" title="Dismiss">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
              {kpis.stuckAtRiskCount > 0 && (
                <div className="min-w-[220px] flex-shrink-0 bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <span className="text-2xl font-bold text-red-600 tabular-nums">
                    {kpis.stuckAtRiskCount}
                  </span>
                  <p className="text-sm text-slate-600 leading-snug">
                    applications
                    <br />
                    at risk
                  </p>
                </div>
              )}
              <div className="min-w-[240px] flex-shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {kpis.approvedThisMonthCount} approved
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(kpis.approvedThisMonthValue)} this month
                  </p>
                </div>
              </div>
              <div className="min-w-[240px] flex-shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {kpis.bookedThisMonthCount} booked
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(kpis.bookedThisMonthValue)} this month
                  </p>
                </div>
              </div>
              {kpis.declinedThisMonthCount > 0 && (
                <div className="min-w-[200px] flex-shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {kpis.declinedThisMonthCount} declined
                    </p>
                    <p className="text-xs text-slate-500">this month</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ──── Quick Actions — circular icons like "Popular Payments" ──── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Quick Actions
            </h2>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-1 no-scrollbar">
            {[
              {
                label: 'New Application',
                path: '/dashboard/applications/new',
                gradient: 'from-blue-500 to-blue-600',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                ),
              },
              {
                label: 'New Customer',
                path: '/dashboard/customers/new',
                gradient: 'from-emerald-500 to-teal-600',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                ),
              },
              {
                label: 'All Applications',
                path: '/dashboard/applications',
                gradient: 'from-violet-500 to-purple-600',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                ),
              },
              {
                label: 'Customers',
                path: '/dashboard/customers',
                gradient: 'from-orange-400 to-pink-500',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ),
              },
              {
                label: 'KYC / AML',
                path: '/dashboard/kyc',
                gradient: 'from-cyan-500 to-blue-500',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                ),
              },
              {
                label: 'Products',
                path: '/dashboard/products',
                gradient: 'from-indigo-500 to-blue-600',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                ),
              },
              {
                label: 'Accounts',
                path: '/dashboard/accounts',
                gradient: 'from-pink-500 to-rose-600',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                ),
              },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => router.push(a.path)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${a.gradient} text-white flex items-center justify-center shadow-lg shadow-blue-900/10 group-hover:scale-110 group-hover:shadow-xl transition-all duration-200`}
                >
                  {a.icon}
                </div>
                <span className="text-xs text-slate-600 font-medium text-center whitespace-nowrap">
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ──── Pipeline ──── */}
        {pipelineSummary.some(s => s.count > 0) && (
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-5">
              Pipeline
            </h2>
            <div className="flex items-end gap-4 justify-between">
              {pipelineSummary.map(stage => {
                const maxCount = Math.max(...pipelineSummary.map(s => s.count), 1);
                const height = Math.max((stage.count / maxCount) * 120, 12);
                return (
                  <div key={stage.key} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-lg font-bold text-slate-900 tabular-nums">
                      {stage.count}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className={`w-full max-w-[48px] rounded-xl ${stage.color} transition-all duration-700 ease-out`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 text-center font-medium">
                      {stage.label}
                    </span>
                    {stage.avgDays > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {Math.round(stage.avgDays)}d avg
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ──── Worklist ──── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Header with tabs */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-semibold text-slate-900">Latest Applications</h2>
                <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
                  {[
                    {
                      key: 'action' as const,
                      label: 'Needs Action',
                      count: actionItems.length,
                      accent: 'bg-amber-100 text-amber-700',
                    },
                    {
                      key: 'completed' as const,
                      label: 'Completed',
                      count: completedItems.length + declinedItems.length,
                      accent: 'bg-slate-200 text-slate-600',
                    },
                    {
                      key: 'all' as const,
                      label: 'All',
                      count: worklist.length,
                      accent: 'bg-slate-200 text-slate-600',
                    },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeTab === tab.key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full ${activeTab === tab.key ? tab.accent : 'bg-slate-200 text-slate-500'}`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedFilter || ''}
                  onChange={e => setSelectedFilter(e.target.value || undefined)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="PENDING_KYC">Pending KYC</option>
                  <option value="PENDING_DOCUMENTS">Pending Documents</option>
                  <option value="PENDING_CREDIT_CHECK">Pending Credit Check</option>
                  <option value="REFERRED_TO_SENIOR">Referred to Senior</option>
                  <option value="IN_UNDERWRITING">In Underwriting</option>
                  <option value="UNDERWRITING_APPROVED">Underwriting Approved</option>
                  <option value="APPROVED">Approved</option>
                  <option value="OFFER_GENERATED">Offer Generated</option>
                  <option value="PENDING_ESIGN">Pending E-Sign</option>
                  <option value="PENDING_BOOKING">Pending Booking</option>
                  <option value="BOOKED">Booked</option>
                  <option value="DISBURSED">Disbursed</option>
                  <option value="DECLINED">Declined</option>
                </select>
                {/* View toggle (card / table) like VTB's grid/list toggle */}
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Card view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Table view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Card View ── */}
          {viewMode === 'card' && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedWorklist.map(item => {
                const statusStyle = getStatusStyle(item.status);
                const action = getSmartAction(item);
                const isTerminal = TERMINAL_STATUSES.has(item.status);
                const isCompletedItem = COMPLETED_STATUSES.has(item.status);

                return (
                  <div
                    key={item.applicationId}
                    className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all duration-200 group cursor-pointer"
                    onClick={() => router.push(`/dashboard/applications/${item.applicationId}`)}
                  >
                    {/* Top row: icon + app number + age */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl ${statusStyle.bg} flex items-center justify-center shrink-0 ring-1 ${statusStyle.ring}`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {item.applicationNumber}
                          </p>
                          <p className="text-xs text-slate-400">{item.customerName}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums ${item.daysInCurrentStage > 7 ? 'text-red-500' : item.daysInCurrentStage > 3 ? 'text-amber-500' : 'text-slate-400'}`}
                      >
                        {item.daysInCurrentStage}d
                      </span>
                    </div>

                    {/* Product + Amount */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500 truncate">{item.productName}</span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums">
                        {formatCurrency(item.requestedAmount)}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {item.status.replace(/_/g, ' ')}
                      </span>
                      {/* Action */}
                      {item.status === 'PENDING_KYC' || item.nextAction === 'COMPLETE_KYC' ? (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleCompleteKyc(item.applicationId);
                          }}
                          disabled={kycLoadingId === item.applicationId}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {kycLoadingId === item.applicationId ? 'Processing...' : 'Complete KYC'}
                        </button>
                      ) : !isTerminal && action.actionable ? (
                        <span className="text-[11px] font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {action.label} &rarr;
                        </span>
                      ) : isCompletedItem ? (
                        <svg
                          className="w-4 h-4 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : null}
                    </div>

                    {/* SLA badge */}
                    {item.slaBreachDays !== null && item.slaBreachDays > 0 && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                          SLA +{item.slaBreachDays}d
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Table View ── */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80">
                    <SortableHeader
                      label="Application"
                      field="applicationNumber"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Customer"
                      field="customerName"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Product / Amount"
                      field="requestedAmount"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Action"
                      field="nextAction"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Age"
                      field="daysInCurrentStage"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedWorklist.map(item => {
                    const statusStyle = getStatusStyle(item.status);
                    const action = getSmartAction(item);
                    const isTerminal = TERMINAL_STATUSES.has(item.status);
                    const isCompletedItem = COMPLETED_STATUSES.has(item.status);

                    return (
                      <tr
                        key={item.applicationId}
                        className="hover:bg-blue-50/40 transition-colors group"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/applications/${item.applicationId}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {item.applicationNumber}
                            </Link>
                            {item.createdByMe ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                                MY
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                ASSIGNED
                              </span>
                            )}
                          </div>
                          {item.slaBreachDays !== null && item.slaBreachDays > 0 && (
                            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                              SLA +{item.slaBreachDays}d
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/dashboard/customers/${item.customerId}`}
                            className="text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {item.customerName}
                          </Link>
                          <p className="text-xs text-slate-400">{item.customerNumber}</p>
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="text-sm text-slate-900">{item.productName}</p>
                          <p className="text-sm font-semibold text-slate-700">
                            {formatCurrency(item.requestedAmount)}
                          </p>
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          {item.status === 'PENDING_KYC' || item.nextAction === 'COMPLETE_KYC' ? (
                            <button
                              onClick={() => handleCompleteKyc(item.applicationId)}
                              disabled={kycLoadingId === item.applicationId}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {kycLoadingId === item.applicationId ? (
                                <>
                                  <svg
                                    className="w-3 h-3 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                  </svg>
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                    />
                                  </svg>
                                  Complete KYC
                                </>
                              )}
                            </button>
                          ) : isCompletedItem ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              {action.label}
                            </span>
                          ) : isTerminal ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg">
                              {action.label}
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                router.push(`/dashboard/applications/${item.applicationId}`)
                              }
                              className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors group/action"
                            >
                              <span className="group-hover/action:underline">{action.label}</span>
                              <svg
                                className="w-3.5 h-3.5 opacity-0 group-hover/action:opacity-100 transition-opacity"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                                />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold tabular-nums ${item.daysInCurrentStage > 7 ? 'text-red-600' : item.daysInCurrentStage > 3 ? 'text-amber-600' : 'text-slate-700'}`}
                            >
                              {item.daysInCurrentStage}d
                            </span>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 leading-tight">
                                in status
                              </span>
                              <span className="text-[10px] text-slate-300 leading-tight">
                                {item.daysSinceSubmitted}d total
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {displayWorklist.length === 0 && (
            <div className="py-20 text-center">
              {activeTab === 'action' ? (
                <>
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-emerald-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-slate-900 font-semibold text-lg">All caught up!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    No applications need your attention right now.
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-slate-900 font-semibold text-lg">No applications found</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try adjusting your filters or timeframe.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Footer */}
          {displayWorklist.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {displayWorklist.length} of {worklist.length} application
                {worklist.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => router.push('/dashboard/applications')}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                View all applications &rarr;
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
