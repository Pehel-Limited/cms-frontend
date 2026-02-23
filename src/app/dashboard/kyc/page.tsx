'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  kycService,
  type KycDashboardStats,
  type KycCase,
  type PageResponse,
} from '@/services/api/kycService';

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  IN_REVIEW: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  PENDING_APPROVAL: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  ESCALATED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  CLOSED: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const RISK_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  VERY_HIGH: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  PROHIBITED: { bg: 'bg-slate-800', text: 'text-white', dot: 'bg-white' },
};

const DILIGENCE_BADGE: Record<string, { bg: string; text: string }> = {
  SDD: { bg: 'bg-sky-50', text: 'text-sky-700' },
  CDD: { bg: 'bg-blue-50', text: 'text-blue-700' },
  EDD: { bg: 'bg-violet-50', text: 'text-violet-700' },
};

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
      <div className="min-h-[calc(100vh-4rem)] bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading KYC Dashboard...</p>
        </div>
      </div>
    );
  }

  const pipelineCards = stats
    ? [
        {
          label: 'Total',
          value: stats.totalCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
          ),
          color: 'text-slate-900',
        },
        {
          label: 'Pending',
          value: stats.pendingCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mx-auto">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          ),
          color: 'text-amber-600',
        },
        {
          label: 'In Review',
          value: stats.inReviewCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          ),
          color: 'text-blue-600',
        },
        {
          label: 'Approval',
          value: stats.pendingApprovalCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-violet-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
          ),
          color: 'text-violet-600',
        },
        {
          label: 'Approved',
          value: stats.approvedCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          ),
          color: 'text-emerald-600',
        },
        {
          label: 'Rejected',
          value: stats.rejectedCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-red-600"
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
          ),
          color: 'text-red-600',
        },
        {
          label: 'Escalated',
          value: stats.escalatedCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-orange-600"
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
          ),
          color: 'text-orange-600',
          alert: stats.escalatedCases > 0,
        },
        {
          label: 'Overdue',
          value: stats.overdueCases,
          icon: (
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto">
              <svg
                className="w-4 h-4 text-red-600"
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
          ),
          color: 'text-red-600',
          alert: stats.overdueCases > 0,
        },
      ]
    : [];

  const riskCards = stats
    ? [
        { label: 'Low Risk', value: stats.lowRiskCustomers, bg: 'from-emerald-500 to-green-600' },
        {
          label: 'Medium Risk',
          value: stats.mediumRiskCustomers,
          bg: 'from-amber-500 to-yellow-600',
        },
        {
          label: 'High Risk',
          value: stats.highRiskCustomers,
          bg: 'from-red-500 to-rose-600',
          alert: stats.highRiskCustomers > 0,
        },
        {
          label: 'Prohibited',
          value: stats.prohibitedCustomers,
          bg: 'from-slate-700 to-slate-900',
          alert: stats.prohibitedCustomers > 0,
        },
      ]
    : [];

  const actionCards = stats
    ? [
        {
          label: 'Screening Reviews',
          value: stats.pendingScreeningReviews,
          href: '/dashboard/kyc/screening',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          ),
        },
        {
          label: 'Doc Verifications',
          value: stats.pendingDocumentVerifications,
          href: '/dashboard/kyc/documents',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ),
        },
        {
          label: 'Expiring Docs',
          value: stats.expiringDocuments,
          href: '/dashboard/kyc/documents?filter=expiring',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        },
        {
          label: 'Expired Docs',
          value: stats.expiredDocuments,
          href: '/dashboard/kyc/documents?filter=expired',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ),
        },
        {
          label: 'Periodic Reviews',
          value: stats.casesForPeriodicReview,
          href: '/dashboard/kyc/cases?filter=review-due',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          ),
        },
      ]
    : [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ──── Gradient header banner ──── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a3a7a] via-[#1e4da0] to-[#3b82f6]">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 w-56 h-56 bg-blue-400/10 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-100"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
        </svg>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-14">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">KYC / AML Dashboard</h1>
              <p className="text-blue-200 text-sm mt-1">EU/Irish AML Compliance Management</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/kyc/cases"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-sm text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                All Cases
              </Link>
              <Link
                href="/dashboard/kyc/screening"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-sm text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Screening
              </Link>
              <Link
                href="/dashboard/kyc/cases/new"
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
                New Case
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 space-y-5">
        {stats && (
          <>
            {/* ──── Case Pipeline strip ──── */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Case Pipeline
              </h2>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {pipelineCards.map(c => (
                  <div
                    key={c.label}
                    className={`flex-none min-w-[120px] bg-white/90 backdrop-blur-md rounded-2xl border shadow-sm px-4 py-3 text-center ${c.alert ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200/80'}`}
                  >
                    {c.icon}
                    <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                      {c.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ──── Risk Distribution ──── */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Risk Distribution
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {riskCards.map(r => (
                  <div
                    key={r.label}
                    className={`relative overflow-hidden rounded-2xl p-4 ${r.alert ? 'ring-2 ring-red-400/50' : ''}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${r.bg} opacity-90`} />
                    <div className="relative">
                      <p className="text-3xl font-bold text-white">{r.value}</p>
                      <p className="text-sm text-white/80 font-medium mt-0.5">{r.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ──── Actions Required ──── */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Actions Required
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {actionCards.map(a => (
                  <Link key={a.label} href={a.href}>
                    <div
                      className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all group ${a.value > 0 ? 'border-l-4 border-l-orange-400 border-t-slate-200/80 border-r-slate-200/80 border-b-slate-200/80' : 'border-slate-200/80'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`${a.value > 0 ? 'text-orange-500' : 'text-slate-400'} group-hover:scale-110 transition-transform`}
                        >
                          {a.icon}
                        </div>
                        <div>
                          <p
                            className={`text-xl font-bold ${a.value > 0 ? 'text-orange-600' : 'text-slate-500'}`}
                          >
                            {a.value}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">{a.label}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ──── Recent Cases table ──── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Cases</h2>
            <Link
              href="/dashboard/kyc/cases"
              className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors"
            >
              View All &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Case Ref
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Segment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Diligence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentCases.map(kycCase => {
                  const sb = STATUS_BADGE[kycCase.status] || {
                    bg: 'bg-slate-50',
                    text: 'text-slate-600',
                    dot: 'bg-slate-400',
                  };
                  const riskKey = kycCase.riskTier?.replace(' ', '_') || '';
                  const rb = RISK_BADGE[riskKey] || null;
                  const dd = kycCase.requiredDiligence
                    ? DILIGENCE_BADGE[kycCase.requiredDiligence] || {
                        bg: 'bg-slate-50',
                        text: 'text-slate-600',
                      }
                    : null;

                  return (
                    <tr
                      key={kycCase.caseId}
                      className={`hover:bg-blue-50/40 transition-colors group cursor-pointer ${kycCase.isOverdue ? 'bg-red-50/40' : ''}`}
                      onClick={() => {
                        window.location.href = `/dashboard/kyc/cases/${kycCase.caseId}`;
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-800 transition-colors">
                          {kycCase.caseReference}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-slate-900">
                          {kycCase.partyDisplayName || 'Unknown'}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-slate-600">
                          {formatSegment(kycCase.customerSegment)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-slate-600">{formatCaseType(kycCase.caseType)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sb.bg} ${sb.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sb.dot}`} />
                          {kycCase.statusDisplay}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {rb ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${rb.bg} ${rb.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${rb.dot}`} />
                            {kycCase.riskTier?.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not assessed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {dd ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${dd.bg} ${dd.text}`}
                          >
                            {kycService.getDiligenceLabel(kycCase.requiredDiligence)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {kycCase.dueDate ? (
                          <span
                            className={`text-sm ${kycCase.isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}
                          >
                            {new Date(kycCase.dueDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {kycCase.isOverdue && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                                OVERDUE
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No due date</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            window.location.href = `/dashboard/kyc/cases/${kycCase.caseId}`;
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
                {recentCases.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
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
                            strokeWidth={1.8}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-slate-900 font-semibold">No KYC cases found</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Create your first case to get started.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
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
