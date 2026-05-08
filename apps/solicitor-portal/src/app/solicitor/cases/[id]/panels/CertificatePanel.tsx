'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

const statusColor: Record<string, string> = {
  NOT_SUBMITTED: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-yellow-100 text-yellow-700',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  QUALIFIED_ACCEPTED: 'bg-orange-100 text-orange-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function CertificatePanel({
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
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [isQualified, setIsQualified] = useState(false);
  const [qualDetails, setQualDetails] = useState('');
  const [reviewReason, setReviewReason] = useState('');

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const res = await caseService.getCertificate(caseId);
      setData(res as unknown as Record<string, unknown>);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      await caseService.submitCertificate(caseId, {
        isQualified,
        qualificationDetails: isQualified ? qualDetails : undefined,
        templateVersion: '1.0',
      });
      toast.success('Certificate submitted');
      setShowSubmitForm(false);
      load();
      onRefresh();
    } catch {
      toast.error('Submission failed');
    }
  };

  const review = async (action: string) => {
    try {
      await caseService.reviewCertificate(caseId, action, reviewReason || undefined);
      toast.success(`Certificate ${action.toLowerCase()}ed`);
      load();
      onRefresh();
    } catch {
      toast.error('Action failed');
    }
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading certificate…</div>;

  const status = (data?.status as string) ?? 'NOT_SUBMITTED';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-gray-800">Certificate of Title</h3>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {data && status !== 'NOT_SUBMITTED' && (
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
          {!!data.isQualified && (
            <p className="text-orange-700 font-medium">⚠ Qualified Certificate</p>
          )}
          {!!data.qualificationDetails && (
            <p className="text-gray-600">Details: {String(data.qualificationDetails)}</p>
          )}
          {!!data.submittedAt && (
            <p className="text-gray-600">
              Submitted: {new Date(String(data.submittedAt)).toLocaleDateString()}
            </p>
          )}
          {!!data.reviewNotes && (
            <p className="text-gray-500 italic">Review notes: {String(data.reviewNotes)}</p>
          )}
        </div>
      )}

      {/* Solicitor: Submit Certificate */}
      {!isBankUser && (status === 'NOT_SUBMITTED' || status === 'REJECTED') && (
        <>
          {!showSubmitForm ? (
            <button
              onClick={() => setShowSubmitForm(true)}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Submit Certificate
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-800">Submit Certificate of Title</h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isQualified}
                  onChange={e => setIsQualified(e.target.checked)}
                />
                This is a qualified certificate
              </label>
              {isQualified && (
                <textarea
                  placeholder="Qualification details (required)"
                  value={qualDetails}
                  onChange={e => setQualDetails(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={submit}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Submit
                </button>
                <button
                  onClick={() => setShowSubmitForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bank User: Review Certificate */}
      {isBankUser && ['SUBMITTED', 'UNDER_REVIEW'].includes(status) && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Review notes (optional)"
            value={reviewReason}
            onChange={e => setReviewReason(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => review('ACCEPT')}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Accept
            </button>
            <button
              onClick={() => review('REJECT')}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
