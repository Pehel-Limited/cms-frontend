'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

interface CaseDocument {
  id: string;
  documentName: string;
  documentType: string;
  status: string;
  uploadedAt?: string;
  uploadedByName?: string;
  fileUrl?: string;
}

const statusColor: Record<string, string> = {
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  SUPERSEDED: 'bg-gray-100 text-gray-500',
};

export default function DocumentsPanel({
  caseId,
  isBankUser,
}: {
  caseId: string;
  isBankUser: boolean;
}) {
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const res = await caseService.getDocuments(caseId);
      setDocs(res as unknown as CaseDocument[]);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const review = async (docId: string, action: string) => {
    try {
      await caseService.reviewDocument(caseId, docId, action, reason || undefined);
      toast.success(`Document ${action.toLowerCase()}ed`);
      setReviewingId(null);
      setReason('');
      load();
    } catch {
      toast.error('Action failed');
    }
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading documents…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Documents ({docs.length})</h3>
      </div>
      {docs.length === 0 ? (
        <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
      ) : (
        docs.map(doc => (
          <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-800">{doc.documentName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{doc.documentType}</p>
                {doc.uploadedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                    {doc.uploadedByName && ` by ${doc.uploadedByName}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[doc.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {doc.status.replace(/_/g, ' ')}
                </span>
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-600 hover:underline"
                  >
                    View
                  </a>
                )}
                {isBankUser && doc.status === 'PENDING_REVIEW' && (
                  <button
                    onClick={() => setReviewingId(reviewingId === doc.id ? null : doc.id)}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Review
                  </button>
                )}
              </div>
            </div>
            {isBankUser && reviewingId === doc.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => review(doc.id, 'ACCEPT')}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => review(doc.id, 'REJECT')}
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
