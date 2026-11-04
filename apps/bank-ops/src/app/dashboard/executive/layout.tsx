'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { loadStoredAuth } from '@/store/slices/authSlice';
import { isAdminRole } from '@/lib/roles';

/*
 * The executive view reads the bank-wide oversight endpoints, which reject a relationship
 * manager with 403. Gate the route at the same boundary so a non-admin never lands on a
 * half-populated page; the API remains the authority.
 */
export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector(state => state.auth);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) dispatch(loadStoredAuth());
  }, [dispatch, isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
    if (!isLoading && isAuthenticated && !isAdminRole(user)) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated || !user || !isAdminRole(user)) return null;

  return <>{children}</>;
}
