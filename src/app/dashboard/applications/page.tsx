'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  DOCUMENTS_PENDING: 'bg-orange-100 text-orange-800',
  CREDIT_CHECK: 'bg-purple-100 text-purple-800',
  UNDERWRITING: 'bg-indigo-100 text-indigo-800',
  MANAGER_APPROVAL: 'bg-pink-100 text-pink-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CONDITIONALLY_APPROVED: 'bg-teal-100 text-teal-800',
};

// Helper to check if user is a reviewer (Credit Analyst, Credit Officer, Underwriter)
const isReviewerRole = (roles: string[] | undefined): boolean => {
  if (!roles) return false;
  const reviewerRoles = ['CREDIT_ANALYST', 'CREDIT_OFFICER', 'UNDERWRITER', 'RISK_MANAGER'];
  return roles.some(role => reviewerRoles.includes(role));
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

  // Check for customerId in URL params
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    setFilterCustomerId(customerId);
  }, [searchParams]);

  // Get bankId from user object or localStorage fallback
  const getBankId = (): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      // Try to get from stored user data
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || '';
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    }
    return '';
  };

  const bankId = getBankId();

  useEffect(() => {
    // Check if user is a reviewer
    const userIsReviewer = isReviewerRole(user?.roles);
    setIsReviewer(userIsReviewer);
    fetchApplications(userIsReviewer);
  }, [user, selectedStatus, searchTerm, currentPage, filterCustomerId]);

  const fetchApplications = async (userIsReviewer?: boolean) => {
    // Ensure userId is set for X-User-Id header
    if (typeof window !== 'undefined' && user?.userId) {
      localStorage.setItem('userId', user.userId);
    }

    // Use the passed value or check from state
    const isReviewerUser =
      userIsReviewer !== undefined ? userIsReviewer : isReviewerRole(user?.roles);

    try {
      setLoading(true);
      setError(null);

      let response;

      // If filtering by customerId, use that endpoint
      if (filterCustomerId) {
        response = await applicationService.getApplicationsByCustomer(
          filterCustomerId,
          currentPage,
          20
        );
        console.log('Fetched applications for customer:', filterCustomerId, response);
      } else if (isReviewerUser) {
        // For reviewers, fetch assigned applications
        response = await applicationService.getMyAssignedApplications({
          page: currentPage,
          size: 20,
        });
        console.log('Fetched assigned applications for reviewer:', response);
      } else if (bankId) {
        // For other users with bankId, fetch all applications for bank
        response = await applicationService.getApplications({
          bankId,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchTerm || undefined,
          page: currentPage,
          size: 20,
          sort: 'createdAt,desc',
        });
      } else {
        // Fallback to user's own applications
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
    setCurrentPage(0); // Reset to first page
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(0); // Reset to first page
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {filterCustomerId
              ? 'Customer Applications'
              : isReviewer
                ? 'Applications for Review'
                : 'Loan Applications'}
          </h1>
          <p className="text-gray-600 mt-1">
            {totalElements} application{totalElements !== 1 ? 's' : ''}
            {filterCustomerId ? ' for this customer' : isReviewer ? ' assigned to you' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          {filterCustomerId && (
            <button
              onClick={() => router.push('/dashboard/applications')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ← Clear Filter
            </button>
          )}
          {!isReviewer && !filterCustomerId && (
            <button
              onClick={() => router.push('/dashboard/applications/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              + New Application
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by application number..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {APPLICATION_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading applications...</p>
        </div>
      )}

      {/* Applications Table */}
      {!loading && applications.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Application
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applications.map(app => (
                <tr key={app.applicationId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {app.applicationNumber || 'Pending'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {app.loanPurpose.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {app.customer?.firstName} {app.customer?.lastName}
                      {app.customer?.businessName && <div>{app.customer.businessName}</div>}
                    </div>
                    <div className="text-sm text-gray-500">
                      {app.customer?.customerNumber || app.customerId.substring(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(app.requestedAmount)}
                    </div>
                    <div className="text-sm text-gray-500">{app.requestedTermMonths} months</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {app.status.replace(/_/g, ' ')}
                    </span>
                    {app.slaBreached && <span className="ml-2 text-red-600 text-xs">⚠ SLA</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(app.submittedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => router.push(`/dashboard/applications/${app.applicationId}`)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{currentPage + 1}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === i
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && applications.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || selectedStatus !== 'ALL'
              ? 'Try adjusting your filters'
              : 'Get started by creating a new application'}
          </p>
          {!searchTerm && selectedStatus === 'ALL' && (
            <div className="mt-6">
              <button
                onClick={() => router.push('/dashboard/applications/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                + Create Application
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
