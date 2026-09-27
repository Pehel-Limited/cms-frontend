'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AIPreferencesPanel } from '@/components/intelligence/AIPreferences';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import {
  customerService,
  type CustomerProfile,
  type UpdateProfilePayload,
} from '@/services/api/customer-service';

/* ─── Small building blocks ─────────────────────────────────── */

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200"
      style={{
        backgroundColor: on ? 'var(--brand)' : 'var(--surface-input)',
        borderColor: on ? 'var(--brand)' : 'var(--surface-border-strong)',
      }}
      role="switch"
      aria-checked={on}
      aria-label={label}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
        style={{ backgroundColor: on ? '#fff' : 'var(--text-muted)' }}
        aria-hidden="true"
      />
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="px-0 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-0.5 text-base" style={{ color: 'var(--text-primary)' }}>
        {value || '—'}
      </p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const badge = tone === 'success' ? 'badge-success' : tone === 'warning' ? 'badge-warning' : 'badge-neutral';
  return (
    <div
      className="flex items-center justify-between gap-3 py-3"
      style={{ borderBottom: '1px solid var(--surface-border)' }}
    >
      <span className="text-base" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      <span className={`badge ${badge} shrink-0`}>{value}</span>
    </div>
  );
}

function formatDay(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const KYC_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  VERIFIED: { label: 'Verified', tone: 'success' },
  COMPLETED: { label: 'Verified', tone: 'success' },
  APPROVED: { label: 'Verified', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  IN_REVIEW: { label: 'In review', tone: 'warning' },
  FAILED: { label: 'Not verified', tone: 'neutral' },
  REJECTED: { label: 'Not verified', tone: 'neutral' },
};

function statusFor(value?: string | null) {
  if (!value) return { label: 'Not recorded', tone: 'neutral' as const };
  return KYC_LABELS[value] ?? { label: sentenceCase(value), tone: 'neutral' as const };
}

/** "PRIVATE_CUSTOMER" → "Private customer" */
function sentenceCase(value?: string | null): string {
  if (!value) return '';
  const words = value.replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function ProfilePage() {
  const user = useSelector((s: RootState) => s.auth.user);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noProfile, setNoProfile] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateProfilePayload>({});

  const [notifications, setNotifications] = useState({
    accountAlerts: true,
    securityAlerts: true,
    paymentConfirmations: true,
    email: true,
    sms: true,
    push: true,
    marketing: false,
  });

  const toggle = (key: keyof typeof notifications) =>
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));

  const resetForm = useCallback(
    (p: CustomerProfile | null) => {
      setForm({
        primaryEmail: p?.primaryEmail ?? user?.email ?? '',
        mobilePhone: p?.mobilePhone ?? '',
        addressLine1: p?.addressLine1 ?? '',
        addressLine2: p?.addressLine2 ?? '',
        city: p?.city ?? '',
        stateProvince: p?.stateProvince ?? '',
        postalCode: p?.postalCode ?? '',
        country: p?.country ?? '',
      });
    },
    [user?.email]
  );

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setNoProfile(false);
      const data = await customerService.getMyProfile();
      setProfile(data);
      resetForm(data);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 404) {
        setNoProfile(true);
      } else {
        setLoadError(e?.message || 'Could not load your profile');
      }
    } finally {
      setLoading(false);
    }
  }, [resetForm]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSave() {
    try {
      setSaving(true);
      setSaveError(null);
      const updated = await customerService.updateMyProfile(form);
      setProfile(updated);
      resetForm(updated);
      setEditing(false);
      setSavedMsg('Your details have been updated');
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (err) {
      const e = err as { message?: string };
      setSaveError(e?.message || 'Could not save your changes');
    } finally {
      setSaving(false);
    }
  }

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';
  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    : `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const composedAddress =
    profile?.fullAddress ||
    [
      profile?.addressLine1,
      profile?.addressLine2,
      profile?.city,
      profile?.stateProvince,
      profile?.postalCode,
      profile?.country,
    ]
      .filter(Boolean)
      .join(', ');

  const kyc = statusFor(profile?.kycStatus);
  const aml = statusFor(profile?.amlCheckStatus);
  const customerNumber = profile?.customerNumber || user?.customerNumber;

  const notificationRows: { key: keyof typeof notifications; label: string; sub: string }[] = [
    { key: 'accountAlerts', label: 'Account alerts', sub: 'Transactions, balances and account activity' },
    { key: 'securityAlerts', label: 'Security alerts', sub: 'Sign-ins, password changes, suspicious activity' },
    { key: 'paymentConfirmations', label: 'Payment confirmations', sub: 'Payments, transfers and direct debits' },
    { key: 'email', label: 'Email', sub: 'Statements, letters and account updates' },
    { key: 'sms', label: 'SMS', sub: 'One-time passcodes and security alerts' },
    { key: 'push', label: 'Push notifications', sub: 'Instant alerts in the mobile app' },
    { key: 'marketing', label: 'Marketing communications', sub: 'Product updates and offers' },
  ];

  return (
    <div className="space-y-6">
      <AIPreferencesPanel />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            Profile and settings
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Your personal details, security status and notification preferences.
          </p>
        </div>
        {!loading && !noProfile && !loadError && (
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    resetForm(profile);
                    setEditing(false);
                    setSaveError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
                Edit contact details
              </button>
            )}
          </div>
        )}
      </div>

      {savedMsg && (
        <div className="alert alert-success" role="status">
          <span className="flex-1">{savedMsg}</span>
        </div>
      )}
      {saveError && (
        <div className="alert alert-error" role="alert">
          <div className="flex-1">
            <p className="text-base font-semibold">Could not save your changes</p>
            <p className="mt-0.5 text-sm opacity-80">{saveError}</p>
          </div>
          <button type="button" onClick={handleSave} className="btn btn-sm btn-outline shrink-0">
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="panel p-5">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton mt-4 h-16 w-full" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-3 h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="alert alert-error" role="alert">
          <div className="flex-1">
            <p className="text-base font-semibold">Could not load your profile</p>
            <p className="mt-0.5 text-sm opacity-80">{loadError}</p>
          </div>
          <button type="button" onClick={loadProfile} className="btn btn-sm btn-outline shrink-0">
            Try again
          </button>
        </div>
      ) : (
        <>
          {noProfile && (
            <div className="alert alert-info" role="status">
              <span className="flex-1 text-sm">
                No customer profile is linked to this sign-in yet. The details below come from your
                sign-in record only.
              </span>
            </div>
          )}

          {/* Row 1 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Personal details */}
            <Section title="Personal details">
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: 'var(--brand)', boxShadow: 'var(--shadow-sm)' }}
                  aria-hidden="true"
                >
                  {initials || '?'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {displayName || '—'}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {customerNumber ? `Customer number: ${customerNumber}` : 'No customer number on record'}
                  </p>
                </div>
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="field-label" htmlFor="profile-email">
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      className="input"
                      value={form.primaryEmail ?? ''}
                      onChange={e => setForm(p => ({ ...p, primaryEmail: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="profile-mobile">
                      Mobile
                    </label>
                    <input
                      id="profile-mobile"
                      type="tel"
                      className="input"
                      value={form.mobilePhone ?? ''}
                      onChange={e => setForm(p => ({ ...p, mobilePhone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="profile-address-1">
                      Address line 1
                    </label>
                    <input
                      id="profile-address-1"
                      className="input"
                      value={form.addressLine1 ?? ''}
                      onChange={e => setForm(p => ({ ...p, addressLine1: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="profile-address-2">
                      Address line 2
                    </label>
                    <input
                      id="profile-address-2"
                      className="input"
                      value={form.addressLine2 ?? ''}
                      onChange={e => setForm(p => ({ ...p, addressLine2: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label" htmlFor="profile-city">
                        City
                      </label>
                      <input
                        id="profile-city"
                        className="input"
                        value={form.city ?? ''}
                        onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="profile-postal">
                        Postal code
                      </label>
                      <input
                        id="profile-postal"
                        className="input"
                        value={form.postalCode ?? ''}
                        onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label" htmlFor="profile-province">
                        County or province
                      </label>
                      <input
                        id="profile-province"
                        className="input"
                        value={form.stateProvince ?? ''}
                        onChange={e => setForm(p => ({ ...p, stateProvince: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="profile-country">
                        Country
                      </label>
                      <input
                        id="profile-country"
                        className="input"
                        value={form.country ?? ''}
                        onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <DetailRow label="Email" value={profile?.primaryEmail || user?.email} />
                  <DetailRow
                    label="Mobile"
                    value={profile?.mobilePhone || profile?.primaryPhone}
                  />
                  <DetailRow label="Address" value={composedAddress} />
                  <div className="py-3">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Username
                    </p>
                    <p className="mt-0.5 text-base" style={{ color: 'var(--text-primary)' }}>
                      {user?.username || '—'}
                    </p>
                  </div>
                </div>
              )}
            </Section>

            {/* Identity and verification */}
            <Section title="Identity and verification">
              <div className="mb-2">
                <StatusRow label="Identity check (KYC)" value={kyc.label} tone={kyc.tone} />
                <StatusRow label="Anti-money-laundering check" value={aml.label} tone={aml.tone} />
                <StatusRow
                  label="ID document"
                  value={profile?.primaryIdentityType?.replace(/_/g, ' ') || 'Not recorded'}
                />
                <StatusRow
                  label="Customer since"
                  value={formatDay(profile?.customerSince) || 'Not recorded'}
                />
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                {kyc.tone === 'success'
                  ? 'Your identity has been verified, so you have access to the full range of services.'
                  : 'If a check is pending or missing, your relationship manager will let you know what is needed.'}
              </p>
            </Section>

            {/* Security */}
            <Section title="Security">
              <StatusRow
                label="Two-factor authentication"
                value={user?.requiresTwoFactor ? 'Required at sign-in' : 'Not required'}
                tone={user?.requiresTwoFactor ? 'success' : 'neutral'}
              />
              <StatusRow label="Account type" value={sentenceCase(user?.userType) || '—'} />
              {user?.forcePasswordChange ? (
                <div className="alert alert-warning mt-4" role="status">
                  <span className="flex-1 text-sm">
                    Your password must be changed the next time you sign in.
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                  Sign in with your username and password. Contact the bank if you need your password
                  reset.
                </p>
              )}
              <Link href="/portal/messages" className="btn btn-secondary btn-sm mt-4">
                Contact the bank
              </Link>
            </Section>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Notifications — one list instead of duplicated channel/alert panels */}
            <div className="panel lg:col-span-2">
              <div className="panel-header">
                <h2 className="panel-title">Notifications</h2>
                <span className="chip">
                  {Object.values(notifications).filter(Boolean).length} of{' '}
                  {Object.keys(notifications).length} on
                </span>
              </div>
              <ul className="divide-token">
                {notificationRows.map(row => (
                  <li key={row.key} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {row.sub}
                      </p>
                    </div>
                    <Toggle
                      on={notifications[row.key]}
                      onChange={() => toggle(row.key)}
                      label={`${row.label} notifications`}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Documents and payees — real destinations instead of dead buttons */}
            <Section title="Documents and payees">
              <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                Statements, letters and uploaded paperwork live in your document centre. Saved payees
                are managed from the payments page.
              </p>
              <div className="mt-4 space-y-2">
                <Link href="/portal/documents" className="btn btn-secondary w-full">
                  Go to documents
                </Link>
                <Link href="/portal/payments" className="btn btn-outline w-full">
                  Manage payees
                </Link>
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
