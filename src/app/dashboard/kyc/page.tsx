'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  kycService,
  type KycDashboardStats,
  type KycCase,
  type PageResponse,
} from '@/services/api/kycService';

export default function KycDashboardPage() {
  const [stats, setStats] = useState<KycDashboardStats | null>(null);
  const [recentCases, setRecentCases] = useState<KycCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [statsData, casesData] = await Promise.all([
        kycService.getDashboardStats(),
        kycService.getCases({ page: 0, size: 10, sort: 'createdAt,desc' }),
      ]);
      setStats(statsData);
      setRecentCases(casesData.content);
    } catch (error) {
      console.error('Failed to load KYC dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading KYC Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">KYC/AML Dashboard</h1>
              <p className="text-sm text-gray-500">EU/Irish AML Compliance Management</p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-primary-600 font-medium"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Link
            href="/dashboard/kyc/cases/new"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New KYC Case
          </Link>
          <Link
            href="/dashboard/kyc/cases"
            className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            View All Cases
          </Link>
          <Link
            href="/dashboard/kyc/screening"
            className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Screening Queue
          </Link>
        </div>

        {/* Stats Grid */}
        {stats && (
          <>
            {/* Case Status Overview */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Pipeline</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <StatCard
                  label="Total Cases"
                  value={stats.totalCases}
                  color="bg-gray-100 text-gray-800"
                />
                <StatCard
                  label="Pending"
                  value={stats.pendingCases}
                  color="bg-yellow-100 text-yellow-800"
                />
                <StatCard
                  label="In Review"
                  value={stats.inReviewCases}
                  color="bg-blue-100 text-blue-800"
                />
                <StatCard
                  label="Pending Approval"
                  value={stats.pendingApprovalCases}
                  color="bg-purple-100 text-purple-800"
                />
                <StatCard
                  label="Approved"
                  value={stats.approvedCases}
                  color="bg-green-100 text-green-800"
                />
                <StatCard
                  label="Rejected"
                  value={stats.rejectedCases}
                  color="bg-red-100 text-red-800"
                />
                <StatCard
                  label="Escalated"
                  value={stats.escalatedCases}
                  color="bg-orange-100 text-orange-800"
                  alert={stats.escalatedCases > 0}
                />
                <StatCard
                  label="Overdue"
                  value={stats.overdueCases}
                  color="bg-red-100 text-red-800"
                  alert={stats.overdueCases > 0}
                />
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Low Risk"
                  value={stats.lowRiskCustomers}
                  color="bg-green-100 text-green-800"
                />
                <StatCard
                  label="Medium Risk"
                  value={stats.mediumRiskCustomers}
                  color="bg-yellow-100 text-yellow-800"
                />
                <StatCard
                  label="High Risk"
                  value={stats.highRiskCustomers}
                  color="bg-red-100 text-red-800"
                  alert={stats.highRiskCustomers > 0}
                />
                <StatCard
                  label="Prohibited"
                  value={stats.prohibitedCustomers}
                  color="bg-gray-900 text-white"
                  alert={stats.prohibitedCustomers > 0}
                />
              </div>
            </div>

            {/* Alerts & Actions Required */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions Required</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <AlertCard
                  label="Screening Reviews"
                  value={stats.pendingScreeningReviews}
                  icon="shield"
                  href="/dashboard/kyc/screening"
                />
                <AlertCard
                  label="Document Verifications"
                  value={stats.pendingDocumentVerifications}
                  icon="document"
                  href="/dashboard/kyc/documents"
                />
                <AlertCard
                  label="Expiring Documents"
                  value={stats.expiringDocuments}
                  icon="clock"
                  href="/dashboard/kyc/documents?filter=expiring"
                />
                <AlertCard
                  label="Expired Documents"
                  value={stats.expiredDocuments}
                  icon="exclamation"
                  href="/dashboard/kyc/documents?filter=expired"
                />
                <AlertCard
                  label="Periodic Reviews Due"
                  value={stats.casesForPeriodicReview}
                  icon="refresh"
                  href="/dashboard/kyc/cases?filter=review-due"
                />
              </div>
            </div>
          </>
        )}

        {/* Recent Cases */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Recent Cases</h2>
              <Link
                href="/dashboard/kyc/cases"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Case Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Segment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diligence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentCases.map(kycCase => (
                  <tr key={kycCase.caseId} className={kycCase.isOverdue ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/kyc/cases/${kycCase.caseId}`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {kycCase.caseReference}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {kycCase.partyDisplayName || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {formatSegment(kycCase.customerSegment)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {formatCaseType(kycCase.caseType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${kycService.getStatusColor(kycCase.status)}`}
                      >
                        {kycCase.statusDisplay}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {kycCase.riskTier ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${kycService.getRiskTierColor(kycCase.riskTier)}`}
                        >
                          {kycCase.riskTier.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not assessed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${kycService.getDiligenceColor(kycCase.requiredDiligence)}`}
                      >
                        {kycService.getDiligenceLabel(kycCase.requiredDiligence)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {kycCase.dueDate ? (
                        <span
                          className={`text-sm ${kycCase.isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}
                        >
                          {new Date(kycCase.dueDate).toLocaleDateString()}
                          {kycCase.isOverdue && ' (Overdue)'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No due date</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/dashboard/kyc/cases/${kycCase.caseId}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentCases.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No KYC cases found. Create your first case to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper Components
function StatCard({
  label,
  value,
  color,
  alert,
}: {
  label: string;
  value: number;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${alert ? 'ring-2 ring-red-500' : ''}`}>
      <div className={`text-2xl font-bold ${color.includes('bg-') ? '' : color}`}>{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

function AlertCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    shield: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    document: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    clock: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    exclamation: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    refresh: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  };

  return (
    <Link href={href} className="block">
      <div
        className={`bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow ${value > 0 ? 'border-l-4 border-orange-500' : ''}`}
      >
        <div className="flex items-center">
          <div className={`${value > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            {iconMap[icon]}
          </div>
          <div className="ml-4">
            <div
              className={`text-2xl font-bold ${value > 0 ? 'text-orange-600' : 'text-gray-600'}`}
            >
              {value}
            </div>
            <div className="text-sm text-gray-600">{label}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Formatters
function formatSegment(segment: string): string {
  const map: Record<string, string> = {
    INDIVIDUAL: 'Individual',
    SOLE_TRADER: 'Sole Trader',
    COMPANY: 'Company',
    PARTNERSHIP: 'Partnership',
    TRUST: 'Trust',
    CHARITY: 'Charity',
    CLUB_ASSOCIATION: 'Club/Association',
  };
  return map[segment] || segment;
}

function formatCaseType(type: string): string {
  const map: Record<string, string> = {
    ONBOARDING: 'Onboarding',
    PERIODIC_REVIEW: 'Periodic Review',
    EVENT_DRIVEN: 'Event Driven',
    REMEDIATION: 'Remediation',
  };
  return map[type] || type;
}
