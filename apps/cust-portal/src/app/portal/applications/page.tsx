'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import Glyph from '@/components/ui/Glyph';
import {
  applicationService,
  LoanApplication,
  STATUS_LABELS,
  STATUS_COLORS,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
} from '@/services/api/application-service';

/* ─── Status badge — labels and colours come from application-service ─── */

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'badge-neutral';
  return <span className={`badge ${color}`}>{label}</span>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ─── Filter config ─────────────────────────────────────────── */

type FilterStatus = 'ALL' | 'DRAFT' | 'ACTIVE' | 'COMPLETED';

const FILTER_LABELS: Record<FilterStatus, string> = {
  ALL: 'All',
  DRAFT: 'Draft',
  ACTIVE: 'In progress',
  COMPLETED: 'Completed',
};

const FILTER_GROUPS: Record<FilterStatus, string[] | null> = {
  ALL: null,
  DRAFT: ['DRAFT'],
  ACTIVE: [
    'SUBMITTED',
    'PENDING_KYC',
    'KYC_APPROVED',
    'PENDING_DOCUMENTS',
    'DOCUMENTS_RECEIVED',
    'PENDING_CREDIT_CHECK',
    'CREDIT_APPROVED',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_DECISION',
    'PENDING_CONDITIONS',
    'CONDITIONS_MET',
    'OFFER_GENERATED',
    'OFFER_SENT',
    'OFFER_COUNTERED',
    'PENDING_ESIGN',
    'ESIGN_IN_PROGRESS',
    'ESIGN_COMPLETED',
    'PENDING_BOOKING',
    'BOOKING_IN_PROGRESS',
    'RETURNED',
  ],
  COMPLETED: [
    'APPROVED',
    'DECLINED',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'BOOKED',
    'PENDING_DISBURSEMENT',
    'DISBURSEMENT_IN_PROGRESS',
    'DISBURSED',
    'WITHDRAWN',
    'EXPIRED',
    'CANCELLED',
    'KYC_REJECTED',
    'CREDIT_DECLINED',
    'UNDERWRITING_APPROVED',
    'UNDERWRITING_DECLINED',
    'ACTIVE',
    'CLOSED',
  ],
};

/* ─── Portfolio journey ───────────────────────────────────────
   Four customer-facing milestones derived from the application status.
   The status badge still carries the bank's exact wording; this strip answers
   the simpler question, "where is it now?". */

const PORTFOLIO_STAGES = ['Submit', 'Review', 'Decision', 'Offer & funds'] as const;

function portfolioStage(status: string): { active: number; done: boolean } {
  const s = status.toUpperCase();
  if (s === 'DRAFT') return { active: 0, done: false };
  if (['DISBURSED', 'ACTIVE', 'CLOSED'].includes(s)) return { active: 3, done: true };
  if (['WITHDRAWN', 'CANCELLED', 'EXPIRED'].includes(s)) return { active: -1, done: false };
  if (['PENDING_DECISION', 'APPROVED', 'DECLINED'].includes(s)) return { active: 2, done: false };
  if (
    [
      'OFFER_GENERATED',
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'OFFER_REJECTED',
      'OFFER_EXPIRED',
      'OFFER_COUNTERED',
      'PENDING_CONDITIONS',
      'CONDITIONS_MET',
      'PENDING_ESIGN',
      'ESIGN_IN_PROGRESS',
      'ESIGN_COMPLETED',
      'PENDING_BOOKING',
      'BOOKING_IN_PROGRESS',
      'BOOKED',
      'PENDING_DISBURSEMENT',
      'DISBURSEMENT_IN_PROGRESS',
    ].includes(s)
  ) {
    return { active: 3, done: false };
  }
  return { active: 1, done: false };
}

function applicationGlyph(productType?: string): string {
  const t = (productType || '').toUpperCase();
  if (/MORTGAGE|HOME_LOAN|BRIDGE|CONSTRUCTION|GREEN|PROPERTY/.test(t)) return 'rent';
  if (/AUTO|VEHICLE|PCP|HIRE_PURCHASE|LEASE|EQUIPMENT/.test(t)) return 'Transport';
  if (/CARD|OVERDRAFT|CREDIT/.test(t)) return 'current';
  if (/BUSINESS|SME|AGRI|WORKING|INVOICE|COMMERCIAL/.test(t)) return 'bank';
  return 'doc';
}

function nextActionFor(app: LoanApplication): {
  label: string;
  tone: 'action' | 'warning' | 'quiet';
  glyph: string;
} | null {
  if (app.status === 'DRAFT') {
    return { label: 'Continue your draft', tone: 'action', glyph: 'doc' };
  }
  if (app.status === 'RETURNED' || app.lomsStatus === 'RETURNED') {
    return { label: 'Corrections requested', tone: 'warning', glyph: 'alert' };
  }
  if ((app.documentsPendingCount ?? 0) > 0) {
    const count = app.documentsPendingCount ?? 0;
    return {
      label: `${count} document${count === 1 ? '' : 's'} still needed`,
      tone: 'action',
      glyph: 'doc',
    };
  }
  if (
    app.offerValidUntil &&
    !app.offerAccepted &&
    new Date(app.offerValidUntil).getTime() > Date.now()
  ) {
    return { label: 'Offer waiting for you', tone: 'action', glyph: 'sign' };
  }
  if (['PENDING_ESIGN', 'ESIGN_IN_PROGRESS'].includes(app.status)) {
    return { label: 'Signature needed', tone: 'action', glyph: 'sign' };
  }
  if (app.slaBreached) {
    return { label: 'Taking longer than expected', tone: 'warning', glyph: 'clock' };
  }
  return null;
}

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Main ──────────────────────────────────────────────────── */

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const [query, setQuery] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    try {
      setLoading(true);
      setError(null);
      const data = await applicationService.list();
      setApplications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  const byStatus =
    filter === 'ALL'
      ? applications
      : applications.filter(a => FILTER_GROUPS[filter]?.includes(a.status));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? byStatus.filter(a =>
        [
          a.applicationNumber,
          a.product?.productName,
          LOAN_PURPOSE_LABELS[a.loanPurpose as LoanPurpose],
          a.loanPurpose,
          STATUS_LABELS[a.status],
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      )
    : byStatus;

  /* Every count is derived from the applications the service actually returned. */
  const counts: Record<FilterStatus, number> = {
    ALL: applications.length,
    DRAFT: applications.filter(a => FILTER_GROUPS.DRAFT?.includes(a.status)).length,
    ACTIVE: applications.filter(a => FILTER_GROUPS.ACTIVE?.includes(a.status)).length,
    COMPLETED: applications.filter(a => FILTER_GROUPS.COMPLETED?.includes(a.status)).length,
  };

  const attentionCount = applications.filter(app => {
    const next = nextActionFor(app);
    return next != null && next.tone !== 'quiet';
  }).length;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────── */}
      <section className="mesh-hero relative overflow-hidden rounded-[32px] p-6 shadow-float sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10"
          style={{ boxShadow: '0 0 0 40px rgba(255,255,255,.035), 0 0 0 80px rgba(255,255,255,.025)' }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Credit with the bank
            </p>
            <h1 className="serif mt-2 text-[32px] font-medium leading-tight tracking-tight text-white sm:text-[36px]">
              My applications
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              {loading
                ? 'Loading your applications…'
                : attentionCount > 0
                  ? `${counts.ALL} ${counts.ALL === 1 ? 'application' : 'applications'} · ${
                      attentionCount === counts.ALL
                        ? 'all need your attention'
                        : `${attentionCount} need your attention`
                    }`
                  : `${counts.ALL} ${
                      counts.ALL === 1 ? 'application' : 'applications'
                    } · nothing needs you right now`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="dash-hero-chip">Total {counts.ALL}</span>
              <span className="dash-hero-chip">In progress {counts.ACTIVE}</span>
              <span className="dash-hero-chip">Completed {counts.COMPLETED}</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/portal/ai-assistant')}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#5e1f5b] shadow-lg transition-transform hover:scale-[1.02] lg:self-end"
          >
            <Glyph name="plus" className="h-4 w-4" strokeWidth={2.2} />
            New application
          </button>
        </div>
      </section>

      {/* ── Toolbar: filters + search ──────────────────────── */}
      <div className="glass-panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="segmented no-scrollbar max-w-full overflow-x-auto"
          role="group"
          aria-label="Filter applications by status"
          tabIndex={0}
        >
          {(Object.keys(FILTER_GROUPS) as FilterStatus[]).map(f => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              data-active={filter === f ? 'true' : undefined}
              onClick={() => setFilter(f)}
              className="segmented-item px-2 text-[13px] sm:px-3.5 sm:text-sm"
            >
              {FILTER_LABELS[f]}
              <span className="ml-0.5 text-xs tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-xs">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            <Glyph name="search" className="h-4 w-4" strokeWidth={2} />
          </span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by reference, purpose or status"
            aria-label="Search applications"
            className="input !rounded-full py-2 pl-9 pr-4"
          />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">Loading your applications…</p>
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel p-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3.5 w-72" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error flex-col text-center sm:flex-row sm:text-left" role="alert">
          <Glyph name="alert" className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">We couldn&apos;t load your applications</p>
            <p className="mt-0.5 text-sm opacity-80">{error}</p>
          </div>
          <button onClick={loadApplications} className="btn btn-sm btn-outline shrink-0">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        applications.length === 0 ? (
          <div className="glass-panel-solid relative overflow-hidden px-6 py-12 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, var(--brand-soft-strong), transparent 68%)',
              }}
            />
            <div className="relative">
              <span
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background: 'var(--brand-soft)',
                  color: 'var(--brand-on-soft)',
                  border: '1px solid var(--hairline)',
                }}
              >
                <Glyph name="doc" className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <h2 className="serif mt-5 text-[26px] font-medium">Your first application starts here</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                Apply for a loan or credit product, share your details once, and follow every step
                from submission to drawdown.
              </p>
              <button
                onClick={() => router.push('/portal/ai-assistant')}
                className="btn btn-primary mt-6"
              >
                Start an application <span aria-hidden="true">→</span>
              </button>

              <ol className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
                {[
                  { glyph: 'search', title: 'Choose a product', detail: 'See what is open to you.' },
                  { glyph: 'doc', title: 'Share your details', detail: 'Bring in your banking.' },
                  { glyph: 'check', title: 'Track every step', detail: 'Know who is doing what.' },
                ].map((item, i) => (
                  <li
                    key={item.title}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: 'var(--hairline)',
                      backgroundColor: 'var(--surface-input)',
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: 'var(--brand-soft)',
                        color: 'var(--brand-on-soft)',
                      }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Glyph name="search" className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <h2 className="empty-state-title">No matching applications</h2>
            <p className="empty-state-text">
              {q
                ? `Nothing matches “${query.trim()}”. Try a different reference, purpose or status.`
                : 'No applications have this status yet.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {q && (
                <button onClick={() => setQuery('')} className="btn btn-secondary btn-sm">
                  Clear search
                </button>
              )}
              {filter !== 'ALL' && (
                <button onClick={() => setFilter('ALL')} className="btn btn-ghost btn-sm">
                  Show all applications
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        <ul className="stagger space-y-3">
          {filtered.map(app => {
            const purpose =
              app.product?.productName ||
              LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] ||
              app.loanPurpose;
            const stage = portfolioStage(app.status);
            const nextAction = nextActionFor(app);
            const closed = [
              'DECLINED',
              'WITHDRAWN',
              'CANCELLED',
              'EXPIRED',
              'CLOSED',
              'KYC_REJECTED',
              'CREDIT_DECLINED',
              'UNDERWRITING_DECLINED',
              'OFFER_REJECTED',
              'OFFER_EXPIRED',
            ].includes(app.status);

            return (
              <li key={app.applicationId}>
                <Link
                  href={`/portal/applications/${app.applicationId}`}
                  className="glass-panel group block w-full text-left transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <span
                        className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:flex"
                        style={{
                          background: 'var(--brand-soft)',
                          color: 'var(--brand-on-soft)',
                          border: '1px solid var(--hairline)',
                        }}
                        aria-hidden="true"
                      >
                        <Glyph
                          name={applicationGlyph(app.product?.productType)}
                          className="h-5 w-5"
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className="serif truncate text-[20px] font-medium leading-snug"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {purpose || 'Draft application'}
                          </h2>
                          <StatusBadge status={app.status} />
                          {nextAction && (
                            <span
                              className={`badge ${
                                nextAction.tone === 'warning' ? 'badge-warning' : 'badge-primary'
                              }`}
                            >
                              Needs you
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                          {app.applicationNumber || 'No reference yet'} ·{' '}
                          {app.requestedTermMonths} months ·{' '}
                          {app.status === 'DRAFT' ? 'Created' : 'Updated'}{' '}
                          {formatDate(app.updatedAt || app.createdAt)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className="text-xl font-bold tracking-tight tabular-nums"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {formatCurrency(app.requestedAmount)}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Requested
                        </p>
                        {app.approvedAmount != null && (
                          <p
                            className="mt-1 text-xs font-semibold tabular-nums"
                            style={{ color: 'var(--up)' }}
                          >
                            Approved {formatCurrency(app.approvedAmount)}
                          </p>
                        )}
                      </div>

                      <span
                        aria-hidden="true"
                        className="mt-2 hidden transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Glyph name="chevron" className="h-4 w-4 -rotate-90" strokeWidth={2} />
                      </span>
                    </div>

                    {/* Position in the customer journey, not the bank's internal workflow. */}
                    <div className="mt-5 grid grid-cols-4 gap-1.5">
                      {PORTFOLIO_STAGES.map((label, i) => {
                        const reached = stage.done || (stage.active >= 0 && i <= stage.active);
                        const isCurrent = !stage.done && i === stage.active;
                        return (
                          <div key={label}>
                            <div
                              className="h-1.5 rounded-full transition-colors"
                              style={{
                                backgroundColor: reached
                                  ? 'var(--brand)'
                                  : 'var(--hairline-strong)',
                                opacity: reached && !isCurrent ? 0.65 : 1,
                              }}
                            />
                            <p
                              className="mt-1.5 text-[10px] font-medium"
                              style={{
                                color: isCurrent
                                  ? 'var(--text-primary)'
                                  : reached
                                    ? 'var(--text-secondary)'
                                    : 'var(--text-muted)',
                              }}
                            >
                              {label}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs"
                      style={{ borderColor: 'var(--hairline)' }}
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {nextAction ? (
                          <span
                            className="inline-flex items-center gap-1.5 font-semibold"
                            style={{
                              color:
                                nextAction.tone === 'warning'
                                  ? 'var(--down)'
                                  : 'var(--brand-on-soft)',
                            }}
                          >
                            <Glyph
                              name={nextAction.glyph}
                              className="h-3.5 w-3.5"
                              strokeWidth={2}
                            />
                            {nextAction.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>
                            {closed ? 'This application is closed' : 'No action needed from you'}
                          </span>
                        )}
                        {app.daysInCurrentStatus != null && app.status !== 'DRAFT' && (
                          <span style={{ color: 'var(--text-muted)' }}>
                            {app.daysInCurrentStatus}{' '}
                            {app.daysInCurrentStatus === 1 ? 'day' : 'days'} in this status
                          </span>
                        )}
                      </div>
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: 'var(--brand-on-soft)' }}
                      >
                        {app.status === 'DRAFT' ? 'Continue' : 'Open'}
                        <span
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
