'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import config from '@/config';
import { aiApprovalService, type PendingAction } from '@/services/api/aiApprovalService';

const TOOL_LABELS: Record<string, string> = {
  'signal.acknowledge': 'Acknowledge customer signal',
};

const RISK_TONE: Record<string, string> = {
  READ_ONLY: '#10b981',
  PREPARE: '#0ea5e9',
  REVERSIBLE_WRITE: '#f59e0b',
  FINANCIAL_WRITE: '#ef4444',
  REGULATED_DECISION: '#dc2626',
};

function toolLabel(toolCode: string): string {
  return TOOL_LABELS[toolCode] || toolCode;
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
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AiApprovalsPage() {
  const bankId = config.bank.defaultBankId;

  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await aiApprovalService.listPending(bankId);
      setActions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (actionId: string) => {
    try {
      setDecidingId(actionId);
      await aiApprovalService.approve(actionId, bankId, 'Approved by RM');
      toast.success('Action approved and executed.');
      await load();
    } catch (err) {
      toast.error('Failed to approve action.');
    } finally {
      setDecidingId(null);
    }
  };

  const handleReject = async (actionId: string) => {
    try {
      setDecidingId(actionId);
      await aiApprovalService.reject(actionId, bankId, 'Rejected by RM');
      toast.success('Action rejected.');
      await load();
    } catch (err) {
      toast.error('Failed to reject action.');
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>AI Approvals</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
          Every AI-proposed action that writes data waits here until a human decides. Nothing executes
          without an explicit approval.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>Loading pending approvals…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid rgba(239,68,68,0.35)' }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : actions.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>Nothing waiting on you</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            AI-proposed actions requiring approval will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const payload = parsePayload(action.payload);
            const busy = decidingId === action.actionId;
            return (
              <div
                key={action.actionId}
                className="rounded-2xl p-4"
                style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: `${RISK_TONE[action.riskClass] || '#64748b'}22`, color: RISK_TONE[action.riskClass] || '#64748b' }}
                      >
                        {action.riskClass.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        Requested {formatDate(action.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                      {toolLabel(action.toolCode)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--rm-text-secondary)' }}>
                      {action.customerId && (
                        <Link href={`/dashboard/customers/${action.customerId}`} className="hover:underline" style={{ color: '#0ea5e9' }}>
                          View customer →
                        </Link>
                      )}
                      {typeof payload.signalId === 'string' && (
                        <span>Signal: {String(payload.signalId).slice(0, 8)}…</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(action.actionId)}
                      disabled={busy}
                      className="rounded-xl px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(action.actionId)}
                      disabled={busy}
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: '#0ea5e9' }}
                    >
                      {busy ? 'Working…' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
