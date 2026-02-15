'use client';

import { useEffect, useState, useMemo } from 'react';
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

function getStatusStyle(status: string): { bg: string; text: string; dot: string } {
  if (COMPLETED_STATUSES.has(status))
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (DECLINED_STATUSES.has(status))
    return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
  if (['SUBMITTED', 'PENDING_KYC', 'PENDING_DOCUMENTS'].includes(status))
    return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' };
  if (
    [
      'PENDING_CREDIT_CHECK',
      'PENDING_UNDERWRITING',
      'IN_UNDERWRITING',
      'REFERRED_TO_SENIOR',
    ].includes(status)
  )
    return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
  if (['APPROVED', 'UNDERWRITING_APPROVED', 'CREDIT_APPROVED', 'KYC_APPROVED'].includes(status))
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (
    [
      'OFFER_GENERATED',
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'PENDING_ESIGN',
      'ESIGN_COMPLETED',
    ].includes(status)
  )
    return { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' };
  if (
    [
      'PENDING_BOOKING',
      'BOOKING_IN_PROGRESS',
      'PENDING_DISBURSEMENT',
      'DISBURSEMENT_IN_PROGRESS',
    ].includes(status)
  )
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' };
  return { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' };
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
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.getFullYear(), now.getMonth(), diff);
      }
      case 'this_month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'last_30_days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'last_90_days':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return null;
    }
  };

  const filterByTimeframe = (items: WorklistItem[]): WorklistItem[] => {
    const cutoffDate = getTimeframeDate(selectedTimeframe);
    if (!cutoffDate) return items;
    return items.filter(item => {
      const itemDate = new Date(item.submittedAt || item.updatedAt);
      return itemDate >= cutoffDate;
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSort = (field: string) => {
    setSortConfig(handleSortToggle(field, sortConfig));
  };

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

  // Split worklist into tabs
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

  // Pipeline visualization data
  const pipelineSummary = useMemo(() => {
    const stages = [
      { key: 'SUBMITTED', label: 'Submitted', color: 'blue' },
      { key: 'UNDERWRITING', label: 'Underwriting', color: 'amber' },
      { key: 'APPROVED', label: 'Approved', color: 'emerald' },
      { key: 'OFFER', label: 'Offer', color: 'violet' },
      { key: 'BOOKING', label: 'Booking', color: 'indigo' },
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getGreeting()} 👋</h1>
              <p className="text-gray-500 mt-1">
                Here&apos;s what&apos;s happening with your applications
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedTimeframe}
                onChange={e => setSelectedTimeframe(e.target.value as TimeframeFilter)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TIMEFRAME_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={loadDashboardData}
                className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
        </div>

        {/* KPI Cards — Row 1 */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* In Progress */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  In Progress
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                  <svg
                    className="w-4 h-4 text-blue-600"
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
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpis.inProgressCount}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatCurrency(kpis.inProgressValue)} pipeline
              </p>
            </div>

            {/* Needs Action */}
            <div
              onClick={() => setActiveTab('action')}
              className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                  Needs Action
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <svg
                    className="w-4 h-4 text-amber-600"
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
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpis.needsActionCount}</p>
              <p className="text-sm text-amber-600 mt-1 font-medium group-hover:underline">
                Review now →
              </p>
            </div>

            {/* At Risk */}
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  At Risk
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                  <svg
                    className="w-4 h-4 text-red-500"
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
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpis.stuckAtRiskCount}</p>
              <p className="text-sm text-red-500 mt-1 font-medium">Requires attention</p>
            </div>

            {/* Conversion Rate */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Conversion (30d)
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <svg
                    className="w-4 h-4 text-emerald-600"
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
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {kpis.conversionRate30d ? `${Math.round(kpis.conversionRate30d)}%` : '—'}
              </p>
              <p className="text-sm text-gray-500 mt-1">Submit → Booked</p>
            </div>
          </div>
        )}

        {/* KPI Cards — Row 2: Monthly Metrics */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 shrink-0">
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
                <p className="text-sm text-gray-500">Approved This Month</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-gray-900">{kpis.approvedThisMonthCount}</p>
                  <p className="text-sm text-gray-400">
                    {formatCurrency(kpis.approvedThisMonthValue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 shrink-0">
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
                <p className="text-sm text-gray-500">Booked This Month</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-gray-900">{kpis.bookedThisMonthCount}</p>
                  <p className="text-sm text-gray-400">
                    {formatCurrency(kpis.bookedThisMonthValue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 shrink-0">
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
                <p className="text-sm text-gray-500">Declined This Month</p>
                <p className="text-xl font-bold text-gray-900">{kpis.declinedThisMonthCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Funnel */}
        {pipelineSummary.some(s => s.count > 0) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Pipeline
            </h2>
            <div className="flex items-end gap-2 justify-between">
              {pipelineSummary.map(stage => {
                const maxCount = Math.max(...pipelineSummary.map(s => s.count), 1);
                const height = Math.max((stage.count / maxCount) * 100, 8);
                const colorMap: Record<string, string> = {
                  blue: 'bg-blue-500',
                  amber: 'bg-amber-500',
                  emerald: 'bg-emerald-500',
                  violet: 'bg-violet-500',
                  indigo: 'bg-indigo-500',
                };
                return (
                  <div key={stage.key} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">{stage.count}</span>
                    <div className="w-full flex justify-center">
                      <div
                        className={`w-full max-w-[60px] rounded-t-lg ${colorMap[stage.color]} transition-all duration-500`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 text-center">{stage.label}</span>
                    {stage.avgDays > 0 && (
                      <span className="text-[10px] text-gray-400">{stage.avgDays}d avg</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => router.push('/dashboard/applications/new')}
            className="flex items-center gap-3 bg-blue-600 text-white rounded-xl px-4 py-3 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-sm font-medium">New Application</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/customers/new')}
            className="flex items-center gap-3 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg
              className="w-5 h-5 shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            <span className="text-sm font-medium">New Customer</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/applications')}
            className="flex items-center gap-3 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg
              className="w-5 h-5 shrink-0 text-gray-400"
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
            <span className="text-sm font-medium">All Applications</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/kyc')}
            className="flex items-center gap-3 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg
              className="w-5 h-5 shrink-0 text-gray-400"
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
            <span className="text-sm font-medium">KYC / AML</span>
          </button>
        </div>

        {/* Worklist Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('action')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'action'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Needs Action
                  {actionItems.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                      {actionItems.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'completed'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Completed / Closed
                  {completedItems.length + declinedItems.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-gray-200 text-gray-600 rounded-full">
                      {completedItems.length + declinedItems.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-gray-200 text-gray-600 rounded-full">
                    {worklist.length}
                  </span>
                </button>
              </div>
              <select
                value={selectedFilter || ''}
                onChange={e => setSelectedFilter(e.target.value || undefined)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
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
              <tbody className="divide-y divide-gray-50">
                {sortedWorklist.map(item => {
                  const statusStyle = getStatusStyle(item.status);
                  const action = getSmartAction(item);
                  const isTerminal = TERMINAL_STATUSES.has(item.status);
                  const isCompleted = COMPLETED_STATUSES.has(item.status);

                  return (
                    <tr
                      key={item.applicationId}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* Application */}
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

                      {/* Customer */}
                      <td className="px-6 py-3.5">
                        <Link
                          href={`/dashboard/customers/${item.customerId}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                        >
                          {item.customerName}
                        </Link>
                        <p className="text-xs text-gray-400">{item.customerNumber}</p>
                      </td>

                      {/* Product / Amount */}
                      <td className="px-6 py-3.5">
                        <p className="text-sm text-gray-900">{item.productName}</p>
                        <p className="text-sm font-semibold text-gray-700">
                          {formatCurrency(item.requestedAmount)}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Action */}
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
                        ) : isCompleted ? (
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
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

                      {/* Age */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              item.daysInCurrentStage > 7
                                ? 'text-red-600'
                                : item.daysInCurrentStage > 3
                                  ? 'text-amber-600'
                                  : 'text-gray-700'
                            }`}
                          >
                            {item.daysInCurrentStage}d
                          </span>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 leading-tight">
                              in status
                            </span>
                            <span className="text-[10px] text-gray-300 leading-tight">
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

          {/* Empty State */}
          {displayWorklist.length === 0 && (
            <div className="py-16 text-center">
              {activeTab === 'action' ? (
                <>
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6 text-emerald-500"
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
                  <p className="text-gray-900 font-medium">All caught up!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    No applications need your attention right now.
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6 text-gray-400"
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
                  <p className="text-gray-900 font-medium">No applications found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your filters or timeframe.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Footer */}
          {displayWorklist.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {displayWorklist.length} of {worklist.length} application
                {worklist.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => router.push('/dashboard/applications')}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                View all applications →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
