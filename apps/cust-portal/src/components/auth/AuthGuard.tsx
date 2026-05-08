'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { setCredentials, authChecked, logout as logoutAction } from '@/store/slices/authSlice';
import { authService } from '@/services/api/auth-service';

/** Public routes that don't require authentication */
const PUBLIC_ROUTES = ['/portal/login', '/portal/register', '/'];

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_ROUTES.some(
      route => pathname === route || pathname.startsWith(route + '/')
    );

    // Try to hydrate from localStorage
    const storedUser = authService.getStoredUser();
    const hasToken = authService.isLoggedIn();

    if (hasToken && storedUser) {
      dispatch(setCredentials({ user: storedUser }));
    } else {
      dispatch(authChecked());
    }

    if (!isPublic && !hasToken) {
      router.replace('/portal/login');
      return;
    }

    // If authenticated user visits login/register, redirect to portal
    if (isPublic && hasToken && (pathname === '/portal/login' || pathname === '/portal/register')) {
      router.replace('/portal');
      return;
    }

    setChecked(true);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // If route is public, always render
  const isPublic = PUBLIC_ROUTES.some(
    route => pathname === route || pathname.startsWith(route + '/')
  );
  if (isPublic) return <>{children}</>;

  // For protected routes, show loading until auth is checked
  if (!checked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
