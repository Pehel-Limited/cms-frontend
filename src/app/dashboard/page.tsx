'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dashboardService,
  DashboardKpis,
  WorklistItem,
  PipelineStage,
} from '@/services/api/dashboard-service';
import config from '@/config';

export default function DashboardPage() {
  const router = useRouter();
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
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

            <div
              onClick={() => router.push('/dashboard/applications')}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500 cursor-pointer hover:shadow-lg transition-shadow"
            >
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
                  <option value="DOCUMENTS_PENDING">Documents Pending</option>
                  <option value="DOCUMENTS_RECEIVED">Documents Received</option>
                  <option value="CREDIT_CHECK_INITIATED">Credit Check Initiated</option>
                  <option value="REFERRED_TO_UNDERWRITER">Referred to Underwriter</option>
                  <option value="UNDER_UNDERWRITING">Under Underwriting</option>
                  <option value="UNDERWRITING_APPROVED">Underwriting Approved</option>
                  <option value="APPROVED">Approved</option>
                  <option value="CONDITIONALLY_APPROVED">Conditionally Approved</option>
                  <option value="OFFER_GENERATED">Offer Generated</option>
                  <option value="PENDING_ESIGN">Pending E-Sign</option>
                  <option value="AWAITING_BOOKING">Awaiting Booking</option>
                  <option value="BOOKED">Booked</option>
                  <option value="DECLINED">Declined</option>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {worklist.map(item => (
                  <tr key={item.applicationId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/dashboard/applications/${item.applicationId}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                        >
                          {item.applicationNumber}
                        </a>
                        {item.createdByMe ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            My App
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Assigned
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{item.productCode}</div>
                      {item.slaBreachDays !== null && item.slaBreachDays > 0 && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            SLA Breach: +{item.slaBreachDays}d
                          </span>
                        </div>
                      )}
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
      </div>
    </div>
  );
}
