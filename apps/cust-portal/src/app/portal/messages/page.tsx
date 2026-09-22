'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  messagingService,
  formatMessageTime,
  SENDER_TYPE_LABELS,
  type Conversation,
  type Message,
} from '@/services/api/messaging-service';

const STATUS_LABELS: Record<Conversation['status'], string> = {
  ACTIVE: 'Active',
  RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
};

const STATUS_BADGES: Record<Conversation['status'], string> = {
  ACTIVE: 'badge-success',
  RESOLVED: 'badge-neutral',
  ARCHIVED: 'badge-neutral',
};

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { message?: string };
  return e?.message || fallback;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (selectFirst: boolean) => {
    try {
      setListLoading(true);
      setListError(null);
      const list = await messagingService.listConversations();
      const sorted = [...(list ?? [])].sort((a, b) => {
        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bt - at;
      });
      setConversations(sorted);
      if (selectFirst) setActiveId(sorted.length > 0 ? sorted[0].id : null);
    } catch (err) {
      setListError(errorMessage(err, 'Could not load your conversations'));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  const active = useMemo(
    () => conversations.find(c => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const loadMessages = useCallback(async (applicationId: string) => {
    try {
      setMessagesLoading(true);
      setMessagesError(null);
      const res = await messagingService.getMessages(applicationId);
      setMessages(res?.messages ?? []);
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
  }, [activeApplicationId, loadMessages]);

  /* Keep the newest message in view as the log grows */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messagesLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c => c.subject?.toLowerCase().includes(q));
  }, [conversations, search]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!active || !body || sending) return;
    try {
      setSending(true);
      setSendError(null);
      const sent = await messagingService.sendMessage(active.applicationId, body);
      setMessages(prev => [...prev, sent]);
      setDraft('');
      /* Keep the list's message count and "last activity" honest after a send */
      setConversations(prev =>
        prev.map(c =>
          c.id === active.id
            ? { ...c, messageCount: c.messageCount + 1, lastMessageAt: sent.createdAt }
            : c
        )
      );
    } catch (err) {
      setSendError(errorMessage(err, 'Could not send your message'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          Messages
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {!listLoading && !listError
            ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'} with your bank`
            : 'Your conversations with the bank, in one place.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: conversation list */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Conversations</h2>
            <button
              onClick={() => loadConversations(false)}
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
              placeholder="Search by subject"
              className="input"
            />
          </div>

          {listLoading ? (
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
                <button onClick={() => loadConversations(true)} className="btn btn-sm btn-outline shrink-0">
                  Try again
                </button>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-5">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="empty-state-title">No conversations yet</p>
                <p className="empty-state-text">
                  A conversation opens when you start an application, so you can ask questions and
                  track it in one thread.
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
              {filtered.map(conv => {
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
                      <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                        {conv.subject || 'Untitled conversation'}
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
          {!active ? (
            <div className="empty-state h-full">
              <div className="empty-state-icon">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="empty-state-title">Select a conversation</p>
              <p className="empty-state-text">
                {conversations.length > 0
                  ? 'Choose a conversation from the list to read and reply to its messages.'
                  : 'Once you have a conversation, its messages will appear here.'}
              </p>
            </div>
          ) : (
            <div className="panel flex flex-col">
              <div className="panel-header">
                <div className="min-w-0">
                  <h2 className="panel-title truncate">{active.subject || 'Untitled conversation'}</h2>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {STATUS_LABELS[active.status] || active.status}
                    {active.lastMessageAt ? ` · last activity ${formatMessageTime(active.lastMessageAt)}` : ''}
                  </p>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="max-h-[28rem] min-h-[16rem] overflow-y-auto p-5"
                role="region"
                aria-label={`Messages in ${active.subject || 'this conversation'}, scrollable`}
                tabIndex={0}
              >
                {messagesLoading ? (
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
