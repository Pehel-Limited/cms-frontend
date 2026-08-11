'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

interface DrawdownRequest {
  id: string;
  amount: number;
  iban?: string;
  accountName?: string;
  requestedDrawdownDate?: string;
  status: string;
  requestedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

const statusColor: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  RELEASED: 'bg-blue-100 text-blue-700',
};

export default function DrawdownPanel({
  caseId,
  isBankUser,
  eligibilityData,
}: {
  caseId: string;
  isBankUser: boolean;
  eligibilityData: Record<string, unknown>;
}) {
  const [history, setHistory] = useState<DrawdownRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState('');
  const [accountName, setAccountName] = useState('');
  const [requestedDrawdownDate, setRequestedDrawdownDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const res = await caseService.getDrawdownHistory(caseId);
      setHistory(res as unknown as DrawdownRequest[]);
    } catch {
      toast.error('Failed to load drawdown history');
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!iban.trim()) {
      toast.error('IBAN is required');
      return;
    }
    if (!accountName.trim()) {
      toast.error('Account name is required');
      return;
    }
    if (!requestedDrawdownDate) {
      toast.error('Drawdown date is required');
      return;
    }
    try {
      await caseService.requestDrawdown(caseId, {
        amount: parseFloat(amount),
        iban: iban.trim(),
        accountName: accountName.trim(),
        requestedDrawdownDate,
        purpose,
      });
      toast.success('Drawdown request submitted');
      setShowForm(false);
      setAmount('');
      setIban('');
      setAccountName('');
      setRequestedDrawdownDate('');
      setPurpose('');
      load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Request failed';
      toast.error(msg);
    }
  };

  const reviewDrawdown = async (id: string, action: string) => {
    try {
      await caseService.reviewDrawdown(caseId, id, action, reviewReason || undefined);
      toast.success(`Drawdown ${action.toLowerCase()}d`);
      setReviewingId(null);
      setReviewReason('');
      load();
    } catch {
      toast.error('Action failed');
    }
  };

  const eligible = eligibilityData.drawdownEligible as boolean;

  if (loading) return <div className="text-gray-500 text-sm">Loading drawdown…</div>;

  return (
    <div className="space-y-4">
      {/* Eligibility Banner */}
      <div
        className={`rounded-lg p-4 text-sm ${eligible ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}
      >
        <p className={`font-medium ${eligible ? 'text-green-800' : 'text-yellow-800'}`}>
          {eligible ? '✓ Drawdown eligible' : '⚠ Not yet eligible for drawdown'}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <EligFlag
            label="Mandatory Checklist"
            ok={eligibilityData.mandatoryChecklistComplete as boolean}
          />
          <EligFlag label="Undertaking" ok={eligibilityData.undertakingAccepted as boolean} />
          <EligFlag label="Certificate" ok={eligibilityData.certificateAccepted as boolean} />
        </div>
      </div>

      {/* Request Form (solicitor only when eligible) */}
      {!isBankUser && eligible && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Request Drawdown
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-800">New Drawdown Request</h4>
              <input
                type="number"
                placeholder="Amount (€)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="IBAN"
                value={iban}
                onChange={e => setIban(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Account holder name"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Requested drawdown date</label>
                <input
                  type="date"
                  value={requestedDrawdownDate}
                  onChange={e => setRequestedDrawdownDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <input
                type="text"
                placeholder="Purpose (optional)"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitRequest}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Submit
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawdown History */}
      <h3 className="font-semibold text-gray-800 text-sm">Drawdown History ({history.length})</h3>
      {history.length === 0 ? (
        <p className="text-gray-500 text-sm">No drawdown requests.</p>
      ) : (
        history.map(req => (
          <div key={req.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm text-gray-800">€{req.amount?.toLocaleString()}</p>
                {req.accountName && <p className="text-xs text-gray-500">{req.accountName}</p>}
                {req.iban && <p className="text-xs text-gray-400 font-mono">{req.iban}</p>}
                {req.requestedDrawdownDate && (
                  <p className="text-xs text-gray-400">
                    Date: {new Date(req.requestedDrawdownDate).toLocaleDateString()}
                  </p>
                )}
                {req.requestedAt && (
                  <p className="text-xs text-gray-400">
                    Requested {new Date(req.requestedAt).toLocaleDateString()}
                  </p>
                )}
                {req.rejectionReason && (
                  <p className="text-xs text-red-600 mt-1">Rejected: {req.rejectionReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[req.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {req.status}
                </span>
                {isBankUser && req.status === 'PENDING' && (
                  <button
                    onClick={() => setReviewingId(reviewingId === req.id ? null : req.id)}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Review
                  </button>
                )}
                {isBankUser && req.status === 'APPROVED' && (
                  <button
                    onClick={() => reviewDrawdown(req.id, 'RELEASE')}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Release Funds
                  </button>
                )}
              </div>
            </div>
            {isBankUser && reviewingId === req.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewDrawdown(req.id, 'APPROVE')}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reviewDrawdown(req.id, 'REJECT')}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setReviewingId(null)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function EligFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`flex items-center gap-1 ${ok ? 'text-green-700' : 'text-yellow-700'}`}>
      {ok ? '✓' : '○'} {label}
    </span>
  );
}
