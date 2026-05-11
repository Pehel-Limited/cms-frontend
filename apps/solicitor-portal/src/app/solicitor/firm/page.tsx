'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { firmService } from '@/services/api/firm-service';

const STATUS_STYLE: Record<string, { bg: string; dot: string }> = {
  ACTIVE: { bg: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  PENDING_APPROVAL: { bg: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  SUSPENDED: { bg: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  INACTIVE: { bg: 'bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

export default function FirmProfilePage() {
  const user = useAppSelector(s => s.auth.user);
  const firmId = user?.firmId;
  const [firm, setFirm] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (firmId) {
      firmService
        .getFirm(firmId)
        .then(res => setFirm(res as unknown as Record<string, unknown>))
        .catch(() => setError('Failed to load firm profile'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [firmId]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!firmId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">No firm linked</h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Your account is not associated with a solicitor firm. Contact your bank administrator.
        </p>
      </div>
    );
  }

  if (error || !firm) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <p className="text-sm text-red-600 font-medium">{error ?? 'Firm not found'}</p>
      </div>
    );
  }

  const status = String(firm.panelStatus ?? '');
  const statusStyle = STATUS_STYLE[status] ?? {
    bg: 'bg-gray-50 text-gray-600',
    dot: 'bg-gray-400',
  };

  const firmName = String(firm.firmName ?? 'Unnamed Firm');
  const tradingName = firm.tradingName ? String(firm.tradingName) : null;
  const lawSocietyId = firm.lawSocietyIdentifier ? String(firm.lawSocietyIdentifier) : null;

  const address = [firm.addressLine1, firm.addressLine2, firm.city, firm.county, firm.eircode]
    .filter(Boolean)
    .map(String)
    .join(', ');

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Gradient header card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b] p-6 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute right-8 bottom-0 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">{firmName}</h1>
              {tradingName && (
                <p className="text-purple-200 text-sm mt-0.5">Trading as: {tradingName}</p>
              )}
              {lawSocietyId && (
                <p className="text-purple-300 text-xs mt-1">Law Society: {lawSocietyId}</p>
              )}
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-sm font-medium ${statusStyle.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
            {status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          icon="envelope"
          label="Email"
          value={firm.email != null ? String(firm.email) : undefined}
        />
        <InfoCard
          icon="phone"
          label="Phone"
          value={firm.phone != null ? String(firm.phone) : undefined}
        />
        <InfoCard
          icon="user"
          label="Principal Solicitor"
          value={
            firm.principalSolicitorName != null ? String(firm.principalSolicitorName) : undefined
          }
        />
        <InfoCard
          icon="shield"
          label="Law Society Number"
          value={firm.lawSocietyNumber != null ? String(firm.lawSocietyNumber) : undefined}
        />
        <InfoCard
          icon="calendar"
          label="PI Insurance Expiry"
          value={
            firm.piInsuranceExpiry != null
              ? new Date(String(firm.piInsuranceExpiry)).toLocaleDateString('en-IE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : undefined
          }
        />
        <InfoCard
          icon="currency"
          label="PI Insurance Cover"
          value={
            firm.piInsuranceAmount != null
              ? `€${(firm.piInsuranceAmount as number).toLocaleString()}`
              : undefined
          }
        />
      </div>

      {/* Address */}
      {address && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#7f2b7b]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Office Address</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{address}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: string; label: string; value?: string }) {
  const icons: Record<string, React.ReactNode> = {
    envelope: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    ),
    phone: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    ),
    user: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    ),
    shield: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    currency: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4.5 h-4.5 text-[#7f2b7b]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {icons[icon]}
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{value ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
