'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  kycService,
  type KycCase,
  type Party,
  type PartyRelationship,
  type KycDocument,
  type ScreeningResult,
  type RiskAssessment,
  type KycCaseEvent,
} from '@/services/api/kycService';

type Tab = 'overview' | 'documents' | 'screening' | 'risk' | 'timeline';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'screening', label: 'Screening' },
  { id: 'risk', label: 'Risk' },
  { id: 'timeline', label: 'Timeline' },
];

/** 'PENDING_DOCUMENTS' → 'Pending documents' */
function humanize(value?: string): string {
  if (!value) return '—';
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return apiMessage || fallback;
}

/* Tinted chip colours — readable on light and dark card surfaces. */
const DOC_STATUS_TINT: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'rgba(245,158,11,0.15)', text: '#b45309' },
  VERIFIED: { bg: 'rgba(16,185,129,0.14)', text: '#047857' },
  REJECTED: { bg: 'rgba(239,68,68,0.13)', text: '#b91c1c' },
  EXPIRED: { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-secondary)' },
};

const MATCH_STATUS_TINT: Record<string, { bg: string; text: string }> = {
  PENDING_REVIEW: { bg: 'rgba(245,158,11,0.15)', text: '#b45309' },
  TRUE_POSITIVE: { bg: 'rgba(239,68,68,0.13)', text: '#b91c1c' },
  FALSE_POSITIVE: { bg: 'rgba(16,185,129,0.14)', text: '#047857' },
  POSSIBLE: { bg: 'rgba(249,115,22,0.15)', text: '#c2410c' },
  CLEARED: { bg: 'rgba(16,185,129,0.14)', text: '#047857' },
};

const NEUTRAL_TINT = { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-secondary)' };

export default function KycCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [partyGraph, setPartyGraph] = useState<PartyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Decision flow (approve / reject / escalate)
  const [decision, setDecision] = useState<'approve' | 'reject' | 'escalate' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Document rejection flow
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [docReason, setDocReason] = useState('');
  const [docReasonError, setDocReasonError] = useState<string | null>(null);
  const [docBusyId, setDocBusyId] = useState<string | null>(null);

  // Screening disposition flow
  const [pendingScreening, setPendingScreening] = useState<{
    screeningId: string;
    matchStatus: string;
    decisionText: string;
  } | null>(null);
  const [screeningNotes, setScreeningNotes] = useState('');
  const [screeningBusy, setScreeningBusy] = useState(false);

  const loadCaseDetails = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const caseData = await kycService.getCase(caseId, true);
      setKycCase(caseData);

      // Party data is secondary — its failure must never blank the case.
      if (caseData.partyId) {
        try {
          const [partyData, graph] = await Promise.all([
            kycService.getParty(caseData.partyId),
            kycService.getPartyGraph(caseData.partyId),
          ]);
          setParty(partyData);
          setPartyGraph(graph ?? []);
        } catch (e) {
          console.error('Failed to load party data:', e);
          setParty(null);
          setPartyGraph([]);
        }
      }
    } catch (error) {
      console.error('Failed to load KYC case:', error);
      setLoadError(errorMessage(error, 'We could not load this case. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) loadCaseDetails();
  }, [caseId, loadCaseDetails]);

  const closeDecision = () => {
    setDecision(null);
    setDecisionNotes('');
    setDecisionError(null);
  };

  const submitDecision = async () => {
    if (!kycCase || !decision) return;
    const notes = decisionNotes.trim();

    // A rejection or escalation is irreversible and must carry a reason.
    if ((decision === 'reject' || decision === 'escalate') && !notes) {
      setDecisionError(
        decision === 'reject'
          ? 'A reason is required before a case can be rejected.'
          : 'A reason is required before a case can be escalated.'
      );
      return;
    }

    setDecisionBusy(true);
    setDecisionError(null);
    setActionError(null);
    setActionNotice(null);
    try {
      if (decision === 'approve') await kycService.approveCase(kycCase.caseId, notes || undefined);
      if (decision === 'reject') await kycService.rejectCase(kycCase.caseId, notes);
      if (decision === 'escalate') await kycService.escalateCase(kycCase.caseId, notes);
      const label =
        decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'escalated';
      closeDecision();
      setActionNotice(`${kycCase.caseReference} ${label}.`);
      await loadCaseDetails();
    } catch (error) {
      console.error(`Failed to ${decision} case:`, error);
      // Scoped to the decision panel — typed notes and the page stay intact.
      setDecisionError(errorMessage(error, `We could not record that decision. Please try again.`));
    } finally {
      setDecisionBusy(false);
    }
  };

  const submitForReview = async () => {
    if (!kycCase) return;
    setDecisionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await kycService.submitForReview(kycCase.caseId);
      setActionNotice(`${kycCase.caseReference} submitted for review.`);
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to submit case:', error);
      setActionError(errorMessage(error, 'We could not submit this case for review.'));
    } finally {
      setDecisionBusy(false);
    }
  };

  const handleDocumentVerify = async (documentId: string) => {
    setDocBusyId(documentId);
    setActionError(null);
    setActionNotice(null);
    try {
      await kycService.verifyDocument(documentId);
      setActionNotice('Document verified.');
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to verify document:', error);
      setActionError(errorMessage(error, 'We could not verify that document.'));
    } finally {
      setDocBusyId(null);
    }
  };

  const handleDocumentReject = async () => {
    if (!rejectDocId) return;
    const reason = docReason.trim();
    if (!reason) {
      setDocReasonError('A reason is required before a document can be rejected.');
      return;
    }
    setDocBusyId(rejectDocId);
    setDocReasonError(null);
    setActionError(null);
    setActionNotice(null);
    try {
      await kycService.rejectDocument(rejectDocId, reason);
      setRejectDocId(null);
      setDocReason('');
      setActionNotice('Document rejected.');
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to reject document:', error);
      setDocReasonError(errorMessage(error, 'We could not reject that document.'));
    } finally {
      setDocBusyId(null);
    }
  };

  const handleScreeningReview = async () => {
    if (!pendingScreening) return;
    setScreeningBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await kycService.reviewScreeningHit(
        pendingScreening.screeningId,
        pendingScreening.matchStatus,
        pendingScreening.decisionText,
        screeningNotes.trim() || undefined
      );
      setPendingScreening(null);
      setScreeningNotes('');
      setActionNotice('Screening result dispositioned.');
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to review screening:', error);
      setActionError(errorMessage(error, 'We could not save that screening decision.'));
    } finally {
      setScreeningBusy(false);
    }
  };

  // ------------------------------------------------------------------ loading
  if (loading) {
    return (
      <div className="space-y-6">
        <div
          className="h-28 animate-pulse rounded-3xl"
          style={{ backgroundColor: 'var(--rm-card-hover)' }}
        />
        <div
          className="h-20 animate-pulse rounded-3xl"
          style={{ backgroundColor: 'var(--rm-card-hover)' }}
        />
        <div
          className="h-96 animate-pulse rounded-3xl"
          style={{ backgroundColor: 'var(--rm-card-hover)' }}
        />
        <p className="sr-only" role="status">
          Loading case details
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------- error
  if (loadError) {
    return (
      <div className="space-y-6">
        <section
          role="alert"
          className="rounded-3xl p-7 text-center"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          <p className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
            We could not load this case
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {loadError}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={loadCaseDetails}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              Try again
            </button>
            <Link
              href="/dashboard/kyc/cases"
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Back to cases
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!kycCase) {
    return (
      <section className="rounded-3xl p-7 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
        <p className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
          Case not found
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          It may have been closed or removed.
        </p>
        <Link
          href="/dashboard/kyc/cases"
          className="mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-medium"
          style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
        >
          Back to cases
        </Link>
      </section>
    );
  }

  const canDecide = ['UNDER_REVIEW', 'PENDING_APPROVAL'].includes(kycCase.status);
  const tabCount = (tab: Tab): number | null => {
    if (tab === 'documents' && kycCase.documents) return kycCase.documents.length;
    if (tab === 'screening' && kycCase.screeningResults) return kycCase.screeningResults.length;
    if (tab === 'timeline' && kycCase.events) return kycCase.events.length;
    return null;
  };

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveTab(TABS[next].id);
    document.getElementById(`kyc-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div className="space-y-6" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <Link
          href="/dashboard/kyc/cases"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back to cases
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="text-2xl font-semibold tracking-tight"
                style={{ color: 'var(--rm-text)' }}
              >
                {kycCase.caseReference}
              </h1>
              <span
                className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getStatusColor(kycCase.status)}`}
              >
                {kycCase.statusDisplay || humanize(kycCase.status)}
              </span>
              {kycCase.isOverdue && (
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: 'rgba(239,68,68,0.13)', color: '#b91c1c' }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Overdue
                </span>
              )}
            </div>
            <p className="mt-2 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
              {party?.customerId ? (
                <Link
                  href={`/dashboard/customers/${party.customerId}`}
                  className="font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  {kycCase.partyDisplayName}
                </Link>
              ) : (
                <span className="font-medium" style={{ color: 'var(--rm-text)' }}>
                  {kycCase.partyDisplayName}
                </span>
              )}
              <span style={{ color: 'var(--rm-text-muted)' }}>
                {' · '}
                {humanize(kycCase.customerSegment)} · {humanize(kycCase.caseType)}
              </span>
            </p>
          </div>

          <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Risk
              </dt>
              <dd className="mt-1">
                {kycCase.riskTier ? (
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getRiskTierColor(kycCase.riskTier)}`}
                    >
                      {humanize(kycCase.riskTier)}
                    </span>
                    {kycCase.riskScore !== undefined && (
                      <span
                        className="text-base font-semibold tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {kycCase.riskScore}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Not assessed
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Diligence
              </dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getDiligenceColor(kycCase.requiredDiligence)}`}
                >
                  {kycService.getDiligenceLabel(kycCase.requiredDiligence)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Due
              </dt>
              <dd
                className="mt-1 text-base font-medium"
                style={{ color: kycCase.isOverdue ? '#b91c1c' : 'var(--rm-text)' }}
              >
                {kycCase.dueDate ? formatDate(kycCase.dueDate) : 'No due date'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Decisions */}
        {(kycCase.status === 'DRAFT' || canDecide) && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5" style={{ borderColor: 'var(--rm-border)' }}>
            {kycCase.status === 'DRAFT' && (
              <button
                onClick={submitForReview}
                disabled={decisionBusy}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {decisionBusy ? 'Submitting…' : 'Submit for review'}
              </button>
            )}
            {canDecide && (
              <>
                <button
                  onClick={() => {
                    setActionError(null);
                    setDecisionError(null);
                    setDecision('approve');
                  }}
                  disabled={decisionBusy}
                  aria-expanded={decision === 'approve'}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    setActionError(null);
                    setDecisionError(null);
                    setDecision('reject');
                  }}
                  disabled={decisionBusy}
                  aria-expanded={decision === 'reject'}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(239,68,68,0.13)', color: '#b91c1c' }}
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    setActionError(null);
                    setDecisionError(null);
                    setDecision('escalate');
                  }}
                  disabled={decisionBusy}
                  aria-expanded={decision === 'escalate'}
                  className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                >
                  Escalate
                </button>
              </>
            )}
          </div>
        )}

        {/* Inline decision confirmation */}
        {decision && (
          <div
            className="mt-4 rounded-2xl p-5"
            style={{ backgroundColor: 'var(--rm-input)' }}
            aria-labelledby="decision-heading"
          >
            <h2
              id="decision-heading"
              className="text-base font-semibold"
              style={{ color: 'var(--rm-text)' }}
            >
              {decision === 'approve'
                ? `Approve ${kycCase.caseReference}?`
                : decision === 'reject'
                  ? `Reject ${kycCase.caseReference}?`
                  : `Escalate ${kycCase.caseReference}?`}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              {decision === 'approve'
                ? 'This records a compliance approval and closes the review. Notes are optional.'
                : decision === 'reject'
                  ? 'This closes the case as rejected and cannot be undone. A reason is required.'
                  : 'This routes the case to senior compliance review and cannot be undone. A reason is required.'}
            </p>

            <div className="mt-4">
              <label
                htmlFor="decision-notes"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                {decision === 'approve' ? 'Notes (optional)' : 'Reason'}
                {decision !== 'approve' && (
                  <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                    {' '}
                    *
                  </span>
                )}
              </label>
              <textarea
                id="decision-notes"
                rows={3}
                value={decisionNotes}
                onChange={e => {
                  setDecisionNotes(e.target.value);
                  if (decisionError) setDecisionError(null);
                }}
                required={decision !== 'approve'}
                aria-required={decision !== 'approve'}
                aria-invalid={decisionError ? true : undefined}
                aria-describedby={decisionError ? 'decision-notes-error' : 'decision-notes-hint'}
                placeholder={
                  decision === 'approve'
                    ? 'Add anything the audit trail should record'
                    : 'Explain the decision for the audit trail'
                }
                className="w-full rounded-xl px-3.5 py-2.5 text-base"
                style={{
                  backgroundColor: 'var(--rm-card)',
                  border: `1px solid ${decisionError ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)'}`,
                  color: 'var(--rm-text)',
                }}
              />
              {decisionError ? (
                <p id="decision-notes-error" role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
                  {decisionError}
                </p>
              ) : (
                <p id="decision-notes-hint" className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {decision === 'approve' ? 'Optional.' : 'Required.'}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={submitDecision}
                disabled={decisionBusy}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: decision === 'reject' ? 'rgba(220,38,38,0.92)' : 'var(--rm-accent)',
                }}
              >
                {decisionBusy
                  ? 'Saving…'
                  : decision === 'approve'
                    ? 'Confirm approval'
                    : decision === 'reject'
                      ? 'Confirm rejection'
                      : 'Confirm escalation'}
              </button>
              <button
                onClick={closeDecision}
                disabled={decisionBusy}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action feedback */}
        {actionNotice && (
          <p
            role="status"
            className="mt-4 rounded-2xl px-5 py-3 text-sm font-medium"
            style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: 'var(--rm-text)' }}
          >
            {actionNotice}
          </p>
        )}
        {actionError && (
          <p
            role="alert"
            className="mt-4 rounded-2xl px-5 py-3 text-sm font-medium"
            style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: 'var(--rm-text)' }}
          >
            {actionError}
          </p>
        )}
      </header>

      {/* ══ Tabs ══ */}
      <div
        role="tablist"
        aria-label="Case sections"
        className="flex flex-wrap gap-1 rounded-full p-1"
        style={{ backgroundColor: 'var(--rm-card)' }}
      >
        {TABS.map((tab, i) => {
          const selected = activeTab === tab.id;
          const count = tabCount(tab.id);
          return (
            <button
              key={tab.id}
              id={`kyc-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`kyc-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={e => onTabKeyDown(e, i)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                backgroundColor: selected ? 'var(--rm-accent-muted)' : 'transparent',
                color: selected ? 'var(--rm-accent)' : 'var(--rm-text-muted)',
              }}
            >
              {tab.label}
              {count !== null && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ══ Panels ══ */}
      <div
        id={`kyc-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`kyc-tab-${activeTab}`}
        tabIndex={0}
        className="rounded-3xl"
        style={{ backgroundColor: 'var(--rm-card)' }}
      >
        {activeTab === 'overview' && <OverviewTab kycCase={kycCase} partyGraph={partyGraph} />}
        {activeTab === 'documents' && (
          <DocumentsTab
            documents={kycCase.documents || []}
            busyId={docBusyId}
            rejectDocId={rejectDocId}
            docReason={docReason}
            docReasonError={docReasonError}
            onDocReasonChange={v => {
              setDocReason(v);
              if (docReasonError) setDocReasonError(null);
            }}
            onVerify={handleDocumentVerify}
            onStartReject={id => {
              setActionError(null);
              setDocReasonError(null);
              setDocReason('');
              setRejectDocId(id);
            }}
            onCancelReject={() => {
              setRejectDocId(null);
              setDocReason('');
              setDocReasonError(null);
            }}
            onConfirmReject={handleDocumentReject}
          />
        )}
        {activeTab === 'screening' && (
          <ScreeningTab
            screenings={kycCase.screeningResults || []}
            pending={pendingScreening}
            notes={screeningNotes}
            busy={screeningBusy}
            onNotesChange={setScreeningNotes}
            onStartReview={(screeningId, matchStatus, decisionText) => {
              setActionError(null);
              setScreeningNotes('');
              setPendingScreening({ screeningId, matchStatus, decisionText });
            }}
            onCancelReview={() => {
              setPendingScreening(null);
              setScreeningNotes('');
            }}
            onConfirmReview={handleScreeningReview}
          />
        )}
        {activeTab === 'risk' && <RiskTab assessment={kycCase.riskAssessment} />}
        {activeTab === 'timeline' && <TimelineTab events={kycCase.events || []} />}
      </div>
    </div>
  );
}

// ============================================================================
// Panels
// ============================================================================

function EmptyState({ title, hint, icon }: { title: string; hint: string; icon: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(127,127,127,0.14)' }}
        aria-hidden="true"
      >
        <svg
          className="h-7 w-7"
          style={{ color: 'var(--rm-text-muted)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
         aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
        {title}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {hint}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="text-right text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {children}
      </dd>
    </div>
  );
}

function OverviewTab({
  kycCase,
  partyGraph,
}: {
  kycCase: KycCase;
  partyGraph: PartyRelationship[];
}) {
  return (
    <div className="space-y-8 p-6 sm:p-7">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="case-details-heading">
          <h2
            id="case-details-heading"
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            Case details
          </h2>
          <dl className="mt-3 divide-y" style={{ borderColor: 'var(--rm-border)' }}>
            <Field label="Case reference">{kycCase.caseReference}</Field>
            <Field label="Case type">{humanize(kycCase.caseType)}</Field>
            <Field label="Customer segment">{humanize(kycCase.customerSegment)}</Field>
            <Field label="Required diligence">
              <span
                className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getDiligenceColor(kycCase.requiredDiligence)}`}
              >
                {kycService.getDiligenceLabel(kycCase.requiredDiligence)}
              </span>
            </Field>
            {kycCase.triggerReason && <Field label="Trigger reason">{kycCase.triggerReason}</Field>}
            <Field label="Created">{formatDateTime(kycCase.createdAt)}</Field>
            {kycCase.dueDate && (
              <Field label="Due date">
                <span style={{ color: kycCase.isOverdue ? '#b91c1c' : 'var(--rm-text)' }}>
                  {formatDateTime(kycCase.dueDate)}
                  {kycCase.isOverdue ? ' · overdue' : ''}
                </span>
              </Field>
            )}
            {kycCase.assignedTo && <Field label="Assigned to">{kycCase.assignedTo}</Field>}
            {kycCase.nextReviewDate && (
              <Field label="Next review">{formatDate(kycCase.nextReviewDate)}</Field>
            )}
            <Field label="Documents on file">
              <span className="tabular-nums">{kycCase.documentCount}</span>
            </Field>
          </dl>
        </section>

        {kycCase.decision && (
          <section aria-labelledby="decision-details-heading">
            <h2
              id="decision-details-heading"
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Decision
            </h2>
            <dl className="mt-3 divide-y" style={{ borderColor: 'var(--rm-border)' }}>
              <Field label="Outcome">
                <span
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                  style={
                    kycCase.decision === 'APPROVE'
                      ? { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                      : { backgroundColor: 'rgba(239,68,68,0.13)', color: '#b91c1c' }
                  }
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={
                        kycCase.decision === 'APPROVE'
                          ? 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          : 'M6 18L18 6M6 6l12 12'
                      }
                    />
                  </svg>
                  {humanize(kycCase.decision)}
                </span>
              </Field>
              {kycCase.decisionReason && <Field label="Reason">{kycCase.decisionReason}</Field>}
              {kycCase.decidedBy && <Field label="Decided by">{kycCase.decidedBy}</Field>}
              {kycCase.decidedAt && (
                <Field label="Decided on">{formatDateTime(kycCase.decidedAt)}</Field>
              )}
              {kycCase.seniorApprovalBy && (
                <Field label="Senior approval by">{kycCase.seniorApprovalBy}</Field>
              )}
              {kycCase.seniorApprovalAt && (
                <Field label="Senior approval on">
                  {formatDateTime(kycCase.seniorApprovalAt)}
                </Field>
              )}
              {kycCase.seniorApprovalNotes && (
                <Field label="Senior approval notes">{kycCase.seniorApprovalNotes}</Field>
              )}
            </dl>
          </section>
        )}
      </div>

      {partyGraph.length > 0 && (
        <section aria-labelledby="party-graph-heading">
          <h2
            id="party-graph-heading"
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            Related parties
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {partyGraph.length} relationship{partyGraph.length === 1 ? '' : 's'} on record
          </p>
          <div
            className="mt-4 overflow-x-auto"
            role="region"
            aria-label="Related parties, scrollable"
            tabIndex={0}
          >
            <table className="w-full" aria-label="Party relationships">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                  <Th>From</Th>
                  <Th>Relationship</Th>
                  <Th>To</Th>
                  <Th align="right">Ownership</Th>
                  <Th>Verified</Th>
                </tr>
              </thead>
              <tbody>
                {partyGraph.map(rel => (
                  <tr key={rel.relationshipId} style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <td className="px-5 py-4">
                      <span className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {rel.fromPartyDisplayName}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                        style={{
                          backgroundColor: 'var(--rm-accent-muted)',
                          color: 'var(--rm-accent)',
                        }}
                      >
                        {rel.relationshipTypeDisplay ||
                          kycService.formatRelationshipType(rel.relationshipType)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-base" style={{ color: 'var(--rm-text)' }}>
                        {rel.toPartyDisplayName}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-right text-base tabular-nums"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      {rel.ownershipPercentage != null ? `${rel.ownershipPercentage}%` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: rel.isVerified ? '#047857' : 'var(--rm-text-muted)' }}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={
                              rel.isVerified
                                ? 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                : 'M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z'
                            }
                          />
                        </svg>
                        {rel.isVerified ? 'Verified' : 'Pending verification'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function DocumentsTab({
  documents,
  busyId,
  rejectDocId,
  docReason,
  docReasonError,
  onDocReasonChange,
  onVerify,
  onStartReject,
  onCancelReject,
  onConfirmReject,
}: {
  documents: KycDocument[];
  busyId: string | null;
  rejectDocId: string | null;
  docReason: string;
  docReasonError: string | null;
  onDocReasonChange: (v: string) => void;
  onVerify: (id: string) => void;
  onStartReject: (id: string) => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents uploaded yet"
        hint="Documents requested from the customer will appear here."
        icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    );
  }

  return (
    <div className="p-6 sm:p-7">
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Case documents, scrollable"
        tabIndex={0}
      >
        <table className="w-full" aria-label="Case documents">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
              <Th>Document</Th>
              <Th>Type</Th>
              <Th>Issuing authority</Th>
              <Th>Expiry</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => {
              const tint = DOC_STATUS_TINT[doc.status] ?? NEUTRAL_TINT;
              return (
                <tr
                  key={doc.documentId}
                  style={{
                    borderBottom: '1px solid var(--rm-border)',
                    backgroundColor: doc.isExpired
                      ? 'rgba(239,68,68,0.05)'
                      : doc.isExpiringSoon
                        ? 'rgba(245,158,11,0.06)'
                        : undefined,
                  }}
                >
                  <td className="px-5 py-4">
                    <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {doc.documentName}
                    </p>
                    {doc.documentNumber && (
                      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {doc.documentNumber}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {doc.documentTypeDisplay || humanize(doc.documentType)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {doc.issuingAuthority || '—'}
                      {doc.issuingCountry ? ` (${doc.issuingCountry})` : ''}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {doc.expiryDate ? formatDate(doc.expiryDate) : 'No expiry'}
                    </span>
                    {doc.isExpired && (
                      <p className="text-sm font-medium" style={{ color: '#b91c1c' }}>
                        Expired
                      </p>
                    )}
                    {doc.isExpiringSoon && !doc.isExpired && (
                      <p className="text-sm font-medium" style={{ color: '#b45309' }}>
                        Expiring soon
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                      style={{ backgroundColor: tint.bg, color: tint.text }}
                    >
                      {doc.statusDisplay || humanize(doc.status)}
                    </span>
                    {doc.rejectionReason && (
                      <p className="mt-1.5 max-w-[220px] text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {doc.rejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {rejectDocId === doc.documentId ? (
                      <div className="min-w-[260px] rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-input)' }}>
                        <label
                          htmlFor={`doc-reject-${doc.documentId}`}
                          className="mb-1.5 block text-sm font-medium"
                          style={{ color: 'var(--rm-text-secondary)' }}
                        >
                          Reason for rejection
                          <span aria-hidden="true" style={{ color: '#b91c1c' }}>
                            {' '}
                            *
                          </span>
                        </label>
                        <textarea
                          id={`doc-reject-${doc.documentId}`}
                          rows={2}
                          value={docReason}
                          onChange={e => onDocReasonChange(e.target.value)}
                          required
                          aria-required="true"
                          aria-invalid={docReasonError ? true : undefined}
                          aria-describedby={
                            docReasonError ? `doc-reject-error-${doc.documentId}` : undefined
                          }
                          className="w-full rounded-xl px-3 py-2 text-sm"
                          style={{
                            backgroundColor: 'var(--rm-card)',
                            border: `1px solid ${docReasonError ? 'rgba(239,68,68,0.75)' : 'var(--rm-border)'}`,
                            color: 'var(--rm-text)',
                          }}
                        />
                        {docReasonError && (
                          <p
                            id={`doc-reject-error-${doc.documentId}`}
                            role="alert"
                            className="mt-1.5 text-sm"
                            style={{ color: '#b91c1c' }}
                          >
                            {docReasonError}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={onConfirmReject}
                            disabled={busyId === doc.documentId}
                            className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                            style={{ backgroundColor: 'rgba(220,38,38,0.92)' }}
                          >
                            {busyId === doc.documentId ? 'Saving…' : 'Confirm rejection'}
                          </button>
                          <button
                            onClick={onCancelReject}
                            disabled={busyId === doc.documentId}
                            className="rounded-full px-3.5 py-1.5 text-sm font-medium disabled:opacity-50"
                            style={{
                              backgroundColor: 'var(--rm-card)',
                              color: 'var(--rm-text-secondary)',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="flex items-center justify-end gap-3">
                        {doc.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => onVerify(doc.documentId)}
                              disabled={busyId === doc.documentId}
                              className="text-sm font-medium hover:underline disabled:opacity-50"
                              style={{ color: 'var(--rm-accent)' }}
                            >
                              {busyId === doc.documentId ? 'Working…' : 'Verify'}
                            </button>
                            <button
                              onClick={() => onStartReject(doc.documentId)}
                              disabled={busyId === doc.documentId}
                              className="text-sm font-medium hover:underline disabled:opacity-50"
                              style={{ color: '#b91c1c' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {doc.fileReference && (
                          <a
                            href={`/api/documents/${doc.fileReference}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline"
                            style={{ color: 'var(--rm-text-secondary)' }}
                          >
                            Open file
                            <span className="sr-only"> for {doc.documentName} (opens in a new tab)</span>
                          </a>
                        )}
                        {!doc.fileReference && doc.status !== 'PENDING' && (
                          <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            —
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScreeningTab({
  screenings,
  pending,
  notes,
  busy,
  onNotesChange,
  onStartReview,
  onCancelReview,
  onConfirmReview,
}: {
  screenings: ScreeningResult[];
  pending: { screeningId: string; matchStatus: string; decisionText: string } | null;
  notes: string;
  busy: boolean;
  onNotesChange: (v: string) => void;
  onStartReview: (screeningId: string, matchStatus: string, decisionText: string) => void;
  onCancelReview: () => void;
  onConfirmReview: () => void;
}) {
  if (screenings.length === 0) {
    return (
      <EmptyState
        title="No screening results yet"
        hint="Sanctions, PEP and adverse media results will appear here."
        icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    );
  }

  return (
    <div className="space-y-6 p-6 sm:p-7">
      {screenings.map(screening => {
        const matchTint = screening.matchStatus
          ? MATCH_STATUS_TINT[screening.matchStatus] ?? NEUTRAL_TINT
          : null;
        const isPending = pending?.screeningId === screening.screeningId;
        return (
          <article
            key={screening.screeningId}
            className="rounded-2xl p-5"
            style={{
              backgroundColor: screening.hasHits ? 'rgba(245,158,11,0.07)' : 'var(--rm-input)',
            }}
            aria-label={`${screening.screeningTypeDisplay || screening.screeningType} screening`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                  {screening.screeningTypeDisplay || humanize(screening.screeningType)}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {screening.provider} · screened {formatDateTime(screening.screenedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                  style={
                    screening.hasHits
                      ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309' }
                      : { backgroundColor: 'rgba(16,185,129,0.14)', color: '#047857' }
                  }
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={
                        screening.hasHits
                          ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                          : 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                      }
                    />
                  </svg>
                  {screening.hasHits
                    ? `${screening.matchCount} potential match${screening.matchCount === 1 ? '' : 'es'}`
                    : 'No matches'}
                </span>
                {matchTint && screening.matchStatus && (
                  <span
                    className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: matchTint.bg, color: matchTint.text }}
                  >
                    {screening.matchStatusDisplay || humanize(screening.matchStatus)}
                  </span>
                )}
              </div>
            </div>

            {screening.matches && screening.matches.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                  Matches
                </h4>
                <ul className="mt-2 space-y-2">
                  {screening.matches.map((match, idx) => (
                    <li
                      key={match.matchId ?? idx}
                      className="rounded-xl p-4"
                      style={{ backgroundColor: 'var(--rm-card)' }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {match.name}
                          </p>
                          <p className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {match.listName}
                            {match.listCategory ? ` · ${match.listCategory}` : ''}
                          </p>
                          {match.pepDetails?.position && (
                            <p className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              Politically exposed: {match.pepDetails.position}
                              {match.pepDetails.country ? `, ${match.pepDetails.country}` : ''}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-base font-semibold tabular-nums"
                          style={{
                            color:
                              match.matchScore >= 90
                                ? '#b91c1c'
                                : match.matchScore >= 70
                                  ? '#c2410c'
                                  : '#b45309',
                          }}
                        >
                          {match.matchScore}% match
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {screening.hasHits && screening.matchStatus === 'PENDING_REVIEW' && (
              <div className="mt-5">
                <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                  Record a disposition
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { matchStatus: 'FALSE_POSITIVE', decisionText: 'No match confirmed', label: 'False positive' },
                    { matchStatus: 'POSSIBLE', decisionText: 'Requires further investigation', label: 'Possible match' },
                    { matchStatus: 'TRUE_POSITIVE', decisionText: 'Match confirmed', label: 'True positive' },
                  ].map(opt => (
                    <button
                      key={opt.matchStatus}
                      onClick={() =>
                        onStartReview(screening.screeningId, opt.matchStatus, opt.decisionText)
                      }
                      disabled={busy}
                      className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--rm-card)',
                        color: 'var(--rm-text-secondary)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {isPending && pending && (
                  <div className="mt-4 rounded-2xl p-5" style={{ backgroundColor: 'var(--rm-card)' }}>
                    <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                      Confirm: {humanize(pending.matchStatus)}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {pending.decisionText}. This records a compliance disposition.
                    </p>
                    <div className="mt-4">
                      <label
                        htmlFor={`screening-notes-${screening.screeningId}`}
                        className="mb-1.5 block text-sm font-medium"
                        style={{ color: 'var(--rm-text-secondary)' }}
                      >
                        Notes (optional)
                      </label>
                      <textarea
                        id={`screening-notes-${screening.screeningId}`}
                        rows={2}
                        value={notes}
                        onChange={e => onNotesChange(e.target.value)}
                        className="w-full rounded-xl px-3.5 py-2.5 text-base"
                        style={{
                          backgroundColor: 'var(--rm-input)',
                          border: '1px solid var(--rm-border)',
                          color: 'var(--rm-text)',
                        }}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={onConfirmReview}
                        disabled={busy}
                        className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--rm-accent)' }}
                      >
                        {busy ? 'Saving…' : 'Confirm disposition'}
                      </button>
                      <button
                        onClick={onCancelReview}
                        disabled={busy}
                        className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--rm-input)',
                          color: 'var(--rm-text-secondary)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {screening.reviewedAt && (
              <dl
                className="mt-5 rounded-2xl p-4"
                style={{ backgroundColor: 'var(--rm-card)' }}
                aria-label="Review record"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Decision
                  </dt>
                  <dd className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    {screening.reviewDecision || '—'}
                  </dd>
                </div>
                {screening.reviewNotes && (
                  <div className="mt-2 flex items-baseline justify-between gap-4">
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Notes
                    </dt>
                    <dd
                      className="text-right text-sm"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      {screening.reviewNotes}
                    </dd>
                  </div>
                )}
                <div className="mt-2 flex items-baseline justify-between gap-4">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Reviewed
                  </dt>
                  <dd className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {formatDateTime(screening.reviewedAt)}
                    {screening.reviewedBy ? ` · ${screening.reviewedBy}` : ''}
                  </dd>
                </div>
              </dl>
            )}
          </article>
        );
      })}
    </div>
  );
}

function RiskTab({ assessment }: { assessment?: RiskAssessment }) {
  if (!assessment) {
    return (
      <EmptyState
        title="No risk assessment yet"
        hint="A risk score and tier are recorded once the assessment has been run."
        icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    );
  }

  const components = [
    { label: 'Customer', score: assessment.customerRiskScore },
    { label: 'Geography', score: assessment.geographyRiskScore },
    { label: 'Product', score: assessment.productRiskScore },
    { label: 'Channel', score: assessment.channelRiskScore },
    { label: 'Transaction', score: assessment.transactionRiskScore },
  ];

  return (
    <div className="space-y-8 p-6 sm:p-7">
      <section
        className="rounded-2xl p-6"
        style={{ backgroundColor: 'var(--rm-input)' }}
        aria-labelledby="overall-risk-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h2
              id="overall-risk-heading"
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Overall risk
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Assessed {formatDateTime(assessment.assessedAt)}
              {assessment.validUntil ? ` · valid until ${formatDate(assessment.validUntil)}` : ''}
            </p>
            {assessment.isExpired && (
              <p className="mt-1 text-sm font-medium" style={{ color: '#b45309' }}>
                This assessment has expired and should be re-run.
              </p>
            )}
          </div>
          <div className="text-right">
            <span
              className={`inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-base font-semibold ${kycService.getRiskTierColor(assessment.riskTier)}`}
            >
              {assessment.riskTierDisplay || humanize(assessment.riskTier)}
            </span>
            <p
              className="mt-2 text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--rm-text)' }}
            >
              {assessment.overallRiskScore}
              <span className="ml-1.5 text-sm font-normal" style={{ color: 'var(--rm-text-muted)' }}>
                overall score
              </span>
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="risk-components-heading">
        <h2
          id="risk-components-heading"
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          Risk components
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {components.map(c => (
            <RiskScoreCard key={c.label} label={c.label} score={c.score} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="diligence-heading" className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--rm-input)' }}>
          <h2
            id="diligence-heading"
            className="text-base font-semibold"
            style={{ color: 'var(--rm-text)' }}
          >
            Applied diligence
          </h2>
          <span
            className={`mt-3 inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${kycService.getDiligenceColor(assessment.appliedDiligence)}`}
          >
            {assessment.appliedDiligenceDisplay ||
              kycService.getDiligenceLabel(assessment.appliedDiligence)}
          </span>
        </div>

        {assessment.isOverridden && (
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'rgba(245,158,11,0.10)' }}
            aria-labelledby="override-heading"
          >
            <h2
              id="override-heading"
              className="text-base font-semibold"
              style={{ color: 'var(--rm-text)' }}
            >
              Risk override applied
            </h2>
            <dl className="mt-3 space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Original tier
                </dt>
                <dd className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                  {humanize(assessment.originalRiskTier)}
                </dd>
              </div>
              {assessment.overrideReason && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Reason
                  </dt>
                  <dd
                    className="text-right text-sm"
                    style={{ color: 'var(--rm-text-secondary)' }}
                  >
                    {assessment.overrideReason}
                  </dd>
                </div>
              )}
              {assessment.overriddenBy && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Overridden by
                  </dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                    {assessment.overriddenBy}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}

function RiskScoreCard({ label, score }: { label: string; score: number }) {
  const band =
    score >= 70
      ? { label: 'High', bg: 'rgba(239,68,68,0.13)', text: '#b91c1c' }
      : score >= 50
        ? { label: 'Elevated', bg: 'rgba(249,115,22,0.15)', text: '#c2410c' }
        : score >= 30
          ? { label: 'Moderate', bg: 'rgba(245,158,11,0.15)', text: '#b45309' }
          : { label: 'Low', bg: 'rgba(16,185,129,0.14)', text: '#047857' };

  return (
    <li className="rounded-2xl p-5 text-center" style={{ backgroundColor: band.bg }}>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: band.text }}>
        {score}
      </p>
      <p className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm" style={{ color: band.text }}>
        {band.label}
      </p>
    </li>
  );
}

function TimelineTab({ events }: { events: KycCaseEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events recorded yet"
        hint="Every status change, document and screening action is logged here."
        icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    );
  }

  return (
    <div className="p-6 sm:p-7">
      <ol className="space-y-6">
        {events.map(event => {
          const tone = eventTone(event.eventType);
          return (
            <li key={event.eventId} className="flex gap-4">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: tone.bg, color: tone.text }}
                aria-hidden="true"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                 aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tone.path} />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    {event.eventTypeDisplay || humanize(event.eventType)}
                  </p>
                  <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                    {formatDateTime(event.performedAt)}
                  </p>
                </div>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  {event.eventDescription}
                </p>
                {(event.previousValue || event.newValue) && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {event.previousValue ? `${humanize(event.previousValue)} → ` : ''}
                    {event.newValue ? humanize(event.newValue) : ''}
                  </p>
                )}
                {event.performedBy && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {event.performedBy}
                  </p>
                )}
                {event.notes && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Note: {event.notes}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function eventTone(eventType: string): { bg: string; text: string; path: string } {
  const CHECK = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  const CROSS = 'M6 18L18 6M6 6l12 12';
  const WARN =
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
  const DOC =
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  const CLOCK = 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';

  if (eventType.includes('REJECT'))
    return { bg: 'rgba(239,68,68,0.13)', text: '#b91c1c', path: CROSS };
  if (eventType.includes('ESCALAT'))
    return { bg: 'rgba(249,115,22,0.15)', text: '#c2410c', path: WARN };
  if (eventType.includes('APPROV') || eventType.includes('CREATED'))
    return { bg: 'rgba(16,185,129,0.14)', text: '#047857', path: CHECK };
  if (eventType.includes('SCREEN'))
    return { bg: 'rgba(139,92,246,0.15)', text: '#6d28d9', path: WARN };
  if (eventType.includes('DOCUMENT'))
    return { bg: 'var(--rm-accent-muted)', text: 'var(--rm-accent)', path: DOC };
  if (eventType.includes('RISK'))
    return { bg: 'rgba(245,158,11,0.15)', text: '#b45309', path: WARN };
  return { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-muted)', path: CLOCK };
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--rm-text-muted)' }}
    >
      {children}
    </th>
  );
}
