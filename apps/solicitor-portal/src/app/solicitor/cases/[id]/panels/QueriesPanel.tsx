'use client';

import { useEffect, useState } from 'react';
import { caseService } from '@/services/api/case-service';
import { toast } from 'react-toastify';

interface QueryMessage {
  id: string;
  messageBody: string;
  senderType?: string;
  internalOnly?: boolean;
  createdAt?: string;
}

interface QueryThread {
  id: string;
  subject: string;
  queryType: string;
  status: string;
  priority?: string;
  createdAt?: string;
  messages?: QueryMessage[];
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  AWAITING_SOLICITOR: 'bg-blue-100 text-blue-700',
  AWAITING_BANK: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

export default function QueriesPanel({
  caseId,
  isSolicitor,
}: {
  caseId: string;
  isSolicitor: boolean;
}) {
  const [threads, setThreads] = useState<QueryThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState('OTHER');

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const res = await caseService.getQueries(caseId, isSolicitor);
      setThreads(res as unknown as QueryThread[]);
    } catch {
      toast.error('Failed to load queries');
    } finally {
      setLoading(false);
    }
  };

  const createQuery = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    try {
      await caseService.createQuery(caseId, {
        subject: newSubject,
        queryType: newType,
        messageBody: newMessage,
      });
      toast.success('Query submitted');
      setShowNewForm(false);
      setNewSubject('');
      setNewMessage('');
      load();
    } catch {
      toast.error('Failed to create query');
    }
  };

  const reply = async (threadId: string) => {
    if (!replyText.trim()) return;
    try {
      await caseService.replyToQuery(caseId, threadId, replyText);
      toast.success('Reply sent');
      setReplyText('');
      load();
    } catch {
      toast.error('Failed to send reply');
    }
  };

  const closeThread = async (threadId: string) => {
    try {
      await caseService.closeQuery(caseId, threadId);
      toast.success('Query closed');
      load();
    } catch {
      toast.error('Failed to close query');
    }
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading queries…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Queries ({threads.length})</h3>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          New Query
        </button>
      </div>

      {showNewForm && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-800">New Query</h4>
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none"
          >
            {[
              { value: 'MISSING_INFORMATION', label: 'Missing Information' },
              { value: 'TITLE_ISSUE', label: 'Title Issue' },
              { value: 'PLANNING_ISSUE', label: 'Planning Issue' },
              { value: 'IDENTITY_AUTHORITY_ISSUE', label: 'Identity / Authority Issue' },
              { value: 'FACILITY_LETTER_ISSUE', label: 'Facility Letter Issue' },
              { value: 'DRAWDOWN_ISSUE', label: 'Drawdown Issue' },
              { value: 'REDEMPTION_ISSUE', label: 'Redemption Issue' },
              { value: 'DISCHARGE_ISSUE', label: 'Discharge Issue' },
              { value: 'REGISTRATION_DELAY', label: 'Registration Delay' },
              { value: 'TECHNICAL_SUPPORT', label: 'Technical Support' },
              { value: 'OTHER', label: 'Other' },
            ].map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Subject"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none"
          />
          <textarea
            placeholder="Message"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            rows={3}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={createQuery}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Submit
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {threads.length === 0 ? (
        <p className="text-gray-500 text-sm">No queries on this case.</p>
      ) : (
        threads.map(thread => (
          <div key={thread.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === thread.id ? null : thread.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            >
              <div>
                <span className="font-medium text-sm text-gray-800">{thread.subject}</span>
                <span className="ml-2 text-xs text-gray-500">[{thread.queryType}]</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[thread.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {thread.status.replace(/_/g, ' ')}
              </span>
            </button>

            {expandedId === thread.id && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {(thread.messages ?? []).map(msg => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-3 text-sm ${msg.internalOnly ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700">
                        {msg.senderType === 'BANK_USER' ? 'Bank' : 'Solicitor'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{msg.messageBody}</p>
                    {msg.internalOnly && (
                      <p className="text-xs text-yellow-700 mt-1 font-medium">Internal only</p>
                    )}
                  </div>
                ))}

                {thread.status !== 'CLOSED' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Reply…"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && reply(thread.id)}
                      className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none"
                    />
                    <button
                      onClick={() => reply(thread.id)}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Send
                    </button>
                    {!isSolicitor && (
                      <button
                        onClick={() => closeThread(thread.id)}
                        className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
