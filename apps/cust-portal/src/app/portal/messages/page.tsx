'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { useMessagingInbox, notifyMessagingInboxChanged } from '@/hooks/useMessagingInbox';
import {
  messagingService,
  formatMessageTime,
  previewLine,
  threadLabel,
  SENDER_TYPE_LABELS,
  type ConversationInboxRow,
  type Message,
} from '@/services/api/messaging-service';

/* An open thread is the one place a delay is felt, so it refreshes faster than the list does.
   Ticks are skipped while the tab is hidden. */
const THREAD_POLL_MS = 8000;
const LIST_POLL_MS = 15000;

const STATUS_LABELS: Record<ConversationInboxRow['conversation']['status'], string> = {
  ACTIVE: 'Active',
  RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
};

const STATUS_BADGES: Record<ConversationInboxRow['conversation']['status'], string> = {
  ACTIVE: 'badge-success',
  RESOLVED: 'badge-neutral',
  ARCHIVED: 'badge-neutral',
};

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { message?: string };
  return e?.message || fallback;
}

function lastActivity(row: ConversationInboxRow): number {
  const at = row.conversation.lastMessageAt;
  return at ? new Date(at).getTime() : 0;
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const {
    rows,
    loading: listLoading,
    error: listError,
    unreadTotal,
    refresh,
  } = useMessagingInbox(LIST_POLL_MS);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => [...rows].sort((a, b) => lastActivity(b) - lastActivity(a)), [rows]);

  /* A notification deep-links its thread, including when the inbox is already on screen. */
  const linkedApplication = searchParams.get('application');
  useEffect(() => {
    if (!linkedApplication) return;
    const match = sorted.find(r => r.conversation.applicationId === linkedApplication);
    if (match) setActiveId(match.conversation.id);
  }, [linkedApplication, sorted]);

  /* Open the most recent thread on arrival, unless the URL asked for a specific one. */
  useEffect(() => {
    if (activeId !== null || linkedApplication || sorted.length === 0) return;
    setActiveId(sorted[0].conversation.id);
  }, [sorted, activeId, linkedApplication]);

  const activeRow = useMemo(
    () => sorted.find(r => r.conversation.id === activeId) ?? null,
    [sorted, activeId]
  );
  const active = activeRow?.conversation ?? null;

  const loadMessages = useCallback(async (applicationId: string) => {
    try {
      setMessagesLoading(true);
      setMessagesError(null);
      const res = await messagingService.getMessages(applicationId);
      setMessages(res?.messages ?? []);
      /* Reading the thread acknowledges it server-side, so tell the badge to re-count now. */
      notifyMessagingInboxChanged();
    } catch (err) {
      setMessages([]);
      setMessagesError(errorMessage(err, 'Could not load these messages'));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  /* Keyed on the application id so metadata refreshes don't refetch the thread */
  const activeApplicationId = active?.applicationId ?? null;

  useEffect(() => {
    if (!activeApplicationId) {
      setMessages([]);
      return;
    }
    loadMessages(activeApplicationId);
    const id = window.setInterval(() => {
      if (!document.hidden) loadMessages(activeApplicationId);
    }, THREAD_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) loadMessages(activeApplicationId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeApplicationId, loadMessages]);

  /* Keep the newest message in view as the log grows */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messagesLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      r =>
        threadLabel(r).toLowerCase().includes(q) ||
        previewLine(r).toLowerCase().includes(q)
    );
  }, [sorted, search]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!active || !body || sending) return;
    try {
      setSending(true);
      setSendError(null);
      const sent = await messagingService.sendMessage(active.applicationId, body);
      /* Keep what is on screen and append — reloading would flicker the log the customer is
         reading, and the next poll picks up anything written since. */
      setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
      setDraft('');
      refresh();
    } catch (err) {
      setSendError(errorMessage(err, 'Could not send your message'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHero
        title="Messages"
        subtitle={
          !listLoading && !listError
            ? `${sorted.length} conversation${sorted.length === 1 ? '' : 's'} with your bank${
                unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''
              }`
            : 'Your conversations with the bank, in one place.'
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: conversation list */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Conversations</h2>
            <button
              onClick={refresh}
              className="btn btn-ghost btn-sm shrink-0"
              disabled={listLoading}
            >
              Refresh
            </button>
          </div>

          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <label className="field-label" htmlFor="conversation-search">
              Search conversations
            </label>
            <input
              id="conversation-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by application or message"
              className="input"
            />
          </div>

          {listLoading && sorted.length === 0 ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : listError ? (
            <div className="p-5">
              <div className="alert alert-error" role="alert">
                <div className="flex-1">
                  <p className="text-base font-semibold">Could not load conversations</p>
                  <p className="mt-0.5 text-sm opacity-80">{listError}</p>
                </div>
                <button onClick={refresh} className="btn btn-sm btn-outline shrink-0">
                  Try again
                </button>
              </div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="empty-state-title">No conversations yet</p>
                <p className="empty-state-text">
                  Your relationship manager can open a conversation on an application. When they do,
                  it appears here and you are told what they said.
                </p>
                <Link href="/portal/applications" className="btn btn-primary btn-sm mt-4">
                  View your applications
                </Link>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No conversations match “{search}”.
            </p>
          ) : (
            <ul className="divide-token">
              {filtered.map(row => {
                const conv = row.conversation;
                const selected = conv.id === activeId;
                return (
                  <li key={conv.id}>
                    <button
                      onClick={() => setActiveId(conv.id)}
                      aria-current={selected ? 'true' : undefined}
                      className="w-full px-5 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      style={{
                        backgroundColor: selected ? 'var(--brand-soft)' : undefined,
                        borderLeft: selected ? '3px solid var(--brand)' : '3px solid transparent',
                      }}
                    >
                      <p className="flex items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate text-base font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {threadLabel(row)}
                        </span>
                        {row.unreadCount > 0 && (
                          <span
                            className="shrink-0 rounded-full px-1.5 text-[10px] font-bold leading-[1.25rem] text-white"
                            style={{ backgroundColor: 'var(--brand)' }}
                          >
                            {row.unreadCount}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {previewLine(row)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <span className={`badge ${STATUS_BADGES[conv.status] || 'badge-neutral'}`}>
                          {STATUS_LABELS[conv.status] || conv.status}
                        </span>
                        <span>{conv.messageCount} message{conv.messageCount === 1 ? '' : 's'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{conv.lastMessageAt ? formatMessageTime(conv.lastMessageAt) : 'No messages yet'}</span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: message thread */}
        <div className="lg:col-span-2">
          {!active || !activeRow ? (
            <div className="empty-state h-full">
              <div className="empty-state-icon">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="empty-state-title">Select a conversation</p>
              <p className="empty-state-text">
                {sorted.length > 0
                  ? 'Choose a conversation from the list to read and reply to its messages.'
                  : 'Once you have a conversation, its messages will appear here.'}
              </p>
            </div>
          ) : (
            <div className="panel flex flex-col">
              <div className="panel-header">
                <div className="min-w-0">
                  <h2 className="panel-title truncate">{threadLabel(activeRow)}</h2>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {STATUS_LABELS[active.status] || active.status}
                    {active.lastMessageAt ? ` · last activity ${formatMessageTime(active.lastMessageAt)}` : ''}
                  </p>
                </div>
                <Link
                  href={`/portal/applications/${active.applicationId}`}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  View application
                </Link>
              </div>

              <div
                ref={scrollRef}
                className="max-h-[28rem] min-h-[16rem] overflow-y-auto p-5"
                role="region"
                aria-label={`Messages on ${threadLabel(activeRow)}, scrollable`}
                tabIndex={0}
              >
                {messagesLoading && messages.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton h-14 w-2/3" />
                    ))}
                  </div>
                ) : messagesError ? (
                  <div className="alert alert-error" role="alert">
                    <div className="flex-1">
                      <p className="text-base font-semibold">Could not load these messages</p>
                      <p className="mt-0.5 text-sm opacity-80">{messagesError}</p>
                    </div>
                    <button
                      onClick={() => loadMessages(active.applicationId)}
                      className="btn btn-sm btn-outline shrink-0"
                    >
                      Try again
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No messages in this conversation yet. Send the first one below.
                  </p>
                ) : (
                  <div role="log" aria-live="polite" aria-relevant="additions text" className="space-y-4">
                    {messages.map(msg => {
                      const mine = msg.senderType === 'CUSTOMER';
                      const sender =
                        msg.senderName || SENDER_TYPE_LABELS[msg.senderType] || msg.senderType;
                      return (
                        <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-xs rounded-2xl px-4 py-3 lg:max-w-md ${
                              mine ? 'rounded-br-sm text-white' : 'rounded-bl-sm'
                            }`}
                            style={
                              mine
                                ? { backgroundColor: 'var(--brand)' }
                                : {
                                    backgroundColor:
                                      msg.senderType === 'SYSTEM'
                                        ? 'rgba(16,185,129,0.14)'
                                        : 'var(--surface-input)',
                                    color: 'var(--text-primary)',
                                  }
                            }
                          >
                            {!mine && (
                              <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
                                {sender}
                              </p>
                            )}
                            {mine && <span className="sr-only">You said: </span>}
                            <p className="text-base leading-relaxed">{msg.body}</p>
                            <p
                              className="mt-1.5 text-sm"
                              style={{ color: mine ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
                            >
                              {formatMessageTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSend}
                className="px-5 py-4"
                style={{ borderTop: '1px solid var(--surface-border)' }}
              >
                {sendError && (
                  <div className="alert alert-error mb-3" role="alert" id="message-send-error">
                    <div className="flex-1">
                      <p className="text-base font-semibold">Message not sent</p>
                      <p className="mt-0.5 text-sm opacity-80">{sendError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSend()}
                      className="btn btn-sm btn-outline shrink-0"
                    >
                      Try again
                    </button>
                  </div>
                )}
                <label className="field-label" htmlFor="message-input">
                  Your message
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="message-input"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Write a message to the bank…"
                    disabled={sending}
                    autoComplete="off"
                    className="input flex-1"
                    aria-describedby={sendError ? 'message-send-error' : undefined}
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    aria-label="Send message"
                    className="btn btn-primary h-11 w-11 shrink-0 rounded-xl p-0"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
