'use client';

import { useEffect, useState } from 'react';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PipelineStage,
} from '@/services/api/dashboard-service';
import config from '@/config';

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-GB').format(value);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      IN_REVIEW: 'bg-yellow-100 text-yellow-800',
      UNDERWRITING: 'bg-orange-100 text-orange-800',
      APPROVED: 'bg-green-100 text-green-800',
      APPROVED_PENDING_OFFER: 'bg-green-100 text-green-800',
      AWAITING_BOOKING: 'bg-purple-100 text-purple-800',
      BOOKED: 'bg-green-200 text-green-900',
      DECLINED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getActionButtonColor = (action: string) => {
    const colors: Record<string, string> = {
      REQUEST_DOCUMENTS: 'bg-blue-600 hover:bg-blue-700',
      COMPLETE_KYC: 'bg-yellow-600 hover:bg-yellow-700',
      ASSIGN_TO_UNDERWRITER: 'bg-purple-600 hover:bg-purple-700',
      SEND_OFFER_LETTER: 'bg-green-600 hover:bg-green-700',
      PROCESS_BOOKING: 'bg-indigo-600 hover:bg-indigo-700',
      FOLLOW_UP: 'bg-gray-600 hover:bg-gray-700',
    };
    return colors[action] || 'bg-gray-600 hover:bg-gray-700';
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Your daily operating system for loan applications</p>
        </div>

        {/* KPI Tiles */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.inProgressCount}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(kpis.inProgressValue)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg
                    className="w-8 h-8 text-blue-600"
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Stuck / At Risk</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.stuckAtRiskCount}</p>
                  <p className="text-sm text-red-600 mt-1 font-medium">Requires attention</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <svg
                    className="w-8 h-8 text-red-600"
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Needs Your Action</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.needsActionCount}</p>
                  <p className="text-sm text-yellow-600 mt-1 font-medium">Awaiting action</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <svg
                    className="w-8 h-8 text-yellow-600"
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversion Rate (30d)</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {kpis.conversionRate30d.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Submitted → Booked</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Secondary KPIs */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium text-gray-600">Approved This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.approvedThisMonthCount}</p>
              <p className="text-sm text-gray-500">{formatCurrency(kpis.approvedThisMonthValue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium text-gray-600">Booked This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.bookedThisMonthCount}</p>
              <p className="text-sm text-gray-500">{formatCurrency(kpis.bookedThisMonthValue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium text-gray-600">Declined This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.declinedThisMonthCount}</p>
            </div>
          </div>
        )}

        {/* Worklist Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">My Worklist</h2>
                <p className="text-sm text-gray-600 mt-1">Prioritized by urgency and SLA</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedFilter || ''}
                  onChange={e => setSelectedFilter(e.target.value || undefined)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="UNDERWRITING">Underwriting</option>
                  <option value="APPROVED">Approved</option>
                  <option value="APPROVED_PENDING_OFFER">Pending Offer</option>
                </select>
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product / Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aging
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blocker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {worklist.map(item => (
                  <tr key={item.applicationId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${item.slaBreachDays !== null && item.slaBreachDays > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {item.priorityScore}
                        </div>
                        {item.slaBreachDays !== null && item.slaBreachDays > 0 && (
                          <span className="ml-2 text-xs font-medium text-red-600">
                            SLA +{item.slaBreachDays}d
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                        {item.applicationNumber}
                      </div>
                      <div className="text-xs text-gray-500">{item.productCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.customerName}</div>
                      <div className="text-xs text-gray-500">{item.customerNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.productName}</div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(item.requestedAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{item.daysSinceSubmitted}d total</div>
                      <div className="text-xs">{item.daysInCurrentStage}d in stage</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.blockerReason.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-gray-500">
                        Docs: {item.documentsSubmittedCount}/{item.documentsRequiredCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        className={`px-3 py-1 text-xs font-medium text-white rounded ${getActionButtonColor(item.nextAction)}`}
                      >
                        {formatAction(item.nextAction)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {worklist.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
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
              <p className="mt-2">No applications in your worklist</p>
            </div>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Pipeline by Stage</h2>
            <p className="text-sm text-gray-600 mt-1">Application funnel and bottleneck analysis</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {pipeline.map(stage => (
                <div key={stage.stage} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">
                        {stage.stage.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Avg: {stage.avgDaysInStage.toFixed(1)}d | P90:{' '}
                        {stage.p90DaysInStage.toFixed(1)}d
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{stage.applicationCount}</p>
                      <p className="text-sm text-gray-600">{formatCurrency(stage.totalValue)}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 mt-2">
                    {stage.kycPendingCount > 0 && <span>KYC: {stage.kycPendingCount}</span>}
                    {stage.amlPendingCount > 0 && <span>AML: {stage.amlPendingCount}</span>}
                    {stage.docsPendingCount > 0 && <span>Docs: {stage.docsPendingCount}</span>}
                    {stage.creditCheckPendingCount > 0 && (
                      <span>Credit: {stage.creditCheckPendingCount}</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (stage.applicationCount / Math.max(...pipeline.map(p => p.applicationCount))) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
