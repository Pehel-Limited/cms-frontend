'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { CATEGORY_META, type SpendCategory } from './banking-data';
import type { CategoryOverrides } from './spending-insights';

/**
 * The customer's own corrections to the insight calculations.
 *
 * Stored per profile in the browser, like the AI presentation preferences.
 * These are UI-level corrections — they change what is shown and recalculated
 * here, and are not sent to the bank as a dispute.
 */
export interface InsightFeedback {
  /** Insight ids the customer has dismissed. */
  dismissed: string[];
  /** Merchant → category reassignments, keyed by lowercased merchant name. */
  overrides: CategoryOverrides;
}

const EMPTY: InsightFeedback = { dismissed: [], overrides: {} };
const EVENT = 'rayva-insight-feedback';

export const CORRECTABLE_CATEGORIES = Object.keys(CATEGORY_META) as SpendCategory[];

function sanitise(value: unknown): InsightFeedback {
  const raw = value as Partial<InsightFeedback> | null;
  return {
    dismissed: Array.isArray(raw?.dismissed)
      ? raw!.dismissed.filter((id): id is string => typeof id === 'string')
      : [],
    overrides:
      raw?.overrides && typeof raw.overrides === 'object'
        ? Object.fromEntries(
            Object.entries(raw.overrides).filter(([, c]) =>
              CORRECTABLE_CATEGORIES.includes(c as SpendCategory)
            )
          )
        : {},
  };
}

export function useInsightFeedback() {
  const user = useSelector((state: RootState) => state.auth.user);
  const key = `rayva-insight-feedback:${user?.userId ?? user?.email ?? 'guest'}`;
  const [feedback, setFeedback] = useState<InsightFeedback>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setFeedback(sanitise(JSON.parse(localStorage.getItem(key) || 'null')));
      } catch {
        setFeedback(EMPTY);
      }
      setReady(true);
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener(EVENT, read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener(EVENT, read);
    };
  }, [key]);

  const persist = useCallback(
    (next: InsightFeedback) => {
      setFeedback(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(EVENT));
      } catch {
        /* Storage full or blocked — the in-memory value still applies for this session. */
      }
    },
    [key]
  );

  const dismiss = useCallback(
    (id: string) => {
      if (feedback.dismissed.includes(id)) return;
      persist({ ...feedback, dismissed: [...feedback.dismissed, id] });
    },
    [feedback, persist]
  );

  const restore = useCallback(
    (id: string) => persist({ ...feedback, dismissed: feedback.dismissed.filter(x => x !== id) }),
    [feedback, persist]
  );

  const setCategory = useCallback(
    (merchantKey: string, category: SpendCategory) =>
      persist({ ...feedback, overrides: { ...feedback.overrides, [merchantKey]: category } }),
    [feedback, persist]
  );

  const resetCategory = useCallback(
    (merchantKey: string) => {
      const overrides = { ...feedback.overrides };
      delete overrides[merchantKey];
      persist({ ...feedback, overrides });
    },
    [feedback, persist]
  );

  const clearAll = useCallback(() => persist(EMPTY), [persist]);

  const correctionCount = Object.keys(feedback.overrides).length;

  return {
    feedback,
    ready,
    dismiss,
    restore,
    setCategory,
    resetCategory,
    clearAll,
    correctionCount,
    dismissedCount: feedback.dismissed.length,
  };
}
