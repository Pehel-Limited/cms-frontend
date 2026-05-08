'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { toast } from 'react-toastify';

// Note: Users for a firm would come from Identity Service or a firm-users endpoint.
// For now we show a placeholder directing to bank admin if no users endpoint is available.
export default function FirmUsersPage() {
  const user = useAppSelector(s => s.auth.user);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Team</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-gray-600 text-sm">
          Solicitor team members are managed by your bank administrator. Contact your bank to add or
          remove users from your firm.
        </p>

        <div className="mt-6 border border-gray-100 rounded-lg p-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-800">Your Account</p>
          {user && (
            <div className="mt-2 text-sm text-gray-600 space-y-1">
              <p>
                Name: {user.firstName} {user.lastName}
              </p>
              <p>Email: {user.email}</p>
              <p>Role: {user.userType}</p>
              {user.firmId && <p>Firm ID: {user.firmId}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
