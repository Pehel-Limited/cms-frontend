'use client';

import { useEffect, useState } from 'react';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PipelineStage,
} from '@/services/api/dashboard-service';
import config from '@/config';
import { formatCurrency } from '@/lib/format';

/* ── Status dot + bg maps ─────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  SUBMITTED: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  UNDERWRITING: 'bg-orange-500',
  APPROVED: 'bg-emerald-500',
  AWAITING_BOOKING: 'bg-violet-500',
  BOOKED: 'bg-emerald-600',
  DECLINED: 'bg-red-500',
};
const STATUS_BG: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  IN_REVIEW: 'bg-amber-50 text-amber-700',
  UNDERWRITING: 'bg-orange-50 text-orange-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  AWAITING_BOOKING: 'bg-violet-50 text-violet-700',
  BOOKED: 'bg-emerald-50 text-emerald-800',
  DECLINED: 'bg-red-50 text-red-700',
};

/* ── Pipeline bar colors ──────────────────────────────────── */
const PIPELINE_COLORS: Record<string, string> = {
  SUBMITTED: 'from-blue-500 to-blue-400',
  IN_REVIEW: 'from-amber-500 to-amber-400',
  UNDERWRITING: 'from-orange-500 to-orange-400',
  APPROVED: 'from-emerald-500 to-emerald-400',
  AWAITING_BOOKING: 'from-violet-500 to-violet-400',
  BOOKED: 'from-emerald-600 to-emerald-500',
  DECLINED: 'from-red-500 to-red-400',
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | undefined>(undefined);

  const bankId = config.bank.defaultBankId;

  useEffect(() => {
    loadDashboardData();
  }, [selectedFilter]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [kpisData, worklistData, pipelineData] = await Promise.all([
        dashboardService.getKpis(bankId),
        dashboardService.getWorklist(bankId, selectedFilter, 50),
        dashboardService.getPipeline(bankId),
      ]);
      setKpis(kpisData);
      setWorklist(worklistData);
      setPipeline(pipelineData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string) =>
    action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());

  // ─── Loading ──────────────────────────────────────
  if (loading && !kpis) {
    return (
      <div className="space-y-6 p-6">
        {/* Hero skeleton */}
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8 animate-pulse">
          <div className="h-7 bg-white/20 rounded-xl w-40" />
          <div className="h-4 bg-white/10 rounded-xl w-60 mt-2" />
        </div>
        {/* KPI skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse"
            >
              <div className="h-4 bg-slate-200/70 rounded-xl w-24 mb-3" />
              <div className="h-8 bg-slate-200/70 rounded-xl w-16" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">RM Dashboard</h1>
            <p className="text-white/70 mt-1">Your daily operating system for loan applications</p>
          </div>
          <button
            onClick={loadDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Primary KPI Tiles */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            label="In Progress"
            count={kpis.inProgressCount}
            sub={formatCurrency(kpis.inProgressValue)}
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            }
          />
          <KpiCard
            label="Stuck / At Risk"
            count={kpis.stuckAtRiskCount}
            sub="Requires attention"
            subColor="text-red-600"
            color="red"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            }
          />
          <KpiCard
            label="Needs Your Action"
            count={kpis.needsActionCount}
            sub="Awaiting action"
            subColor="text-amber-600"
            color="amber"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            }
          />
          <KpiCard
            label="Conversion Rate (30d)"
            count={`${kpis.conversionRate30d.toFixed(1)}%`}
            sub="Submitted → Booked"
            color="emerald"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>
      )}

      {/* Secondary KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <MiniKpi
            label="Approved This Month"
            count={kpis.approvedThisMonthCount}
            sub={formatCurrency(kpis.approvedThisMonthValue)}
          />
          <MiniKpi
            label="Booked This Month"
            count={kpis.bookedThisMonthCount}
            sub={formatCurrency(kpis.bookedThisMonthValue)}
          />
          <MiniKpi label="Declined This Month" count={kpis.declinedThisMonthCount} />
        </div>
      )}

      {/* Worklist Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">My Worklist</h2>
              <p className="text-sm text-slate-500 mt-0.5">Prioritized by urgency and SLA</p>
            </div>
            <select
              value={selectedFilter || ''}
              onChange={e => setSelectedFilter(e.target.value || undefined)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="UNDERWRITING">Underwriting</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Application
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Product / Amount
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Aging
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Blocker
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {worklist.map(item => (
                <tr
                  key={item.applicationId}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                          item.slaBreachDays !== null && item.slaBreachDays > 0
                            ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.priorityScore}
                      </div>
                      {item.slaBreachDays !== null && item.slaBreachDays > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />+
                          {item.slaBreachDays}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[#7f2b7b] hover:text-[#6b2568] cursor-pointer">
                      {item.applicationNumber}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.productCode}</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center text-xs font-semibold text-[#7f2b7b]">
                        {item.customerName
                          ?.split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm text-slate-900">{item.customerName}</div>
                        <div className="text-xs text-slate-400">{item.customerNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">{item.productName}</div>
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(item.requestedAmount)}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_BG[item.status] || 'bg-slate-50 text-slate-700'}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[item.status] || 'bg-slate-400'}`}
                      />
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm">
                    <div className="text-slate-700 tabular-nums">
                      {item.daysSinceSubmitted}d total
                    </div>
                    <div className="text-xs text-slate-400 tabular-nums">
                      {item.daysInCurrentStage}d in stage
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-700">
                      {item.blockerReason.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Docs: {item.documentsSubmittedCount}/{item.documentsRequiredCount}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <button className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-[#7f2b7b] hover:bg-[#6b2568] transition-colors">
                      {formatAction(item.nextAction)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {worklist.length === 0 && (
          <div className="p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <svg
                className="w-7 h-7 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-slate-500">No applications in your worklist</p>
          </div>
        )}
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Pipeline by Stage</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Application funnel and bottleneck analysis
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          {pipeline.map(stage => {
            const maxCount = Math.max(...pipeline.map(p => p.applicationCount), 1);
            const pct = Math.min(100, (stage.applicationCount / maxCount) * 100);
            const barColor = PIPELINE_COLORS[stage.stage] || 'from-slate-500 to-slate-400';

            return (
              <div key={stage.stage} className="bg-slate-50/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">
                      {stage.stage.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Avg: {stage.avgDaysInStage.toFixed(1)}d &middot; P90:{' '}
                      {stage.p90DaysInStage.toFixed(1)}d
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {stage.applicationCount}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatCurrency(stage.totalValue)}
                    </p>
                  </div>
                </div>

                {/* Pending indicators */}
                {(stage.kycPendingCount > 0 ||
                  stage.amlPendingCount > 0 ||
                  stage.docsPendingCount > 0 ||
                  stage.creditCheckPendingCount > 0) && (
                  <div className="flex gap-3 text-xs mb-2.5">
                    {stage.kycPendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-amber-500" />
                        KYC: {stage.kycPendingCount}
                      </span>
                    )}
                    {stage.amlPendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-orange-500" />
                        AML: {stage.amlPendingCount}
                      </span>
                    )}
                    {stage.docsPendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-blue-500" />
                        Docs: {stage.docsPendingCount}
                      </span>
                    )}
                    {stage.creditCheckPendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-violet-500" />
                        Credit: {stage.creditCheckPendingCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Progress bar */}
                <div className="w-full bg-slate-200/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── KPI Card Components ─────────────────────────────────── */

const ICON_BG: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

function KpiCard({
  label,
  count,
  sub,
  subColor,
  color,
  icon,
}: {
  label: string;
  count: number | string;
  sub: string;
  subColor?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{count}</p>
          <p className={`text-sm mt-1 ${subColor || 'text-slate-500'}`}>{sub}</p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${ICON_BG[color] || ICON_BG.blue}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, count, sub }: { label: string; count: number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{count}</p>
      {sub && <p className="text-sm text-slate-500 tabular-nums">{sub}</p>}
    </div>
  );
}
