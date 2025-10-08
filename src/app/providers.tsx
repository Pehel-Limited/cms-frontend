'use client';

import { Provider } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import dynamic from 'next/dynamic';
import { store } from '@/store';
import apolloClient from '@/lib/apollo-client';
import { useEffect } from 'react';
import { loadStoredAuth } from '@/store/slices/authSlice';

const ToastProvider = dynamic(
  () => import('@/components/ToastProvider').then((mod) => ({ default: mod.ToastProvider })),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load stored authentication on mount
    store.dispatch(loadStoredAuth());
  }, []);

  return (
    <Provider store={store}>
      <ApolloProvider client={apolloClient}>
        {children}
        <ToastProvider />
      </ApolloProvider>
    </Provider>
  );
}
