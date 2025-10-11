'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store';
import apiClient from '@/lib/api-client';
import config from '@/config';

export default function DiagnosticPage() {
  const { user, isAuthenticated } = useAppSelector(state => state.auth);
  const [apiTest, setApiTest] = useState<string>('Testing...');

  useEffect(() => {
    const testApi = async () => {
      try {
        const response = await apiClient.get('/api/v1/admin/users/pending?page=0&size=10');
        setApiTest(`Success! Got ${response.data.totalElements} pending users`);
      } catch (err: any) {
        setApiTest(
          `Error: ${err.response?.status} - ${err.response?.data?.message || err.message}`
        );
      }
    };

    if (isAuthenticated) {
      testApi();
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Diagnostic Information</h1>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium">Authenticated:</dt>
              <dd className="ml-4">{String(isAuthenticated)}</dd>
            </div>
            <div>
              <dt className="font-medium">User Type:</dt>
              <dd className="ml-4">{user?.userType || 'N/A'}</dd>
            </div>
            <div>
              <dt className="font-medium">Username:</dt>
              <dd className="ml-4">{user?.username || 'N/A'}</dd>
            </div>
            <div>
              <dt className="font-medium">Bank ID:</dt>
              <dd className="ml-4">{user?.bankId || 'N/A'}</dd>
            </div>
            <div>
              <dt className="font-medium">Roles:</dt>
              <dd className="ml-4">{user?.roles ? JSON.stringify(user.roles) : 'N/A'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">API Configuration</h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium">Base URL:</dt>
              <dd className="ml-4">{config.api.baseUrl}</dd>
            </div>
            <div>
              <dt className="font-medium">Token:</dt>
              <dd className="ml-4 break-all">
                {typeof window !== 'undefined'
                  ? localStorage.getItem(config.auth.tokenKey)?.substring(0, 50) + '...'
                  : 'N/A'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">API Test</h2>
          <p className="font-mono text-sm">{apiTest}</p>
        </div>

        <div className="mt-6">
          <a href="/dashboard" className="text-primary-600 hover:text-primary-800">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
