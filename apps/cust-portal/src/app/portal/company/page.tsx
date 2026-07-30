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
        <div className="spinner h-8 w-8" style={{ color: 'var(--brand)' }} role="status" aria-label="Loading company profile" />
      </div>
    );
  }

  if (notBusiness) {
    return (
      <div className="max-w-2xl mx-auto py-20">
        <div className="empty-state">
          <div className="empty-state-icon">
            <BuildingIcon className="w-7 h-7" />
          </div>
          <h2 className="empty-state-title">No company workspace</h2>
          <p className="empty-state-text">
            This section is available for business and corporate customers. If you believe this is an
            error, please contact your relationship manager.
          </p>
        </div>
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="alert alert-error" role="alert">
          <div className="flex-1">
            <p className="font-semibold">Could not load company profile</p>
            <p className="mt-1">{error}</p>
            <button onClick={loadCompany} className="btn btn-secondary btn-sm mt-4">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!company) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'addresses', label: 'Addresses' },
    { key: 'members', label: 'Directors & shareholders' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {company.legalName}
          </h1>
          <p
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{company.entityType?.replace(/_/g, ' ')}</span>
            <span aria-hidden="true">&middot;</span>
            <StatusBadge status={company.status} />
            <span aria-hidden="true">&middot;</span>
            <span>Reg: {company.registrationNumber || '—'}</span>
          </p>
        </div>
        {activeTab !== 'members' && (
          <>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn btn-primary">
                <PencilIcon /> Edit
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={handleCancel} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Banners */}
      {successMsg && (
        <div className="alert alert-success" role="status">
          {successMsg}
        </div>
      )}
      {error && company && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <nav className="flex flex-wrap gap-6" role="tablist" aria-label="Company sections">
          {tabs.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => {
                setActiveTab(t.key);
                if (editing) handleCancel();
              }}
              className="border-b-2 pb-3 text-sm font-medium transition-colors"
              style={
                activeTab === t.key
                  ? { borderColor: 'var(--brand)', color: 'var(--brand-on-soft)' }
                  : { borderColor: 'transparent', color: 'var(--text-muted)' }
              }
            >
              {t.label}
            </button>
          ))}
          {/* Team management link — navigates to sub-page */}
          <Link
            href="/portal/company/team"
            className="border-b-2 border-transparent pb-3 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Team management
          </Link>
        </nav>
      </div>

      {/* Tab content */}
      <div className="panel">
        {activeTab === 'overview' && (
          <div className="panel-body space-y-5">
            <SectionTitle>Legal information</SectionTitle>
            <FieldGrid>
              <ReadOnlyField label="Legal Name" value={company.legalName} />
              <ReadOnlyField label="Entity Type" value={company.entityType?.replace(/_/g, ' ')} />
              <ReadOnlyField label="Registration Number" value={company.registrationNumber} />
              <ReadOnlyField label="Registration Country" value={company.registrationCountry} />
              <ReadOnlyField label="Registration Date" value={company.registrationDate} />
              <ReadOnlyField label="Tax ID" value={company.taxIdNumber} />
              <ReadOnlyField label="VAT Number" value={company.vatNumber} />
            </FieldGrid>

            <SectionTitle>Business details</SectionTitle>
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
          <div className="panel-body space-y-6">
            <div>
              <SectionTitle>Registered address</SectionTitle>
              <p className="field-hint mb-3">
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
              <SectionTitle>Trading address</SectionTitle>
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
          <div className="panel-body">
            <SectionTitle>Directors, shareholders &amp; signatories</SectionTitle>
            {company.members && company.members.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Ownership</th>
                      <th>Signatory</th>
                      <th>UBO</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.members.map(m => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {m.customerName || '—'}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {m.customerEmail}
                          </div>
                        </td>
                        <td className="whitespace-nowrap capitalize">
                          {m.role?.replace(/_/g, ' ').toLowerCase()}
                        </td>
                        <td className="whitespace-nowrap">
                          {m.ownershipPercentage != null ? `${m.ownershipPercentage}%` : '—'}
                        </td>
                        <td className="whitespace-nowrap">
                          {m.isAuthorizedSignatory ? (
                            <span className="badge badge-success">Yes</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {m.isBeneficialOwner ? (
                            <span className="badge badge-success">Yes</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <span
                            className={`badge ${m.isActive ? 'badge-success' : 'badge-neutral'}`}
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
              <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
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
  return <h3 className="section-title uppercase tracking-wider">{children}</h3>;
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
        {value || '—'}
      </dd>
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
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div>
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="input"
      />
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const variants: Record<string, string> = {
    ACTIVE: 'badge-success',
    PENDING_VERIFICATION: 'badge-warning',
    SUSPENDED: 'badge-error',
    DORMANT: 'badge-neutral',
  };
  const variant = variants[status || ''] || 'badge-neutral';
  return <span className={`badge ${variant}`}>{status?.replace(/_/g, ' ') || 'Unknown'}</span>;
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
