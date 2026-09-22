'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import config from '@/config';
import { aiApprovalService, type PendingAction } from '@/services/api/aiApprovalService';

const TOOL_LABELS: Record<string, string> = {
  'signal.acknowledge': 'Acknowledge customer signal',
};

/* Risk classes are surfaced with wording and a tint — never colour alone. */
const RISK_META: Record<string, { label: string; detail: string; bg: string; fg: string }> = {
  READ_ONLY: {
    label: 'Read only',
    detail: 'Looks at data without changing anything.',
    bg: 'rgba(16,185,129,0.14)',
    fg: '#047857',
  },
  PREPARE: {
    label: 'Prepares data',
    detail: 'Drafts content for a human to review.',
    bg: 'rgba(14,165,233,0.14)',
    fg: '#0284c7',
  },
  REVERSIBLE_WRITE: {
    label: 'Reversible write',
    detail: 'Changes a record, and the change can be undone.',
    bg: 'rgba(245,158,11,0.15)',
    fg: '#b45309',
  },
  FINANCIAL_WRITE: {
    label: 'Financial write',
    detail: 'Moves or commits money, so it needs a human decision.',
    bg: 'rgba(239,68,68,0.13)',
    fg: '#b91c1c',
  },
  REGULATED_DECISION: {
    label: 'Regulated decision',
    detail: 'A credit or compliance decision that must be made by a person.',
    bg: 'rgba(220,38,38,0.14)',
    fg: '#b91c1c',
  },
};

function riskMeta(riskClass: string) {
  return (
    RISK_META[riskClass] || {
      label: (riskClass || 'Unclassified').replace(/_/g, ' ').toLowerCase(),
      detail: '',
      bg: 'rgba(127,127,127,0.14)',
      fg: 'var(--rm-text-secondary)',
    }
  );
}

function toolLabel(toolCode: string): string {
  return TOOL_LABELS[toolCode] || toolCode.replace(/[._]/g, ' ');
}

function parsePayload(payload: string | null): Record<string, unknown> {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Decision = 'approve' | 'reject';

export default function AiApprovalsPage() {
  const bankId = config.bank.defaultBankId;

  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  /* Scoped per action: a failed decision never blanks the queue or hides the
     other pending items. */
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<{ id: string; decision: Decision } | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await aiApprovalService.listPending(bankId);
      setActions(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const decide = async (actionId: string, decision: Decision) => {
    try {
      setDecidingId(actionId);
      setActionErrors(prev => ({ ...prev, [actionId]: '' }));
      if (decision === 'approve') {
        await aiApprovalService.approve(actionId, bankId, 'Approved by RM');
        toast.success('Action approved and executed.');
      } else {
        await aiApprovalService.reject(actionId, bankId, 'Rejected by RM');
        toast.info('Action rejected.');
      }
      setConfirming(null);
      await load();
    } catch (err) {
      setActionErrors(prev => ({
        ...prev,
        [actionId]:
          err instanceof Error
            ? err.message
            : `That action could not be ${decision === 'approve' ? 'approved' : 'rejected'}.`,
      }));
      setConfirming(null);
    } finally {
      setDecidingId(null);
    }
  };

  const startConfirm = (actionId: string, decision: Decision) =>
    setConfirming({ id: actionId, decision });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* ── Header ── */}
      <header>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          AI approvals
        </h1>
        <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Every AI-proposed action that writes data waits here until a person decides. Nothing
          executes without an explicit approval.
        </p>
      </header>

      {/* ── Loading ── */}
      {loading && (
        <section aria-label="Pending approvals, loading" className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
              <div className="flex items-center gap-3">
                <div className="h-6 w-32 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="h-4 w-40 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              </div>
              <div className="mt-4 h-5 w-2/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              <div className="mt-3 h-4 w-1/3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
            </div>
          ))}
          <p className="sr-only" role="status">
            Loading pending approvals
          </p>
        </section>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-3xl px-6 py-5"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}
        >
          <svg className="h-5 w-5 shrink-0" style={{ color: '#dc2626' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm" style={{ color: '#b91c1c' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={load}
            className="ml-auto rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgba(239,68,68,0.16)', color: '#b91c1c' }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && actions.length === 0 && (
        <section className="rounded-3xl py-20 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(16,185,129,0.14)' }}
          >
            <svg className="h-7 w-7" style={{ color: '#047857' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Nothing waiting on you
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            AI-proposed actions that need a decision will appear here.
          </p>
        </section>
      )}

      {/* ── Queue ── */}
      {!loading && !error && actions.length > 0 && (
        <section aria-label="Pending AI approvals" className="space-y-4">
          <p role="status" className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {actions.length} action{actions.length === 1 ? '' : 's'} awaiting a decision
          </p>

          <ul className="space-y-4">
            {actions.map(action => {
              const payload = parsePayload(action.payload);
              const busy = decidingId === action.actionId;
              const meta = riskMeta(action.riskClass);
              const actionError = actionErrors[action.actionId];
              const isConfirming = confirming?.id === action.actionId;
              const pendingDecision = isConfirming ? confirming?.decision : null;

              return (
                <li
                  key={action.actionId}
                  className="rounded-3xl p-6 sm:p-7"
                  style={{ backgroundColor: 'var(--rm-card)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="rounded-full px-3 py-1 text-sm font-medium"
                          style={{ backgroundColor: meta.bg, color: meta.fg }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                          Requested {formatDate(action.createdAt)}
                        </span>
                      </div>

                      <p className="mt-3 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {toolLabel(action.toolCode)}
                      </p>
                      {meta.detail && (
                        <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {meta.detail}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {action.customerId && (
                          <Link
                            href={`/dashboard/customers/${action.customerId}`}
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                            style={{ color: 'var(--rm-accent)' }}
                          >
                            View customer
                            <svg className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}
                        {typeof payload.signalId === 'string' && (
                          <span className="tabular-nums">
                            Signal {String(payload.signalId).slice(0, 8)}
                          </span>
                        )}
                        <span className="tabular-nums">Reference {action.actionId.slice(0, 8)}</span>
                      </div>
                    </div>

                    {!isConfirming && (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startConfirm(action.actionId, 'reject')}
                          disabled={busy}
                          className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => startConfirm(action.actionId, 'approve')}
                          disabled={busy}
                          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--rm-accent)' }}
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline confirmation — replaces a browser confirm() dialog */}
                  {isConfirming && pendingDecision && (
                    <div
                      role="group"
                      aria-label={
                        pendingDecision === 'approve'
                          ? 'Confirm approval'
                          : 'Confirm rejection'
                      }
                      className="mt-5 rounded-2xl p-5"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    >
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {pendingDecision === 'approve'
                          ? 'Approve and run this action now?'
                          : 'Reject this action?'}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {pendingDecision === 'approve'
                          ? 'The action runs immediately and is recorded against your user.'
                          : 'The action is discarded and the AI will not retry it on its own.'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          ref={confirmRef}
                          type="button"
                          onClick={() => decide(action.actionId, pendingDecision)}
                          disabled={busy}
                          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{
                            backgroundColor:
                              pendingDecision === 'approve' ? 'var(--rm-accent)' : '#dc2626',
                          }}
                        >
                          {busy
                            ? 'Working…'
                            : pendingDecision === 'approve'
                              ? 'Yes, approve and run'
                              : 'Yes, reject'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          disabled={busy}
                          className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-secondary)' }}
                        >
                          No, leave it pending
                        </button>
                      </div>
                      {busy && (
                        <p className="sr-only" role="status">
                          Sending your decision
                        </p>
                      )}
                    </div>
                  )}

                  {actionError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-2xl px-4 py-3 text-sm"
                      style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}
                    >
                      {actionError} The action is still pending — you can try again.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
