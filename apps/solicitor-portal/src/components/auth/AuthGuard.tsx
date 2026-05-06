'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials, setLoading } from '@/store/slices/authSlice';
import config from '@/config';

const PUBLIC_ROUTES = ['/solicitor/login'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector(s => s.auth);
  const [checked, setChecked] = useState(false);

  const isPublic = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  useEffect(() => {
    const token = localStorage.getItem(config.auth.tokenKey);
    const userRaw = localStorage.getItem(config.auth.userKey);

    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw);
        dispatch(setCredentials({ user, accessToken: token }));
      } catch {
        dispatch(setLoading(false));
      }
    } else {
      dispatch(setLoading(false));
    }

    if (!isPublic && !token) {
      router.replace('/solicitor/login');
      return;
    }

    if (isPublic && token) {
      router.replace('/solicitor/dashboard');
      return;
    }

    setChecked(true);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPublic) return <>{children}</>;

  if (!checked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
