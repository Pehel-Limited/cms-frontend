'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

export type AIPreferences = { insights: boolean; repeats: boolean; documents: boolean };
const defaults: AIPreferences = { insights: true, repeats: true, documents: true };

/** Presentation preferences only; server-side consent is a separate integration. */
export function useAIPreferences() {
  const user = useSelector((state: RootState) => state.auth.user);
  const key = `rayva-ui-preferences:${user?.userId ?? user?.email ?? 'guest'}`;
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        setPreferences(
          Object.fromEntries(
            Object.entries(defaults).map(([name, value]) => [
              name,
              typeof stored?.[name] === 'boolean' ? stored[name] : value,
            ])
          ) as AIPreferences
        );
      } catch {
        setPreferences(defaults);
      }
      setReady(true);
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener('rayva-preferences', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('rayva-preferences', read);
    };
  }, [key]);
  function toggle(name: keyof AIPreferences) {
    const next = { ...preferences, [name]: !preferences[name] };
    setPreferences(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
      window.dispatchEvent(new Event('rayva-preferences'));
    } catch {
      setStorageError(true);
    }
  }
  return { preferences, toggle, ready, storageError };
}
