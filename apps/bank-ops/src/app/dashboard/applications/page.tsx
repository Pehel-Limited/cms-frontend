'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import {
  dashboardService,
  type DashboardKpis,
  type PipelineStage,
  type WorklistItem,
} from '@/services/api/dashboard-service';
import config from '@/config';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';

const APPLICATION_STATUSES = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'PENDING_KYC',
  'PENDING_DOCUMENTS',
  'PENDING_CREDIT_CHECK',
  'IN_UNDERWRITING',
  'PENDING_DECISION',
  'APPROVED',
  'DECLINED',
];

/* Status → accent colour (works in both light & dark via rgba tint) */
const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#94a3b8',
  SUBMITTED: '#3b82f6',
  PENDING_KYC: '#f59e0b',
  KYC_APPROVED: '#14b8a6',
  KYC_REJECTED: '#ef4444',
  PENDING_DOCUMENTS: '#f97316',
  DOCUMENTS_RECEIVED: '#14b8a6',
  PENDING_CREDIT_CHECK: '#8b5cf6',
  CREDIT_APPROVED: '#10b981',
  CREDIT_DECLINED: '#ef4444',
  PENDING_UNDERWRITING: '#6366f1',
  IN_UNDERWRITING: '#6366f1',
  UNDERWRITING_APPROVED: '#10b981',
  UNDERWRITING_DECLINED: '#ef4444',
  REFERRED_TO_SENIOR: '#6366f1',
  REFERRED_TO_UNDERWRITER: '#6366f1',
  PENDING_DECISION: '#a855f7',
  APPROVED: '#10b981',
  DECLINED: '#ef4444',
  PENDING_CONDITIONS: '#f59e0b',
  CONDITIONS_MET: '#14b8a6',
  OFFER_GENERATED: '#06b6d4',
  OFFER_SENT: '#06b6d4',
  OFFER_ACCEPTED: '#10b981',
  OFFER_REJECTED: '#ef4444',
  OFFER_EXPIRED: '#94a3b8',
  PENDING_ESIGN: '#8b5cf6',
  ESIGN_IN_PROGRESS: '#8b5cf6',
  ESIGN_COMPLETED: '#10b981',
  PENDING_BOOKING: '#0ea5e9',
  BOOKING_IN_PROGRESS: '#0ea5e9',
  BOOKED: '#10b981',
  DISBURSED: '#10b981',
  RETURNED: '#f97316',
  CANCELLED: '#94a3b8',
  WITHDRAWN: '#94a3b8',
  EXPIRED: '#94a3b8',
  ACTIVE: '#10b981',
  CLOSED: '#94a3b8',
};
const getStatusColor = (s: string) => STATUS_COLOR[s] || '#94a3b8';

/* Next-action hint derived from status */
const NEXT_ACTION: Record<string, string> = {
  DRAFT: 'Complete & submit',
  SUBMITTED: 'Initial review',
  PENDING_KYC: 'Complete KYC review',
  PENDING_DOCUMENTS: 'Collect documents',
  PENDING_CREDIT_CHECK: 'Run credit check',
  PENDING_UNDERWRITING: 'Assign underwriter',
  IN_UNDERWRITING: 'Underwriting review',
  REFERRED_TO_UNDERWRITER: 'Underwriter review',
  PENDING_DECISION: 'Make decision',
  PENDING_CONDITIONS: 'Clear conditions',
  OFFER_GENERATED: 'Send offer',
  OFFER_SENT: 'Await acceptance',
  OFFER_ACCEPTED: 'Prepare e-sign',
  PENDING_ESIGN: 'Complete e-sign',
  ESIGN_COMPLETED: 'Book loan',
  PENDING_BOOKING: 'Book loan',
  APPROVED: 'Prepare offer',
  BOOKED: 'Monitor',
};
const nextActionFor = (app: ApplicationResponse) => NEXT_ACTION[app.status] || 'Review application';

/* Risk level from internal rating / risk score */
function riskLevel(app: ApplicationResponse): { label: string; color: string } {
  const r = (app.internalRiskRating || '').toUpperCase();
  if (r) {
    if (r.includes('LOW') || r === 'A' || r === 'EXCELLENT') return { label: 'Low', color: '#10b981' };
    if (r.includes('MEDIUM') || r === 'B' || r === 'FAIR') return { label: 'Medium', color: '#f59e0b' };
    if (r.includes('HIGH') || r === 'C' || r === 'POOR') return { label: 'High', color: '#ef4444' };
  }
  if (typeof app.riskScore === 'number') {
    if (app.riskScore >= 70) return { label: 'High', color: '#ef4444' };
    if (app.riskScore >= 40) return { label: 'Medium', color: '#f59e0b' };
    return { label: 'Low', color: '#10b981' };
  }
  return { label: '—', color: '#94a3b8' };
}

function compactCurrency(n: number): string {
  const sym = getCurrencySymbol();
  const a = Math.abs(n);
  if (a >= 1e9) return `${sym}${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sym}${(n / 1e3).toFixed(0)}K`;
  return formatCurrency(n);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return '';
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0ea5e9,#2563eb)',
  'linear-gradient(135deg,#8b5cf6,#6366f1)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#f97316)',
  'linear-gradient(135deg,#ec4899,#db2777)',
  'linear-gradient(135deg,#14b8a6,#0891b2)',
];
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

const isReviewerRole = (roles: (string | { roleType?: string })[] | undefined): boolean => {
  if (!roles) return false;
  const reviewerRoles = ['CREDIT_ANALYST', 'CREDIT_OFFICER', 'UNDERWRITER', 'RISK_MANAGER'];
  return roles.some(role => {
    const roleType = typeof role === 'string' ? role : role.roleType;
    return roleType && reviewerRoles.includes(roleType.toUpperCase());
  });
};

/* ------------------------------------------------------------------ */
/* KPI stat card                                                       */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, tint, icon }: { label: string; value: string; tint: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3.5" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: `${tint}1a`, color: tint }}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold leading-tight" style={{ color: 'var(--rm-text)' }}>{value}</p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
    </div>
  );
}

/* Small SVG icons */
const I = {
  folder: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>,
  warn: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  doc: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  docs: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
  check: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  book: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>,
  shield: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
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
  const filterCustomerId = searchParams.get('customerId');
  const [productFilter, setProductFilter] = useState('');
  const [rmFilter, setRmFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'amount' | 'sla'>('recent');

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedStatus, searchTerm, currentPage, filterCustomerId]);

  /* Aggregate stats (bank-wide) — only when not scoped to one customer */
  useEffect(() => {
    if (filterCustomerId || !bankId) return;
    dashboardService.getKpis(bankId).then(setKpis).catch(() => setKpis(null));
    dashboardService.getPipeline(bankId).then(setPipeline).catch(() => setPipeline([]));
    dashboardService.getWorklist(bankId, undefined, 50).then(setWorklist).catch(() => setWorklist([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId, filterCustomerId]);

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
        response = await applicationService.getApplicationsByCustomer(filterCustomerId, currentPage, 20);
      } else if (isReviewerUser) {
        response = await applicationService.getMyAssignedApplications({ page: currentPage, size: 20 });
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  /* Client-side product / RM filter options + filtering + sorting */
  const productOptions = useMemo(
    () => Array.from(new Set(applications.map(a => a.product?.productName).filter(Boolean) as string[])).sort(),
    [applications]
  );
  const rmOptions = useMemo(
    () =>
      Array.from(
        new Set(
          applications
            .map(a => (a.assignedToUser ? `${a.assignedToUser.firstName} ${a.assignedToUser.lastName}` : ''))
            .filter(Boolean)
        )
      ).sort(),
    [applications]
  );

  const displayed = useMemo(() => {
    let list = applications.filter(a => {
      if (productFilter && a.product?.productName !== productFilter) return false;
      if (rmFilter) {
        const name = a.assignedToUser ? `${a.assignedToUser.firstName} ${a.assignedToUser.lastName}` : '';
        if (name !== rmFilter) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return (b.requestedAmount || 0) - (a.requestedAmount || 0);
        case 'sla':
          return (b.daysInCurrentStatus || 0) - (a.daysInCurrentStatus || 0);
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return list;
  }, [applications, productFilter, rmFilter, sortBy]);

  /* KPI derivations from real dashboard data */
  const pipelineTotal = useMemo(() => pipeline.reduce((s, p) => s + p.applicationCount, 0), [pipeline]);
  const docsPending = useMemo(() => pipeline.reduce((s, p) => s + (p.docsPendingCount || 0), 0), [pipeline]);
  const underwritingCount = useMemo(
    () => pipeline.filter(p => (p.stage || '').toUpperCase().includes('UNDERWRIT')).reduce((s, p) => s + p.applicationCount, 0),
    [pipeline]
  );

  const kpiCards = [
    { label: 'All Applications', value: (totalElements || pipelineTotal).toLocaleString(), tint: '#0ea5e9', icon: I.folder },
    { label: 'Needs Action', value: (kpis?.needsActionCount ?? 0).toLocaleString(), tint: '#f59e0b', icon: I.warn },
    { label: 'In Progress', value: (kpis?.inProgressCount ?? 0).toLocaleString(), tint: '#3b82f6', icon: I.clock },
    { label: 'Underwriting', value: underwritingCount.toLocaleString(), tint: '#6366f1', icon: I.doc },
    { label: 'Docs Pending', value: docsPending.toLocaleString(), tint: '#f97316', icon: I.docs },
    { label: 'Approved (MTD)', value: (kpis?.approvedThisMonthCount ?? 0).toLocaleString(), tint: '#10b981', icon: I.check },
    { label: 'Booked (MTD)', value: (kpis?.bookedThisMonthCount ?? 0).toLocaleString(), tint: '#14b8a6', icon: I.book },
    { label: 'At Risk', value: (kpis?.stuckAtRiskCount ?? 0).toLocaleString(), tint: '#ef4444', icon: I.shield },
  ];

  /* Sidebar lists from worklist */
  const slaBreaches = useMemo(
    () =>
      worklist
        .filter(w => (w.slaBreachDays ?? 0) > 0)
        .sort((a, b) => (b.slaBreachDays ?? 0) - (a.slaBreachDays ?? 0))
        .slice(0, 3),
    [worklist]
  );
  const needsActionList = useMemo(
    () => [...worklist].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)).slice(0, 4),
    [worklist]
  );
  const recentlyUpdated = useMemo(
    () => [...worklist].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3),
    [worklist]
  );
  const atRiskPct = pipelineTotal ? ((kpis?.stuckAtRiskCount ?? 0) / pipelineTotal) * 100 : 0;

  const hasClientFilters = !!(productFilter || rmFilter);
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('ALL');
    setProductFilter('');
    setRmFilter('');
    setCurrentPage(0);
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    color: 'var(--rm-text)',
    border: '1px solid var(--rm-border)',
  };

  const pageTitle = filterCustomerId
    ? 'Customer Applications'
    : isReviewer
      ? 'Applications for Review'
      : 'Applications';
  const showAggregates = !filterCustomerId;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>{pageTitle}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
            Manage your application pipeline and take action on priority cases
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filterCustomerId && (
            <button onClick={() => router.push('/dashboard/applications')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Clear Filter
            </button>
          )}
          {!isReviewer && !filterCustomerId && (
            <button onClick={() => router.push('/dashboard/applications/new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#0ea5e9' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Application
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select value={selectedStatus} onChange={e => handleStatusChange(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
          {APPLICATION_STATUSES.map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {productOptions.length > 0 && (
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
            <option value="">All Products</option>
            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {rmOptions.length > 0 && (
          <select value={rmFilter} onChange={e => setRmFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
            <option value="">All RMs</option>
            {rmOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search applications..." value={searchTerm} onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle} />
        </div>
        {(searchTerm || selectedStatus !== 'ALL' || hasClientFilters) && (
          <button onClick={resetFilters} className="text-xs font-semibold px-2" style={{ color: 'var(--rm-accent)' }}>
            Reset
          </button>
        )}
      </div>

      {/* KPI stat cards */}
      {showAggregates && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {kpiCards.map(c => (
            <StatCard key={c.label} label={c.label} value={c.value} tint={c.tint} icon={c.icon} />
          ))}
        </div>
      )}

      {/* Main content + sidebar */}
      <div className={`grid grid-cols-1 gap-5 items-start ${showAggregates ? 'xl:grid-cols-[1fr_320px]' : ''}`}>
        {/* Left column */}
        <div className="space-y-4 min-w-0">
          {/* Error */}
          {error && (
            <div className="rounded-2xl px-5 py-4 flex items-center gap-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mx-auto mb-3" />
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>Loading applications...</p>
              </div>
            </div>
          )}

          {/* Table */}
          {!loading && displayed.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-2" style={{ borderBottom: '1px solid var(--rm-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  {totalElements} application{totalElements !== 1 ? 's' : ''}
                </span>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  Sort by
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none" style={selectStyle}>
                    <option value="recent">Most Recent</option>
                    <option value="amount">Amount</option>
                    <option value="sla">Days in Stage</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)', backgroundColor: 'rgba(148,163,184,0.06)' }}>
                      {['Customer / Company', 'Product', 'Amount', 'Stage', 'SLA / Age', 'Risk', 'Next Action', 'RM', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--rm-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(app => {
                      const color = getStatusColor(app.status);
                      const risk = riskLevel(app);
                      const custName = app.customer?.businessName
                        || `${app.customer?.firstName || ''} ${app.customer?.lastName || ''}`.trim()
                        || 'Unknown';
                      const rmName = app.assignedToUser ? `${app.assignedToUser.firstName} ${app.assignedToUser.lastName}` : '';
                      const days = app.daysInCurrentStatus;
                      return (
                        <tr key={app.applicationId} className="transition-colors hover:bg-white/[0.03] cursor-pointer" style={{ borderBottom: '1px solid var(--rm-border)' }}
                          onClick={() => router.push(`/dashboard/applications/${app.applicationId}`)}>
                          {/* Customer / Company */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: avatarGradient(custName) }}>
                                {custName.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{custName}</p>
                                <p className="text-[10px] font-mono truncate" style={{ color: 'var(--rm-text-muted)' }}>{app.applicationNumber || 'Pending'}</p>
                              </div>
                            </div>
                          </td>
                          {/* Product */}
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-medium" style={{ color: 'var(--rm-text-secondary)' }}>{app.product?.productName || app.loanPurpose?.replace(/_/g, ' ') || '—'}</p>
                          </td>
                          {/* Amount */}
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>{app.requestedAmount ? compactCurrency(app.requestedAmount) : '—'}</p>
                            <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>{app.requestedTermMonths} mo</p>
                          </td>
                          {/* Stage */}
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${color}22`, color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {app.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          {/* SLA / Age */}
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-semibold" style={{ color: 'var(--rm-text)' }}>{typeof days === 'number' ? `${days}d` : '—'}</p>
                            <p className="text-[10px] font-semibold" style={{ color: app.slaBreached ? '#ef4444' : 'var(--rm-text-muted)' }}>
                              {app.slaBreached ? 'Overdue' : 'On track'}
                            </p>
                          </td>
                          {/* Risk */}
                          <td className="px-5 py-3.5">
                            {typeof app.creditScoreAtApplication === 'number' && (
                              <p className="text-sm font-bold" style={{ color: 'var(--rm-text)' }}>{app.creditScoreAtApplication}</p>
                            )}
                            <span className="text-[11px] font-semibold" style={{ color: risk.color }}>{risk.label}</span>
                          </td>
                          {/* Next Action */}
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}>
                              {nextActionFor(app)}
                            </span>
                          </td>
                          {/* RM */}
                          <td className="px-5 py-3.5">
                            {rmName ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: avatarGradient(rmName) }}>
                                  {rmName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs truncate" style={{ color: 'var(--rm-text-secondary)' }}>{rmName}</span>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>Unassigned</span>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <svg className="h-4 w-4 inline" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderTop: '1px solid var(--rm-border)' }}>
                <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  Showing {displayed.length} of {totalElements} applications
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}
                      className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: 'var(--rm-text-muted)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                      <button key={i} onClick={() => setCurrentPage(i)}
                        className="min-w-[34px] h-8 rounded-lg text-sm font-medium transition-all"
                        style={currentPage === i
                          ? { backgroundColor: '#0ea5e9', color: '#fff' }
                          : { color: 'var(--rm-text-secondary)' }}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage === totalPages - 1}
                      className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: 'var(--rm-text-muted)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && displayed.length === 0 && (
            <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ backgroundColor: 'var(--rm-input)' }}>
                <svg className="w-7 h-7" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--rm-text)' }}>No applications found</p>
              <p className="text-sm mt-1 mb-4" style={{ color: 'var(--rm-text-muted)' }}>
                {searchTerm || selectedStatus !== 'ALL' || hasClientFilters ? 'Try adjusting your filters' : 'Get started by creating a new application'}
              </p>
              {!searchTerm && selectedStatus === 'ALL' && !hasClientFilters && (
                <button onClick={() => router.push('/dashboard/applications/new')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#0ea5e9' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Create Application
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar — AI Assistant (derived from real worklist/KPIs) */}
        {showAggregates && !loading && (
          <aside className="space-y-4">
            {/* SLA Breaches */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--rm-text)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  SLA Breaches
                  <span className="text-xs font-semibold" style={{ color: 'var(--rm-text-muted)' }}>({slaBreaches.length})</span>
                </h3>
              </div>
              {slaBreaches.length === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>No breaches — pipeline on track.</p>
              ) : (
                <div className="space-y-2.5">
                  {slaBreaches.map(w => (
                    <button key={w.applicationId} onClick={() => router.push(`/dashboard/applications/${w.applicationId}`)}
                      className="w-full text-left flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{w.customerName}</p>
                        <p className="text-[10px] font-mono truncate" style={{ color: 'var(--rm-text-muted)' }}>{w.applicationNumber}</p>
                      </div>
                      <span className="text-[11px] font-bold shrink-0" style={{ color: '#f87171' }}>{w.slaBreachDays}d overdue</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Needs Your Action */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Needs Your Action</h3>
              {needsActionList.length === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>Nothing pending right now.</p>
              ) : (
                <div className="space-y-3">
                  {needsActionList.map(w => (
                    <button key={w.applicationId} onClick={() => router.push(`/dashboard/applications/${w.applicationId}`)} className="w-full text-left">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{w.nextAction || 'Review'}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--rm-text-muted)' }}>{w.customerName} · {w.applicationNumber}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recently Updated */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Recently Updated</h3>
              {recentlyUpdated.length === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>No recent activity.</p>
              ) : (
                <div className="space-y-3">
                  {recentlyUpdated.map(w => (
                    <button key={w.applicationId} onClick={() => router.push(`/dashboard/applications/${w.applicationId}`)}
                      className="w-full text-left flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: avatarGradient(w.customerName || '') }}>
                        {(w.customerName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{w.customerName}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--rm-text-muted)' }}>{(w.status || '').replace(/_/g, ' ')}</p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--rm-text-muted)' }}>{timeAgo(w.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Insights */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--rm-accent)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                Insights
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--rm-text-secondary)' }}>
                {kpis?.stuckAtRiskCount ?? 0} application{(kpis?.stuckAtRiskCount ?? 0) !== 1 ? 's' : ''} ({atRiskPct.toFixed(1)}%) flagged at-risk. {kpis?.needsActionCount ?? 0} need action to keep the pipeline moving.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
