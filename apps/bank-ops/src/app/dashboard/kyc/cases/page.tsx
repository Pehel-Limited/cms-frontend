'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  kycService,
  type KycCase,
  type PageResponse,
  type KycCaseStatus,
} from '@/services/api/kycService';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_DOCUMENTS', label: 'Pending Documents' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'PENDING_SCREENING', label: 'Pending Screening' },
  { value: 'PENDING_RISK', label: 'Pending Risk' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Segments' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'SOLE_TRADER', label: 'Sole Trader' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'CLUB_ASSOCIATION', label: 'Club/Association' },
];

export default function KycCasesPage() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const [cases, setCases] = useState<KycCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Handle special filters from URL
    if (filterParam === 'review-due') {
      // Would need a specific endpoint for this
    } else if (filterParam === 'overdue') {
      // Would need a specific endpoint for this
    }
    loadCases();
  }, [page, statusFilter]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const response = await kycService.getCases({
        status: statusFilter || undefined,
        page,
        size: 20,
        sort: 'createdAt,desc',
      });
      setCases(response.content);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
    } catch (error) {
      console.error('Failed to load KYC cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter(kycCase => {
    // Apply segment filter
    if (segmentFilter && kycCase.customerSegment !== segmentFilter) {
      return false;
    }
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesRef = kycCase.caseReference.toLowerCase().includes(term);
      const matchesName = kycCase.partyDisplayName?.toLowerCase().includes(term);
      return matchesRef || matchesName;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">KYC Cases</h1>
              <p className="text-sm text-gray-500">{totalElements} total cases</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/kyc"
                className="text-sm text-gray-600 hover:text-primary-600 font-medium"
              >
                Back to KYC Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by reference or name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Segment Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Segment
              </label>
              <select
                value={segmentFilter}
                onChange={e => setSegmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {SEGMENT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* New Case Button */}
            <div className="flex items-end">
              <Link
                href="/dashboard/kyc/cases/new"
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Case
              </Link>
            </div>
          </div>
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading cases...</p>
            </div>
          ) : (
            <>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCases.map(kycCase => (
                      <tr
                        key={kycCase.caseId}
                        className={kycCase.isOverdue ? 'bg-red-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/kyc/cases/${kycCase.caseId}`}
                            className="text-primary-600 hover:text-primary-700 font-medium"
                          >
                            {kycCase.caseReference}
                          </Link>
                          {kycCase.requiresSeniorApproval && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Senior Approval
                            </span>
                          )}
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
                            <div className="flex items-center">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${kycService.getRiskTierColor(kycCase.riskTier)}`}
                              >
                                {kycCase.riskTier.replace('_', ' ')}
                              </span>
                              {kycCase.riskScore !== undefined && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({kycCase.riskScore})
                                </span>
                              )}
                            </div>
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
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {new Date(kycCase.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/dashboard/kyc/cases/${kycCase.caseId}`}
                              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                            >
                              View
                            </Link>
                            {kycCase.status === 'UNDER_REVIEW' && (
                              <button
                                onClick={() => handleQuickAction(kycCase.caseId, 'approve')}
                                className="text-green-600 hover:text-green-700 text-sm font-medium"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCases.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                          No cases found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {page * 20 + 1} to {Math.min((page + 1) * 20, totalElements)} of{' '}
                    {totalElements} cases
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-600">
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// Quick action handler
async function handleQuickAction(caseId: string, action: string) {
  try {
    if (action === 'approve') {
      await kycService.approveCase(caseId);
      window.location.reload();
    }
  } catch (error) {
    console.error(`Failed to ${action} case:`, error);
    alert(`Failed to ${action} case`);
  }
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
