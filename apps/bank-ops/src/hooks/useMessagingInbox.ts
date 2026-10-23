'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { messagingService, type ConversationInboxRow } from '@/services/api/messaging-service';

function message(err: unknown, fallback: string): string {
  return (err as { message?: string })?.message || fallback;
}

/* Readers of the inbox register here so opening a thread can clear the bell immediately rather
   than leaving a message the RM has already read showing as unread until the next tick. */
const listeners = new Set<() => void>();

export function notifyMessagingInboxChanged(): void {
  listeners.forEach(listener => listener());
}

/**
 * Polls the RM messaging inbox. There is no websocket or push transport in the backend, so
 * polling is the only way an inbound customer message reaches the bell. Ticks are skipped while
 * the tab is hidden and the inbox is re-read the moment it becomes visible again, so a returning
 * RM sees what arrived rather than waiting out the rest of the interval.
 */
export function useMessagingInbox(intervalMs = 20000) {
  const [rows, setRows] = useState<ConversationInboxRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await messagingService.getInbox();
      setRows(next ?? []);
      setError(null);
    } catch (err) {
      setError(message(err, 'Could not load your messages'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    listeners.add(refresh);
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(refresh);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  const unreadTotal = useMemo(
    () => (rows ?? []).reduce((sum, r) => sum + (r.unreadCount || 0), 0),
    [rows]
  );

  /** Unread threads newest first — the bell dropdown reads the top of this as notifications. */
  const unreadThreads = useMemo(
    () =>
      (rows ?? [])
        .filter(r => (r.unreadCount || 0) > 0)
        .sort((a, b) => {
          const at = a.conversation.lastMessageAt ? new Date(a.conversation.lastMessageAt).getTime() : 0;
          const bt = b.conversation.lastMessageAt ? new Date(b.conversation.lastMessageAt).getTime() : 0;
          return bt - at;
        }),
    [rows]
  );

  return { rows: rows ?? [], loading, error, unreadTotal, unreadThreads, refresh };
}
