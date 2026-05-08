'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  customerService,
  type CompanyProfile,
  type UpdateCompanyPayload,
} from '@/services/api/customer-service';

type Tab = 'overview' | 'addresses' | 'members';

export default function CompanyPage() {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notBusiness, setNotBusiness] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [form, setForm] = useState<UpdateCompanyPayload>({});

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    try {
      setLoading(true);
      setError(null);
      setNotBusiness(false);
      const data = await customerService.getMyCompany();
      if (!data) {
        setNotBusiness(true);
        return;
      }
      setCompany(data);
      resetForm(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load company profile');
    } finally {
      setLoading(false);
    }
  }

  function resetForm(c: CompanyProfile) {
    setForm({
      tradingName: c.tradingName || '',
      businessDescription: c.businessDescription || '',
      email: c.email || '',
      phoneNumber: c.phoneNumber || '',
      website: c.website || '',
      tradingAddressLine1: c.tradingAddressLine1 || '',
      tradingAddressLine2: c.tradingAddressLine2 || '',
      tradingCity: c.tradingCity || '',
      tradingCounty: c.tradingCounty || '',
      tradingEircode: c.tradingEircode || '',
      tradingCountry: c.tradingCountry || '',
    });
  }

  function handleChange(field: keyof UpdateCompanyPayload, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!company) return;
    try {
      setSaving(true);
      setError(null);
      const updated = await customerService.updateMyCompany(form);
      setCompany(updated);
      resetForm(updated);
      setEditing(false);
      setSuccessMsg('Company profile updated successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (company) resetForm(company);
    setEditing(false);
    setError(null);
  }

  // ─── States ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notBusiness) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <BuildingIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No Company Workspace</h2>
        <p className="text-sm text-gray-500">
          This section is available for business and corporate customers. If you believe this is an
          error, please contact your relationship manager.
        </p>
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 mt-8">
        <h2 className="text-red-800 font-semibold mb-2">Could not load company profile</h2>
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={loadCompany} className="mt-4 text-sm text-primary-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (!company) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'addresses', label: 'Addresses' },
    { key: 'members', label: 'Directors & Shareholders' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company.legalName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {company.entityType?.replace(/_/g, ' ')} &middot;{' '}
            <StatusBadge status={company.status} /> &middot; Reg:{' '}
            {company.registrationNumber || '—'}
          </p>
        </div>
        {activeTab !== 'members' && (
          <>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <PencilIcon /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Banners */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {successMsg}
        </div>
      )}
      {error && company && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                if (editing) handleCancel();
              }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
          {/* Team management link — navigates to sub-page */}
          <Link
            href="/portal/company/team"
            className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
          >
            Team Management
          </Link>
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-5">
            <SectionTitle>Legal Information</SectionTitle>
            <FieldGrid>
              <ReadOnlyField label="Legal Name" value={company.legalName} />
              <ReadOnlyField label="Entity Type" value={company.entityType?.replace(/_/g, ' ')} />
              <ReadOnlyField label="Registration Number" value={company.registrationNumber} />
              <ReadOnlyField label="Registration Country" value={company.registrationCountry} />
              <ReadOnlyField label="Registration Date" value={company.registrationDate} />
              <ReadOnlyField label="Tax ID" value={company.taxIdNumber} />
              <ReadOnlyField label="VAT Number" value={company.vatNumber} />
            </FieldGrid>

            <SectionTitle>Business Details</SectionTitle>
            <FieldGrid>
              <EditableField
                editing={editing}
                label="Trading Name"
                value={form.tradingName}
                onChange={v => handleChange('tradingName', v)}
              />
              <ReadOnlyField label="Industry Sector" value={company.industrySector} />
              <ReadOnlyField label="Year Established" value={company.yearEstablished?.toString()} />
              <ReadOnlyField label="Employees" value={company.numberOfEmployees?.toString()} />
            </FieldGrid>
            <EditableField
              editing={editing}
              label="Business Description"
              value={form.businessDescription}
              onChange={v => handleChange('businessDescription', v)}
            />

            <SectionTitle>Contact</SectionTitle>
            <FieldGrid>
              <EditableField
                editing={editing}
                label="Email"
                value={form.email}
                onChange={v => handleChange('email', v)}
                type="email"
              />
              <EditableField
                editing={editing}
                label="Phone"
                value={form.phoneNumber}
                onChange={v => handleChange('phoneNumber', v)}
              />
              <EditableField
                editing={editing}
                label="Website"
                value={form.website}
                onChange={v => handleChange('website', v)}
              />
            </FieldGrid>
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="p-6 space-y-6">
            <div>
              <SectionTitle>Registered Address</SectionTitle>
              <p className="text-xs text-gray-400 mb-3">
                Changes to the registered address require bank verification
              </p>
              <FieldGrid>
                <ReadOnlyField label="Address Line 1" value={company.registeredAddressLine1} />
                <ReadOnlyField label="Address Line 2" value={company.registeredAddressLine2} />
                <ReadOnlyField label="City" value={company.registeredCity} />
                <ReadOnlyField label="County" value={company.registeredCounty} />
                <ReadOnlyField label="Eircode" value={company.registeredEircode} />
                <ReadOnlyField label="Country" value={company.registeredCountry} />
              </FieldGrid>
            </div>

            <div>
              <SectionTitle>Trading Address</SectionTitle>
              <FieldGrid>
                <EditableField
                  editing={editing}
                  label="Address Line 1"
                  value={form.tradingAddressLine1}
                  onChange={v => handleChange('tradingAddressLine1', v)}
                />
                <EditableField
                  editing={editing}
                  label="Address Line 2"
                  value={form.tradingAddressLine2}
                  onChange={v => handleChange('tradingAddressLine2', v)}
                />
                <EditableField
                  editing={editing}
                  label="City"
                  value={form.tradingCity}
                  onChange={v => handleChange('tradingCity', v)}
                />
                <EditableField
                  editing={editing}
                  label="County"
                  value={form.tradingCounty}
                  onChange={v => handleChange('tradingCounty', v)}
                />
                <EditableField
                  editing={editing}
                  label="Eircode"
                  value={form.tradingEircode}
                  onChange={v => handleChange('tradingEircode', v)}
                />
                <EditableField
                  editing={editing}
                  label="Country"
                  value={form.tradingCountry}
                  onChange={v => handleChange('tradingCountry', v)}
                />
              </FieldGrid>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-6">
            <SectionTitle>Directors, Shareholders &amp; Signatories</SectionTitle>
            {company.members && company.members.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Ownership</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Signatory</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">UBO</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {company.members.map(m => (
                      <tr key={m.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{m.customerName || '—'}</div>
                          <div className="text-xs text-gray-500">{m.customerEmail}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap capitalize">
                          {m.role?.replace(/_/g, ' ').toLowerCase()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.ownershipPercentage != null ? `${m.ownershipPercentage}%` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.isAuthorizedSignatory ? (
                            <span className="text-green-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.isBeneficialOwner ? (
                            <span className="text-green-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              m.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {m.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No members on file. Contact your relationship manager.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{children}</h3>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || '—'}</dd>
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
  if (!editing) return <ReadOnlyField label={label} value={value} />;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
      />
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    DORMANT: 'bg-gray-100 text-gray-600',
  };
  const cls = colors[status || ''] || 'bg-gray-100 text-gray-800';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </span>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}
