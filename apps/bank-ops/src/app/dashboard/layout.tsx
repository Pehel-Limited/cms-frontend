'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { loadStoredAuth } from '@/store/slices/authSlice';
import DashboardLayout from '@/components/DashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Only check auth once on mount
    if (!authChecked) {
      dispatch(loadStoredAuth()).finally(() => {
        setAuthChecked(true);
      });
    }
  }, [dispatch, authChecked]);

  useEffect(() => {
    // Only redirect after auth has been checked
    if (authChecked && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authChecked, isAuthenticated, isLoading, router]);

  // Show loading while checking auth
  if (!authChecked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
