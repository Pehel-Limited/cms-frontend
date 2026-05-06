'use client';

import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { authService } from '@/services/api/auth-service';
import config from '@/config';

export default function SolicitorHeader() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);

  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.refreshTokenKey);
    localStorage.removeItem(config.auth.userKey);
    dispatch(logout());
    router.push('/solicitor/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-gray-700">
            {user.firstName} {user.lastName}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
