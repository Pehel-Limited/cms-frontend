'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

interface AuditEvent {
  id: string;
  eventType: string;
  description?: string;
  actorName?: string;
  actorType?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

interface PagedAudit {
  content: AuditEvent[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export default function AuditPanel({ caseId }: { caseId: string }) {
  const [data, setData] = useState<PagedAudit | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const res = await caseService.getAudit(caseId, page, 20);
      setData(res as unknown as PagedAudit);
    } catch {
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading audit trail…</div>;

  const events = data?.content ?? [];

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-800">
        Audit Trail ({data?.totalElements ?? 0} events)
      </h3>
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm">No audit events.</p>
      ) : (
        <div className="relative pl-4">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" />
          {events.map((event, idx) => (
            <div key={event.id} className="relative flex gap-4 pb-4">
              <div className="absolute left-[-3px] w-2.5 h-2.5 rounded-full bg-primary-500 border-2 border-white mt-1" />
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">
                    {event.eventType.replace(/_/g, ' ')}
                  </p>
                  <span className="text-xs text-gray-400">
                    {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}
                  </span>
                </div>
                {event.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{event.description}</p>
                )}
                {event.actorName && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    By {event.actorName}
                    {event.actorType && ` (${event.actorType})`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span>
            Page {(data.number ?? 0) + 1} of {data.totalPages}
          </span>
          <button
            disabled={page >= data.totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
