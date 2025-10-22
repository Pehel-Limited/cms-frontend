'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/store';
import { logoutUser } from '@/store/slices/authSlice';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout even if API call fails
      localStorage.clear();
      router.push('/login');
    }
  };

  const handleBack = () => {
    router.back();
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { name: 'Applications', path: '/dashboard/applications', icon: '📄' },
    { name: 'Customers', path: '/dashboard/customers', icon: '👥' },
    { name: 'Products', path: '/dashboard/products', icon: '💼' },
  ];

  if (user?.userType === 'BANK_USER') {
    navItems.push({ name: 'Admin', path: '/dashboard/admin', icon: '⚙️' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and Nav */}
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-blue-600">CMS Banking</h1>
              </Link>
              <nav className="hidden md:flex space-x-1">
                {navItems.map(item => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-4">
              {pathname !== '/dashboard' && (
                <button
                  onClick={handleBack}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center space-x-1"
                >
                  <span>←</span>
                  <span>Back</span>
                </button>
              )}
              <span className="text-sm text-gray-700">
                Welcome,{' '}
                <span className="font-semibold">
                  {user?.firstName} {user?.lastName}
                </span>
              </span>
              <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full font-medium">
                {user?.userType === 'BANK_USER' ? 'Relationship Manager' : user?.userType}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-red-600 font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
