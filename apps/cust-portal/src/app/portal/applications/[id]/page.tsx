'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import {
  applicationService,
  LoanApplication,
  CustomerStatusInfo,
  CustomerStage,
  CUSTOMER_STAGES,
  STATUS_LABELS,
  STATUS_COLORS,
  LOAN_PURPOSE_LABELS,
  LoanPurpose,
  TimelineEvent,
} from '@/services/api/application-service';
import {
  documentService,
  type ApplicationDocument,
  type DocumentRequest,
  type DocumentSummary,
  type DocumentCategory,
  type UploadDocumentPayload,
  CATEGORY_LABELS,
  UPLOAD_STATUS_LABELS,
  UPLOAD_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  formatFileSize,
  getCategoryIcon,
} from '@/services/api/document-service';
import {
  messagingService,
  type Message,
  type Conversation,
  type SenderType,
  SENDER_TYPE_COLORS,
  formatMessageTime,
} from '@/services/api/messaging-service';
import {
  offerService,
  type Offer,
  type OfferCondition,
  type OfferWithConditions,
  type OfferStatus,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_COLORS,
} from '@/services/api/offer-service';
import {
  esignService,
  type EsignStatus,
  type SignerProgress,
  type EsignOverallStatus,
  ESIGN_STATUS_LABELS,
  ESIGN_STATUS_COLORS,
} from '@/services/api/esign-service';
import {
  bookingService,
  type BookingStatus,
  type BookingMilestone,
  type BookingPhase,
  type MilestoneStatus,
  PHASE_LABELS,
  PHASE_COLORS,
  MILESTONE_STATUS_COLORS,
  isBookingPhaseStatus,
} from '@/services/api/booking-service';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'badge-neutral';
  return <span className={`badge ${color}`}>{label}</span>;
}

// Terminal statuses (not in the normal flow)
const TERMINAL_STATUSES: string[] = [
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED',
  'CANCELLED',
  'KYC_REJECTED',
  'CREDIT_DECLINED',
  'UNDERWRITING_DECLINED',
  'OFFER_REJECTED',
  'OFFER_EXPIRED',
  'CLOSED',
];

/* booking-service exports colours but no labels for milestone status; the
   timeline states each milestone in words so status is never colour alone. */
const MILESTONE_STATUS_TEXT: Record<MilestoneStatus, string> = {
  COMPLETED: 'Complete',
  IN_PROGRESS: 'In progress',
  PENDING: 'Not started',
};

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get('submitted') === '1';

  const [app, setApp] = useState<LoanApplication | null>(null);
  const [statusInfo, setStatusInfo] = useState<CustomerStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(justSubmitted);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  /* Kept separate from the page-level `error`: a failed withdrawal must not
     replace the whole application view (and the customer's typed reason). */
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  useEffect(() => {
    loadApplication();
  }, [params.id]);

  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  async function loadApplication() {
    try {
      setLoading(true);
      setError(null);
      const id = params.id as string;
      const [data, status] = await Promise.all([
        applicationService.getById(id),
        applicationService.getStatus(id).catch(() => null),
      ]);
      setApp(data);
      setStatusInfo(status);
    } catch (err: any) {
      setError(err.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6" aria-busy="true">
        <p className="sr-only" role="status">Loading your application…</p>
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-48 w-full rounded-3xl" />
        <div className="card space-y-4">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </div>
        <div className="card space-y-4">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push('/portal/applications')}
          className="btn btn-ghost btn-sm mb-6"
          type="button"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to applications
        </button>
        <div className="alert alert-error flex-col items-center text-center" role="alert">
          <div>
            <p className="font-semibold">We couldn&apos;t open this application</p>
            <p className="mt-0.5 text-sm opacity-80">{error || 'Application not found'}</p>
          </div>
          <button onClick={loadApplication} className="btn btn-outline btn-sm mt-2" type="button">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isDraft = app.status === 'DRAFT';
  const isReturned = app.status === 'RETURNED' || app.lomsStatus === 'RETURNED';
  const isTerminal = TERMINAL_STATUSES.includes(app.status);
  const canWithdraw = !isDraft && !isTerminal && !isReturned;
  const stage = statusInfo?.stage as CustomerStage | undefined;
  const isDeclined = statusInfo?.declined ?? false;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Withdraw Confirmation Dialog */}
      {showWithdrawConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-title"
          aria-describedby="withdraw-desc"
          onKeyDown={e => {
            if (e.key === 'Escape' && !withdrawing) {
              setShowWithdrawConfirm(false);
              setWithdrawError(null);
            }
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border p-6"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2 id="withdraw-title" className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Withdraw application?
            </h2>
            <p id="withdraw-desc" className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone. Your application will be permanently withdrawn.
            </p>

            {withdrawError && (
              <p
                className="mt-4 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-300"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
                role="alert"
              >
                {withdrawError} Your reason has been kept — you can try again.
              </p>
            )}

            <div className="mt-4">
              <label className="field-label" htmlFor="withdraw-reason">
                Reason <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <textarea
                id="withdraw-reason"
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                rows={2}
                placeholder="Why are you withdrawing?"
                className="input resize-none"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowWithdrawConfirm(false);
                  setWithdrawReason('');
                  setWithdrawError(null);
                }}
                className="btn btn-ghost"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setWithdrawError(null);
                  try {
                    setWithdrawing(true);
                    await applicationService.withdraw(
                      app.applicationId,
                      withdrawReason || undefined
                    );
                    setShowWithdrawConfirm(false);
                    setWithdrawReason('');
                    loadApplication();
                  } catch (err: unknown) {
                    setWithdrawError(
                      err instanceof Error ? err.message : 'We couldn’t withdraw this application.'
                    );
                  } finally {
                    setWithdrawing(false);
                  }
                }}
                disabled={withdrawing}
                className="btn btn-danger"
                type="button"
              >
                {withdrawing ? 'Withdrawing…' : 'Confirm withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return for corrections banner */}
      {isReturned && (
        <div className="alert alert-warning mb-6" role="alert">
          <span className="text-lg leading-none" aria-hidden="true">
            ⚠
          </span>
          <div>
            <h2 className="text-base font-semibold">Corrections requested</h2>
            <p className="mt-1 text-sm">
              The bank has returned your application for corrections. Please review the requested
              changes, update the details, and resubmit your application.
            </p>
          </div>
        </div>
      )}

      {/* Success banner */}
      {showSuccess && (
        <div className="alert alert-success mb-6 items-center" role="status">
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium">
            Application submitted. Your relationship manager will review it.
          </p>
        </div>
      )}

      {/* Back + Header */}
      <button
        onClick={() => router.push('/portal/applications')}
        className="btn btn-ghost btn-sm mb-3"
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Applications
      </button>

      <section className="mesh-hero aurora relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-float md:p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur">
                {STATUS_LABELS[app.status] || app.status}
              </span>
              {app.channel && (
                <span className="text-sm text-white/75">
                  Channel: {app.channel.replace(/_/g, ' ').toLowerCase()}
                </span>
              )}
            </div>
            <h1 className="mt-3 truncate text-2xl font-extrabold tracking-tight md:text-3xl">
              {app.applicationNumber || 'Draft application'}
            </h1>
            <p className="mt-1.5 text-sm text-white/75">
              {app.product?.productName
                ? `${app.product.productName} · ${LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}`
                : LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
            </p>

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-sm text-white/70">Requested</p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">
                  {formatCurrency(app.requestedAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/70">Term</p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">
                  {app.requestedTermMonths} months
                </p>
              </div>
              {app.requestedInterestRate != null && (
                <div>
                  <p className="text-sm text-white/70">Rate</p>
                  <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">
                    {app.requestedInterestRate}%
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-2">
            {isDraft && (
              <button
                onClick={() => router.push(`/portal/applications/new?product=&resume=${app.applicationId}`)}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#7f2b7b] shadow-sm transition-transform hover:scale-[1.02]"
              >
                Continue editing
              </button>
            )}
            {isReturned && (
              <button
                onClick={() => router.push(`/portal/applications/new?product=&resume=${app.applicationId}`)}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-orange-600 shadow-sm transition-transform hover:scale-[1.02]"
              >
                Review and resubmit
              </button>
            )}
            {canWithdraw && (
              <button
                onClick={() => setShowWithdrawConfirm(true)}
                className="rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                Withdraw
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Customer Status Headline */}
      {statusInfo && (
        <div
          className={`rounded-3xl border p-6 mb-6 shadow-sm ${
            statusInfo.terminal
              ? isDeclined
                ? 'border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10'
                : ''
              : 'mesh-soft border-fuchsia-100/60'
          }`}
          style={
            statusInfo.terminal && !isDeclined
              ? {
                  backgroundColor: 'var(--surface-input)',
                  borderColor: 'var(--surface-border)',
                }
              : undefined
          }
        >
          <h2
            className={`text-lg font-semibold ${
              isDeclined ? 'text-red-800 dark:text-red-200' : ''
            }`}
            style={
              isDeclined
                ? undefined
                : statusInfo.terminal
                  ? { color: 'var(--text-primary)' }
                  : { color: 'var(--brand-strong)' }
            }
          >
            {statusInfo.headline}
          </h2>
          {statusInfo.detail && (
            <p
              className={`mt-1.5 text-sm ${isDeclined ? 'text-red-600 dark:text-red-300' : ''}`}
              style={
                isDeclined
                  ? undefined
                  : statusInfo.terminal
                    ? { color: 'var(--text-secondary)' }
                    : { color: 'var(--brand)' }
              }
            >
              {statusInfo.detail}
            </p>
          )}
          {statusInfo.lastUpdated && (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Last updated: {formatDateTime(statusInfo.lastUpdated)}
            </p>
          )}
        </div>
      )}

      {/* Where the application actually sits — quiet and factual, no scoring */}
      {statusInfo && !statusInfo.terminal && (
        <StageProgress progress={statusInfo.progress} stage={statusInfo.stage as CustomerStage} />
      )}

      {/* Terminal status message (for old status path, in case statusInfo is missing) */}
      {isTerminal && !statusInfo && (
        <div
          className={`rounded-xl border p-5 mb-6 ${
            app.status === 'DECLINED' ||
            app.status === 'CANCELLED' ||
            app.status === 'KYC_REJECTED' ||
            app.status === 'CREDIT_DECLINED' ||
            app.status === 'UNDERWRITING_DECLINED'
              ? 'border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10'
              : ''
          }`}
          style={
            app.status === 'DECLINED' ||
            app.status === 'CANCELLED' ||
            app.status === 'KYC_REJECTED' ||
            app.status === 'CREDIT_DECLINED' ||
            app.status === 'UNDERWRITING_DECLINED'
              ? undefined
              : { backgroundColor: 'var(--surface-input)', borderColor: 'var(--surface-border)' }
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={app.status} />
            {app.rejectionReason && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {app.rejectionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Approved terms */}
      {app.approvedAmount != null && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 mb-6 shadow-sm dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <h2 className="text-base font-semibold text-emerald-800 dark:text-emerald-200 mb-4">
            Approved terms
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Amount</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                {formatCurrency(app.approvedAmount)}
              </p>
            </div>
            {app.approvedTermMonths != null && (
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Term</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {app.approvedTermMonths} months
                </p>
              </div>
            )}
            {app.approvedInterestRate != null && (
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Interest rate</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {app.approvedInterestRate}% p.a.
                </p>
              </div>
            )}
            {app.approvedMonthlyPayment != null && (
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Monthly payment</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {formatCurrency(app.approvedMonthlyPayment)}
                </p>
              </div>
            )}
          </div>
          {app.conditionalApprovalConditions && (
            <div className="mt-4 text-sm text-emerald-700 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-500/15 rounded-lg p-3">
              <span className="font-semibold">Conditions:</span> {app.conditionalApprovalConditions}
            </div>
          )}
        </div>
      )}

      {/* Offer */}
      {app.offerValidUntil && !app.offerAccepted && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 mb-6 shadow-sm dark:border-amber-500/25 dark:bg-amber-500/10">
          <h2 className="text-base font-semibold text-amber-800 dark:text-amber-200 mb-1">
            Offer available
          </h2>
          <p className="text-sm text-amber-700 dark:text-amber-200">
            Valid until <span className="font-semibold">{formatDate(app.offerValidUntil)}</span>.
            Please accept or contact your relationship manager.
          </p>
        </div>
      )}

      {/* Detail Sections */}
      <div className="space-y-6">
        {/* Loan purpose — the requested amount, term and rate already appear in the
            header above, so they are deliberately not restated here. */}
        {app.loanPurposeDescription && (
          <DetailSection title="Loan purpose">
            <DetailRow label="Description" value={app.loanPurposeDescription} />
          </DetailSection>
        )}

        {/* Financial */}
        {(app.statedAnnualIncome != null ||
          app.statedMonthlyIncome != null ||
          app.statedMonthlyExpenses != null ||
          app.debtToIncomeRatio != null) && (
          <DetailSection title="Financial information">
            {app.statedAnnualIncome != null && (
              <DetailRow label="Annual income" value={formatCurrency(app.statedAnnualIncome)} />
            )}
            {app.statedMonthlyIncome != null && (
              <DetailRow label="Monthly income" value={formatCurrency(app.statedMonthlyIncome)} />
            )}
            {app.statedMonthlyExpenses != null && (
              <DetailRow
                label="Monthly expenses"
                value={formatCurrency(app.statedMonthlyExpenses)}
              />
            )}
            {app.debtToIncomeRatio != null && (
              <DetailRow label="Debt-to-income" value={`${app.debtToIncomeRatio}%`} />
            )}
          </DetailSection>
        )}

        {/* Employment */}
        {(app.employmentStatus || app.employerName) && (
          <DetailSection title="Employment">
            {app.employmentStatus && (
              <DetailRow label="Status" value={app.employmentStatus.replace(/_/g, ' ')} />
            )}
            {app.employerName && <DetailRow label="Employer" value={app.employerName} />}
            {app.jobTitle && <DetailRow label="Title" value={app.jobTitle} />}
            {app.yearsWithEmployer != null && (
              <DetailRow label="Years" value={`${app.yearsWithEmployer}`} />
            )}
          </DetailSection>
        )}

        {/* Documents – interactive */}
        <DocumentsSection applicationId={app.applicationId} />

        {/* Compliance */}
        {(app.kycCompleted != null || app.amlCheckCompleted != null) && (
          <DetailSection title="Compliance">
            {app.kycCompleted != null && (
              <DetailRow label="KYC" value={app.kycCompleted ? 'Completed' : 'Pending'} />
            )}
            {app.amlCheckCompleted != null && (
              <DetailRow
                label="AML check"
                value={app.amlCheckCompleted ? 'Completed' : 'Pending'}
              />
            )}
          </DetailSection>
        )}

        {/* Loan Offer Actions */}
        {!isDraft && (
          <OfferSection
            applicationId={app.applicationId}
            productName={app.product?.productName}
            onAction={() => loadApplication()}
          />
        )}

        {/* E-Signature */}
        {!isDraft && (
          <ESignSection
            applicationId={app.applicationId}
            applicationType={app.loanPurpose}
            onComplete={() => loadApplication()}
          />
        )}

        {/* Booking + Disbursement Progress */}
        {!isDraft && (
          <BookingSection applicationId={app.applicationId} applicationStatus={app.status} />
        )}

        {/* Message RM + Help Request */}
        {!isDraft && <MessageRmSection applicationId={app.applicationId} />}

        {/* Timeline Events */}
        {statusInfo && statusInfo.timeline.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Activity timeline</h2>
            </div>
            <div className="panel-body">
              <EventTimeline events={statusInfo.timeline} />
            </div>
          </div>
        )}

        {/* Static timestamps fallback (when no timeline events) */}
        {(!statusInfo || statusInfo.timeline.length === 0) && (
          <DetailSection title="Timeline">
            <DetailRow label="Created" value={formatDateTime(app.createdAt)} />
            {app.submittedAt && (
              <DetailRow label="Submitted" value={formatDateTime(app.submittedAt)} />
            )}
            {app.reviewStartedAt && (
              <DetailRow label="Review started" value={formatDateTime(app.reviewStartedAt)} />
            )}
            {app.decisionDueDate && (
              <DetailRow label="Decision due" value={formatDate(app.decisionDueDate)} />
            )}
            {app.decisionMadeAt && (
              <DetailRow label="Decision made" value={formatDateTime(app.decisionMadeAt)} />
            )}
            <DetailRow label="Last updated" value={formatDateTime(app.updatedAt)} />
            {app.daysInCurrentStatus != null && (
              <DetailRow
                label="Days in current status"
                value={`${app.daysInCurrentStatus}`}
              />
            )}
            {app.slaBreached && (
              <DetailRow
                label="Review time"
                value="Longer than our target"
                className="font-medium text-red-600 dark:text-red-300"
              />
            )}
          </DetailSection>
        )}
      </div>
    </div>
  );
}

// ─── Documents Section (interactive) ───────────────────────────

const DOC_CATEGORIES: DocumentCategory[] = [
  'IDENTITY',
  'ADDRESS_PROOF',
  'INCOME_PROOF',
  'BANK_STATEMENT',
  'TAX_RETURN',
  'EMPLOYMENT_LETTER',
  'BUSINESS_REGISTRATION',
  'FINANCIAL_STATEMENT',
  'COLLATERAL',
  'INSURANCE',
  'LEGAL',
  'SIGNED_AGREEMENT',
  'OTHER',
];

function DocumentsSection({ applicationId }: { applicationId: string }) {
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /* Which document request the inline form is answering, so "Upload" on a
     specific request pre-selects its category and links the uploaded file. */
  const [uploadTarget, setUploadTarget] = useState<{
    requestId?: string;
    category?: DocumentCategory;
  } | null>(null);

  async function loadDocs() {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, summaryRes] = await Promise.all([
        documentService.getApplicationDocuments(applicationId),
        documentService.getDocumentSummary(applicationId).catch(() => null),
      ]);
      setDocuments(docsRes.documents || []);
      setRequests(docsRes.requests || []);
      setSummary(summaryRes);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'We couldn’t load the documents for this application.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
  }, [applicationId]);

  async function handleUpload(payload: UploadDocumentPayload) {
    setUploading(true);
    setUploadError(null);
    try {
      await documentService.uploadDocument(applicationId, payload);
      setShowUpload(false);
      await loadDocs();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const pendingRequests = requests.filter(
    r => r.status === 'PENDING' || r.status === 'PARTIALLY_FULFILLED'
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Documents</h2>
        <button
          onClick={() => {
            setShowUpload(!showUpload);
            setUploadTarget(null);
            setUploadError(null);
          }}
          className="btn btn-ghost btn-sm"
          type="button"
          aria-expanded={showUpload}
        >
          {showUpload ? 'Cancel' : 'Upload document'}
        </button>
      </div>

      <div className="panel-body space-y-5">
        {/* Summary counters — all three figures come from the documents service */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-xl p-4 text-center"
              style={{ backgroundColor: 'var(--surface-input)' }}
            >
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.totalDocuments}
              </p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                Uploaded
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 text-center dark:bg-amber-500/15">
              <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
                {summary.pendingRequiredRequests}
              </p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">Still needed</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/15">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {summary.allRequiredFulfilled ? 'Yes' : 'No'}
              </p>
              <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-300">All received</p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error flex-col sm:flex-row sm:items-center" role="alert">
            <p className="flex-1">{error}</p>
            <button onClick={loadDocs} className="btn btn-sm btn-outline shrink-0" type="button">
              Try again
            </button>
          </div>
        )}

        {/* Upload form (inline) */}
        {showUpload && (
          <div
            className="rounded-xl border p-4 space-y-4"
            style={{
              borderColor: 'var(--surface-border)',
              backgroundColor: 'var(--surface-input)',
            }}
          >
            {uploadError && (
              <p className="text-sm font-medium text-red-600 dark:text-red-300" role="alert">
                {uploadError}
              </p>
            )}
            <DocUploadForm
              key={uploadTarget?.requestId ?? 'general'}
              requestId={uploadTarget?.requestId}
              initialCategory={uploadTarget?.category}
              uploading={uploading}
              onUpload={handleUpload}
            />
          </div>
        )}

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div>
            <h3
              className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-300"
            >
              Requested by your relationship manager
            </h3>
            <ul className="space-y-2">
              {pendingRequests.map(req => (
                <li
                  key={req.id}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/25 dark:bg-amber-500/10"
                >
                  <span className="text-lg" aria-hidden="true">
                    {getCategoryIcon(req.category)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                      {req.title}
                    </p>
                    {req.description && (
                      <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {req.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`badge ${REQUEST_STATUS_COLORS[req.status] || 'badge-neutral'}`}
                      >
                        {REQUEST_STATUS_LABELS[req.status] || req.status}
                      </span>
                      {req.required && <span className="badge badge-neutral">Required</span>}
                      {req.dueDate && (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Due{' '}
                          {new Date(req.dueDate).toLocaleDateString('en-IE', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  {req.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        setUploadTarget({ requestId: req.id, category: req.category });
                        setUploadError(null);
                        setShowUpload(true);
                      }}
                      className="btn btn-primary btn-sm shrink-0"
                      type="button"
                      aria-label={`Upload ${req.title}`}
                    >
                      Upload
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <p className="sr-only" role="status">Loading documents…</p>
            {[1, 2].map(i => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border px-5 py-4"
                style={{ borderColor: 'var(--surface-border)' }}
              >
                <div className="skeleton h-6 w-6 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3.5 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : documents.length === 0 && pendingRequests.length === 0 && !error ? (
          <div className="py-6 text-center">
            <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
              No documents yet
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Upload a document, or wait for your relationship manager to request one.
            </p>
          </div>
        ) : documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map(doc => {
              const statusColor = UPLOAD_STATUS_COLORS[doc.uploadStatus] || 'badge-neutral';
              return (
                <li
                  key={doc.id}
                  className="flex items-start gap-3 rounded-xl border px-5 py-4"
                  style={{ borderColor: 'var(--surface-border)' }}
                >
                  <span className="text-lg" aria-hidden="true">
                    {getCategoryIcon(doc.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-base font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {doc.fileName}
                    </p>
                    <div
                      className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{CATEGORY_LABELS[doc.category] || doc.category}</span>
                      {doc.fileSizeBytes != null && (
                        <span className="tabular-nums">{formatFileSize(doc.fileSizeBytes)}</span>
                      )}
                      <span className={`badge ${statusColor}`}>
                        {UPLOAD_STATUS_LABELS[doc.uploadStatus] || doc.uploadStatus}
                      </span>
                    </div>
                    {doc.rejectionReason && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-300">
                        <span className="font-semibold">Not accepted:</span> {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function DocUploadForm({
  requestId,
  initialCategory,
  uploading,
  onUpload,
}: {
  requestId: string | undefined;
  initialCategory?: DocumentCategory;
  uploading: boolean;
  onUpload: (payload: UploadDocumentPayload) => void;
}) {
  const [category, setCategory] = useState<DocumentCategory>(initialCategory ?? 'IDENTITY');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const missingName = !fileName.trim();

  return (
    <>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Fields marked <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="doc-category">
            Category{' '}
            <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <select
            id="doc-category"
            value={category}
            onChange={e => setCategory(e.target.value as DocumentCategory)}
            className="select"
            required
            aria-required="true"
          >
            {DOC_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="doc-name">
            Document name{' '}
            <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            id="doc-name"
            type="text"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            placeholder="e.g. Passport.pdf"
            className="input"
            required
            aria-required="true"
            aria-invalid={missingName || undefined}
            aria-describedby="doc-name-hint"
          />
          <p id="doc-name-hint" className="field-hint">
            {missingName ? 'Enter a file name to enable upload.' : 'For example Passport.pdf'}
          </p>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="doc-notes">
          Notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <input
          id="doc-notes"
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="input"
          placeholder="Additional information…"
        />
      </div>
      <div className="text-right">
        <button
          onClick={() => {
            if (!fileName.trim()) return;
            onUpload({
              category,
              fileName: fileName.trim(),
              requestId,
              notes: notes.trim() || undefined,
            });
          }}
          disabled={missingName || uploading}
          className="btn btn-primary btn-sm"
          type="button"
        >
          {uploading ? 'Uploading…' : 'Upload document'}
        </button>
      </div>
    </>
  );
}

// ─── Offer Section ─────────────────────────────────────────────

function OfferSection({
  applicationId,
  productName,
  onAction,
}: {
  applicationId: string;
  productName?: string;
  onAction: () => void;
}) {
  const [data, setData] = useState<OfferWithConditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [counterAmount, setCounterAmount] = useState('');
  const [counterTerm, setCounterTerm] = useState('');
  const [counterRate, setCounterRate] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  /* Inline failure state — an offer action that fails must not vanish into a
     native alert, and the customer's typed proposal must survive the retry. */
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadOffer();
  }, [applicationId]);

  async function loadOffer() {
    try {
      const res = await offerService.getLatestOffer(applicationId);
      setData(res);
    } catch {
      // no offer yet — fine
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;
  if (!data?.offer) return null;

  const offer = data.offer;
  const conditions = data.conditions ?? [];
  const isIssued = offer.status === 'ISSUED';
  const isTerminal = ['ACCEPTED', 'REJECTED', 'EXPIRED', 'VOIDED'].includes(offer.status);

  // Expiry countdown
  let expiryText = '';
  let expiryUrgent = false;
  if (offer.expiryAt && isIssued) {
    const diff = new Date(offer.expiryAt).getTime() - Date.now();
    if (diff <= 0) {
      expiryText = 'Expired';
      expiryUrgent = true;
    } else {
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      if (days > 0) {
        expiryText = `${days}d ${hours}h remaining`;
        expiryUrgent = days <= 3;
      } else {
        expiryText = `${hours}h remaining`;
        expiryUrgent = true;
      }
    }
  }

  async function handleAccept() {
    if (!confirm('Are you sure you want to accept this offer? This action cannot be undone.'))
      return;
    setActing(true);
    setActionError(null);
    try {
      await offerService.acceptOffer(applicationId, offer.id);
      await loadOffer();
      onAction();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'We couldn’t accept this offer.');
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    setActionError(null);
    try {
      await offerService.rejectOffer(applicationId, offer.id, rejectReason || undefined);
      setShowReject(false);
      setRejectReason('');
      await loadOffer();
      onAction();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'We couldn’t record your decline.');
    } finally {
      setActing(false);
    }
  }

  async function handleCounter() {
    setActing(true);
    setActionError(null);
    try {
      await offerService.counterOffer(applicationId, offer.id, {
        proposedAmount: counterAmount ? parseFloat(counterAmount) : undefined,
        proposedTermMonths: counterTerm ? parseInt(counterTerm) : undefined,
        proposedRate: counterRate ? parseFloat(counterRate) : undefined,
        notes: counterNotes || undefined,
      });
      setShowCounter(false);
      setCounterAmount('');
      setCounterTerm('');
      setCounterRate('');
      setCounterNotes('');
      await loadOffer();
      onAction();
    } catch (e: unknown) {
      setActionError(
        e instanceof Error ? e.message : 'We couldn’t submit your counter offer.'
      );
    } finally {
      setActing(false);
    }
  }

  const statusBadge = (
    <span
      className={`badge ${OFFER_STATUS_COLORS[offer.status as OfferStatus] ?? 'badge-neutral'}`}
    >
      {OFFER_STATUS_LABELS[offer.status as OfferStatus] ?? offer.status}
    </span>
  );

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header flex-wrap">
        <h2 className="panel-title flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            style={{ color: 'var(--brand)' }}
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
          {productName ? productName : 'Loan'} offer
          {offer.version > 1 && (
            <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
              Version {offer.version}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {expiryText && (
            <span
              className={`text-sm px-2.5 py-1 rounded-full ${expiryUrgent ? 'bg-red-50 text-red-600 font-medium dark:bg-red-500/15 dark:text-red-300' : 'chip'}`}
            >
              <span aria-hidden="true">{expiryUrgent ? '⏰ ' : '🕐 '}</span>
              {expiryText}
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      <div className="panel-body space-y-5">
      {actionError && (
        <div className="alert alert-error flex-col sm:flex-row sm:items-center" role="alert">
          <p className="flex-1">{actionError}</p>
          <button onClick={loadOffer} className="btn btn-sm btn-outline shrink-0" type="button">
            Reload offer
          </button>
        </div>
      )}

      {/* Offer Terms Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Approved amount
          </p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {new Intl.NumberFormat('en-IE', {
              style: 'currency',
              currency: offer.currency || 'EUR',
              maximumFractionDigits: 0,
            }).format(offer.amount)}
          </p>
        </div>
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Interest rate
          </p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {offer.interestRate}%{' '}
            <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
              {offer.rateType}
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Term
          </p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {offer.termMonths} months
          </p>
        </div>
        {offer.repaymentEstimate != null && (
          <div>
            <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Estimated monthly payment
            </p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
              {new Intl.NumberFormat('en-IE', {
                style: 'currency',
                currency: offer.currency || 'EUR',
                maximumFractionDigits: 0,
              }).format(offer.repaymentEstimate)}
            </p>
          </div>
        )}
        {offer.apr != null && (
          <div>
            <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
              APR
            </p>
            <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {offer.apr}%
            </p>
          </div>
        )}
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Repayment frequency
          </p>
          <p
            className="text-base font-medium capitalize"
            style={{ color: 'var(--text-secondary)' }}
          >
            {(offer.repaymentFrequency || 'MONTHLY').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div
          className="border-t pt-4"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Conditions
          </h3>
          <ul className="space-y-2">
            {conditions.map(c => {
              const settled = c.status === 'SATISFIED' || c.status === 'WAIVED';
              const stateText =
                c.status === 'SATISFIED'
                  ? 'Satisfied'
                  : c.status === 'WAIVED'
                    ? 'Waived'
                    : 'Outstanding';
              return (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 ${
                      c.status === 'SATISFIED'
                        ? 'text-emerald-500'
                        : c.status === 'WAIVED'
                          ? 'text-sky-500'
                          : 'text-amber-500'
                    }`}
                    aria-hidden="true"
                  >
                    {c.status === 'SATISFIED' ? '✓' : c.status === 'WAIVED' ? '~' : '○'}
                  </span>
                  <span className="sr-only">{stateText}: </span>
                  <span
                    className={settled ? 'line-through' : ''}
                    style={{
                      color: settled ? 'var(--text-muted)' : 'var(--text-secondary)',
                    }}
                  >
                    {c.description}
                    {c.isMandatory && c.status === 'PENDING' && (
                      <span className="ml-1 text-sm font-medium text-red-500 dark:text-red-300">
                        (required)
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action Buttons — only for ISSUED offers */}
      {isIssued && !showReject && !showCounter && (
        <div
          className="flex flex-wrap gap-3 border-t pt-4"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <button onClick={handleAccept} disabled={acting} className="btn btn-primary flex-1" type="button">
            {acting ? 'Processing…' : 'Accept offer'}
          </button>
          <button
            onClick={() => {
              setActionError(null);
              setShowCounter(true);
            }}
            disabled={acting}
            className="btn btn-secondary flex-1"
            type="button"
          >
            Counter offer
          </button>
          <button
            onClick={() => {
              setActionError(null);
              setShowReject(true);
            }}
            disabled={acting}
            className="btn btn-outline text-red-600 dark:text-red-300"
            type="button"
          >
            Decline
          </button>
        </div>
      )}

      {/* Reject Form */}
      {showReject && (
        <div
          className="space-y-4 border-t pt-4"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <label className="field-label" htmlFor="offer-reject-reason">
            Why are you declining this offer?{' '}
            <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <textarea
            id="offer-reject-reason"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Tell us why — this helps us improve future offers"
            rows={2}
            className="input resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={handleReject} disabled={acting} className="btn btn-danger btn-sm" type="button">
              {acting ? 'Processing…' : 'Confirm decline'}
            </button>
            <button
              onClick={() => {
                setShowReject(false);
                setRejectReason('');
              }}
              className="btn btn-ghost btn-sm"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Counter Offer Form */}
      {showCounter && (
        <div
          className="space-y-4 border-t pt-4"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <div>
            <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
              Propose your terms
            </p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Leave a field blank to keep the original value.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="field-label" htmlFor="counter-amount">
                Amount ({offer.currency})
              </label>
              <input
                id="counter-amount"
                type="number"
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                placeholder={String(offer.amount)}
                className="input tabular-nums"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="counter-term">
                Term (months)
              </label>
              <input
                id="counter-term"
                type="number"
                value={counterTerm}
                onChange={e => setCounterTerm(e.target.value)}
                placeholder={String(offer.termMonths)}
                className="input tabular-nums"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="counter-rate">
                Rate (%)
              </label>
              <input
                id="counter-rate"
                type="number"
                step="0.01"
                value={counterRate}
                onChange={e => setCounterRate(e.target.value)}
                placeholder={String(offer.interestRate)}
                className="input tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="counter-notes">
              Notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              id="counter-notes"
              value={counterNotes}
              onChange={e => setCounterNotes(e.target.value)}
              placeholder="Explain your proposal…"
              rows={2}
              className="input resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleCounter} disabled={acting} className="btn btn-primary btn-sm" type="button">
              {acting ? 'Submitting…' : 'Submit counter offer'}
            </button>
            <button
              onClick={() => {
                setShowCounter(false);
                setCounterAmount('');
                setCounterTerm('');
                setCounterRate('');
                setCounterNotes('');
              }}
              className="btn btn-ghost btn-sm"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Terminal state messages */}
      {offer.status === 'ACCEPTED' && (
        <div className="border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm text-emerald-600 dark:text-emerald-300 font-medium">
            <span aria-hidden="true">✓ </span>You accepted this offer
            {offer.acceptedAt ? ` on ${formatDate(offer.acceptedAt)}` : ''}
          </p>
        </div>
      )}
      {offer.status === 'REJECTED' && (
        <div className="border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm text-red-500 dark:text-red-300">
            You declined this offer{offer.voidReason ? `: ${offer.voidReason}` : ''}
          </p>
        </div>
      )}
      {offer.status === 'EXPIRED' && (
        <div className="border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm text-amber-600 dark:text-amber-300">
            This offer has expired. Contact your relationship manager for a new offer.
          </p>
        </div>
      )}
      {offer.status === 'COUNTERED' && (
        <div className="border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm" style={{ color: 'var(--brand-on-soft)' }}>
            Your counter offer has been submitted. Your relationship manager will review and
            respond.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── E-Sign Section ────────────────────────────────────────────

function ESignSection({
  applicationId,
  applicationType,
  onComplete,
}: {
  applicationId: string;
  applicationType?: string;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<EsignStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [signingUrl, setSigning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, [applicationId]);

  async function loadStatus() {
    try {
      const res = await esignService.getStatus(applicationId);
      setStatus(res);
    } catch {
      // no e-sign yet
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  // Don't show if no e-sign has started and status is NOT_STARTED
  // We still show the section so the customer can initiate signing
  const overallStatus = status?.overallStatus ?? 'NOT_STARTED';
  const signers = status?.signers ?? [];
  const completedCount = status?.completedCount ?? 0;
  const totalCount = status?.totalCount ?? 0;
  const isBusiness = applicationType?.toLowerCase().includes('business');
  const isComplete = overallStatus === 'COMPLETED';
  const isDeclined = overallStatus === 'DECLINED';

  async function handleStartSigning() {
    setStarting(true);
    setActionError(null);
    try {
      const res = await esignService.startSigning(applicationId);
      setSigning(res.signingUrl);
      // Reload status after a short delay to show the new envelope
      setTimeout(() => {
        loadStatus();
      }, 1000);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'We couldn’t start the signing session.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSimulateComplete(envelopeId: string) {
    setActionError(null);
    try {
      await esignService.simulateComplete(applicationId, envelopeId);
      await loadStatus();
      onComplete();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'We couldn’t record that signature.');
    }
  }

  const statusBadge = (
    <span
      className={`badge ${
        ESIGN_STATUS_COLORS[overallStatus as EsignOverallStatus] ?? 'badge-neutral'
      }`}
    >
      {ESIGN_STATUS_LABELS[overallStatus as EsignOverallStatus] ?? overallStatus}
    </span>
  );

  // Progress bar width
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header flex-wrap">
        <h2 className="panel-title flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            style={{ color: 'var(--brand)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          E-signature
        </h2>
        {statusBadge}
      </div>

      <div className="panel-body space-y-5">
      {actionError && (
        <div className="alert alert-error flex-col sm:flex-row sm:items-center" role="alert">
          <p className="flex-1">{actionError}</p>
          <button onClick={loadStatus} className="btn btn-sm btn-outline shrink-0" type="button">
            Try again
          </button>
        </div>
      )}

      {/* Signer progress (multi-signatory business applications) */}
      {isBusiness && totalCount > 1 && (
        <div>
          <div
            className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span id="signer-progress-label">Signer progress</span>
            <span className="tabular-nums">
              {completedCount} of {totalCount} signed
            </span>
          </div>
          <div
            className="h-1 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={completedCount}
            aria-labelledby="signer-progress-label"
            style={{ backgroundColor: 'var(--surface-input)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor: isComplete ? 'rgb(16 185 129)' : 'var(--brand)',
              }}
            />
          </div>
        </div>
      )}

      {/* Signers list */}
      {signers.length > 0 && (
        <ul className="space-y-2">
          {signers.map(s => {
            const signerLabel =
              s.status === 'COMPLETED'
                ? 'Signed'
                : s.status === 'DECLINED'
                  ? 'Declined'
                  : s.status === 'SENT' || s.status === 'DELIVERED'
                    ? 'Awaiting signature'
                    : toSentenceCase(s.status);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-5 py-4"
                style={{ backgroundColor: 'var(--surface-input)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      s.status === 'COMPLETED'
                        ? 'text-emerald-500'
                        : s.status === 'DECLINED'
                          ? 'text-red-500'
                          : ''
                    }
                    style={
                      s.status === 'COMPLETED' || s.status === 'DECLINED'
                        ? undefined
                        : { color: 'var(--text-muted)' }
                    }
                    aria-hidden="true"
                  >
                    {s.status === 'COMPLETED' ? '✓' : s.status === 'DECLINED' ? '✗' : '○'}
                  </span>
                  <div>
                    <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                      {s.name}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {s.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {signerLabel}
                  </span>
                  {/* Dev: simulate complete */}
                  {(s.status === 'SENT' || s.status === 'DELIVERED') && (
                    <button
                      onClick={() => handleSimulateComplete(s.envelopeId)}
                      className="btn btn-ghost btn-sm"
                      title="Simulate completion (dev)"
                      aria-label={`Simulate signature completion for ${s.name}`}
                      type="button"
                    >
                      Simulate
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Sign Now button */}
      {!isComplete && !isDeclined && (
        <div>
          {signingUrl ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your signing session is ready. Open it to review and sign the agreement.
              </p>
              <button
                onClick={() => router.push(signingUrl)}
                className="btn btn-primary w-full"
                type="button"
              >
                Open signing session
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartSigning}
              disabled={starting}
              className="btn btn-primary w-full"
              type="button"
            >
              {starting ? (
                <>
                  <span className="spinner h-4 w-4 border-2" aria-hidden="true" />
                  Preparing…
                </>
              ) : (
                <>
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Sign now
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Completed message */}
      {isComplete && (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300" role="status">
          <span aria-hidden="true">✓ </span>All signatures have been collected
        </p>
      )}

      {/* Declined message */}
      {isDeclined && (
        <p className="text-sm text-red-500 dark:text-red-300" role="alert">
          A signer has declined. Please contact your relationship manager.
        </p>
      )}
      </div>
    </div>
  );
}

// ─── Booking + Disbursement Section ────────────────────────────

function BookingSection({
  applicationId,
  applicationStatus,
}: {
  applicationId: string;
  applicationStatus: string;
}) {
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBookingStatus();
  }, [applicationId]);

  async function loadBookingStatus() {
    // Only fetch if the application has reached the booking phase
    if (!isBookingPhaseStatus(applicationStatus)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await bookingService.getStatus(applicationId);
      setStatus(result);
      setError(null);
    } catch (err: unknown) {
      // 404 = no booking record yet, which is normal
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        setStatus(null);
      } else {
        setError('Unable to load booking status');
      }
    } finally {
      setLoading(false);
    }
  }

  // Don't render unless we're in the booking phase
  if (!isBookingPhaseStatus(applicationStatus) && !status) {
    return null;
  }

  if (loading) {
    return (
      <div className="card p-5" aria-busy="true">
        <p className="sr-only" role="status">Loading booking status…</p>
        <div className="space-y-3">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5">
        <div className="alert alert-error flex-col sm:flex-row sm:items-center" role="alert">
          <p className="flex-1">{error}</p>
          <button
            onClick={loadBookingStatus}
            className="btn btn-sm btn-outline shrink-0"
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const phase = status.phase as BookingPhase;
  const phaseLabel = PHASE_LABELS[phase] || phase;
  const phaseColor = PHASE_COLORS[phase] || 'badge-neutral';

  const completedCount = status.milestones.filter(m => m.status === 'COMPLETED').length;
  const totalCount = status.milestones.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="card p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            style={{ color: 'var(--brand)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Booking and disbursement
        </h2>
        <span className={`badge ${phaseColor}`}>{phaseLabel}</span>
      </div>

      {/* Progress Bar */}
      <div>
        <div
          className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <span id="booking-progress-label" className="tabular-nums">
            {completedCount} of {totalCount} milestones complete
          </span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={completedCount}
          aria-labelledby="booking-progress-label"
          style={{ backgroundColor: 'var(--surface-input)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, backgroundColor: 'var(--brand)' }}
          />
        </div>
      </div>

      {/* Milestone Timeline */}
      <ol className="relative pl-6 space-y-4">
        {status.milestones.map((milestone, idx) => {
          const isLast = idx === status.milestones.length - 1;
          const msStatus = milestone.status as MilestoneStatus;
          const iconColor = MILESTONE_STATUS_COLORS[msStatus] || '';

          return (
            <li key={milestone.key} className="relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-[-16px] top-6 w-0.5 h-full ${
                    msStatus === 'COMPLETED' ? 'bg-emerald-300 dark:bg-emerald-500/40' : ''
                  }`}
                  style={
                    msStatus === 'COMPLETED'
                      ? undefined
                      : { backgroundColor: 'var(--surface-border)' }
                  }
                  aria-hidden="true"
                />
              )}

              {/* Status icon */}
              <div
                className={`absolute left-[-22px] top-1 ${iconColor}`}
                style={iconColor ? undefined : { color: 'var(--text-muted)' }}
                aria-hidden="true"
              >
                {msStatus === 'COMPLETED' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : msStatus === 'IN_PROGRESS' ? (
                  <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div>
                <p
                  className={`text-base font-medium ${
                    msStatus === 'IN_PROGRESS' ? 'text-sky-700 dark:text-sky-300' : ''
                  }`}
                  style={
                    msStatus === 'IN_PROGRESS'
                      ? undefined
                      : {
                          color:
                            msStatus === 'COMPLETED'
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                        }
                  }
                >
                  <span className="sr-only">{MILESTONE_STATUS_TEXT[msStatus] ?? msStatus}: </span>
                  {milestone.label}
                </p>
                <p
                  className={`text-sm mt-0.5 ${
                    msStatus === 'IN_PROGRESS' ? 'text-sky-500 dark:text-sky-300' : ''
                  }`}
                  style={
                    msStatus === 'IN_PROGRESS'
                      ? undefined
                      : {
                          color:
                            msStatus === 'COMPLETED'
                              ? 'var(--text-secondary)'
                              : 'var(--text-muted)',
                        }
                  }
                >
                  {milestone.description}
                </p>
                {milestone.completedAt && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(milestone.completedAt).toLocaleDateString('en-IE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Account Details (shown when booked) */}
      {status.accountNumber && (
        <div
          className="rounded-xl p-4 space-y-1.5"
          style={{ backgroundColor: 'var(--brand-soft)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
            Loan account details
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex gap-1.5">
              <dt style={{ color: 'var(--text-muted)' }}>Account:</dt>
              <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {status.accountNumber}
              </dd>
            </div>
            {status.arrangementId && (
              <div className="flex gap-1.5">
                <dt style={{ color: 'var(--text-muted)' }}>Reference:</dt>
                <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {status.arrangementId}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Disbursement Details (shown when disbursed) */}
      {status.disbursementReference && (
        <div className="rounded-xl p-4 space-y-1.5 bg-emerald-50 dark:bg-emerald-500/10">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Disbursement details
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex gap-1.5">
              <dt style={{ color: 'var(--text-muted)' }}>Reference:</dt>
              <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {status.disbursementReference}
              </dd>
            </div>
            {status.disbursementAmount != null && (
              <div className="flex gap-1.5">
                <dt style={{ color: 'var(--text-muted)' }}>Amount:</dt>
                <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
                    status.disbursementAmount
                  )}
                </dd>
              </div>
            )}
            {status.disbursementAccount && (
              <div className="flex gap-1.5 sm:col-span-2">
                <dt style={{ color: 'var(--text-muted)' }}>To account:</dt>
                <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {status.disbursementAccount}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Completed Banner */}
      {phase === 'DISBURSED' || phase === 'ACTIVE' || phase === 'CLOSED' ? (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10">
          <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">
            {phase === 'CLOSED'
              ? 'Loan fully repaid and closed'
              : phase === 'ACTIVE'
                ? 'Your loan is active and performing'
                : 'Funds have been disbursed to your account'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Message RM Section ────────────────────────────────────────

type MessageTab = 'messages' | 'help' | 'callback';

function MessageRmSection({ applicationId }: { applicationId: string }) {
  const [tab, setTab] = useState<MessageTab>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Help request state
  const [helpSubject, setHelpSubject] = useState('');
  const [helpBody, setHelpBody] = useState('');
  const [helpSending, setHelpSending] = useState(false);

  // Callback request state
  const [cbDate, setCbDate] = useState('');
  const [cbTimeSlot, setCbTimeSlot] = useState('');
  const [cbNotes, setCbNotes] = useState('');
  const [cbSending, setCbSending] = useState(false);
  /* Surfaced inline — the customer keeps whatever they typed and can retry. */
  const [formError, setFormError] = useState<string | null>(null);

  async function loadMessages() {
    setLoading(true);
    try {
      const res = await messagingService.getMessages(applicationId);
      setConversation(res.conversation);
      setMessages(res.messages);
    } catch {
      // Conversation may not exist yet — that's fine
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, [applicationId]);

  async function handleSend() {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    setFormError(null);
    try {
      await messagingService.sendMessage(applicationId, newMessage.trim());
      setNewMessage('');
      await loadMessages();
    } catch {
      setFormError('We couldn’t send that message. It has been kept — please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleHelpRequest() {
    if (!helpSubject.trim() || !helpBody.trim() || helpSending) return;
    setHelpSending(true);
    setFormError(null);
    try {
      await messagingService.createHelpRequest(applicationId, helpSubject.trim(), helpBody.trim());
      setHelpSubject('');
      setHelpBody('');
      setTab('messages');
      await loadMessages();
    } catch {
      setFormError('We couldn’t create that help request. Your details have been kept.');
    } finally {
      setHelpSending(false);
    }
  }

  async function handleCallbackRequest() {
    if (cbSending) return;
    setCbSending(true);
    setFormError(null);
    try {
      await messagingService.createCallbackRequest(applicationId, {
        preferredDate: cbDate || undefined,
        preferredTimeSlot: cbTimeSlot || undefined,
        notes: cbNotes || undefined,
      });
      setCbDate('');
      setCbTimeSlot('');
      setCbNotes('');
      setTab('messages');
      await loadMessages();
    } catch {
      setFormError('We couldn’t request that callback. Your details have been kept.');
    } finally {
      setCbSending(false);
    }
  }

  const tabs: { key: MessageTab; label: string }[] = [
    {
      key: 'messages',
      label: `Messages${conversation && conversation.messageCount > 0 ? ` (${conversation.messageCount})` : ''}`,
    },
    { key: 'help', label: 'Request help' },
    { key: 'callback', label: 'Request a call' },
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Your relationship manager</h2>
      </div>

      <div className="panel-body space-y-5">
        {/* Tab header */}
        <div
          className="no-scrollbar overflow-x-auto"
          role="region"
          aria-label="Ways to contact your relationship manager — scroll horizontally to see all"
          tabIndex={0}
        >
          <div className="segmented" role="group" aria-label="Contact options">
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                data-active={tab === t.key ? 'true' : undefined}
                onClick={() => {
                  setTab(t.key);
                  setFormError(null);
                }}
                className="segmented-item"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        {/* Messages tab */}
        {tab === 'messages' && (
          <div>
            {loading ? (
              <div className="space-y-3 py-2" aria-busy="true">
                <p className="sr-only" role="status">Loading messages…</p>
                <div className="skeleton ml-auto h-12 w-2/3 rounded-xl" />
                <div className="skeleton h-12 w-1/2 rounded-xl" />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No messages yet. Send a message, or ask for help or a callback.
              </p>
            ) : (
              <div
                className="mb-3 max-h-80 space-y-3 overflow-y-auto pr-1"
                role="region"
                aria-label="Message history — scroll to read earlier messages"
                tabIndex={0}
              >
                {messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            )}

            {/* Compose */}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="new-message">
                Message
              </label>
              <input
                id="new-message"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message…"
                className="input flex-1 min-w-[12rem]"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="btn btn-primary"
                type="button"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* Help request tab */}
        {tab === 'help' && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Describe your issue and your relationship manager will receive a task to assist you.
              Fields marked <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">with an asterisk</span> are required.
            </p>
            <div>
              <label className="field-label" htmlFor="help-subject">
                Subject{' '}
                <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <input
                id="help-subject"
                value={helpSubject}
                onChange={e => setHelpSubject(e.target.value)}
                placeholder="e.g. Question about document requirements"
                className="input"
                required
                aria-required="true"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="help-body">
                Message{' '}
                <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <textarea
                id="help-body"
                value={helpBody}
                onChange={e => setHelpBody(e.target.value)}
                rows={3}
                placeholder="Describe what you need help with…"
                className="input"
                required
                aria-required="true"
              />
            </div>
            <div className="text-right">
              <button
                onClick={handleHelpRequest}
                disabled={!helpSubject.trim() || !helpBody.trim() || helpSending}
                className="btn btn-primary"
                type="button"
              >
                {helpSending ? 'Sending…' : 'Request help'}
              </button>
            </div>
          </div>
        )}

        {/* Callback request tab */}
        {tab === 'callback' && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Request a callback from your relationship manager at a convenient time. Every field
              is optional.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="cb-date">
                  Preferred date
                </label>
                <input
                  id="cb-date"
                  type="date"
                  value={cbDate}
                  onChange={e => setCbDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="cb-time">
                  Preferred time
                </label>
                <select
                  id="cb-time"
                  value={cbTimeSlot}
                  onChange={e => setCbTimeSlot(e.target.value)}
                  className="select"
                >
                  <option value="">Any time</option>
                  <option value="09:00-11:00">9 AM – 11 AM</option>
                  <option value="11:00-13:00">11 AM – 1 PM</option>
                  <option value="14:00-16:00">2 PM – 4 PM</option>
                  <option value="16:00-18:00">4 PM – 6 PM</option>
                </select>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="cb-notes">
                Notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input
                id="cb-notes"
                value={cbNotes}
                onChange={e => setCbNotes(e.target.value)}
                placeholder="What would you like to discuss?"
                className="input"
              />
            </div>
            <div className="text-right">
              <button
                onClick={handleCallbackRequest}
                disabled={cbSending}
                className="btn btn-primary"
                type="button"
              >
                {cbSending ? 'Requesting…' : 'Request callback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isCustomer = message.senderType === 'CUSTOMER';
  const isSystem = message.senderType === 'SYSTEM';
  const senderColor =
    SENDER_TYPE_COLORS[message.senderType as SenderType] || SENDER_TYPE_COLORS.SYSTEM;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span
          className="rounded-full px-3 py-1 text-sm"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-input)' }}
        >
          <span className="sr-only">System message: </span>
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] rounded-xl px-4 py-3"
        style={
          isCustomer
            ? { backgroundColor: 'var(--brand)', color: '#fff' }
            : { backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)' }
        }
      >
        <span className="sr-only">{isCustomer ? 'You sent: ' : `${message.senderName ?? 'Bank'}: `}</span>
        {!isCustomer && message.senderName && (
          <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {message.senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <p
          className="mt-1 text-xs"
          style={{ color: isCustomer ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Application progress (quiet, factual — thin bar + plain step line) ───

function toSentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function StageProgress({ progress, stage }: { progress: number; stage: CustomerStage }) {
  const stageIndex = CUSTOMER_STAGES.findIndex(s => s.key === stage);
  const knownStage = stageIndex >= 0;
  const activeIndex = knownStage ? stageIndex : 0;
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="panel mb-6">
      <div className="panel-header flex-wrap">
        <h2 className="panel-title">Application progress</h2>
        {knownStage && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Step {activeIndex + 1} of {CUSTOMER_STAGES.length} ·{' '}
            {toSentenceCase(CUSTOMER_STAGES[activeIndex].label)}
          </p>
        )}
      </div>
      <div className="panel-body">
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedProgress}
          aria-label={`Application progress: ${clampedProgress}%${
            knownStage
              ? `, step ${activeIndex + 1} of ${CUSTOMER_STAGES.length} — ${toSentenceCase(
                  CUSTOMER_STAGES[activeIndex].label
                )}`
              : ''
          }`}
          style={{ backgroundColor: 'var(--surface-input)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${clampedProgress}%`, backgroundColor: 'var(--brand)' }}
          />
        </div>

        <div
          className="no-scrollbar mt-4 overflow-x-auto"
          role="region"
          aria-label="Application stages — scroll horizontally to see all"
          tabIndex={0}
        >
          <ol className="flex min-w-max items-center gap-2">
            {CUSTOMER_STAGES.map((s, i) => {
              const isCurrent = knownStage && i === activeIndex;
              const isPast = knownStage && i < activeIndex;
              return (
                <li
                  key={s.key}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: isCurrent ? 'var(--brand-soft)' : 'transparent',
                    color: isCurrent
                      ? 'var(--brand-on-soft)'
                      : isPast
                        ? 'var(--text-secondary)'
                        : 'var(--text-muted)',
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {isPast && (
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {toSentenceCase(s.label)}
                  {isCurrent && <span className="sr-only">(current stage)</span>}
                  {isPast && <span className="sr-only">(completed)</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Event Timeline ────────────────────────────────────────────

const TIMELINE_ICON_STYLES: Record<string, { bg: string; text: string; symbol: string }> = {
  info: { bg: 'bg-sky-100 dark:bg-sky-500/15', text: 'text-sky-600 dark:text-sky-300', symbol: 'ℹ' },
  success: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-300',
    symbol: '✓',
  },
  warning: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-600 dark:text-red-300',
    symbol: '!',
  },
  action: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-300',
    symbol: '→',
  },
  milestone: {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15',
    text: 'text-fuchsia-600 dark:text-fuchsia-300',
    symbol: '★',
  },
};

/* The marker symbol is decorative — the event kind is always spelled out too,
   so the timeline never relies on colour or shape alone. */
const TIMELINE_ICON_TEXT: Record<string, string> = {
  info: 'Update',
  success: 'Completed',
  warning: 'Needs attention',
  action: 'Action',
  milestone: 'Milestone',
};

function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-3.5 top-2 bottom-2 w-0.5"
        style={{ backgroundColor: 'var(--surface-border)' }}
        aria-hidden="true"
      />

      <ol className="space-y-4">
        {events.map((evt, i) => {
          const iconStyle = TIMELINE_ICON_STYLES[evt.icon] || TIMELINE_ICON_STYLES.info;
          const iconText = TIMELINE_ICON_TEXT[evt.icon] || TIMELINE_ICON_TEXT.info;

          return (
            <li key={i} className="relative flex gap-3">
              {/* Icon */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${iconStyle.bg} ${iconStyle.text}`}
                aria-hidden="true"
              >
                {iconStyle.symbol}
              </div>

              {/* Content */}
              <div className="pt-0.5 min-w-0">
                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  {evt.title}
                </p>
                {evt.description && (
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {evt.description}
                  </p>
                )}
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {iconText} · {formatDateTime(evt.timestamp)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</dl>
    </div>
  );
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:flex-col sm:items-start sm:gap-1"
      style={{ backgroundColor: 'var(--surface-input)' }}
    >
      <dt className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
      <dd
        className={`text-base font-semibold tabular-nums ${className || ''}`}
        style={className ? undefined : { color: 'var(--text-primary)' }}
      >
        {value}
      </dd>
    </div>
  );
}
