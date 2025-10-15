'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/store';
import { loadStoredAuth } from '@/store/slices/authSlice';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const [stats, setStats] = useState({
    myApplications: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    totalCustomers: 0,
    activeLoans: 0,
  });
  const [recentApplications, setRecentApplications] = useState<ApplicationResponse[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      dispatch(loadStoredAuth());
    }
  }, [dispatch, isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.bankId) return;

      try {
        setLoadingStats(true);

        // Fetch stats
        const dashboardStats = await applicationService.getDashboardStats(user.bankId);

        // Fetch recent applications (assigned to me)
        const recentAppsResponse = await applicationService.getMyAssignedApplications({
          page: 0,
          size: 5,
        });

        setStats({
          myApplications: dashboardStats.myApplications,
          pendingReview: dashboardStats.pendingReview,
          approved: dashboardStats.approved,
          rejected: dashboardStats.rejected,
          totalCustomers: 0, // TODO: Implement when customer service is ready
          activeLoans: dashboardStats.approved, // Using approved as proxy for now
        });

        setRecentApplications(recentAppsResponse.content);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    if (isAuthenticated && user) {
      fetchDashboardData();
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-primary-600">CMS Banking</h1>
              <nav className="hidden md:flex space-x-6">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-900 hover:text-primary-600"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/applications"
                  className="text-sm font-medium text-gray-600 hover:text-primary-600"
                >
                  Applications
                </Link>
                <Link
                  href="/dashboard/customers"
                  className="text-sm font-medium text-gray-600 hover:text-primary-600"
                >
                  Customers
                </Link>
                <Link
                  href="/dashboard/products"
                  className="text-sm font-medium text-gray-600 hover:text-primary-600"
                >
                  Products
                </Link>
                {user.userType === 'BANK_USER' && (
                  <Link
                    href="/dashboard/admin/pending-users"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600"
                  >
                    Admin
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome,{' '}
                <span className="font-semibold">
                  {user.firstName} {user.lastName}
                </span>
              </span>
              <span className="text-xs text-primary-700 bg-primary-50 px-2.5 py-1 rounded-full font-medium">
                {user.userType === 'BANK_USER' ? 'Relationship Manager' : user.userType}
              </span>
              <button
                onClick={() => {
                  localStorage.clear();
                  router.push('/login');
                }}
                className="text-sm text-gray-600 hover:text-red-600 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.firstName}! 👋
          </h2>
          <p className="text-gray-600">
            Here&apos;s an overview of your portfolio and pending tasks
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* My Applications */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
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
              <span className="text-3xl font-bold text-gray-900">{stats.myApplications}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">My Applications</h3>
            <p className="text-xs text-gray-500">Total applications managed</p>
          </div>

          {/* Pending Review */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-3xl font-bold text-yellow-600">{stats.pendingReview}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Review</h3>
            <p className="text-xs text-gray-500">Awaiting action</p>
          </div>

          {/* Approved */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
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
              <span className="text-3xl font-bold text-green-600">{stats.approved}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Approved</h3>
            <p className="text-xs text-gray-500">This month</p>
          </div>

          {/* Total Customers */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.totalCustomers}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Customers</h3>
            <p className="text-xs text-gray-500">In your portfolio</p>
          </div>

          {/* Active Loans */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.activeLoans}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Active Loans</h3>
            <p className="text-xs text-gray-500">Currently disbursed</p>
          </div>

          {/* Rejected */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.rejected}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Rejected</h3>
            <p className="text-xs text-gray-500">This month</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/dashboard/applications/new"
              className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-lg">New Application</h4>
                  <p className="text-sm text-primary-100">Create loan application</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/customers/new"
              className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-lg">Add Customer</h4>
                  <p className="text-sm text-purple-100">Register new customer</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/customers"
              className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-lg">Search Customer</h4>
                  <p className="text-sm text-indigo-100">Find customer profile</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/products"
              className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-lg">View Products</h4>
                  <p className="text-sm text-green-100">Browse loan products</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity & Pending Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Applications */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Applications</h3>
              <Link
                href="/dashboard/applications"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All →
              </Link>
            </div>
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : recentApplications.length > 0 ? (
              <div className="space-y-3">
                {recentApplications.map(app => (
                  <Link
                    key={app.applicationId}
                    href={`/dashboard/applications/${app.applicationId}`}
                    className="flex items-center justify-between py-3 border-b border-gray-100 hover:bg-gray-50 -mx-3 px-3 rounded transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {app.customer?.firstName}{' '}
                        {app.customer?.lastName || app.customer?.businessName} -{' '}
                        {app.product?.productName || 'Loan'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(app.requestedAmount)} • {formatDate(app.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(app.status)}`}
                    >
                      {formatStatus(app.status)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
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
                <p className="mt-2 text-sm text-gray-600">No recent applications</p>
                <Link
                  href="/dashboard/applications/new"
                  className="mt-3 inline-block text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create your first application →
                </Link>
              </div>
            )}
          </div>

          {/* Pending Tasks */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Tasks</h3>
            <div className="space-y-3">
              {stats.pendingReview > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <svg
                    className="w-5 h-5 text-yellow-600 mt-0.5"
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
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {stats.pendingReview} applications pending review
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Action required</p>
                  </div>
                </div>
              )}
              {stats.myApplications > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <svg
                    className="w-5 h-5 text-blue-600 mt-0.5"
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
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {stats.myApplications} applications assigned to you
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Review and process</p>
                  </div>
                </div>
              )}
              {stats.approved > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <svg
                    className="w-5 h-5 text-green-600 mt-0.5"
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
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {stats.approved} loans approved
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Ready for disbursement</p>
                  </div>
                </div>
              )}
              {stats.pendingReview === 0 && stats.myApplications === 0 && stats.approved === 0 && (
                <div className="text-center py-8">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">All caught up!</p>
                  <p className="text-xs text-gray-500 mt-1">No pending tasks at the moment</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
