'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import {
  dashboardService,
  type DashboardKpis,
  type PipelineStage,
  type WorklistItem,
} from '@/services/api/dashboard-service';
import { STATUS_CONFIG, type LomsApplicationStatus } from '@/types/loms';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';
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

/* Human-readable status labels come from the shared LOMS status configuration
   so every surface in the portal words a status the same way. */
const statusLabel = (status?: string): string => {
  if (!status) return 'Unknown';
  return (
    STATUS_CONFIG[status as LomsApplicationStatus]?.label ?? status.replace(/_/g, ' ')
  );
};

/* Translucent tints (never white stops, never hardcoded surface hex) so the
   chip reads the same in light and dark mode. Colour is always paired with a
   text label — status is never conveyed by colour alone. */
type Tone = { bg: string; fg: string; dot: string };
const TONES: Record<'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'offer' | 'booking', Tone> = {
  neutral: { bg: 'rgba(127,127,127,0.14)', fg: 'var(--rm-text-secondary)', dot: '#94a3b8' },
  info: { bg: 'rgba(14,165,233,0.14)', fg: '#0284c7', dot: '#0ea5e9' },
  warning: { bg: 'rgba(245,158,11,0.15)', fg: '#b45309', dot: '#f59e0b' },
  success: { bg: 'rgba(16,185,129,0.14)', fg: '#047857', dot: '#10b981' },
  danger: { bg: 'rgba(239,68,68,0.13)', fg: '#b91c1c', dot: '#ef4444' },
  offer: { bg: 'rgba(139,92,246,0.15)', fg: '#6d28d9', dot: '#8b5cf6' },
  booking: { bg: 'rgba(99,102,241,0.15)', fg: '#4338ca', dot: '#6366f1' },
};

function statusTone(status?: string): Tone {
  const s = (status || '').toUpperCase();
  if (/DECLIN|REJECT|CANCEL|WITHDRAWN|EXPIRED|RETURNED/.test(s)) return TONES.danger;
  if (/BOOK|DISBURS/.test(s)) return TONES.booking;
  if (/OFFER|ESIGN/.test(s)) return TONES.offer;
  if (/APPROV|COMPLETED|RECEIVED|CONDITIONS_MET|^ACTIVE$|^CLOSED$/.test(s)) return TONES.success;
  if (/SUBMITTED/.test(s)) return TONES.info;
  if (/PENDING|UNDERWRIT|REFERRED|CREDIT_CHECK/.test(s)) return TONES.warning;
  return TONES.neutral;
}

/* Next-action hint derived from status */
const NEXT_ACTION: Record<string, string> = {
  DRAFT: 'Complete and submit',
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
function riskLevel(app: ApplicationResponse): { label: string; tone: Tone } {
  const r = (app.internalRiskRating || '').toUpperCase();
  if (r) {
    if (r.includes('LOW') || r === 'A' || r === 'EXCELLENT') return { label: 'Low risk', tone: TONES.success };
    if (r.includes('MEDIUM') || r === 'B' || r === 'FAIR') return { label: 'Medium risk', tone: TONES.warning };
    if (r.includes('HIGH') || r === 'C' || r === 'POOR') return { label: 'High risk', tone: TONES.danger };
  }
  if (typeof app.riskScore === 'number') {
    if (app.riskScore >= 70) return { label: 'High risk', tone: TONES.danger };
    if (app.riskScore >= 40) return { label: 'Medium risk', tone: TONES.warning };
    return { label: 'Low risk', tone: TONES.success };
  }
  return { label: 'Not rated', tone: TONES.neutral };
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

/* Flat row view-model — gives the shared sorter stable, sortable keys. */
interface ApplicationRow {
  applicationId: string;
  app: ApplicationResponse;
  customerName: string;
  productName: string;
  statusText: string;
  riskText: string;
  amount: number;
  daysInStage: number;
  rmName: string;
  nextAction: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'createdAt', direction: 'desc' });

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
        response = await applicationService.getApplicationsByCustomer(filterCustomerId, currentPage, PAGE_SIZE);
      } else if (isReviewerUser) {
        response = await applicationService.getMyAssignedApplications({ page: currentPage, size: PAGE_SIZE });
      } else if (bankId) {
        response = await applicationService.getApplications({
          bankId,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchTerm || undefined,
          page: currentPage,
          size: PAGE_SIZE,
          sort: 'createdAt,desc',
        });
      } else {
        response = await applicationService.getMyCreatedApplications(currentPage, PAGE_SIZE);
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

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  /* Client-side product / RM filter options + filtering */
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

  const rows = useMemo<ApplicationRow[]>(() => {
    const filtered = applications.filter(a => {
      if (productFilter && a.product?.productName !== productFilter) return false;
      if (rmFilter) {
        const name = a.assignedToUser ? `${a.assignedToUser.firstName} ${a.assignedToUser.lastName}` : '';
        if (name !== rmFilter) return false;
      }
      return true;
    });
    return filtered.map(app => ({
      applicationId: app.applicationId,
      app,
      customerName:
        app.customer?.businessName ||
        `${app.customer?.firstName || ''} ${app.customer?.lastName || ''}`.trim() ||
        'Unknown customer',
      productName: app.product?.productName || '—',
      statusText: statusLabel(app.status),
      riskText: riskLevel(app).label,
      amount: app.requestedAmount || 0,
      daysInStage: app.daysInCurrentStatus ?? 0,
      rmName: app.assignedToUser ? `${app.assignedToUser.firstName} ${app.assignedToUser.lastName}` : '',
      nextAction: nextActionFor(app),
      createdAt: app.createdAt,
    }));
  }, [applications, productFilter, rmFilter]);

  const sortedRows = useMemo(() => sortData(rows, sortConfig), [rows, sortConfig]);

  /* KPI derivations from real dashboard data */
  const pipelineTotal = useMemo(() => pipeline.reduce((s, p) => s + p.applicationCount, 0), [pipeline]);
  const docsPending = useMemo(() => pipeline.reduce((s, p) => s + (p.docsPendingCount || 0), 0), [pipeline]);
  const underwritingCount = useMemo(
    () => pipeline.filter(p => (p.stage || '').toUpperCase().includes('UNDERWRIT')).reduce((s, p) => s + p.applicationCount, 0),
    [pipeline]
  );

  const kpiCards: { label: string; value: string; sub?: string; tone: Tone; icon: React.ReactNode }[] = [
    {
      label: 'Matching applications',
      value: totalElements.toLocaleString(),
      sub: pipelineTotal ? `${pipelineTotal.toLocaleString()} in the pipeline` : undefined,
      tone: TONES.info,
      icon: I.folder,
    },
    {
      label: 'Needs action',
      value: (kpis?.needsActionCount ?? 0).toLocaleString(),
      sub: kpis ? formatCurrency(kpis.inProgressValue) + ' in progress' : undefined,
      tone: TONES.warning,
      icon: I.warn,
    },
    {
      label: 'In progress',
      value: (kpis?.inProgressCount ?? 0).toLocaleString(),
      tone: TONES.info,
      icon: I.clock,
    },
    {
      label: 'In underwriting',
      value: underwritingCount.toLocaleString(),
      sub: `${docsPending.toLocaleString()} documents pending`,
      tone: TONES.booking,
      icon: I.doc,
    },
    {
      label: 'Approved this month',
      value: (kpis?.approvedThisMonthCount ?? 0).toLocaleString(),
      sub: kpis ? formatCurrency(kpis.approvedThisMonthValue) : undefined,
      tone: TONES.success,
      icon: I.check,
    },
    {
      label: 'Booked this month',
      value: (kpis?.bookedThisMonthCount ?? 0).toLocaleString(),
      sub: kpis ? formatCurrency(kpis.bookedThisMonthValue) : undefined,
      tone: TONES.success,
      icon: I.book,
    },
    {
      label: 'At risk',
      value: (kpis?.stuckAtRiskCount ?? 0).toLocaleString(),
      sub: 'Stuck or breaching SLA',
      tone: TONES.danger,
      icon: I.shield,
    },
    {
      label: 'Conversion, last 30 days',
      value: kpis ? `${kpis.conversionRate30d.toFixed(1)}%` : '—',
      sub: 'Submitted to booked',
      tone: TONES.offer,
      icon: I.trend,
    },
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
  const hasAnyFilter = !!(searchTerm || selectedStatus !== 'ALL' || hasClientFilters);
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('ALL');
    setProductFilter('');
    setRmFilter('');
    setCurrentPage(0);
  };

  /* Page window for pagination — 5 buttons centred on the current page. */
  const pageWindow = useMemo(() => {
    const span = Math.min(totalPages, 5);
    const start = totalPages <= 0 ? 0 : Math.max(0, Math.min(currentPage - 2, totalPages - span));
    return Array.from({ length: span }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const fieldStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    color: 'var(--rm-text)',
    border: '1px solid var(--rm-border)',
  };
  const labelStyle: React.CSSProperties = { color: 'var(--rm-text-secondary)' };
  const fieldCls =
    'w-full px-3.5 py-2.5 rounded-xl text-sm transition-colors';

  const pageTitle = filterCustomerId
    ? 'Customer applications'
    : isReviewer
      ? 'Applications for review'
      : 'Applications';
  const showAggregates = !filterCustomerId;
  const canCreate = !isReviewer && !filterCustomerId;

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            {pageTitle}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--rm-text-muted)' }}>
            {filterCustomerId
              ? 'Applications belonging to this customer.'
              : isReviewer
                ? 'Applications assigned to you for review.'
                : 'Track the pipeline and pick up the cases that need you.'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {filterCustomerId && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/applications')}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
            >
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear customer filter
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/applications/new')}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New application
            </button>
          )}
        </div>
      </header>

      {/* ── Pipeline summary ── */}
      {showAggregates && (
        <section aria-label="Pipeline summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map(c => (
            <div key={c.label} className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {c.label}
                </p>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.tone.bg, color: c.tone.fg }}
                  aria-hidden="true"
                >
                  {c.icon}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold leading-none tabular-nums" style={{ color: 'var(--rm-text)' }}>
                {c.value}
              </p>
              {c.sub && (
                <p className="mt-2 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                  {c.sub}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <div className={`grid grid-cols-1 gap-6 items-start ${showAggregates ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        {/* ── Left column ── */}
        <div className="space-y-6 min-w-0">
          {/* Filters */}
          <section
            aria-label="Filter applications"
            className="rounded-3xl p-6"
            style={{ backgroundColor: 'var(--rm-card)' }}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="filter-status" className="block text-sm mb-1.5" style={labelStyle}>
                  Status
                </label>
                <select
                  id="filter-status"
                  value={selectedStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className={fieldCls}
                  style={fieldStyle}
                >
                  {APPLICATION_STATUSES.map(s => (
                    <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : statusLabel(s)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-product" className="block text-sm mb-1.5" style={labelStyle}>
                  Product
                </label>
                <select
                  id="filter-product"
                  value={productFilter}
                  onChange={e => {
                    setProductFilter(e.target.value);
                  }}
                  className={fieldCls}
                  style={fieldStyle}
                  disabled={productOptions.length === 0}
                >
                  <option value="">All products</option>
                  {productOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-rm" className="block text-sm mb-1.5" style={labelStyle}>
                  Relationship manager
                </label>
                <select
                  id="filter-rm"
                  value={rmFilter}
                  onChange={e => setRmFilter(e.target.value)}
                  className={fieldCls}
                  style={fieldStyle}
                  disabled={rmOptions.length === 0}
                >
                  <option value="">Everyone</option>
                  {rmOptions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-search" className="block text-sm mb-1.5" style={labelStyle}>
                  Search
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--rm-text-muted)' }}
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    id="filter-search"
                    type="search"
                    placeholder="Customer, reference or product"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className={`${fieldCls} pl-10`}
                    style={fieldStyle}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {hasAnyFilter
                  ? `${sortedRows.length} of ${applications.length} applications on this page match your filters.`
                  : `${applications.length} applications loaded on this page.`}
                {hasClientFilters && ' Product and relationship manager filters apply to the loaded page only.'}
              </p>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="rounded-3xl px-6 py-5 flex flex-wrap items-center gap-3"
              style={{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}
            >
              <svg className="w-5 h-5 shrink-0" style={{ color: '#dc2626' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--rm-text)' }}>
                We could not load applications. {error}
              </p>
              <button
                type="button"
                onClick={() => fetchApplications()}
                className="ml-auto rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'rgba(239,68,68,0.16)', color: '#b91c1c' }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <section
              aria-label="Applications, loading"
              className="rounded-3xl overflow-hidden"
              style={{ backgroundColor: 'var(--rm-card)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rm-border)' }}>
                <div className="h-5 w-44 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              </div>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="px-5 py-4 flex items-center gap-4"
                  style={{ borderBottom: '1px solid var(--rm-border)' }}
                >
                  <div className="h-10 w-10 rounded-full animate-pulse shrink-0" style={{ backgroundColor: 'var(--rm-input)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                    <div className="h-3 w-1/5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                  </div>
                  <div className="h-6 w-24 rounded-full animate-pulse hidden sm:block" style={{ backgroundColor: 'var(--rm-input)' }} />
                </div>
              ))}
              <p className="sr-only" role="status">Loading applications</p>
            </section>
          )}

          {/* Table */}
          {!loading && sortedRows.length > 0 && (
            <section className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)' }}>
              <div
                className="flex items-center justify-between px-5 py-4 flex-wrap gap-2"
                style={{ borderBottom: '1px solid var(--rm-border)' }}
              >
                <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                  Applications
                </h2>
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Select a column heading to sort
                </p>
              </div>

              <div
                role="region"
                aria-label="Applications table, scrollable horizontally"
                tabIndex={0}
                className="overflow-x-auto"
              >
                <table className="w-full" aria-label="Loan applications">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                      <SortableHeader label="Customer" field="customerName" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <SortableHeader label="Product" field="productName" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <SortableHeader label="Amount" field="amount" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <SortableHeader label="Stage" field="statusText" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <SortableHeader label="Days in stage" field="daysInStage" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <SortableHeader label="Risk" field="riskText" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <th scope="col" className="px-5 py-3.5 text-left text-sm font-medium whitespace-nowrap" style={{ color: 'var(--rm-text-muted)' }}>
                        Next action
                      </th>
                      <SortableHeader label="Relationship manager" field="rmName" currentSort={sortConfig} onSort={handleSort} className={headerSortClass} />
                      <th scope="col" className="px-5 py-3.5">
                        <span className="sr-only">Open application</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map(row => {
                      const app = row.app;
                      const tone = statusTone(app.status);
                      const risk = riskLevel(app);
                      const breached = app.slaBreached === true;
                      return (
                        <tr
                          key={row.applicationId}
                          className="transition-colors hover:bg-slate-50"
                          style={{ borderBottom: '1px solid var(--rm-border)' }}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                                style={{ background: avatarGradient(row.customerName) }}
                              >
                                {row.customerName.charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <Link
                                  href={`/dashboard/applications/${row.applicationId}`}
                                  className="block truncate text-base font-medium hover:underline"
                                  style={{ color: 'var(--rm-text)' }}
                                >
                                  {row.customerName}
                                </Link>
                                <span className="block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                  {app.applicationNumber || 'No reference yet'}
                                </span>
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="block truncate max-w-[180px] text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                              {row.productName}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                              {app.requestedAmount ? compactCurrency(app.requestedAmount) : '—'}
                            </span>
                            <span className="block text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                              {app.requestedTermMonths} months
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
                              style={{ backgroundColor: tone.bg, color: tone.fg }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tone.dot }} aria-hidden="true" />
                              {row.statusText}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="block text-sm tabular-nums" style={{ color: 'var(--rm-text)' }}>
                              {typeof app.daysInCurrentStatus === 'number' ? `${app.daysInCurrentStatus} days` : '—'}
                            </span>
                            <span
                              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium"
                              style={{ color: breached ? '#b91c1c' : '#047857' }}
                            >
                              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d={
                                    breached
                                      ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                      : 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                  }
                                />
                              </svg>
                              {breached ? 'SLA overdue' : 'Within SLA'}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            {typeof app.creditScoreAtApplication === 'number' && (
                              <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                                {app.creditScoreAtApplication}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: risk.tone.fg }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: risk.tone.dot }} aria-hidden="true" />
                              {risk.label}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-sm whitespace-nowrap"
                              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                            >
                              {row.nextAction}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {row.rmName ? (
                              <span className="flex items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                                  style={{ background: avatarGradient(row.rmName) }}
                                >
                                  {row.rmName.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                                  {row.rmName}
                                </span>
                              </span>
                            ) : (
                              <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>Unassigned</span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/dashboard/applications/${row.applicationId}`}
                              aria-label={`Open application ${app.applicationNumber || row.customerName}`}
                              className="inline-flex items-center justify-center rounded-full p-2 transition-opacity hover:opacity-70"
                              style={{ color: 'var(--rm-text-muted)' }}
                            >
                              <svg className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                className="px-5 py-4 flex items-center justify-between flex-wrap gap-3"
                style={{ borderTop: '1px solid var(--rm-border)' }}
              >
                <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                  Showing {sortedRows.length} of {totalElements.toLocaleString()} applications
                </p>
                {totalPages > 1 && (
                  <nav aria-label="Applications pagination" className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      aria-label="Go to previous page"
                      className="p-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-70"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {pageWindow.map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentPage(i)}
                        aria-label={`Go to page ${i + 1}`}
                        aria-current={currentPage === i ? 'page' : undefined}
                        className="min-w-[36px] h-9 rounded-full text-sm font-medium tabular-nums transition-opacity hover:opacity-80"
                        style={
                          currentPage === i
                            ? { backgroundColor: 'var(--rm-accent)', color: '#ffffff' }
                            : { backgroundColor: 'transparent', color: 'var(--rm-text-secondary)' }
                        }
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                      disabled={currentPage >= totalPages - 1}
                      aria-label="Go to next page"
                      className="p-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-70"
                      style={{ color: 'var(--rm-text-muted)' }}
                    >
                      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </nav>
                )}
              </div>
            </section>
          )}

          {/* Empty */}
          {!loading && sortedRows.length === 0 && (
            <section className="rounded-3xl py-20 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--rm-input)' }}
              >
                <svg className="w-7 h-7" style={{ color: 'var(--rm-text-muted)' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                {error ? 'Nothing to show yet' : hasAnyFilter ? 'No applications match these filters' : 'No applications yet'}
              </p>
              <p className="text-sm mt-2 mb-6" style={{ color: 'var(--rm-text-muted)' }}>
                {error
                  ? 'Use “Try again” above to reload the list.'
                  : hasAnyFilter
                    ? 'Try a different status, product or search term.'
                    : canCreate
                      ? 'Create the first application for this customer to get started.'
                      : 'Applications assigned to you will appear here.'}
              </p>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                >
                  Clear filters
                </button>
              )}
            </section>
          )}
        </div>

        {/* ── Right sidebar — derived from real worklist / KPI data ── */}
        {showAggregates && (
          <aside aria-label="Pipeline highlights" className="space-y-6">
            {/* SLA breaches */}
            <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                SLA breaches
              </h2>
              {loading ? (
                <div className="mt-4 space-y-3" aria-hidden="true">
                  {[0, 1].map(i => (
                    <div key={i} className="h-10 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                  ))}
                </div>
              ) : slaBreaches.length === 0 ? (
                <p className="text-sm mt-2" style={{ color: 'var(--rm-text-muted)' }}>
                  No breaches — the pipeline is on track.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {slaBreaches.map(w => (
                    <li key={w.applicationId}>
                      <Link
                        href={`/dashboard/applications/${w.applicationId}`}
                        className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 -mx-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {w.customerName}
                          </span>
                          <span className="block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {w.applicationNumber}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: '#b91c1c' }}>
                          {w.slaBreachDays}d over
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Needs your action */}
            <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                Needs your action
              </h2>
              {loading ? (
                <div className="mt-4 space-y-3" aria-hidden="true">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-10 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                  ))}
                </div>
              ) : needsActionList.length === 0 ? (
                <p className="text-sm mt-2" style={{ color: 'var(--rm-text-muted)' }}>
                  Nothing pending right now.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {needsActionList.map(w => (
                    <li key={w.applicationId}>
                      <Link
                        href={`/dashboard/applications/${w.applicationId}`}
                        className="block rounded-2xl px-3 py-2 -mx-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="block truncate text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                          {w.nextAction || 'Review application'}
                        </span>
                        <span className="block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {w.customerName} · {w.applicationNumber}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recently updated */}
            <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                Recently updated
              </h2>
              {loading ? (
                <div className="mt-4 space-y-3" aria-hidden="true">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-10 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                  ))}
                </div>
              ) : recentlyUpdated.length === 0 ? (
                <p className="text-sm mt-2" style={{ color: 'var(--rm-text-muted)' }}>
                  No recent activity.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {recentlyUpdated.map(w => (
                    <li key={w.applicationId}>
                      <Link
                        href={`/dashboard/applications/${w.applicationId}`}
                        className="flex items-center gap-3 rounded-2xl px-3 py-2 -mx-3 transition-colors hover:bg-slate-50"
                      >
                        <span
                          aria-hidden="true"
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                          style={{ background: avatarGradient(w.customerName || '') }}
                        >
                          {(w.customerName || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {w.customerName}
                          </span>
                          <span className="block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {statusLabel(w.status)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {timeAgo(w.updatedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Insights */}
            {kpis && (
              <section
                className="rounded-3xl p-6"
                style={{ backgroundColor: 'var(--rm-accent-muted)' }}
              >
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2" style={{ color: 'var(--rm-accent)' }}>
                  <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Where to focus
                </h2>
                <p className="text-sm mt-3" style={{ color: 'var(--rm-text-secondary)' }}>
                  {kpis.stuckAtRiskCount} application{kpis.stuckAtRiskCount === 1 ? '' : 's'}
                  {pipelineTotal > 0 ? ` (${atRiskPct.toFixed(1)}% of the pipeline)` : ''} flagged at risk, and{' '}
                  {kpis.needsActionCount} need{kpis.needsActionCount === 1 ? 's' : ''} action to keep things moving.
                </p>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/* Small SVG icons — decorative only, hidden from assistive tech where used. */
const I = {
  folder: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  warn: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  doc: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  book: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  trend: (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />
    </svg>
  ),
};
