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
  SIGNER_STATUS_COLORS,
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
      <div className="max-w-3xl mx-auto">
        <div className="skeleton h-8 w-64 mb-6" />
        <div className="card space-y-4">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/portal/applications')}
          className="btn btn-ghost btn-sm mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <p className="font-medium">{error || 'Application not found'}</p>
          <button onClick={loadApplication} className="btn btn-ghost btn-sm mt-1">
            Retry
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
          aria-label="Withdraw application"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border p-6"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Withdraw application?
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone. Your application will be permanently withdrawn.
            </p>
            <div className="mt-4">
              <label className="field-label" htmlFor="withdraw-reason">
                Reason (optional)
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
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    setWithdrawing(true);
                    await applicationService.withdraw(
                      app.applicationId,
                      withdrawReason || undefined
                    );
                    setShowWithdrawConfirm(false);
                    setWithdrawReason('');
                    loadApplication();
                  } catch (err: any) {
                    setError(err.message || 'Failed to withdraw');
                  } finally {
                    setWithdrawing(false);
                  }
                }}
                disabled={withdrawing}
                className="btn btn-danger"
              >
                {withdrawing ? 'Withdrawing...' : 'Confirm withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return for corrections banner */}
      {isReturned && (
        <div className="alert alert-warning mb-6" role="alert">
          <span className="text-lg leading-none">⚠</span>
          <div>
            <h4 className="text-sm font-semibold">Corrections requested</h4>
            <p className="mt-1 text-sm">
              The bank has returned your application for corrections. Please review the requested
              changes, update the details, and resubmit your application.
            </p>
          </div>
        </div>
      )}

      {/* Success banner */}
      {showSuccess && (
        <div className="alert alert-success mb-6 items-center">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium">
            Application submitted successfully! Your relationship manager will review it soon.
          </p>
        </div>
      )}

      {/* Back + Header */}
      <button
        onClick={() => router.push('/portal/applications')}
        className="btn btn-ghost btn-sm mb-3"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                {STATUS_LABELS[app.status] || app.status}
              </span>
              {app.channel && (
                <span className="text-xs text-white/70">Channel: {app.channel.replace(/_/g, ' ')}</span>
              )}
            </div>
            <h2 className="mt-3 truncate text-2xl font-extrabold tracking-tight md:text-3xl">
              {app.applicationNumber || 'Draft Application'}
            </h2>
            <p className="mt-1 text-sm text-white/75">
              {LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
            </p>

            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/60">Requested</p>
                <p className="text-2xl font-extrabold tracking-tight">{formatCurrency(app.requestedAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/60">Term</p>
                <p className="text-2xl font-extrabold tracking-tight">{app.requestedTermMonths} mo</p>
              </div>
              {app.requestedInterestRate && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/60">Rate</p>
                  <p className="text-2xl font-extrabold tracking-tight">{app.requestedInterestRate}%</p>
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
                Review &amp; resubmit
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
          <h3
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
          </h3>
          {statusInfo.detail && (
            <p
              className={`mt-1 text-sm ${isDeclined ? 'text-red-600 dark:text-red-300' : ''}`}
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
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Last updated: {formatDateTime(statusInfo.lastUpdated)}
            </p>
          )}
        </div>
      )}

      {/* Stage Stepper */}
      {statusInfo && !statusInfo.terminal && (
        <div className="card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="section-title">Application progress</h3>
            <span className="text-sm font-bold" style={{ color: 'var(--brand-on-soft)' }}>
              {statusInfo.progress}%
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="w-full h-2 rounded-full mb-6 overflow-hidden"
            style={{ backgroundColor: 'var(--surface-input)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${statusInfo.progress}%`,
                background: 'linear-gradient(90deg, #ae3fa9, #ec4899)',
              }}
            />
          </div>
          <div className="overflow-x-auto">
            <StageStepper currentStage={statusInfo.stage as CustomerStage} />
          </div>
        </div>
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
      {app.approvedAmount && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 mb-6 shadow-sm dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3">
            Approved terms
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-300">Amount</p>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {formatCurrency(app.approvedAmount)}
              </p>
            </div>
            {app.approvedTermMonths && (
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-300">Term</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                  {app.approvedTermMonths} months
                </p>
              </div>
            )}
            {app.approvedInterestRate && (
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-300">Interest rate</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                  {app.approvedInterestRate}% p.a.
                </p>
              </div>
            )}
            {app.approvedMonthlyPayment && (
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-300">Monthly EMI</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                  {formatCurrency(app.approvedMonthlyPayment)}
                </p>
              </div>
            )}
          </div>
          {app.conditionalApprovalConditions && (
            <div className="mt-3 text-sm text-emerald-700 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-500/15 rounded-lg p-3">
              <span className="font-medium">Conditions:</span> {app.conditionalApprovalConditions}
            </div>
          )}
        </div>
      )}

      {/* Offer */}
      {app.offerValidUntil && !app.offerAccepted && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 mb-6 shadow-sm dark:border-amber-500/25 dark:bg-amber-500/10">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
            Offer available
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-200">
            Valid until <span className="font-medium">{formatDate(app.offerValidUntil)}</span>.
            Please accept or contact your relationship manager.
          </p>
        </div>
      )}

      {/* Detail Sections */}
      <div className="space-y-5">
        {/* Loan Request */}
        <DetailSection title="Loan details">
          <DetailRow label="Requested amount" value={formatCurrency(app.requestedAmount)} />
          <DetailRow label="Term" value={`${app.requestedTermMonths} months`} />
          {app.requestedInterestRate && (
            <DetailRow label="Requested rate" value={`${app.requestedInterestRate}% p.a.`} />
          )}
          <DetailRow
            label="Purpose"
            value={LOAN_PURPOSE_LABELS[app.loanPurpose as LoanPurpose] || app.loanPurpose}
          />
          {app.loanPurposeDescription && (
            <DetailRow label="Description" value={app.loanPurposeDescription} />
          )}
        </DetailSection>

        {/* Financial */}
        {(app.statedAnnualIncome || app.statedMonthlyIncome || app.statedMonthlyExpenses) && (
          <DetailSection title="Financial information">
            {app.statedAnnualIncome && (
              <DetailRow label="Annual income" value={formatCurrency(app.statedAnnualIncome)} />
            )}
            {app.statedMonthlyIncome && (
              <DetailRow label="Monthly income" value={formatCurrency(app.statedMonthlyIncome)} />
            )}
            {app.statedMonthlyExpenses && (
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
              <h3 className="panel-title">Activity timeline</h3>
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
              <DetailRow label="Days in status" value={`${app.daysInCurrentStatus}`} />
            )}
            {app.slaBreached && (
              <DetailRow label="SLA" value="Breached" className="text-red-600 font-medium" />
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
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadDocs() {
    setLoading(true);
    try {
      const [docsRes, summaryRes] = await Promise.all([
        documentService.getApplicationDocuments(applicationId),
        documentService.getDocumentSummary(applicationId).catch(() => null),
      ]);
      setDocuments(docsRes.documents || []);
      setRequests(docsRes.requests || []);
      setSummary(summaryRes);
    } catch {
      // silent – section simply stays empty
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
  }, [applicationId]);

  async function handleUpload(payload: UploadDocumentPayload) {
    setUploading(true);
    try {
      await documentService.uploadDocument(applicationId, payload);
      setShowUpload(false);
      await loadDocs();
    } catch {
      alert('Upload failed. Please try again.');
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
        <h3 className="panel-title">Documents</h3>
        <button onClick={() => setShowUpload(!showUpload)} className="btn btn-ghost btn-sm">
          {showUpload ? 'Cancel' : '+ Upload'}
        </button>
      </div>

      <div className="panel-body">
        {/* Summary counters */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--surface-input)' }}
            >
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {summary.totalDocuments}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Uploaded
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-500/15 p-3 text-center">
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                {summary.pendingRequiredRequests}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-300">Pending</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 p-3 text-center">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {summary.allRequiredFulfilled ? '✓' : '—'}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-300">All received</p>
            </div>
          </div>
        )}

        {/* Upload form (inline) */}
        {showUpload && (
          <div
            className="rounded-lg border p-4 mb-4 space-y-3"
            style={{
              borderColor: 'var(--surface-border)',
              backgroundColor: 'var(--surface-input)',
            }}
          >
            <DocUploadForm requestId={undefined} uploading={uploading} onUpload={handleUpload} />
          </div>
        )}

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
              Requested by your RM
            </p>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <div
                  key={req.id}
                  className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10"
                >
                  <span className="text-lg">{getCategoryIcon(req.category)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {req.title}
                    </p>
                    {req.description && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {req.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className={`badge !px-2 !py-0.5 !text-[10px] ${REQUEST_STATUS_COLORS[req.status] || 'badge-neutral'}`}
                      >
                        {REQUEST_STATUS_LABELS[req.status] || req.status}
                      </span>
                      {req.dueDate && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
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
                        setShowUpload(true);
                        // Scroll into the upload form would be nice, but not critical
                      }}
                      className="btn btn-primary btn-sm shrink-0"
                    >
                      Upload
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <div className="flex justify-center py-6">
            <span
              className="spinner h-5 w-5 border-2"
              style={{ color: 'var(--brand)' }}
              role="status"
              aria-label="Loading documents"
            />
          </div>
        ) : documents.length === 0 && pendingRequests.length === 0 ? (
          <p className="text-center text-sm py-6" style={{ color: 'var(--text-muted)' }}>
            No documents yet.
          </p>
        ) : documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map(doc => {
              const statusColor = UPLOAD_STATUS_COLORS[doc.uploadStatus] || 'badge-neutral';
              return (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                  style={{ borderColor: 'var(--surface-border)' }}
                >
                  <span className="text-lg">{getCategoryIcon(doc.category)}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {doc.fileName}
                    </p>
                    <div
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{CATEGORY_LABELS[doc.category] || doc.category}</span>
                      {doc.fileSizeBytes && <span>{formatFileSize(doc.fileSizeBytes)}</span>}
                      <span className={`badge !px-1.5 !py-0.5 !text-[10px] ${statusColor}`}>
                        {UPLOAD_STATUS_LABELS[doc.uploadStatus] || doc.uploadStatus}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DocUploadForm({
  requestId,
  uploading,
  onUpload,
}: {
  requestId: string | undefined;
  uploading: boolean;
  onUpload: (payload: UploadDocumentPayload) => void;
}) {
  const [category, setCategory] = useState<DocumentCategory>('IDENTITY');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="doc-category">
            Category
          </label>
          <select
            id="doc-category"
            value={category}
            onChange={e => setCategory(e.target.value as DocumentCategory)}
            className="select"
          >
            {DOC_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {getCategoryIcon(c)} {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="doc-name">
            Document name
          </label>
          <input
            id="doc-name"
            type="text"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            placeholder="e.g. Passport.pdf"
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="doc-notes">
          Notes (optional)
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
          disabled={!fileName.trim() || uploading}
          className="btn btn-primary btn-sm"
        >
          {uploading ? 'Uploading…' : 'Upload'}
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
    try {
      await offerService.acceptOffer(applicationId, offer.id);
      await loadOffer();
      onAction();
    } catch (e: any) {
      alert(e?.message || 'Failed to accept offer');
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    try {
      await offerService.rejectOffer(applicationId, offer.id, rejectReason || undefined);
      setShowReject(false);
      setRejectReason('');
      await loadOffer();
      onAction();
    } catch (e: any) {
      alert(e?.message || 'Failed to reject offer');
    } finally {
      setActing(false);
    }
  }

  async function handleCounter() {
    setActing(true);
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
    } catch (e: any) {
      alert(e?.message || 'Failed to submit counter-offer');
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
        <h3 className="panel-title flex items-center gap-2">
          <svg
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
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              v{offer.version}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {expiryText && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${expiryUrgent ? 'bg-red-50 text-red-600 font-medium dark:bg-red-500/15 dark:text-red-300' : 'chip'}`}
            >
              {expiryUrgent ? '⏰ ' : '🕐 '}
              {expiryText}
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      <div className="panel-body">
      {/* Offer Terms Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Approved amount
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {new Intl.NumberFormat('en-IE', {
              style: 'currency',
              currency: offer.currency || 'EUR',
              maximumFractionDigits: 0,
            }).format(offer.amount)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Interest rate
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {offer.interestRate}%{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              {offer.rateType}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Term
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {offer.termMonths} months
          </p>
        </div>
        {offer.repaymentEstimate && (
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Est. monthly payment
            </p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">
              {new Intl.NumberFormat('en-IE', {
                style: 'currency',
                currency: offer.currency || 'EUR',
                maximumFractionDigits: 0,
              }).format(offer.repaymentEstimate)}
            </p>
          </div>
        )}
        {offer.apr && (
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
              APR
            </p>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {offer.apr}%
            </p>
          </div>
        )}
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Repayment
          </p>
          <p
            className="text-sm font-medium capitalize"
            style={{ color: 'var(--text-secondary)' }}
          >
            {(offer.repaymentFrequency || 'MONTHLY').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div
          className="mb-4 border-t pt-3"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Conditions
          </p>
          <ul className="space-y-1.5">
            {conditions.map(c => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                {c.status === 'SATISFIED' ? (
                  <span className="text-emerald-500 mt-0.5">✓</span>
                ) : c.status === 'WAIVED' ? (
                  <span className="text-sky-500 mt-0.5">~</span>
                ) : (
                  <span className="text-amber-500 mt-0.5">○</span>
                )}
                <span
                  className={
                    c.status === 'SATISFIED' || c.status === 'WAIVED' ? 'line-through' : ''
                  }
                  style={{
                    color:
                      c.status === 'SATISFIED' || c.status === 'WAIVED'
                        ? 'var(--text-muted)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {c.description}
                  {c.isMandatory && c.status === 'PENDING' && (
                    <span className="text-red-400 text-xs ml-1">*required</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons — only for ISSUED offers */}
      {isIssued && !showReject && !showCounter && (
        <div
          className="flex flex-wrap gap-3 border-t pt-4"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <button onClick={handleAccept} disabled={acting} className="btn btn-primary flex-1">
            {acting ? 'Processing…' : 'Accept offer'}
          </button>
          <button
            onClick={() => setShowCounter(true)}
            disabled={acting}
            className="btn btn-secondary flex-1"
          >
            Counter offer
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={acting}
            className="btn btn-outline text-red-600 dark:text-red-300"
          >
            Decline
          </button>
        </div>
      )}

      {/* Reject Form */}
      {showReject && (
        <div
          className="border-t pt-4 space-y-3"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <label className="field-label" htmlFor="offer-reject-reason">
            Why are you declining this offer?
          </label>
          <textarea
            id="offer-reject-reason"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Optional: tell us why (this helps us improve future offers)"
            rows={2}
            className="input resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={handleReject} disabled={acting} className="btn btn-danger btn-sm">
              {acting ? 'Processing…' : 'Confirm decline'}
            </button>
            <button
              onClick={() => {
                setShowReject(false);
                setRejectReason('');
              }}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Counter Offer Form */}
      {showCounter && (
        <div
          className="border-t pt-4 space-y-3"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Propose your terms
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Leave blank to keep the original value
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                className="input"
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
                className="input"
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
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="counter-notes">
              Notes
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
            <button onClick={handleCounter} disabled={acting} className="btn btn-primary btn-sm">
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
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Terminal state messages */}
      {offer.status === 'ACCEPTED' && (
        <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm text-emerald-600 dark:text-emerald-300 font-medium">
            ✓ You accepted this offer{offer.acceptedAt ? ` on ${formatDate(offer.acceptedAt)}` : ''}
          </p>
        </div>
      )}
      {offer.status === 'REJECTED' && (
        <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm text-red-500 dark:text-red-300">
            You declined this offer{offer.voidReason ? `: ${offer.voidReason}` : ''}
          </p>
        </div>
      )}
      {offer.status === 'EXPIRED' && (
        <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm text-amber-600 dark:text-amber-300">
            This offer has expired. Contact your relationship manager for a new offer.
          </p>
        </div>
      )}
      {offer.status === 'COUNTERED' && (
        <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-sm" style={{ color: 'var(--brand-on-soft)' }}>
            Your counter-offer has been submitted. Your RM will review and respond.
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
    try {
      const res = await esignService.startSigning(applicationId);
      setSigning(res.signingUrl);
      // Reload status after a short delay to show the new envelope
      setTimeout(() => {
        loadStatus();
      }, 1000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start signing';
      alert(msg);
    } finally {
      setStarting(false);
    }
  }

  async function handleSimulateComplete(envelopeId: string) {
    try {
      await esignService.simulateComplete(applicationId, envelopeId);
      await loadStatus();
      onComplete();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Simulation failed';
      alert(msg);
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
        <h3 className="panel-title flex items-center gap-2">
          <svg
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
        </h3>
        {statusBadge}
      </div>

      <div className="panel-body">
      {/* Progress Bar (multi-signatory business) */}
      {isBusiness && totalCount > 1 && (
        <div className="mb-4">
          <div
            className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>Signers progress</span>
            <span>
              {completedCount} of {totalCount} signed
            </span>
          </div>
          <div
            className="w-full rounded-full h-2.5"
            style={{ backgroundColor: 'var(--surface-input)' }}
          >
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isComplete ? 'bg-emerald-500' : ''
              }`}
              style={{
                width: `${progressPct}%`,
                backgroundColor: isComplete ? undefined : 'var(--brand)',
              }}
            />
          </div>
        </div>
      )}

      {/* Signers list */}
      {signers.length > 0 && (
        <div className="space-y-2 mb-4">
          {signers.map(s => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--surface-input)' }}
            >
              <div className="flex items-center gap-2">
                {s.status === 'COMPLETED' ? (
                  <span className="text-emerald-500 text-sm">✓</span>
                ) : s.status === 'DECLINED' ? (
                  <span className="text-red-500 text-sm">✗</span>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    ○
                  </span>
                )}
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {s.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium capitalize ${
                    SIGNER_STATUS_COLORS[s.status] ?? ''
                  }`}
                  style={SIGNER_STATUS_COLORS[s.status] ? undefined : { color: 'var(--text-muted)' }}
                >
                  {s.status === 'COMPLETED'
                    ? 'Signed'
                    : s.status === 'DECLINED'
                      ? 'Declined'
                      : s.status === 'SENT' || s.status === 'DELIVERED'
                        ? 'Awaiting'
                        : s.status.toLowerCase()}
                </span>
                {/* Dev: simulate complete */}
                {(s.status === 'SENT' || s.status === 'DELIVERED') && (
                  <button
                    onClick={() => handleSimulateComplete(s.envelopeId)}
                    className="btn btn-ghost btn-sm"
                    title="Simulate completion (dev)"
                    aria-label="Simulate signature completion"
                  >
                    sim✓
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sign Now button */}
      {!isComplete && !isDeclined && (
        <div>
          {signingUrl ? (
            <div className="space-y-2">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your signing session is ready. Click below to review and sign the agreement.
              </p>
              <button
                onClick={() => router.push(signingUrl)}
                className="btn btn-primary w-full"
              >
                Open signing ceremony
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartSigning}
              disabled={starting}
              className="btn btn-primary w-full"
            >
              {starting ? (
                <>
                  <span className="spinner h-4 w-4 border-2" aria-hidden="true" />
                  Preparing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="text-center py-2">
          <p className="text-sm text-emerald-600 dark:text-emerald-300 font-medium">
            ✓ All signatures have been collected
          </p>
        </div>
      )}

      {/* Declined message */}
      {isDeclined && (
        <div className="text-center py-2">
          <p className="text-sm text-red-500 dark:text-red-300">
            A signer has declined. Please contact your relationship manager.
          </p>
        </div>
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
      <div className="card p-5">
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
        <p className="text-sm text-red-500 dark:text-red-300" role="alert">
          {error}
        </p>
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
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title flex items-center gap-2">
          <svg
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
          Booking &amp; disbursement
        </h3>
        <span className={`badge ${phaseColor}`}>{phaseLabel}</span>
      </div>

      {/* Progress Bar */}
      <div>
        <div
          className="flex flex-wrap justify-between gap-2 text-xs mb-1"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>
            {completedCount} of {totalCount} milestones
          </span>
          <span>{progressPct}%</span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--surface-input)' }}
        >
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="relative pl-6 space-y-4">
        {status.milestones.map((milestone, idx) => {
          const isLast = idx === status.milestones.length - 1;
          const msStatus = milestone.status as MilestoneStatus;
          const iconColor = MILESTONE_STATUS_COLORS[msStatus] || '';

          return (
            <div key={milestone.key} className="relative">
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
                />
              )}

              {/* Status icon */}
              <div
                className={`absolute left-[-22px] top-1 ${iconColor}`}
                style={iconColor ? undefined : { color: 'var(--text-muted)' }}
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
                  className={`text-sm font-medium ${
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
                  {milestone.label}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
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
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
            </div>
          );
        })}
      </div>

      {/* Account Details (shown when booked) */}
      {status.accountNumber && (
        <div
          className="mt-3 rounded-lg p-3 space-y-1"
          style={{ backgroundColor: 'var(--brand-soft)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--brand-on-soft)' }}>
            Loan account details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {status.accountNumber && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Account: </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {status.accountNumber}
                </span>
              </div>
            )}
            {status.arrangementId && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Ref: </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {status.arrangementId}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disbursement Details (shown when disbursed) */}
      {status.disbursementReference && (
        <div className="mt-2 rounded-lg p-3 space-y-1 bg-emerald-50 dark:bg-emerald-500/10">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Disbursement details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {status.disbursementReference && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Reference: </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {status.disbursementReference}
                </span>
              </div>
            )}
            {status.disbursementAmount != null && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Amount: </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
                    status.disbursementAmount
                  )}
                </span>
              </div>
            )}
            {status.disbursementAccount && (
              <div className="sm:col-span-2">
                <span style={{ color: 'var(--text-muted)' }}>To account: </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {status.disbursementAccount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Banner */}
      {phase === 'DISBURSED' || phase === 'ACTIVE' || phase === 'CLOSED' ? (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                : 'Funds have been successfully disbursed to your account'}
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
    try {
      await messagingService.sendMessage(applicationId, newMessage.trim());
      setNewMessage('');
      await loadMessages();
    } catch {
      alert('Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleHelpRequest() {
    if (!helpSubject.trim() || !helpBody.trim() || helpSending) return;
    setHelpSending(true);
    try {
      await messagingService.createHelpRequest(applicationId, helpSubject.trim(), helpBody.trim());
      setHelpSubject('');
      setHelpBody('');
      setTab('messages');
      await loadMessages();
    } catch {
      alert('Failed to create help request.');
    } finally {
      setHelpSending(false);
    }
  }

  async function handleCallbackRequest() {
    if (cbSending) return;
    setCbSending(true);
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
      alert('Failed to request callback.');
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
    <div className="card p-5">
      {/* Tab header */}
      <div className="mb-4 overflow-x-auto">
        <div className="segmented" role="tablist" aria-label="Message your relationship manager">
          {tabs.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="segmented-item text-xs"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-6">
              <span
                className="spinner h-5 w-5 border-2"
                style={{ color: 'var(--brand)' }}
                role="status"
                aria-label="Loading messages"
              />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
              No messages yet. Send a message or request help from your RM.
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto mb-3 pr-1">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}

          {/* Compose */}
          <div className="flex flex-wrap gap-2 mt-2">
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
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Help request tab */}
      {tab === 'help' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Describe your issue and your relationship manager will receive a task to assist you.
          </p>
          <div>
            <label className="field-label" htmlFor="help-subject">
              Subject
            </label>
            <input
              id="help-subject"
              value={helpSubject}
              onChange={e => setHelpSubject(e.target.value)}
              placeholder="e.g. Question about document requirements"
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="help-body">
              Message
            </label>
            <textarea
              id="help-body"
              value={helpBody}
              onChange={e => setHelpBody(e.target.value)}
              rows={3}
              placeholder="Describe what you need help with…"
              className="input"
            />
          </div>
          <div className="text-right">
            <button
              onClick={handleHelpRequest}
              disabled={!helpSubject.trim() || !helpBody.trim() || helpSending}
              className="btn btn-primary"
            >
              {helpSending ? 'Sending…' : 'Request help'}
            </button>
          </div>
        </div>
      )}

      {/* Callback request tab */}
      {tab === 'callback' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Request a callback from your relationship manager at a convenient time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              Notes (optional)
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
            >
              {cbSending ? 'Requesting…' : 'Request callback'}
            </button>
          </div>
        </div>
      )}
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
          className="text-[10px] px-3 py-1 rounded-full"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-input)' }}
        >
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] rounded-lg px-3 py-2"
        style={
          isCustomer
            ? { backgroundColor: 'var(--brand)', color: '#fff' }
            : { backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)' }
        }
      >
        {!isCustomer && message.senderName && (
          <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
            {message.senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <p
          className="text-[10px] mt-1"
          style={{ color: isCustomer ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Stage Stepper (6 customer-friendly stages) ────────────────

function StageStepper({ currentStage }: { currentStage: CustomerStage }) {
  const stageIndex = CUSTOMER_STAGES.findIndex(s => s.key === currentStage);
  const activeIndex = stageIndex >= 0 ? stageIndex : 0;

  return (
    <div className="flex items-center justify-between">
      {CUSTOMER_STAGES.map((s, i) => {
        const isComplete = i < activeIndex;
        const isActive = i === activeIndex;

        return (
          <div key={s.key} className="flex-1 flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isComplete
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-none'
                    : isActive
                      ? 'border-transparent bg-gradient-to-br from-[#ae3fa9] to-[#ec4899] text-white ring-4 ring-fuchsia-100 dark:ring-fuchsia-500/20 shadow-lg'
                      : ''
                }`}
                style={
                  isComplete || isActive
                    ? undefined
                    : {
                        borderColor: 'var(--surface-border-strong)',
                        backgroundColor: 'var(--surface-card)',
                        color: 'var(--text-muted)',
                      }
                }
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1.5 text-[10px] font-medium text-center leading-tight ${
                  isComplete ? 'text-emerald-600 dark:text-emerald-300' : ''
                }`}
                style={
                  isComplete
                    ? undefined
                    : {
                        color: isActive ? 'var(--brand-on-soft)' : 'var(--text-muted)',
                      }
                }
              >
                {s.label}
              </span>
            </div>
            {i < CUSTOMER_STAGES.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 ${i < activeIndex ? 'bg-emerald-400' : ''}`}
                style={i < activeIndex ? undefined : { backgroundColor: 'var(--surface-border)' }}
              />
            )}
          </div>
        );
      })}
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

function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-3.5 top-2 bottom-2 w-0.5"
        style={{ backgroundColor: 'var(--surface-border)' }}
      />

      <div className="space-y-4">
        {events.map((evt, i) => {
          const iconStyle = TIMELINE_ICON_STYLES[evt.icon] || TIMELINE_ICON_STYLES.info;

          return (
            <div key={i} className="relative flex gap-3">
              {/* Icon */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${iconStyle.bg} ${iconStyle.text}`}
              >
                {iconStyle.symbol}
              </div>

              {/* Content */}
              <div className="pt-0.5 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {evt.title}
                </p>
                {evt.description && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {evt.description}
                  </p>
                )}
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatDateTime(evt.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
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
      className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:flex-col sm:items-start sm:gap-1"
      style={{ backgroundColor: 'var(--surface-input)' }}
    >
      <dt
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </dt>
      <dd
        className={`text-sm font-bold ${className || ''}`}
        style={className ? undefined : { color: 'var(--text-primary)' }}
      >
        {value}
      </dd>
    </div>
  );
}
