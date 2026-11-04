'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { loadStoredAuth } from '@/store/slices/authSlice';
import { isAdminRole } from '@/lib/roles';

/*
 * Bank Users changes access and roles, so the route is administrator-only at the
 * client boundary as well as in identity-service.
 */
export default function BankUsersLayout({ children }: { children: React.ReactNode }) {
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
