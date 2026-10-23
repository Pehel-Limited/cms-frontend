'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import CustomerChatPanel from '@/components/applications/CustomerChatPanel';
import { useMessagingInbox } from '@/hooks/useMessagingInbox';
import {
  formatRelativeTime,
  previewLine,
  threadCounterpartName,
  type ConversationInboxRow,
} from '@/services/api/messaging-service';
import { compactCurrency } from '@/lib/format';

function applicationLabel(row: ConversationInboxRow): string {
  const parts: string[] = [];
  if (row.requestedAmount != null) parts.push(compactCurrency(row.requestedAmount));
  if (row.requestedTermMonths != null) parts.push(`${row.requestedTermMonths} months`);
  return parts.length ? parts.join(' · ') : 'Credit application';
}

export default function RmMessagesPage() {
  const searchParams = useSearchParams();
  const { rows, loading, error, unreadTotal, refresh } = useMessagingInbox(10000);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('application'));
  const [search, setSearch] = useState('');

  /* The bell deep-links a thread, including when the inbox is already open on screen. */
  const linkedApplication = searchParams.get('application');
  useEffect(() => {
    if (linkedApplication) setSelectedId(linkedApplication);
  }, [linkedApplication]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const at = a.conversation.lastMessageAt ? new Date(a.conversation.lastMessageAt).getTime() : 0;
        const bt = b.conversation.lastMessageAt ? new Date(b.conversation.lastMessageAt).getTime() : 0;
        return bt - at;
      }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      row =>
        threadCounterpartName(row).toLowerCase().includes(q) ||
        previewLine(row).toLowerCase().includes(q) ||
        row.conversation.applicationId.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  /* Keyed on the application id: the thread is opened by application, so a stale selection from
     another customer's row must not keep the panel showing the previous thread. */
  const selected = useMemo(
    () => sorted.find(r => r.conversation.applicationId === selectedId) ?? null,
    [sorted, selectedId]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Customer messages
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {loading
              ? 'Loading your conversations…'
              : `${rows.length} conversation${rows.length === 1 ? '' : 's'} · ${unreadTotal} unread`}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ borderColor: 'var(--rm-border)', color: 'var(--rm-text-secondary)' }}
        >
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--rm-danger-soft)', color: 'var(--rm-text)' }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="shrink-0 font-medium underline underline-offset-2"
            style={{ color: 'var(--rm-brand-on-soft)' }}
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
        <section
          className="overflow-hidden rounded-3xl"
          style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          aria-label="Conversations"
        >
          <div className="p-3" style={{ borderBottom: '1px solid var(--rm-border)' }}>
            <label className="sr-only" htmlFor="thread-search">
              Search conversations
            </label>
            <input
              id="thread-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer or message…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
            />
          </div>

          {loading && rows.length === 0 ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-16 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--rm-input)' }} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              No conversations yet. Open a credit application and use the Customer chat tab to write
              first — the customer is notified as soon as you send.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Nothing matches “{search.trim()}”.
            </p>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto">
              {filtered.map(row => {
                const active = selected?.conversation.id === row.conversation.id;
                return (
                  <li key={row.conversation.id} style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.conversation.applicationId)}
                      aria-current={active ? 'true' : undefined}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors"
                      style={{ backgroundColor: active ? 'var(--rm-brand-soft)' : 'transparent' }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate text-sm font-semibold"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {threadCounterpartName(row)}
                        </span>
                        {row.unreadCount > 0 && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ backgroundColor: 'var(--rm-brand)', color: '#fff' }}
                          >
                            {row.unreadCount}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {applicationLabel(row)}
                      </span>
                      <span
                        className="line-clamp-2 text-xs"
                        style={{ color: 'var(--rm-text-secondary)' }}
                      >
                        {previewLine(row)}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>
                        {formatRelativeTime(row.conversation.lastMessageAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="rounded-3xl p-5 sm:p-6"
          style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
        >
          {selected ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
                    {threadCounterpartName(selected)}
                  </h2>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {applicationLabel(selected)}
                  </p>
                </div>
                <Link
                  href={`/dashboard/applications/${selected.conversation.applicationId}`}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--rm-border)', color: 'var(--rm-text-secondary)' }}
                >
                  Open application
                </Link>
              </div>
              <CustomerChatPanel
                key={selected.conversation.applicationId}
                applicationId={selected.conversation.applicationId}
                customerName={threadCounterpartName(selected)}
              />
            </>
          ) : (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-2 text-center">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
                style={{ color: 'var(--rm-text-muted)' }}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                Choose a conversation
              </p>
              <p className="max-w-xs text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Read what the customer has said and reply from here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
