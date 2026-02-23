'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import {
  applicationService,
  LoanApplication,
  ApplicationStatus,
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
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}
    >
      {label}
    </span>
  );
}

// Terminal statuses (not in the normal flow)
const TERMINAL_STATUSES: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'];

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
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/portal/applications')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Applications
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-red-600 font-medium">{error || 'Application not found'}</p>
          <button onClick={loadApplication} className="mt-3 text-sm text-red-700 underline">
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
    <div className="max-w-3xl mx-auto">
      {/* Withdraw Confirmation Dialog */}
      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Withdraw Application?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This action cannot be undone. Your application will be permanently withdrawn.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                rows={2}
                placeholder="Why are you withdrawing?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowWithdrawConfirm(false);
                  setWithdrawReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
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
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {withdrawing ? 'Withdrawing...' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return for corrections banner */}
      {isReturned && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-orange-500 text-lg">⚠</span>
            <div>
              <h4 className="text-sm font-semibold text-orange-800">Corrections Requested</h4>
              <p className="mt-1 text-sm text-orange-700">
                The bank has returned your application for corrections. Please review the requested
                changes, update the details, and resubmit your application.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success banner */}
      {showSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-green-500 shrink-0"
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
          <p className="text-sm text-green-700 font-medium">
            Application submitted successfully! Your relationship manager will review it soon.
          </p>
        </div>
      )}

      {/* Back + Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/portal/applications')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Applications
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {app.applicationNumber || 'Draft Application'}
          </h2>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={app.status} />
            {app.channel && (
              <span className="text-xs text-gray-400">
                Channel: {app.channel.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {isDraft && (
          <button
            onClick={() =>
              router.push(`/portal/applications/new?product=&resume=${app.applicationId}`)
            }
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            Continue Editing
          </button>
        )}

        {isReturned && (
          <button
            onClick={() =>
              router.push(`/portal/applications/new?product=&resume=${app.applicationId}`)
            }
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors shadow-sm"
          >
            Review &amp; Resubmit
          </button>
        )}

        {canWithdraw && (
          <button
            onClick={() => setShowWithdrawConfirm(true)}
            className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Withdraw
          </button>
        )}
      </div>

      {/* Customer Status Headline */}
      {statusInfo && (
        <div
          className={`rounded-xl border p-5 mb-6 ${
            statusInfo.terminal
              ? isDeclined
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
              : 'bg-primary-50 border-primary-200'
          }`}
        >
          <h3
            className={`text-lg font-semibold ${
              isDeclined
                ? 'text-red-800'
                : statusInfo.terminal
                  ? 'text-gray-800'
                  : 'text-primary-800'
            }`}
          >
            {statusInfo.headline}
          </h3>
          {statusInfo.detail && (
            <p
              className={`mt-1 text-sm ${
                isDeclined
                  ? 'text-red-600'
                  : statusInfo.terminal
                    ? 'text-gray-600'
                    : 'text-primary-600'
              }`}
            >
              {statusInfo.detail}
            </p>
          )}
          {statusInfo.lastUpdated && (
            <p className="mt-2 text-xs text-gray-400">
              Last updated: {formatDateTime(statusInfo.lastUpdated)}
            </p>
          )}
        </div>
      )}

      {/* Stage Stepper */}
      {statusInfo && !statusInfo.terminal && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Application Progress</h3>
            <span className="text-xs text-gray-400">{statusInfo.progress}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${statusInfo.progress}%` }}
            />
          </div>
          <StageStepper currentStage={statusInfo.stage as CustomerStage} />
        </div>
      )}

      {/* Terminal status message (for old status path, in case statusInfo is missing) */}
      {isTerminal && !statusInfo && (
        <div
          className={`rounded-xl border p-5 mb-6 ${
            app.status === 'REJECTED' || app.status === 'CANCELLED'
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <StatusBadge status={app.status} />
            {app.rejectionReason && <p className="text-sm text-gray-600">{app.rejectionReason}</p>}
          </div>
        </div>
      )}

      {/* Approved terms */}
      {app.approvedAmount && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-green-800 mb-3">Approved Terms</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-green-600">Amount</p>
              <p className="text-lg font-bold text-green-800">
                {formatCurrency(app.approvedAmount)}
              </p>
            </div>
            {app.approvedTermMonths && (
              <div>
                <p className="text-xs text-green-600">Term</p>
                <p className="text-lg font-bold text-green-800">{app.approvedTermMonths} months</p>
              </div>
            )}
            {app.approvedInterestRate && (
              <div>
                <p className="text-xs text-green-600">Interest Rate</p>
                <p className="text-lg font-bold text-green-800">{app.approvedInterestRate}% p.a.</p>
              </div>
            )}
            {app.approvedMonthlyPayment && (
              <div>
                <p className="text-xs text-green-600">Monthly EMI</p>
                <p className="text-lg font-bold text-green-800">
                  {formatCurrency(app.approvedMonthlyPayment)}
                </p>
              </div>
            )}
          </div>
          {app.conditionalApprovalConditions && (
            <div className="mt-3 text-sm text-green-700 bg-green-100 rounded-lg p-3">
              <span className="font-medium">Conditions:</span> {app.conditionalApprovalConditions}
            </div>
          )}
        </div>
      )}

      {/* Offer */}
      {app.offerValidUntil && !app.offerAccepted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">Offer Available</h3>
          <p className="text-sm text-amber-700">
            Valid until <span className="font-medium">{formatDate(app.offerValidUntil)}</span>.
            Please accept or contact your relationship manager.
          </p>
        </div>
      )}

      {/* Detail Sections */}
      <div className="space-y-4">
        {/* Loan Request */}
        <DetailSection title="Loan Details">
          <DetailRow label="Requested Amount" value={formatCurrency(app.requestedAmount)} />
          <DetailRow label="Term" value={`${app.requestedTermMonths} months`} />
          {app.requestedInterestRate && (
            <DetailRow label="Requested Rate" value={`${app.requestedInterestRate}% p.a.`} />
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
          <DetailSection title="Financial Information">
            {app.statedAnnualIncome && (
              <DetailRow label="Annual Income" value={formatCurrency(app.statedAnnualIncome)} />
            )}
            {app.statedMonthlyIncome && (
              <DetailRow label="Monthly Income" value={formatCurrency(app.statedMonthlyIncome)} />
            )}
            {app.statedMonthlyExpenses && (
              <DetailRow
                label="Monthly Expenses"
                value={formatCurrency(app.statedMonthlyExpenses)}
              />
            )}
            {app.debtToIncomeRatio != null && (
              <DetailRow label="Debt-to-Income" value={`${app.debtToIncomeRatio}%`} />
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
                label="AML Check"
                value={app.amlCheckCompleted ? 'Completed' : 'Pending'}
              />
            )}
          </DetailSection>
        )}

        {/* Loan Offer Actions */}
        {!isDraft && (
          <OfferSection applicationId={app.applicationId} onAction={() => loadApplication()} />
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 mb-4">
              Activity Timeline
            </h3>
            <EventTimeline events={statusInfo.timeline} />
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
              <DetailRow label="Review Started" value={formatDateTime(app.reviewStartedAt)} />
            )}
            {app.decisionDueDate && (
              <DetailRow label="Decision Due" value={formatDate(app.decisionDueDate)} />
            )}
            {app.decisionMadeAt && (
              <DetailRow label="Decision Made" value={formatDateTime(app.decisionMadeAt)} />
            )}
            <DetailRow label="Last Updated" value={formatDateTime(app.updatedAt)} />
            {app.daysInCurrentStatus != null && (
              <DetailRow label="Days in Status" value={`${app.daysInCurrentStatus}`} />
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          {showUpload ? 'Cancel' : '+ Upload'}
        </button>
      </div>

      {/* Summary counters */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{summary.totalDocuments}</p>
            <p className="text-[10px] text-gray-500">Uploaded</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{summary.pendingRequiredRequests}</p>
            <p className="text-[10px] text-amber-600">Pending</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <p className="text-lg font-bold text-green-700">
              {summary.allRequiredFulfilled ? '✓' : '—'}
            </p>
            <p className="text-[10px] text-green-600">All Received</p>
          </div>
        </div>
      )}

      {/* Upload form (inline) */}
      {showUpload && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 mb-4 space-y-3">
          <DocUploadForm requestId={undefined} uploading={uploading} onUpload={handleUpload} />
        </div>
      )}

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">Requested by your RM</p>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div
                key={req.id}
                className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <span className="text-lg">{getCategoryIcon(req.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{req.title}</p>
                  {req.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{req.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${REQUEST_STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {REQUEST_STATUS_LABELS[req.status] || req.status}
                    </span>
                    {req.dueDate && (
                      <span className="text-[10px] text-gray-400">
                        Due{' '}
                        {new Date(req.dueDate).toLocaleDateString('en-IN', {
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
                    className="shrink-0 rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-700"
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
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : documents.length === 0 && pendingRequests.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">No documents yet.</p>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map(doc => {
            const statusColor =
              UPLOAD_STATUS_COLORS[doc.uploadStatus] || 'bg-gray-100 text-gray-700';
            return (
              <div
                key={doc.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
              >
                <span className="text-lg">{getCategoryIcon(doc.category)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-gray-500">
                    <span>{CATEGORY_LABELS[doc.category] || doc.category}</span>
                    {doc.fileSizeBytes && <span>{formatFileSize(doc.fileSizeBytes)}</span>}
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusColor}`}
                    >
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as DocumentCategory)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-indigo-500"
          >
            {DOC_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {getCategoryIcon(c)} {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Document Name</label>
          <input
            type="text"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            placeholder="e.g. Passport.pdf"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-indigo-500"
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
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
  onAction,
}: {
  applicationId: string;
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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${OFFER_STATUS_COLORS[offer.status as OfferStatus] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {OFFER_STATUS_LABELS[offer.status as OfferStatus] ?? offer.status}
    </span>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-500"
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
          Loan Offer
          {offer.version > 1 && <span className="text-xs text-gray-400">v{offer.version}</span>}
        </h3>
        <div className="flex items-center gap-2">
          {expiryText && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${expiryUrgent ? 'bg-red-50 text-red-600 font-medium' : 'bg-gray-50 text-gray-500'}`}
            >
              {expiryUrgent ? '⏰ ' : '🕐 '}
              {expiryText}
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      {/* Offer Terms Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Approved Amount</p>
          <p className="text-lg font-semibold text-gray-900">
            {new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: offer.currency || 'EUR',
              maximumFractionDigits: 0,
            }).format(offer.amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Interest Rate</p>
          <p className="text-lg font-semibold text-gray-900">
            {offer.interestRate}%{' '}
            <span className="text-xs font-normal text-gray-400">{offer.rateType}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Term</p>
          <p className="text-lg font-semibold text-gray-900">{offer.termMonths} months</p>
        </div>
        {offer.repaymentEstimate && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Est. Monthly Payment</p>
            <p className="text-lg font-semibold text-emerald-600">
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: offer.currency || 'EUR',
                maximumFractionDigits: 0,
              }).format(offer.repaymentEstimate)}
            </p>
          </div>
        )}
        {offer.apr && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">APR</p>
            <p className="text-lg font-semibold text-gray-900">{offer.apr}%</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Repayment</p>
          <p className="text-sm font-medium text-gray-700 capitalize">
            {(offer.repaymentFrequency || 'MONTHLY').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="mb-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Conditions
          </p>
          <ul className="space-y-1.5">
            {conditions.map(c => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                {c.status === 'SATISFIED' ? (
                  <span className="text-green-500 mt-0.5">✓</span>
                ) : c.status === 'WAIVED' ? (
                  <span className="text-blue-500 mt-0.5">~</span>
                ) : (
                  <span className="text-amber-500 mt-0.5">○</span>
                )}
                <span
                  className={
                    c.status === 'SATISFIED' || c.status === 'WAIVED'
                      ? 'text-gray-400 line-through'
                      : 'text-gray-700'
                  }
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
        <div className="flex gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={handleAccept}
            disabled={acting}
            className="flex-1 bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {acting ? 'Processing…' : 'Accept Offer'}
          </button>
          <button
            onClick={() => setShowCounter(true)}
            disabled={acting}
            className="flex-1 bg-white text-purple-700 text-sm font-medium py-2.5 rounded-lg border border-purple-200 hover:bg-purple-50 disabled:opacity-50 transition-colors"
          >
            Counter Offer
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={acting}
            className="px-4 bg-white text-red-600 text-sm font-medium py-2.5 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {/* Reject Form */}
      {showReject && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Why are you declining this offer?</p>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Optional: tell us why (this helps us improve future offers)"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={acting}
              className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {acting ? 'Processing…' : 'Confirm Decline'}
            </button>
            <button
              onClick={() => {
                setShowReject(false);
                setRejectReason('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Counter Offer Form */}
      {showCounter && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Propose your terms</p>
          <p className="text-xs text-gray-400">Leave blank to keep the original value</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ({offer.currency})</label>
              <input
                type="number"
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                placeholder={String(offer.amount)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Term (months)</label>
              <input
                type="number"
                value={counterTerm}
                onChange={e => setCounterTerm(e.target.value)}
                placeholder={String(offer.termMonths)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={counterRate}
                onChange={e => setCounterRate(e.target.value)}
                placeholder={String(offer.interestRate)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={counterNotes}
              onChange={e => setCounterNotes(e.target.value)}
              placeholder="Explain your proposal…"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCounter}
              disabled={acting}
              className="bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {acting ? 'Submitting…' : 'Submit Counter Offer'}
            </button>
            <button
              onClick={() => {
                setShowCounter(false);
                setCounterAmount('');
                setCounterTerm('');
                setCounterRate('');
                setCounterNotes('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Terminal state messages */}
      {offer.status === 'ACCEPTED' && (
        <div className="border-t border-gray-100 pt-3 mt-2">
          <p className="text-sm text-green-600 font-medium">
            ✓ You accepted this offer{offer.acceptedAt ? ` on ${formatDate(offer.acceptedAt)}` : ''}
          </p>
        </div>
      )}
      {offer.status === 'REJECTED' && (
        <div className="border-t border-gray-100 pt-3 mt-2">
          <p className="text-sm text-red-500">
            You declined this offer{offer.voidReason ? `: ${offer.voidReason}` : ''}
          </p>
        </div>
      )}
      {offer.status === 'EXPIRED' && (
        <div className="border-t border-gray-100 pt-3 mt-2">
          <p className="text-sm text-amber-600">
            This offer has expired. Contact your relationship manager for a new offer.
          </p>
        </div>
      )}
      {offer.status === 'COUNTERED' && (
        <div className="border-t border-gray-100 pt-3 mt-2">
          <p className="text-sm text-purple-600">
            Your counter-offer has been submitted. Your RM will review and respond.
          </p>
        </div>
      )}
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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        ESIGN_STATUS_COLORS[overallStatus as EsignOverallStatus] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {ESIGN_STATUS_LABELS[overallStatus as EsignOverallStatus] ?? overallStatus}
    </span>
  );

  // Progress bar width
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-indigo-500"
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
          E-Signature
        </h3>
        {statusBadge}
      </div>

      {/* Progress Bar (multi-signatory business) */}
      {isBusiness && totalCount > 1 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Signers Progress</span>
            <span>
              {completedCount} of {totalCount} signed
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isComplete ? 'bg-green-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPct}%` }}
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
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {s.status === 'COMPLETED' ? (
                  <span className="text-green-500 text-sm">✓</span>
                ) : s.status === 'DECLINED' ? (
                  <span className="text-red-500 text-sm">✗</span>
                ) : (
                  <span className="text-gray-300 text-sm">○</span>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium capitalize ${
                    SIGNER_STATUS_COLORS[s.status] ?? 'text-gray-400'
                  }`}
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
                    className="text-xs text-indigo-500 hover:underline ml-1"
                    title="Simulate completion (dev)"
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
              <p className="text-sm text-gray-600">
                Your signing session is ready. Click below to review and sign the agreement.
              </p>
              <a
                href={signingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Open Signing Ceremony
              </a>
            </div>
          ) : (
            <button
              onClick={handleStartSigning}
              disabled={starting}
              className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
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
                  Sign Now
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Completed message */}
      {isComplete && (
        <div className="text-center py-2">
          <p className="text-sm text-green-600 font-medium">✓ All signatures have been collected</p>
        </div>
      )}

      {/* Declined message */}
      {isDeclined && (
        <div className="text-center py-2">
          <p className="text-sm text-red-500">
            A signer has declined. Please contact your relationship manager.
          </p>
        </div>
      )}
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
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!status) return null;

  const phase = status.phase as BookingPhase;
  const phaseLabel = PHASE_LABELS[phase] || phase;
  const phaseColor = PHASE_COLORS[phase] || 'bg-gray-100 text-gray-600';

  const completedCount = status.milestones.filter(m => m.status === 'COMPLETED').length;
  const totalCount = status.milestones.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-indigo-500"
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
          Booking &amp; Disbursement
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${phaseColor}`}>
          {phaseLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {completedCount} of {totalCount} milestones
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="relative pl-6 space-y-4">
        {status.milestones.map((milestone, idx) => {
          const isLast = idx === status.milestones.length - 1;
          const msStatus = milestone.status as MilestoneStatus;
          const iconColor = MILESTONE_STATUS_COLORS[msStatus] || 'text-gray-300';

          return (
            <div key={milestone.key} className="relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-[-16px] top-6 w-0.5 h-full ${
                    msStatus === 'COMPLETED' ? 'bg-green-300' : 'bg-gray-200'
                  }`}
                />
              )}

              {/* Status icon */}
              <div className={`absolute left-[-22px] top-1 ${iconColor}`}>
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
                    msStatus === 'COMPLETED'
                      ? 'text-gray-900'
                      : msStatus === 'IN_PROGRESS'
                        ? 'text-blue-700'
                        : 'text-gray-400'
                  }`}
                >
                  {milestone.label}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    msStatus === 'COMPLETED'
                      ? 'text-gray-500'
                      : msStatus === 'IN_PROGRESS'
                        ? 'text-blue-500'
                        : 'text-gray-300'
                  }`}
                >
                  {milestone.description}
                </p>
                {milestone.completedAt && (
                  <p className="text-xs text-gray-400 mt-0.5">
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
        <div className="mt-3 bg-indigo-50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-indigo-700">Loan Account Details</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {status.accountNumber && (
              <div>
                <span className="text-gray-500">Account: </span>
                <span className="font-medium text-gray-800">{status.accountNumber}</span>
              </div>
            )}
            {status.arrangementId && (
              <div>
                <span className="text-gray-500">Ref: </span>
                <span className="font-medium text-gray-800">{status.arrangementId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disbursement Details (shown when disbursed) */}
      {status.disbursementReference && (
        <div className="mt-2 bg-green-50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-green-700">Disbursement Details</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {status.disbursementReference && (
              <div>
                <span className="text-gray-500">Reference: </span>
                <span className="font-medium text-gray-800">{status.disbursementReference}</span>
              </div>
            )}
            {status.disbursementAmount != null && (
              <div>
                <span className="text-gray-500">Amount: </span>
                <span className="font-medium text-gray-800">
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
                    status.disbursementAmount
                  )}
                </span>
              </div>
            )}
            {status.disbursementAccount && (
              <div className="col-span-2">
                <span className="text-gray-500">To Account: </span>
                <span className="font-medium text-gray-800">{status.disbursementAccount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Banner */}
      {phase === 'DISBURSED' || phase === 'ACTIVE' || phase === 'CLOSED' ? (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
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
    { key: 'help', label: 'Request Help' },
    { key: 'callback', label: 'Request a Call' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Tab header */}
      <div className="flex items-center gap-1 border-b border-gray-100 pb-2 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
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
          <div className="flex gap-2 mt-2">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Help request tab */}
      {tab === 'help' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Describe your issue and your Relationship Manager will receive a task to assist you.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input
              value={helpSubject}
              onChange={e => setHelpSubject(e.target.value)}
              placeholder="e.g. Question about document requirements"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea
              value={helpBody}
              onChange={e => setHelpBody(e.target.value)}
              rows={3}
              placeholder="Describe what you need help with…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div className="text-right">
            <button
              onClick={handleHelpRequest}
              disabled={!helpSubject.trim() || !helpBody.trim() || helpSending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {helpSending ? 'Sending…' : 'Request Help'}
            </button>
          </div>
        </div>
      )}

      {/* Callback request tab */}
      {tab === 'callback' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Request a callback from your Relationship Manager at a convenient time.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Date</label>
              <input
                type="date"
                value={cbDate}
                onChange={e => setCbDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Time</label>
              <select
                value={cbTimeSlot}
                onChange={e => setCbTimeSlot(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input
              value={cbNotes}
              onChange={e => setCbNotes(e.target.value)}
              placeholder="What would you like to discuss?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div className="text-right">
            <button
              onClick={handleCallbackRequest}
              disabled={cbSending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cbSending ? 'Requesting…' : 'Request Callback'}
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
        <span className="text-[10px] text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isCustomer ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {!isCustomer && message.senderName && (
          <p
            className={`text-[10px] font-medium mb-0.5 ${
              isCustomer ? 'text-indigo-200' : 'text-gray-500'
            }`}
          >
            {message.senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <p className={`text-[10px] mt-1 ${isCustomer ? 'text-indigo-200' : 'text-gray-400'}`}>
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
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isComplete
                    ? 'border-green-500 bg-green-500 text-white'
                    : isActive
                      ? 'border-primary-500 bg-primary-500 text-white ring-4 ring-primary-100'
                      : 'border-gray-300 bg-white text-gray-400'
                }`}
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
                  isComplete ? 'text-green-600' : isActive ? 'text-primary-700' : 'text-gray-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < CUSTOMER_STAGES.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 ${i < activeIndex ? 'bg-green-400' : 'bg-gray-200'}`}
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
  info: { bg: 'bg-blue-100', text: 'text-blue-600', symbol: 'ℹ' },
  success: { bg: 'bg-green-100', text: 'text-green-600', symbol: '✓' },
  warning: { bg: 'bg-red-100', text: 'text-red-600', symbol: '!' },
  action: { bg: 'bg-amber-100', text: 'text-amber-600', symbol: '→' },
  milestone: { bg: 'bg-purple-100', text: 'text-purple-600', symbol: '★' },
};

function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-100" />

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
                <p className="text-sm font-medium text-gray-900">{evt.title}</p>
                {evt.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{evt.description}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(evt.timestamp)}</p>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 mb-3">
        {title}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">{children}</dl>
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
    <div className="flex justify-between sm:block">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-sm font-medium text-gray-900 ${className || ''}`}>{value}</dd>
    </div>
  );
}
