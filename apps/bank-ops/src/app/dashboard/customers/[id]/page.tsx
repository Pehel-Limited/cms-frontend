'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { customerService, Customer } from '@/services/api/customerService';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import { accountService, AccountSummaryResponse } from '@/services/api/accountService';
import { formatCurrency as sharedFormatCurrency, getCurrencySymbol } from '@/lib/format';

// ============================================================================
// Constants
// ============================================================================

const COUNTRIES = [
  { value: 'IE', label: 'Ireland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'OTHER', label: 'Other' },
];

const IDENTITY_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National Identity Card' },
  { value: 'DRIVERS_LICENSE', label: 'Driving Licence' },
  { value: 'RESIDENCE_PERMIT', label: 'Residence Permit' },
];

const EMPLOYMENT_TYPES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const CUSTOMER_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active Relationship', color: '#10b981' },
  INACTIVE: { label: 'Inactive', color: '#64748b' },
  SUSPENDED: { label: 'Suspended', color: '#ef4444' },
  PENDING_VERIFICATION: { label: 'Pending Verification', color: '#f59e0b' },
};

const APP_STATUS_COLOR: Record<string, string> = {
  DRAFT: '#64748b',
  SUBMITTED: '#f59e0b',
  UNDER_REVIEW: '#3b82f6',
  IN_REVIEW: '#3b82f6',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  DISBURSED: '#10b981',
  BOOKED: '#10b981',
};

const ACCOUNT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#10b981',
  PENDING: '#f59e0b',
  DORMANT: '#64748b',
  FROZEN: '#3b82f6',
  CLOSED: '#64748b',
  BLOCKED: '#ef4444',
};

const RISK_COLOR: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#dc2626',
};

const MIX_PALETTE = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#38bdf8', '#ec4899', '#64748b'];

const TERMINAL_APP = /APPROV|REJECT|BOOK|DISBURS|CLOSED|CANCEL|WITHDRAW|FUNDED|COMPLETED|DECLIN/i;

// ============================================================================
// Helpers
// ============================================================================

function formatEnum(value?: string): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function compact(amount: number): string {
  const sym = getCurrencySymbol();
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

// ============================================================================
// Page
// ============================================================================

type TabId = 'overview' | 'applications' | 'accounts' | 'details' | 'kyc';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const asOf = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  useEffect(() => {
    fetchCustomerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const customerData = await customerService.getCustomerById(customerId);
      setCustomer(customerData);
      setEditedCustomer(customerData);

      const [appsRes, accountsRes] = await Promise.allSettled([
        applicationService.getApplicationsByCustomer(customerId),
        accountService.getAccountsByParty(customerId),
      ]);
      if (appsRes.status === 'fulfilled') setApplications(appsRes.value.content || []);
      if (accountsRes.status === 'fulfilled') setAccounts(accountsRes.value || []);
    } catch (err) {
      console.error('Failed to fetch customer data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (field: keyof Customer, value: string | number | null) => {
    setEditedCustomer(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!customer) return;
    setIsSaving(true);
    try {
      const updated = await customerService.updateCustomer(customerId, editedCustomer);
      setCustomer(updated);
      setIsEditing(false);
      toast.success('Customer updated successfully!');
    } catch (err) {
      console.error('Failed to update customer:', err);
      toast.error('Failed to update customer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedCustomer(customer || {});
    setIsEditing(false);
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    setIsSaving(true);
    try {
      const updated = await customerService.updateCustomerStatus(customerId, newStatus);
      setCustomer(updated);
      setShowStatusModal(false);
      toast.success(`Customer status updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      if (deleteType === 'soft') {
        await customerService.softDeleteCustomer(customerId);
        toast.success('Customer has been deactivated and marked as deleted.');
      } else {
        await customerService.hardDeleteCustomer(customerId);
        toast.success('Customer has been permanently deleted.');
      }
      router.push('/dashboard/customers');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      toast.error('Failed to delete customer. Please try again.');
    } finally {
      setIsSaving(false);
      setShowDeleteModal(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived metrics (all from real data)
  // -------------------------------------------------------------------------

  const isBusiness = customer ? customer.customerType !== 'INDIVIDUAL' : false;

  const displayName = useMemo(() => {
    if (!customer) return '';
    return (
      customer.businessName ||
      customer.businessLegalName ||
      `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
      customer.customerNumber
    );
  }, [customer]);

  const deposits = useMemo(
    () =>
      accounts
        .filter(a => a.accountCategory === 'DEPOSIT')
        .reduce((s, a) => s + (a.currentBalance || 0), 0),
    [accounts]
  );

  const exposure = useMemo(
    () =>
      accounts
        .filter(a => a.accountCategory === 'CREDIT')
        .reduce((s, a) => s + Math.abs(a.currentBalance || 0), 0),
    [accounts]
  );

  const activeAccounts = useMemo(() => accounts.filter(a => a.status === 'ACTIVE'), [accounts]);

  const openApplications = useMemo(
    () => applications.filter(a => !TERMINAL_APP.test(a.lomsStatus || a.status)),
    [applications]
  );

  const rmName = useMemo(() => {
    const withRm = applications.find(a => a.assignedToUser);
    if (withRm?.assignedToUser)
      return `${withRm.assignedToUser.firstName} ${withRm.assignedToUser.lastName}`.trim();
    return '—';
  }, [applications]);

  const annualFigure = isBusiness ? customer?.annualRevenue : customer?.annualIncome;

  // Exposure & product mix — group active accounts by type
  const productMix = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>();
    accounts.forEach(a => {
      const key = a.accountTypeDisplay || formatEnum(a.accountType);
      const prev = map.get(key)?.value || 0;
      map.set(key, { label: key, value: prev + Math.abs(a.currentBalance || 0) });
    });
    const rows = Array.from(map.values())
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows.map((r, i) => ({
      ...r,
      pct: total > 0 ? (r.value / total) * 100 : 0,
      color: MIX_PALETTE[i % MIX_PALETTE.length],
    }));
  }, [accounts]);

  // Relationship health — transparent composite from real signals
  const health = useMemo(() => {
    if (!customer) return null;
    const kyc = customer.kycStatus?.toUpperCase() || '';
    const aml = customer.amlCheckStatus?.toUpperCase() || '';
    const risk = customer.riskRating?.toUpperCase() || '';

    const kycScore = /APPROVED|COMPLETED|VERIFIED/.test(kyc)
      ? 25
      : /PROGRESS|PENDING/.test(kyc)
        ? 12
        : 0;
    const amlScore = /CLEAR|APPROVED|PASS/.test(aml)
      ? 25
      : /PENDING|PROGRESS/.test(aml)
        ? 12
        : /FLAG|FAIL/.test(aml)
          ? 0
          : 8;
    const riskScore = risk === 'LOW' ? 25 : risk === 'MEDIUM' ? 15 : risk === 'HIGH' ? 6 : 12;
    const depthScore = activeAccounts.length >= 3 ? 25 : activeAccounts.length >= 1 ? 15 : 5;

    const total = kycScore + amlScore + riskScore + depthScore;
    const band =
      total >= 75
        ? { label: 'Good', color: '#10b981' }
        : total >= 50
          ? { label: 'Fair', color: '#f59e0b' }
          : { label: 'Watch', color: '#ef4444' };

    const rate = (v: number, max: number) =>
      v / max >= 0.8 ? 'High' : v / max >= 0.5 ? 'Medium' : 'Low';

    return {
      total,
      band,
      signals: [
        { label: 'KYC / AML', value: rate(kycScore + amlScore, 50) },
        { label: 'Risk Profile', value: rate(riskScore, 25) },
        { label: 'Product Depth', value: rate(depthScore, 25) },
        {
          label: 'Engagement',
          value: openApplications.length > 0 ? 'Active' : activeAccounts.length > 0 ? 'Steady' : 'Low',
        },
      ],
    };
  }, [customer, activeAccounts.length, openApplications.length]);

  // Timeline — real events derived from timestamps
  const timeline = useMemo(() => {
    if (!customer) return [];
    const events: { date: string; title: string; detail: string; color: string }[] = [];
    if (customer.customerSince)
      events.push({
        date: customer.customerSince,
        title: 'Relationship established',
        detail: `Onboarded as ${formatEnum(customer.customerType)} customer`,
        color: '#0ea5e9',
      });
    if (customer.kycCompletionDate)
      events.push({
        date: customer.kycCompletionDate,
        title: 'KYC completed',
        detail: `Status: ${formatEnum(customer.kycStatus)}`,
        color: '#10b981',
      });
    if (customer.amlCheckDate)
      events.push({
        date: customer.amlCheckDate,
        title: 'AML check performed',
        detail: `Status: ${formatEnum(customer.amlCheckStatus)}`,
        color: '#8b5cf6',
      });
    if (customer.riskRatingDate)
      events.push({
        date: customer.riskRatingDate,
        title: 'Risk rating assigned',
        detail: `Rating: ${formatEnum(customer.riskRating)}`,
        color: '#f59e0b',
      });
    applications.slice(0, 6).forEach(a =>
      events.push({
        date: a.submittedAt || a.createdAt,
        title: `Application ${a.applicationNumber}`,
        detail: `${a.product?.productName || 'Loan'} · ${sharedFormatCurrency(a.requestedAmount)}`,
        color: '#38bdf8',
      })
    );
    return events
      .filter(e => e.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [customer, applications]);

  const nextActions = useMemo(() => {
    if (!customer) return [];
    const out: { label: string; color: string; href: string }[] = [];
    const kyc = customer.kycStatus?.toUpperCase() || '';
    if (!kyc || /NOT_STARTED|PENDING|PROGRESS/.test(kyc))
      out.push({
        label: 'Complete KYC / AML verification',
        color: '#f59e0b',
        href: `/dashboard/kyc/cases/new?customerId=${customer.customerId}`,
      });
    if (openApplications.length > 0)
      out.push({
        label: `Review ${openApplications.length} open application${openApplications.length > 1 ? 's' : ''}`,
        color: '#3b82f6',
        href: `/dashboard/applications?customerId=${customer.customerId}`,
      });
    if (accounts.length === 0)
      out.push({
        label: 'Open first account for this customer',
        color: '#10b981',
        href: `/dashboard/accounts/new?customerId=${customer.customerId}`,
      });
    if (deposits > 0 && exposure === 0)
      out.push({
        label: 'Explore lending / credit opportunity',
        color: '#8b5cf6',
        href: `/dashboard/applications/new?customerId=${customer.customerId}`,
      });
    return out;
  }, [customer, openApplications.length, accounts.length, deposits, exposure]);

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-5">
          <div
            className="h-40 animate-pulse rounded-2xl"
            style={{ backgroundColor: 'var(--rm-card-hover)' }}
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl"
                style={{ backgroundColor: 'var(--rm-card-hover)' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div
            className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
              Customer Not Found
            </h2>
            <p className="mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              {error || 'Unable to load customer details'}
            </p>
            <Link
              href="/dashboard/customers"
              className="mt-4 inline-block text-sm font-medium"
              style={{ color: 'var(--rm-accent)' }}
            >
              ← Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const status = STATUS_META[customer.customerStatus] || {
    label: formatEnum(customer.customerStatus),
    color: '#64748b',
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'applications', label: `Applications (${applications.length})` },
    { id: 'accounts', label: `Accounts (${accounts.length})` },
    { id: 'details', label: 'Details' },
    { id: 'kyc', label: 'KYC / AML' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
      <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-5">
        {/* Back link */}
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back to Customers
        </Link>

        {/* Header */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}
              >
                {initials(displayName)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                    {displayName}
                  </h1>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${status.color}22`, color: status.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {customer.customerNumber} · {formatEnum(customer.customerType)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 hidden text-xs font-medium sm:inline" style={{ color: 'var(--rm-text-muted)' }}>
                As of {asOf}
              </span>
              <HeaderButton
                onClick={() => {
                  setActiveTab('details');
                  setIsEditing(true);
                }}
              >
                Edit
              </HeaderButton>
              <HeaderButton
                onClick={() => {
                  setNewStatus(customer.customerStatus);
                  setShowStatusModal(true);
                }}
              >
                Change Status
              </HeaderButton>
              <button
                onClick={() => router.push(`/dashboard/applications/new?customerId=${customer.customerId}`)}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                + New Application
              </button>
            </div>
          </div>

          {/* Info row */}
          <div
            className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-3 lg:grid-cols-6"
            style={{ borderColor: 'var(--rm-border)' }}
          >
            <InfoItem label="Customer ID" value={customer.customerNumber} />
            <InfoItem label="Segment" value={formatEnum(customer.customerSegment) || '—'} />
            <InfoItem label="Industry" value={isBusiness ? formatEnum(customer.industrySector) : formatEnum(customer.occupation)} />
            <InfoItem label="Relationship Manager" value={rmName} />
            <InfoItem label="Customer Since" value={customer.customerSince ? formatDate(customer.customerSince) : '—'} />
            <InfoItem
              label="Risk Rating"
              value={customer.riskRating ? formatEnum(customer.riskRating) : 'Not Rated'}
              color={customer.riskRating ? RISK_COLOR[customer.riskRating.toUpperCase()] : undefined}
            />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <KpiCard label="Total Exposure" value={accounts.length ? compact(exposure) : '—'} color="#6366f1" icon={<VaultIcon />} />
          <KpiCard label="Deposits" value={accounts.length ? compact(deposits) : '—'} color="#10b981" icon={<CoinsIcon />} />
          <KpiCard label="Active Products" value={String(activeAccounts.length)} color="#0ea5e9" icon={<GridIcon />} />
          <KpiCard label="Open Applications" value={String(openApplications.length)} color="#f59e0b" icon={<DocIcon />} />
          <KpiCard
            label={isBusiness ? 'Annual Revenue' : 'Annual Income'}
            value={annualFigure ? compact(annualFigure) : '—'}
            color="#38bdf8"
            icon={<ChartIcon />}
          />
          <KpiCard
            label="Risk Rating"
            value={customer.riskRating ? formatEnum(customer.riskRating) : 'N/R'}
            color={customer.riskRating ? RISK_COLOR[customer.riskRating.toUpperCase()] || '#64748b' : '#64748b'}
            icon={<ShieldIcon />}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--rm-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ color: activeTab === tab.id ? 'var(--rm-accent)' : 'var(--rm-text-muted)' }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* OVERVIEW TAB */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Main column */}
            <div className="space-y-5 xl:col-span-2">
              {/* AI Relationship Summary */}
              <Panel>
                <PanelHeader icon={<SparkIcon />} title="AI Relationship Summary" beta />
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--rm-text-secondary)' }}>
                  {buildSummary(customer, displayName, {
                    exposure,
                    deposits,
                    products: activeAccounts.length,
                    openApps: openApplications.length,
                  })}
                </p>
              </Panel>

              {/* Exposure & Product Mix */}
              <Panel>
                <PanelHeader title="Exposure & Product Mix" />
                {productMix.length === 0 ? (
                  <EmptyRow>No active facilities or balances on record.</EmptyRow>
                ) : (
                  <div className="mt-4">
                    <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--rm-card-hover)' }}>
                      {productMix.map(m => (
                        <div key={m.label} style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                      {productMix.map(m => (
                        <div key={m.label} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 truncate">
                            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                            <span className="truncate" style={{ color: 'var(--rm-text-secondary)' }}>{m.label}</span>
                          </span>
                          <span className="flex items-center gap-2 tabular-nums">
                            <span className="font-semibold" style={{ color: 'var(--rm-text)' }}>{sharedFormatCurrency(m.value)}</span>
                            <span style={{ color: 'var(--rm-text-muted)' }}>{m.pct.toFixed(1)}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>

              {/* Active Facilities */}
              <Panel>
                <div className="flex items-center justify-between">
                  <PanelHeader title="Active Facilities" />
                  {accounts.length > 0 && (
                    <button onClick={() => setActiveTab('accounts')} className="text-xs font-semibold" style={{ color: 'var(--rm-accent)' }}>
                      View all accounts →
                    </button>
                  )}
                </div>
                {accounts.length === 0 ? (
                  <EmptyRow>No accounts opened for this customer yet.</EmptyRow>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                          <Th>Account</Th>
                          <Th>Type</Th>
                          <Th className="text-right">Balance</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.slice(0, 5).map(a => (
                          <tr
                            key={a.accountId}
                            onClick={() => router.push(`/dashboard/accounts/${a.accountId}`)}
                            className="cursor-pointer"
                            style={{ borderBottom: '1px solid var(--rm-border)' }}
                          >
                            <td className="py-3 pr-4">
                              <p className="font-medium" style={{ color: 'var(--rm-text)' }}>{a.accountName}</p>
                              <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{a.accountNumber}</p>
                            </td>
                            <td className="py-3 pr-4" style={{ color: 'var(--rm-text-secondary)' }}>{a.accountTypeDisplay || formatEnum(a.accountType)}</td>
                            <td className="py-3 pr-4 text-right font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                              {sharedFormatCurrency(a.currentBalance || 0)}
                            </td>
                            <td className="py-3">
                              <Badge color={ACCOUNT_STATUS_COLOR[a.status] || '#64748b'}>{a.statusDisplay || formatEnum(a.status)}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              {/* Recent Applications */}
              <Panel>
                <div className="flex items-center justify-between">
                  <PanelHeader title="Recent Applications" />
                  {applications.length > 0 && (
                    <button onClick={() => setActiveTab('applications')} className="text-xs font-semibold" style={{ color: 'var(--rm-accent)' }}>
                      View all →
                    </button>
                  )}
                </div>
                {applications.length === 0 ? (
                  <EmptyRow>No applications submitted yet.</EmptyRow>
                ) : (
                  <div className="mt-3 space-y-2">
                    {applications.slice(0, 4).map(a => {
                      const st = (a.lomsStatus || a.status).toUpperCase();
                      const color = APP_STATUS_COLOR[st] || '#64748b';
                      return (
                        <button
                          key={a.applicationId}
                          onClick={() => router.push(`/dashboard/applications/${a.applicationId}`)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left"
                          style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                              {a.applicationNumber} · {a.product?.productName || 'Loan'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{formatDate(a.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                              {sharedFormatCurrency(a.requestedAmount)}
                            </span>
                            <Badge color={color}>{formatEnum(a.lomsStatus || a.status)}</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Panel>

              {/* Financial Snapshot */}
              <Panel>
                <PanelHeader title="Financial Snapshot" />
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {isBusiness ? (
                    <>
                      <Stat label="Annual Revenue" value={customer.annualRevenue ? sharedFormatCurrency(customer.annualRevenue) : '—'} />
                      <Stat label="Net Worth" value={customer.netWorth ? sharedFormatCurrency(customer.netWorth) : '—'} />
                      <Stat label="Employees" value={customer.numberOfEmployees ? String(customer.numberOfEmployees) : '—'} />
                      <Stat label="Years in Business" value={customer.yearsInBusiness ? String(customer.yearsInBusiness) : '—'} />
                    </>
                  ) : (
                    <>
                      <Stat label="Annual Income" value={customer.annualIncome ? sharedFormatCurrency(customer.annualIncome) : '—'} />
                      <Stat label="Net Worth" value={customer.netWorth ? sharedFormatCurrency(customer.netWorth) : '—'} />
                      <Stat label="Credit Score" value={customer.creditScore ? String(customer.creditScore) : '—'} />
                      <Stat label="Employment" value={formatEnum(customer.employmentStatus)} />
                    </>
                  )}
                </div>
              </Panel>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Relationship Health */}
              {health && (
                <Panel>
                  <PanelHeader title="Relationship Health" />
                  <div className="mt-4 flex items-center gap-5">
                    <HealthDonut score={health.total} color={health.band.color} />
                    <div className="flex-1 space-y-2">
                      {health.signals.map(s => (
                        <div key={s.label} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--rm-text-secondary)' }}>{s.label}</span>
                          <span className="font-semibold" style={{ color: 'var(--rm-text)' }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>
                    Composite score derived from KYC/AML, risk rating and product depth.
                  </p>
                </Panel>
              )}

              {/* KYC / AML Status */}
              <Panel>
                <PanelHeader title="KYC / AML Status" />
                <div className="mt-3 space-y-3">
                  <SidebarRow label="KYC Status" value={formatEnum(customer.kycStatus) || 'Not Verified'} color={/APPROV|COMPLET|VERIF/i.test(customer.kycStatus || '') ? '#10b981' : /PEND|PROGRESS/i.test(customer.kycStatus || '') ? '#f59e0b' : '#64748b'} />
                  <SidebarRow label="AML Status" value={formatEnum(customer.amlCheckStatus) || 'Not Checked'} color={/CLEAR|APPROV|PASS/i.test(customer.amlCheckStatus || '') ? '#10b981' : /FLAG|FAIL/i.test(customer.amlCheckStatus || '') ? '#ef4444' : '#64748b'} />
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--rm-text-secondary)' }}>KYC Completed</span>
                    <span style={{ color: 'var(--rm-text)' }}>{formatDate(customer.kycCompletionDate)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('kyc')}
                  className="mt-4 w-full rounded-lg py-2 text-xs font-semibold"
                  style={{ border: '1px solid var(--rm-border)', color: 'var(--rm-text-secondary)' }}
                >
                  Manage KYC / AML
                </button>
              </Panel>

              {/* Contact Details */}
              <Panel>
                <PanelHeader title="Contact Details" />
                <div className="mt-3 space-y-3 text-sm">
                  <ContactRow icon={<MailIcon />} value={customer.primaryEmail} />
                  {customer.primaryPhone && <ContactRow icon={<PhoneIcon />} value={customer.primaryPhone} />}
                  {customer.mobilePhone && <ContactRow icon={<PhoneIcon />} value={customer.mobilePhone} />}
                  {(customer.city || customer.country) && (
                    <ContactRow icon={<PinIcon />} value={[customer.city, customer.country].filter(Boolean).join(', ')} />
                  )}
                </div>
              </Panel>

              {/* Next Best Actions */}
              <Panel>
                <PanelHeader title="Next Best Actions" />
                <div className="mt-3 space-y-2">
                  {nextActions.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>No outstanding actions. Relationship is in good standing.</p>
                  ) : (
                    nextActions.map((a, i) => (
                      <Link
                        key={i}
                        href={a.href}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs"
                        style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                          <span style={{ color: 'var(--rm-text-secondary)' }}>{a.label}</span>
                        </span>
                        <span style={{ color: 'var(--rm-accent)' }}>→</span>
                      </Link>
                    ))
                  )}
                </div>
              </Panel>

              {/* AI Opportunity Insight */}
              <div
                className="rounded-xl p-5"
                style={{ background: 'linear-gradient(135deg, var(--rm-accent-muted), transparent)', border: '1px solid var(--rm-border)' }}
              >
                <PanelHeader icon={<SparkIcon />} title="AI Opportunity Insight" beta />
                <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--rm-text-secondary)' }}>
                  {buildOpportunity(customer, { deposits, exposure, products: activeAccounts.length, openApps: openApplications.length })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* APPLICATIONS TAB */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'applications' && (
          <Panel>
            {applications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>No applications found.</p>
                <Link
                  href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                  className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                >
                  Create First Application
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                      <Th>Application #</Th>
                      <Th>Product</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(a => {
                      const st = (a.lomsStatus || a.status).toUpperCase();
                      const color = APP_STATUS_COLOR[st] || '#64748b';
                      return (
                        <tr
                          key={a.applicationId}
                          onClick={() => router.push(`/dashboard/applications/${a.applicationId}`)}
                          className="cursor-pointer"
                          style={{ borderBottom: '1px solid var(--rm-border)' }}
                        >
                          <td className="py-3 pr-4 font-medium" style={{ color: 'var(--rm-text)' }}>{a.applicationNumber || 'N/A'}</td>
                          <td className="py-3 pr-4" style={{ color: 'var(--rm-text-secondary)' }}>{a.product?.productName || 'N/A'}</td>
                          <td className="py-3 pr-4 text-right font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>{sharedFormatCurrency(a.requestedAmount)}</td>
                          <td className="py-3 pr-4"><Badge color={color}>{formatEnum(a.lomsStatus || a.status)}</Badge></td>
                          <td className="py-3" style={{ color: 'var(--rm-text-muted)' }}>{formatDate(a.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* ACCOUNTS TAB */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'accounts' && (
          <Panel>
            {accounts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>No accounts found for this customer.</p>
                <Link
                  href={`/dashboard/accounts/new?customerId=${customer.customerId}`}
                  className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                >
                  Open Account
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                      <Th>Account</Th>
                      <Th>Type</Th>
                      <Th>Category</Th>
                      <Th className="text-right">Current Balance</Th>
                      <Th className="text-right">Available</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr
                        key={a.accountId}
                        onClick={() => router.push(`/dashboard/accounts/${a.accountId}`)}
                        className="cursor-pointer"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium" style={{ color: 'var(--rm-text)' }}>{a.accountName}</p>
                          <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{a.primaryIban || a.accountNumber}</p>
                        </td>
                        <td className="py-3 pr-4" style={{ color: 'var(--rm-text-secondary)' }}>{a.accountTypeDisplay || formatEnum(a.accountType)}</td>
                        <td className="py-3 pr-4" style={{ color: 'var(--rm-text-secondary)' }}>{formatEnum(a.accountCategory)}</td>
                        <td className="py-3 pr-4 text-right font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>{sharedFormatCurrency(a.currentBalance || 0)} {a.currency}</td>
                        <td className="py-3 pr-4 text-right tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>{sharedFormatCurrency(a.availableBalance || 0)}</td>
                        <td className="py-3"><Badge color={ACCOUNT_STATUS_COLOR[a.status] || '#64748b'}>{a.statusDisplay || formatEnum(a.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* DETAILS TAB (edit forms) */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'details' && (
          <div className="space-y-5">
            <div className="flex justify-end gap-2">
              {isEditing ? (
                <>
                  <HeaderButton onClick={handleCancelEdit} disabled={isSaving}>Cancel</HeaderButton>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--rm-accent)' }}
                  >
                    {isSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <HeaderButton onClick={() => setShowDeleteModal(true)}>Delete</HeaderButton>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--rm-accent)' }}
                  >
                    Edit Details
                  </button>
                </>
              )}
            </div>

            {isBusiness ? (
              <Section title="Business Information">
                <Field label="Business Name" k="businessName" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Legal Name" k="businessLegalName" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Registration Number" k="businessRegistrationNumber" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Business Type" k="businessType" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Industry Sector" k="industrySector" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Years in Business" k="yearsInBusiness" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="number" />
                <Field label="Number of Employees" k="numberOfEmployees" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="number" />
              </Section>
            ) : (
              <Section title="Personal Information">
                <Field label="First Name" k="firstName" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Middle Name" k="middleName" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Last Name" k="lastName" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                <Field label="Date of Birth" k="dateOfBirth" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="date" fmt={v => formatDate(v as string | undefined)} />
                <Field label="Gender" k="gender" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }]} />
                <Field label="Nationality" k="nationality" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} options={COUNTRIES} />
              </Section>
            )}

            <Section title="Contact Information">
              <Field label="Email" k="primaryEmail" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="email" />
              <Field label="Phone" k="primaryPhone" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="tel" />
              <Field label="Mobile" k="mobilePhone" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="tel" />
              <Field label="Secondary Email" k="secondaryEmail" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="email" />
            </Section>

            <Section title="Identity Documents">
              <Field label="ID Type" k="primaryIdentityType" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} options={IDENTITY_TYPES} />
              <Field label="ID Number" k="primaryIdentityNumber" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
              <Field label="Tax Reference / PPS" k="taxIdNumber" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
            </Section>

            <Section title="Address">
              <Field label="Address Line 1" k="addressLine1" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
              <Field label="Address Line 2" k="addressLine2" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
              <Field label="City" k="city" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
              <Field label="County / Region" k="stateProvince" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
              <Field label="Eircode / Postcode" k="postalCode" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
              <Field label="Country" k="country" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} options={COUNTRIES} />
            </Section>

            <Section title="Employment & Financial">
              {!isBusiness && (
                <>
                  <Field label="Employment Status" k="employmentStatus" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} options={EMPLOYMENT_TYPES} />
                  <Field label="Employer" k="employerName" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                  <Field label="Occupation" k="occupation" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} />
                  <Field label="Annual Income" k="annualIncome" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="number" fmt={v => (v ? sharedFormatCurrency(Number(v)) : 'N/A')} />
                </>
              )}
              {isBusiness && (
                <Field label="Annual Revenue" k="annualRevenue" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="number" fmt={v => (v ? sharedFormatCurrency(Number(v)) : 'N/A')} />
              )}
              <Field label="Net Worth" k="netWorth" c={customer} e={editedCustomer} ed={isEditing} on={handleEditChange} type="number" fmt={v => (v ? sharedFormatCurrency(Number(v)) : 'N/A')} />
              <ReadOnlyField label="Credit Score" value={customer.creditScore ? String(customer.creditScore) : 'N/A'} />
              <ReadOnlyField label="Risk Rating" value={customer.riskRating ? formatEnum(customer.riskRating) : 'Not Rated'} />
            </Section>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* KYC / AML TAB */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'kyc' && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PanelHeader title="KYC / AML Status" />
              <div className="flex gap-2">
                {(!customer.kycStatus || /NOT_STARTED|PENDING/.test(customer.kycStatus)) && (
                  <button
                    onClick={() => router.push(`/dashboard/kyc/cases/new?customerId=${customer.customerId}`)}
                    className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--rm-accent)' }}
                  >
                    Initiate KYC
                  </button>
                )}
                <HeaderButton onClick={() => router.push(`/dashboard/kyc/cases?customerId=${customer.customerId}`)}>View KYC Cases</HeaderButton>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="KYC Status" value={formatEnum(customer.kycStatus) || 'Not Verified'} />
              <Stat label="KYC Completion" value={formatDate(customer.kycCompletionDate)} />
              <Stat label="AML Status" value={formatEnum(customer.amlCheckStatus) || 'Not Checked'} />
              <Stat label="AML Check Date" value={formatDate(customer.amlCheckDate)} />
            </div>
            {(!customer.kycStatus || customer.kycStatus === 'NOT_STARTED') && (
              <div
                className="mt-5 flex items-start gap-2 rounded-lg p-3"
                style={{ backgroundColor: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)' }}
              >
                <span style={{ color: '#f59e0b' }}>⚠</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>KYC verification required</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--rm-text-secondary)' }}>
                    This customer has not completed KYC/AML verification. Click “Initiate KYC” to start the process.
                  </p>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* Footer */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs"
          style={{ borderColor: 'var(--rm-border)', color: 'var(--rm-text-muted)' }}
        >
          <span>Last updated {formatDate(customer.customerSince)} · Data as at {asOf}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
            All data sources connected
          </span>
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <Modal onClose={() => setShowStatusModal(false)} title="Change Customer Status">
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>New Status</label>
          <select
            value={newStatus}
            onChange={e => setNewStatus(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
          >
            {CUSTOMER_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="mt-6 flex justify-end gap-3">
            <HeaderButton onClick={() => setShowStatusModal(false)}>Cancel</HeaderButton>
            <button
              onClick={handleStatusChange}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              {isSaving ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)} title="Delete Customer">
          <p className="mb-4 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>How would you like to remove this customer?</p>
          <div className="space-y-3">
            {(['soft', 'hard'] as const).map(t => (
              <label
                key={t}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-4"
                style={{
                  border: `2px solid ${deleteType === t ? (t === 'hard' ? '#ef4444' : 'var(--rm-accent)') : 'var(--rm-border)'}`,
                  backgroundColor: deleteType === t ? 'var(--rm-card-hover)' : 'transparent',
                }}
              >
                <input type="radio" name="deleteType" checked={deleteType === t} onChange={() => setDeleteType(t)} className="mt-1" />
                <div>
                  <p className="font-medium" style={{ color: t === 'hard' ? '#ef4444' : 'var(--rm-text)' }}>
                    {t === 'hard' ? 'Permanent Delete' : 'Deactivate (Soft Delete)'}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {t === 'hard' ? 'Permanently remove all customer data. This cannot be undone!' : 'Mark customer as inactive. Can be restored later.'}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <HeaderButton onClick={() => setShowDeleteModal(false)}>Cancel</HeaderButton>
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: deleteType === 'hard' ? '#ef4444' : 'var(--rm-accent)' }}
            >
              {isSaving ? 'Processing…' : deleteType === 'hard' ? 'Permanently Delete' : 'Deactivate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// Content builders
// ============================================================================

function buildSummary(
  c: Customer,
  name: string,
  m: { exposure: number; deposits: number; products: number; openApps: number }
): string {
  const parts: string[] = [];
  const since = c.customerSince ? ` since ${formatDate(c.customerSince)}` : '';
  parts.push(`${name} has been a ${formatEnum(c.customerType).toLowerCase()} customer${since}.`);
  if (m.products > 0) {
    parts.push(
      `The relationship holds ${m.products} active product${m.products > 1 ? 's' : ''}${m.exposure > 0 ? ` with total exposure of ${sharedFormatCurrency(m.exposure)}` : ''}${m.deposits > 0 ? ` and deposits of ${sharedFormatCurrency(m.deposits)}` : ''}.`
    );
  } else {
    parts.push('No active products are currently booked for this customer.');
  }
  parts.push(
    `Risk rating is ${c.riskRating ? formatEnum(c.riskRating) : 'not yet assigned'} and KYC status is ${c.kycStatus ? formatEnum(c.kycStatus).toLowerCase() : 'not started'}.`
  );
  if (m.openApps > 0)
    parts.push(`${m.openApps} application${m.openApps > 1 ? 's are' : ' is'} currently in progress.`);
  return parts.join(' ');
}

function buildOpportunity(
  c: Customer,
  m: { deposits: number; exposure: number; products: number; openApps: number }
): string {
  if (m.deposits > 0 && m.exposure === 0)
    return `Strong deposit base with no active lending — a good candidate for cross-sell of credit or working-capital facilities.`;
  if (m.exposure > 0 && m.deposits === 0)
    return `Active borrower with no deposit relationship — consider promoting current/savings accounts to deepen the relationship.`;
  if (m.products === 0)
    return `No products booked yet. Prioritise onboarding and opening an initial account to activate the relationship.`;
  if (c.riskRating?.toUpperCase() === 'LOW')
    return `Low-risk profile with an established relationship — well positioned for premium product offers and limit increases.`;
  return `Balanced relationship across deposits and lending. Monitor for periodic review and identify cross-sell based on recent activity.`;
}

// ============================================================================
// Sub-components
// ============================================================================

function HeaderButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-card)' }}
    >
      {children}
    </button>
  );
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="mt-0.5 text-sm font-medium" style={{ color: color || 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1f`, color }}>{icon}</span>
      <p className="mt-3 text-xl font-bold tabular-nums" style={{ color: 'var(--rm-text)' }}>{value}</p>
      <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
      {children}
    </div>
  );
}

function PanelHeader({ title, icon, beta }: { title: string; icon?: React.ReactNode; beta?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}>{icon}</span>
      )}
      <h3 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</h3>
      {beta && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}>BETA</span>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide ${className}`} style={{ color: 'var(--rm-text-muted)' }}>
      {children}
    </th>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${color}22`, color }}>
      {children}
    </span>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>{children}</p>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function SidebarRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: 'var(--rm-text-secondary)' }}>{label}</span>
      <Badge color={color}>{value}</Badge>
    </div>
  );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: 'var(--rm-text-muted)' }}>{icon}</span>
      <span className="truncate" style={{ color: 'var(--rm-text-secondary)' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Panel>
  );
}

type FieldProps = {
  label: string;
  k: keyof Customer;
  c: Customer;
  e: Partial<Customer>;
  ed: boolean;
  on: (field: keyof Customer, value: string | number | null) => void;
  type?: string;
  options?: { value: string; label: string }[];
  fmt?: (v: string | number | undefined) => string;
};

function Field({ label, k, c, e, ed, on, type = 'text', options, fmt }: FieldProps) {
  const raw = (e[k] ?? c[k]) as string | number | undefined;
  const inputStyle = {
    backgroundColor: 'var(--rm-input)',
    border: '1px solid var(--rm-border)',
    color: 'var(--rm-text)',
  } as const;

  let display: string;
  if (options) display = options.find(o => o.value === c[k])?.label || (c[k] ? String(c[k]) : 'N/A');
  else if (fmt) display = fmt(c[k] as string | number | undefined);
  else display = c[k] != null && c[k] !== '' ? String(c[k]) : 'N/A';

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>{label}</label>
      {ed ? (
        options ? (
          <select value={(raw as string) || ''} onChange={ev => on(k, ev.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
            <option value="">Select</option>
            {options.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        ) : (
          <input
            type={type}
            value={(raw as string | number) ?? ''}
            onChange={ev => on(k, type === 'number' ? (ev.target.value === '' ? null : parseFloat(ev.target.value)) : ev.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        )
      ) : (
        <p className="text-sm" style={{ color: 'var(--rm-text)' }}>{display}</p>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>{label}</label>
      <p className="text-sm" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function HealthDonut({ score, color }: { score: number; color: string }) {
  const size = 96;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const filled = (Math.min(100, score) / 100) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--rm-card-hover)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--rm-text)' }}>{score}</span>
        <span className="text-[10px]" style={{ color }}>/ 100</span>
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function VaultIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 9v-1M12 16v-1M15 12h1M8 12H7" /></svg>);
}
function CoinsIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" /></svg>);
}
function GridIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
}
function DocIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>);
}
function ChartIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="m7 14 3-3 3 3 5-5" /></svg>);
}
function ShieldIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}
function SparkIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" /></svg>);
}
function MailIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>);
}
function PhoneIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>);
}
function PinIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>);
}
