'use client';

import { useEffect, useState } from 'react';
import {
  customerService,
  type CustomerProfile,
  type UpdateProfilePayload,
} from '@/services/api/customer-service';

type Tab = 'personal' | 'contact' | 'address' | 'employment';

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  const [form, setForm] = useState<UpdateProfilePayload>({});

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError(null);
      const data = await customerService.getMyProfile();
      setProfile(data);
      resetForm(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  function resetForm(p: CustomerProfile) {
    setForm({
      primaryEmail: p.primaryEmail || '',
      secondaryEmail: p.secondaryEmail || '',
      primaryPhone: p.primaryPhone || '',
      secondaryPhone: p.secondaryPhone || '',
      mobilePhone: p.mobilePhone || '',
      preferredContactMethod: p.preferredContactMethod || '',
      addressLine1: p.addressLine1 || '',
      addressLine2: p.addressLine2 || '',
      city: p.city || '',
      stateProvince: p.stateProvince || '',
      postalCode: p.postalCode || '',
      country: p.country || '',
      employmentStatus: p.employmentStatus || '',
      employerName: p.employerName || '',
      occupation: p.occupation || '',
    });
  }

  function handleChange(field: keyof UpdateProfilePayload, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!profile) return;
    try {
      setSaving(true);
      setError(null);
      const updated = await customerService.updateMyProfile(form);
      setProfile(updated);
      resetForm(updated);
      setEditing(false);
      setSuccessMsg('Profile updated successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (profile) resetForm(profile);
    setEditing(false);
    setError(null);
  }

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl !bg-white/20" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 !bg-white/20" />
              <Skeleton className="h-4 w-64 !bg-white/10" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="grid grid-cols-3 gap-4">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="bg-red-50 border border-red-200/60 rounded-2xl p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <p className="text-red-700 font-medium">Could not load profile</p>
        <p className="text-sm text-red-500 mt-1">{error}</p>
        <button
          onClick={loadProfile}
          className="mt-4 text-sm font-medium text-red-700 underline decoration-red-300 underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'personal',
      label: 'Personal',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      key: 'employment',
      label: 'Employment',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ];

  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Hero header ────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-lg font-bold border border-white/20">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {profile.firstName} {profile.lastName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-white/70">{profile.customerNumber}</span>
                <span className="text-white/30">·</span>
                <span className="text-sm text-white/70 capitalize">
                  {profile.customerType?.toLowerCase()}
                </span>
                <span className="text-white/30">·</span>
                <StatusBadge status={profile.customerStatus} />
              </div>
            </div>
          </div>

          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/25 transition-all border border-white/20 shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-white text-[#7f2b7b] text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 shadow-md"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Success / Error banners */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-sm rounded-2xl px-5 py-3">
          <svg
            className="w-5 h-5 text-emerald-500 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {successMsg}
        </div>
      )}
      {error && profile && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 text-red-700 text-sm rounded-2xl px-5 py-3">
          <svg
            className="w-5 h-5 text-red-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01"
            />
          </svg>
          {error}
        </div>
      )}

      {/* ── Tab pills ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-[#7f2b7b] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
        {activeTab === 'personal' && (
          <div className="p-6 space-y-6">
            <SectionTitle>Personal Information</SectionTitle>
            <FieldGrid>
              <ReadOnlyField label="First Name" value={profile.firstName} />
              <ReadOnlyField label="Middle Name" value={profile.middleName} />
              <ReadOnlyField label="Last Name" value={profile.lastName} />
              <ReadOnlyField label="Date of Birth" value={profile.dateOfBirth} />
              <ReadOnlyField label="Gender" value={profile.gender} />
              <ReadOnlyField label="Nationality" value={profile.nationality} />
            </FieldGrid>

            <SectionTitle>Identity Documents</SectionTitle>
            <FieldGrid>
              <ReadOnlyField label="ID Type" value={profile.primaryIdentityType} />
              <ReadOnlyField label="ID Number" value={profile.primaryIdentityNumber} />
              <ReadOnlyField label="Tax ID" value={profile.taxIdNumber} />
            </FieldGrid>

            <SectionTitle>Account Info</SectionTitle>
            <FieldGrid>
              <ReadOnlyField label="Customer Since" value={profile.customerSince} />
              <ReadOnlyField label="Segment" value={profile.customerSegment} />
              <ReadOnlyField label="KYC Status" value={profile.kycStatus} />
              <ReadOnlyField label="Risk Rating" value={profile.riskRating} />
            </FieldGrid>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="p-6 space-y-6">
            <SectionTitle>Contact Information</SectionTitle>
            <FieldGrid>
              <EditableField
                editing={editing}
                label="Primary Email"
                value={form.primaryEmail}
                onChange={v => handleChange('primaryEmail', v)}
                type="email"
              />
              <EditableField
                editing={editing}
                label="Secondary Email"
                value={form.secondaryEmail}
                onChange={v => handleChange('secondaryEmail', v)}
                type="email"
              />
              <EditableField
                editing={editing}
                label="Primary Phone"
                value={form.primaryPhone}
                onChange={v => handleChange('primaryPhone', v)}
              />
              <EditableField
                editing={editing}
                label="Secondary Phone"
                value={form.secondaryPhone}
                onChange={v => handleChange('secondaryPhone', v)}
              />
              <EditableField
                editing={editing}
                label="Mobile Phone"
                value={form.mobilePhone}
                onChange={v => handleChange('mobilePhone', v)}
              />
              <EditableField
                editing={editing}
                label="Preferred Contact"
                value={form.preferredContactMethod}
                onChange={v => handleChange('preferredContactMethod', v)}
              />
            </FieldGrid>
          </div>
        )}

        {activeTab === 'address' && (
          <div className="p-6 space-y-6">
            <SectionTitle>Address</SectionTitle>
            <FieldGrid>
              <EditableField
                editing={editing}
                label="Address Line 1"
                value={form.addressLine1}
                onChange={v => handleChange('addressLine1', v)}
              />
              <EditableField
                editing={editing}
                label="Address Line 2"
                value={form.addressLine2}
                onChange={v => handleChange('addressLine2', v)}
              />
              <EditableField
                editing={editing}
                label="City"
                value={form.city}
                onChange={v => handleChange('city', v)}
              />
              <EditableField
                editing={editing}
                label="State / Province"
                value={form.stateProvince}
                onChange={v => handleChange('stateProvince', v)}
              />
              <EditableField
                editing={editing}
                label="Postal Code"
                value={form.postalCode}
                onChange={v => handleChange('postalCode', v)}
              />
              <EditableField
                editing={editing}
                label="Country"
                value={form.country}
                onChange={v => handleChange('country', v)}
              />
            </FieldGrid>
          </div>
        )}

        {activeTab === 'employment' && (
          <div className="p-6 space-y-6">
            <SectionTitle>Employment</SectionTitle>
            <FieldGrid>
              <EditableField
                editing={editing}
                label="Employment Status"
                value={form.employmentStatus}
                onChange={v => handleChange('employmentStatus', v)}
              />
              <EditableField
                editing={editing}
                label="Employer"
                value={form.employerName}
                onChange={v => handleChange('employerName', v)}
              />
              <EditableField
                editing={editing}
                label="Occupation"
                value={form.occupation}
                onChange={v => handleChange('occupation', v)}
              />
            </FieldGrid>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable components ──────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</h3>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-slate-50/50 rounded-xl px-4 py-3">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function EditableField({
  editing,
  label,
  value,
  onChange,
  type = 'text',
}: {
  editing: boolean;
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  if (!editing) {
    return <ReadOnlyField label={label} value={value} />;
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[#7f2b7b] focus:ring-1 focus:ring-[#7f2b7b] transition-colors"
      />
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const DOT: Record<string, string> = {
    ACTIVE: 'bg-emerald-400',
    PENDING_VERIFICATION: 'bg-amber-400',
    SUSPENDED: 'bg-red-400',
    INACTIVE: 'bg-slate-400',
  };
  const dot = DOT[status || ''] || 'bg-slate-400';

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </span>
  );
}
