'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
import config from '@/config';

const APPLICATION_STATUSES = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'DOCUMENTS_PENDING',
  'CREDIT_CHECK',
  'UNDERWRITING',
  'MANAGER_APPROVAL',
  'APPROVED',
  'REJECTED',
];

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
  SUBMITTED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  UNDER_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  DOCUMENTS_PENDING: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  CREDIT_CHECK: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  UNDERWRITING: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  MANAGER_APPROVAL: { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  CONDITIONALLY_APPROVED: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
};

const getStatusStyle = (status: string) =>
  STATUS_STYLE[status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };

// Helper to check if user is a reviewer (Credit Analyst, Credit Officer, Underwriter)
const isReviewerRole = (roles: (string | { roleType?: string })[] | undefined): boolean => {
  if (!roles) return false;
  const reviewerRoles = ['CREDIT_ANALYST', 'CREDIT_OFFICER', 'UNDERWRITER', 'RISK_MANAGER'];
  return roles.some(role => {
    const roleType = typeof role === 'string' ? role : role.roleType;
    return roleType && reviewerRoles.includes(roleType.toUpperCase());
  });
};

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppSelector(state => state.auth);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isReviewer, setIsReviewer] = useState(false);
  const [filterCustomerId, setFilterCustomerId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

  // Check for customerId in URL params
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    setFilterCustomerId(customerId);
  }, [searchParams]);

  // Get bankId from user object or localStorage fallback
  const getBankId = (): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  };

  const bankId = getBankId();

  useEffect(() => {
    const userIsReviewer = isReviewerRole(user?.roles);
    setIsReviewer(userIsReviewer);
    fetchApplications(userIsReviewer);
  }, [user, selectedStatus, searchTerm, currentPage, filterCustomerId]);

  const fetchApplications = async (userIsReviewer?: boolean) => {
    if (typeof window !== 'undefined' && user?.userId) {
      localStorage.setItem('userId', user.userId);
    }
    const isReviewerUser =
      userIsReviewer !== undefined ? userIsReviewer : isReviewerRole(user?.roles);

    try {
      setLoading(true);
      setError(null);

      let response;

      if (filterCustomerId) {
        response = await applicationService.getApplicationsByCustomer(
          filterCustomerId,
          currentPage,
          20
        );
        console.log('Fetched applications for customer:', filterCustomerId, response);
      } else if (isReviewerUser) {
        response = await applicationService.getMyAssignedApplications({
          page: currentPage,
          size: 20,
        });
        console.log('Fetched assigned applications for reviewer:', response);
      } else if (bankId) {
        response = await applicationService.getApplications({
          bankId,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchTerm || undefined,
          page: currentPage,
          size: 20,
          sort: 'createdAt,desc',
        });
      } else {
        response = await applicationService.getMyCreatedApplications(currentPage, 20);
      }

      setApplications(response.content);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(0);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(0);
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const onSort = (field: string) => {
    setSortConfig(handleSortToggle(field, sortConfig));
  };

  const sortedApplications = sortData(applications, sortConfig);

  const pageTitle = filterCustomerId
    ? 'Customer Applications'
    : isReviewer
      ? 'Applications for Review'
      : 'Loan Applications';

  const pageSubtitle = filterCustomerId ? 'for this customer' : isReviewer ? 'assigned to you' : '';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ──── Page header with gradient banner ──── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a3a7a] via-[#1e4da0] to-[#3b82f6]">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 w-56 h-56 bg-blue-400/10 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-100"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
        </svg>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-14">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{pageTitle}</h1>
              <p className="text-blue-200 text-sm mt-1">
                {totalElements} application{totalElements !== 1 ? 's' : ''} {pageSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {filterCustomerId && (
                <button
                  onClick={() => router.push('/dashboard/applications')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-sm text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Clear Filter
                </button>
              )}
              {!isReviewer && !filterCustomerId && (
                <button
                  onClick={() => router.push('/dashboard/applications/new')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  New Application
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 space-y-4">
        {/* ──── Search & Filters card ──── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          {/* Search input */}
          <div className="relative mb-4">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
            <input
              type="text"
              placeholder="Search by application number..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2">
            {APPLICATION_STATUSES.map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* ──── Error ──── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
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
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* ──── Loading ──── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Loading applications...</p>
            </div>
          </div>
        )}

        {/* ──── Applications table ──── */}
        {!loading && applications.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <SortableHeader
                      label="Application"
                      field="applicationNumber"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Customer"
                      field="customer.firstName"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Amount"
                      field="requestedAmount"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Submitted"
                      field="submittedAt"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedApplications.map(app => {
                    const s = getStatusStyle(app.status);
                    return (
                      <tr
                        key={app.applicationId}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/dashboard/applications/${app.applicationId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {app.applicationNumber || 'Pending'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {app.loanPurpose.replace(/_/g, ' ')}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-slate-900">
                            {app.customer?.firstName} {app.customer?.lastName}
                          </p>
                          {app.customer?.businessName && (
                            <p className="text-xs text-slate-500">{app.customer.businessName}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            {app.customer?.customerNumber || app.customerId.substring(0, 8)}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatCurrency(app.requestedAmount)}
                          </p>
                          <p className="text-xs text-slate-400">{app.requestedTermMonths} months</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {app.status.replace(/_/g, ' ')}
                          </span>
                          {app.slaBreached && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                              SLA
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-slate-600">{formatDate(app.submittedAt)}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              router.push(`/dashboard/applications/${app.applicationId}`);
                            }}
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors group/btn"
                          >
                            <span className="group-hover/btn:underline">View</span>
                            <svg
                              className="w-3.5 h-3.5 opacity-0 group-hover/btn:opacity-100 transition-opacity"
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page <span className="font-semibold text-slate-700">{currentPage + 1}</span> of{' '}
                  <span className="font-semibold text-slate-700">{totalPages}</span>
                  <span className="ml-2 text-slate-400">({totalElements} total)</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                        currentPage === i
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──── Empty state ──── */}
        {!loading && applications.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm py-20 text-center">
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
                  strokeWidth={1.8}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold text-lg">No applications found</p>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              {searchTerm || selectedStatus !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Get started by creating a new application'}
            </p>
            {!searchTerm && selectedStatus === 'ALL' && (
              <button
                onClick={() => router.push('/dashboard/applications/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Application
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
