'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  messagingService,
  formatRelativeTime,
  type Message,
} from '@/services/api/messaging-service';
import { notifyMessagingInboxChanged } from '@/hooks/useMessagingInbox';

/* A thread the RM is reading is the one place a delay is felt, so it refreshes faster than the
   bell does. Ticks are skipped while the tab is hidden. */
const POLL_MS = 8000;

interface Props {
  applicationId: string;
  customerName?: string;
}

export default function CustomerChatPanel({ applicationId, customerName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await messagingService.getMessages(applicationId);
      setMessages(res?.messages ?? []);
      setError(null);
      /* Reading the thread acknowledges it server-side, so tell the bell to re-count now. */
      notifyMessagingInboxChanged();
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not load this conversation');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const sent = await messagingService.sendMessage(applicationId, body);
      setDraft('');
      /* Keep what is already on screen and append — reloading here would flicker the log the
         RM is reading, and a poll picks up anything written since within POLL_MS. */
      setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
    } catch (err) {
      setSendError(
        ((err as { message?: string })?.message || 'Could not send that message') +
          ' — your text has been kept.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--rm-danger-soft)', color: 'var(--rm-text)' }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="shrink-0 font-medium underline underline-offset-2"
            style={{ color: 'var(--rm-brand-on-soft)' }}
          >
            Try again
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        role="region"
        aria-label="Conversation with the customer"
        tabIndex={0}
        className="max-h-[26rem] min-h-[16rem] space-y-3 overflow-y-auto rounded-2xl p-4"
        style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)' }}
      >
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <p className="sr-only" role="status">
              Loading conversation…
            </p>
            <div className="ml-auto h-12 w-2/3 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--rm-border)' }} />
            <div className="h-12 w-1/2 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--rm-border)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
              No messages yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {customerName
                ? `Write to ${customerName} — this opens the conversation and they get a notification.`
                : 'Your first message opens this conversation for the customer.'}
            </p>
          </div>
        ) : (
          messages.map(m => <ChatBubble key={m.id} message={m} />)
        )}
      </div>

      <div>
        <label className="sr-only" htmlFor="rm-chat-message">
          Message
        </label>
        <textarea
          id="rm-chat-message"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          disabled={loading}
          placeholder="Write a message…"
          className="w-full resize-y rounded-xl px-4 py-3 text-sm outline-none"
          style={{
            backgroundColor: 'var(--rm-card)',
            border: '1px solid var(--rm-border)',
            color: 'var(--rm-text)',
          }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending || loading}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7f2b7b,#b155ac)' }}
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>
          <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            Enter sends, Shift+Enter starts a new line
          </p>
        </div>
        {sendError && (
          <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--rm-down)' }}>
            {sendError}
          </p>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isStaff = message.senderType === 'USER';

  if (message.senderType === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{ color: 'var(--rm-text-muted)', backgroundColor: 'var(--rm-card)' }}
        >
          <span className="sr-only">System message: </span>
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={
          isStaff
            ? { backgroundColor: 'var(--rm-brand)', color: '#fff' }
            : { backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }
        }
      >
        <span className="sr-only">{isStaff ? 'You sent: ' : 'Customer: '}</span>
        {/* The pane header already names the customer, and their seeded display name is a customer
            number rather than a person. A colleague's name is the attribution worth showing. */}
        {isStaff && message.senderName && (
          <p className="mb-0.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {message.senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <p
          className="mt-1 text-[11px]"
          style={{ color: isStaff ? 'rgba(255,255,255,0.78)' : 'var(--rm-text-muted)' }}
        >
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
