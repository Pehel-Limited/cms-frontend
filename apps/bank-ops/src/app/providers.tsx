'use client';

import { Provider } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import { store } from '@/store';
import apolloClient from '@/lib/apollo-client';
import { useEffect, useState, createContext, useContext } from 'react';
import { loadStoredAuth } from '@/store/slices/authSlice';

/* ─── Theme context ─── */
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} });

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('rm-theme') as Theme | null;
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initial: Theme = saved ?? preferred;
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const toggle = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('rm-theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    store.dispatch(loadStoredAuth());
  }, []);

  return (
    <Provider store={store}>
      <ApolloProvider client={apolloClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </ApolloProvider>
    </Provider>
  );
}

