'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

const statusColor: Record<string, string> = {
  NOT_ISSUED: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  SUBMITTED: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function UndertakingPanel({
  caseId,
  isBankUser,
  onRefresh,
}: {
  caseId: string;
  isBankUser: boolean;
  onRefresh: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const res = await caseService.getUndertaking(caseId);
      setData(res as unknown as Record<string, unknown>);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const action = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
      load();
      onRefresh();
    } catch {
      toast.error('Action failed');
    }
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading undertaking…</div>;

  const status = (data?.status as string) ?? 'NOT_ISSUED';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-gray-800">Solicitor Undertaking</h3>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {data && (
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
          {!!data.issuedAt && (
            <p className="text-gray-600">
              Issued: {new Date(String(data.issuedAt)).toLocaleDateString()}
            </p>
          )}
          {!!data.submittedAt && (
            <p className="text-gray-600">
              Submitted: {new Date(String(data.submittedAt)).toLocaleDateString()}
            </p>
          )}
          {!!data.reviewedAt && (
            <p className="text-gray-600">
              Reviewed: {new Date(String(data.reviewedAt)).toLocaleDateString()}
            </p>
          )}
          {!!data.reviewNotes && (
            <p className="text-gray-500 italic">Notes: {String(data.reviewNotes)}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Bank User: Issue undertaking */}
        {isBankUser && status === 'NOT_ISSUED' && (
          <button
            onClick={() => action(() => caseService.issueUndertaking(caseId), 'Undertaking issued')}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Issue Undertaking
          </button>
        )}

        {/* Solicitor: waiting for bank to issue */}
        {!isBankUser && status === 'NOT_ISSUED' && (
          <p className="text-sm text-gray-500 italic">
            The bank has not yet issued the undertaking. It will appear here once issued.
          </p>
        )}

        {/* Solicitor: Submit undertaking once issued/viewed */}
        {!isBankUser && (status === 'ISSUED' || status === 'VIEWED') && (
          <div className="w-full space-y-2">
            {data?.contentSnapshot && (
              <details className="border border-gray-200 rounded-lg mb-2">
                <summary className="px-4 py-2 text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  View Undertaking Text
                </summary>
                <pre className="px-4 py-3 text-xs text-gray-700 whitespace-pre-wrap border-t border-gray-100 bg-gray-50 max-h-48 overflow-y-auto">
                  {String(data.contentSnapshot)}
                </pre>
              </details>
            )}
            <button
              onClick={() =>
                action(() => caseService.submitUndertaking(caseId), 'Undertaking submitted to bank')
              }
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Submit Undertaking to Bank
            </button>
          </div>
        )}

        {/* Solicitor: submitted — awaiting bank review */}
        {!isBankUser && status === 'SUBMITTED' && (
          <p className="text-sm text-amber-700 font-medium">
            Undertaking submitted — awaiting bank review.
          </p>
        )}

        {/* Solicitor: accepted */}
        {!isBankUser && status === 'ACCEPTED' && (
          <p className="text-sm text-green-700 font-medium">✓ Undertaking accepted by the bank.</p>
        )}

        {/* Solicitor: rejected */}
        {!isBankUser && status === 'REJECTED' && (
          <div className="space-y-2">
            <p className="text-sm text-red-600 font-medium">
              Undertaking was rejected by the bank.
            </p>
            {!!data?.reviewNotes && (
              <p className="text-sm text-gray-600">Reason: {String(data.reviewNotes)}</p>
            )}
          </div>
        )}

        {/* Bank User: Review undertaking */}
        {isBankUser && status === 'SUBMITTED' && (
          <div className="w-full space-y-2">
            <input
              type="text"
              placeholder="Review notes (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() =>
                  action(
                    () => caseService.reviewUndertaking(caseId, 'ACCEPT', reason || undefined),
                    'Undertaking accepted'
                  )
                }
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  action(
                    () => caseService.reviewUndertaking(caseId, 'REJECT', reason || undefined),
                    'Undertaking rejected'
                  )
                }
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
