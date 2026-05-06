'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

interface ChecklistItem {
  id: string;
  itemName: string;
  description?: string;
  isMandatory: boolean;
  status: string;
  dueDate?: string;
  overdue?: boolean;
}

const statusColor: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WAIVED: 'bg-purple-100 text-purple-700',
};

export default function ChecklistPanel({
  caseId,
  isBankUser,
}: {
  caseId: string;
  isBankUser: boolean;
}) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const res = await caseService.getChecklist(caseId);
      setItems(res as unknown as ChecklistItem[]);
    } catch {
      toast.error('Failed to load checklist');
    } finally {
      setLoading(false);
    }
  };

  const review = async (itemId: string, action: string) => {
    try {
      await caseService.reviewChecklistItem(caseId, itemId, action, reason || undefined);
      toast.success(`Item ${action.toLowerCase()}ed`);
      setReviewingId(null);
      setReason('');
      load();
    } catch {
      toast.error('Action failed');
    }
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading checklist…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Checklist Items ({items.length})</h3>
        <span className="text-xs text-gray-500">
          {items.filter(i => i.status === 'ACCEPTED' || i.status === 'WAIVED').length} /{' '}
          {items.length} complete
        </span>
      </div>
      {items.map(item => (
        <div key={item.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 text-sm">{item.itemName}</span>
                {item.isMandatory && (
                  <span className="text-xs text-red-500 font-medium">Required</span>
                )}
                {item.overdue && (
                  <span className="text-xs text-orange-600 font-medium">Overdue</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              )}
              {item.dueDate && <p className="text-xs text-gray-400 mt-1">Due: {item.dueDate}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[item.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {item.status.replace(/_/g, ' ')}
              </span>
              {isBankUser && ['SUBMITTED', 'PENDING'].includes(item.status) && (
                <button
                  onClick={() => setReviewingId(reviewingId === item.id ? null : item.id)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Review
                </button>
              )}
            </div>
          </div>

          {/* Inline review form */}
          {isBankUser && reviewingId === item.id && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <input
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => review(item.id, 'ACCEPT')}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Accept
                </button>
                <button
                  onClick={() => review(item.id, 'REJECT')}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reject
                </button>
                <button
                  onClick={() => review(item.id, 'WAIVE')}
                  className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Waive
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
      ))}
    </div>
  );
}
