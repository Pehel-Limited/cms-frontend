'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { authService } from '@/services/auth.service';
import config from '@/config';

type UserType = 'bank' | 'customer';

export default function RegisterPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>('customer');
  const [isLoading, setIsLoading] = useState(false);

  const [bankUserData, setBankUserData] = useState({
    bankId: config.bank.defaultBankId,
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    employeeNumber: '',
    jobTitle: '',
  });

  const [customerData, setCustomerData] = useState({
    bankId: config.bank.defaultBankId,
    customerId: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });

  const handleBankUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bankUserData.password !== bankUserData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...data } = bankUserData;
      await authService.registerBankUser(data);
      toast.success('Registration successful! Please login.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customerData.password !== customerData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...data } = customerData;
      await authService.registerCustomer(data);
      toast.success('Registration successful! Please login.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-600">
            CMS Banking
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Create your account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </p>
        </div>

        {/* User Type Toggle */}
        <div className="card mb-6">
          <div className="flex rounded-lg overflow-hidden bg-gray-100 p-1">
            <button
              type="button"
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                userType === 'customer'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setUserType('customer')}
            >
              <div className="flex items-center justify-center">
                <span className="text-2xl mr-2">👤</span>
                Customer Account
              </div>
            </button>
            <button
              type="button"
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                userType === 'bank'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setUserType('bank')}
            >
              <div className="flex items-center justify-center">
                <span className="text-2xl mr-2">🏦</span>
                Bank Staff Account
              </div>
            </button>
          </div>
        </div>

        {/* Registration Forms */}
        {userType === 'customer' ? (
          <form onSubmit={handleCustomerSubmit} className="card space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Customer Registration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={customerData.firstName}
                  onChange={e => setCustomerData({ ...customerData, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={customerData.lastName}
                  onChange={e => setCustomerData({ ...customerData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer ID *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Your customer ID from the bank"
                value={customerData.customerId}
                onChange={e => setCustomerData({ ...customerData, customerId: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text"
                required
                className="input"
                value={customerData.username}
                onChange={e => setCustomerData({ ...customerData, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                className="input"
                value={customerData.email}
                onChange={e => setCustomerData({ ...customerData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                className="input"
                value={customerData.phoneNumber}
                onChange={e => setCustomerData({ ...customerData, phoneNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  className="input"
                  value={customerData.password}
                  onChange={e => setCustomerData({ ...customerData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  className="input"
                  value={customerData.confirmPassword}
                  onChange={e =>
                    setCustomerData({ ...customerData, confirmPassword: e.target.value })
                  }
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full btn btn-primary py-3">
              {isLoading ? <span className="spinner" /> : 'Create Customer Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleBankUserSubmit} className="card space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Bank Staff Registration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={bankUserData.firstName}
                  onChange={e => setBankUserData({ ...bankUserData, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={bankUserData.lastName}
                  onChange={e => setBankUserData({ ...bankUserData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Number *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={bankUserData.employeeNumber}
                  onChange={e =>
                    setBankUserData({ ...bankUserData, employeeNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  className="input"
                  value={bankUserData.jobTitle}
                  onChange={e => setBankUserData({ ...bankUserData, jobTitle: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text"
                required
                className="input"
                value={bankUserData.username}
                onChange={e => setBankUserData({ ...bankUserData, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                className="input"
                value={bankUserData.email}
                onChange={e => setBankUserData({ ...bankUserData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                className="input"
                value={bankUserData.phoneNumber}
                onChange={e => setBankUserData({ ...bankUserData, phoneNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  className="input"
                  value={bankUserData.password}
                  onChange={e => setBankUserData({ ...bankUserData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  className="input"
                  value={bankUserData.confirmPassword}
                  onChange={e =>
                    setBankUserData({ ...bankUserData, confirmPassword: e.target.value })
                  }
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full btn btn-primary py-3">
              {isLoading ? <span className="spinner" /> : 'Create Bank Staff Account'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-600">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-primary-600 hover:text-primary-500">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary-600 hover:text-primary-500">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
