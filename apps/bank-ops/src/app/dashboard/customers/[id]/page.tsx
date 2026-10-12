'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { customerService, type Customer } from '@/services/api/customerService';
import {
  applicationService,
  type ApplicationResponse,
} from '@/services/api/applicationService';
import {
  accountService,
  type AccountSummaryResponse,
  accountCategoryLabels,
  accountStatusLabels,
  accountTypeLabels,
} from '@/services/api/accountService';
import {
  aiCustomerIntelligenceService,
  type CustomerIntelligenceState,
  type Recommendation,
} from '@/services/api/aiCustomerIntelligenceService';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';
import config from '@/config';

// ============================================================================
// Shared option lists
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
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const CUSTOMER_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
];

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

/** Fields the API requires — marked visually and programmatically. */
const REQUIRED_FIELDS: (keyof Customer)[] = ['primaryEmail', 'primaryPhone'];

const TERMINAL_APP = /APPROV|REJECT|BOOK|DISBURS|CLOSED|CANCEL|WITHDRAW|FUNDED|COMPLETED|DECLIN/i;

// ============================================================================
// Tones — colour is never the only signal, every chip carries its label
// ============================================================================

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

const TONE_BG: Record<Tone, string> = {
  neutral: 'rgba(127,127,127,0.12)',
  positive: 'rgba(16,185,129,0.14)',
  warning: 'rgba(245,158,11,0.16)',
  negative: 'rgba(239,68,68,0.14)',
  accent: 'var(--rm-accent-muted)',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'var(--rm-text-muted)',
  positive: '#10b981',
  warning: '#f59e0b',
  negative: '#ef4444',
  accent: 'var(--rm-accent)',
};

function customerStatusTone(status?: string): Tone {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'positive';
  if (s === 'SUSPENDED') return 'negative';
  if (s === 'PENDING_VERIFICATION') return 'warning';
  return 'neutral';
}

function accountStatusTone(status?: string): Tone {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'positive';
  if (s === 'BLOCKED' || s === 'CLOSED') return 'negative';
  if (s === 'PENDING' || s === 'DORMANT') return 'warning';
  if (s === 'FROZEN') return 'accent';
  return 'neutral';
}

function applicationStatusTone(status?: string): Tone {
  const s = (status || '').toUpperCase();
  if (/APPROV|BOOK|DISBURS|FUNDED|COMPLETED/.test(s)) return 'positive';
  if (/REJECT|DECLIN|CANCEL|WITHDRAW/.test(s)) return 'negative';
  if (/REVIEW|UNDERWRIT|CREDIT|PENDING/.test(s)) return 'warning';
  return 'neutral';
}

function riskTone(rating?: string): Tone {
  const r = (rating || '').toUpperCase();
  if (!r || r === 'NOT_RATED') return 'neutral';
  if (r === 'LOW') return 'positive';
  if (r === 'MEDIUM') return 'warning';
  return 'negative';
}

function kycTone(status?: string): Tone {
  const k = (status || '').toUpperCase();
  if (/APPROV|COMPLET|VERIF/.test(k)) return 'positive';
  if (/REJECT|FAIL|FLAG/.test(k)) return 'negative';
  if (/PEND|PROGRESS|EXPIRED|NOT_STARTED/.test(k) || !k) return 'warning';
  return 'neutral';
}

function severityTone(severity?: string | null): Tone {
  const s = (severity || '').toUpperCase();
  if (s === 'HIGH') return 'negative';
  if (s === 'MEDIUM') return 'warning';
  if (s === 'LOW') return 'positive';
  return 'neutral';
}

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
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  return `${sign}${formatCurrency(abs)}`;
}

// ============================================================================
// Page
// ============================================================================

type TabId = 'overview' | 'applications' | 'accounts' | 'details' | 'kyc';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Applications' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'details', label: 'Details' },
  { id: 'kyc', label: 'KYC and AML' },
];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [intelligence, setIntelligence] = useState<CustomerIntelligenceState | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationBusyId, setRecommendationBusyId] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null
  );

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const fetchCustomerData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const customerData = await customerService.getCustomerById(customerId);
      setCustomer(customerData);
      setEditedCustomer(customerData);

      const [appsRes, accountsRes] = await Promise.allSettled([
        applicationService.getApplicationsByCustomer(customerId),
        accountService.getAccountsByParty(customerId),
      ]);
      setApplications(appsRes.status === 'fulfilled' ? appsRes.value.content || [] : []);
      setAccounts(accountsRes.status === 'fulfilled' ? accountsRes.value || [] : []);
    } catch (err) {
      console.error('Failed to fetch customer data:', err);
      setLoadError(
        err instanceof Error ? err.message : 'We could not load this customer. Please try again.'
      );
    } finally {
      setLoading(false);
    }

    // Loaded independently so an unavailable intelligence service never blocks the page.
    setIntelligenceLoading(true);
    aiCustomerIntelligenceService
      .getCustomerState(customerId, config.bank.defaultBankId)
      .then(setIntelligence)
      .catch(() => setIntelligence(null))
      .finally(() => setIntelligenceLoading(false));

    setRecommendationsLoading(true);
    aiCustomerIntelligenceService
      .getRecommendations(customerId, config.bank.defaultBankId)
      .then(data => setRecommendations(Array.isArray(data) ? data : []))
      .catch(() => setRecommendations([]))
      .finally(() => setRecommendationsLoading(false));
  }, [customerId]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const handleRecommendationDecision = async (
    recommendationId: string,
    decision: 'accept' | 'dismiss'
  ) => {
    setRecommendationBusyId(recommendationId);
    setRecommendationError(null);
    try {
      const updated =
        decision === 'accept'
          ? await aiCustomerIntelligenceService.acceptRecommendation(
              recommendationId,
              config.bank.defaultBankId
            )
          : await aiCustomerIntelligenceService.dismissRecommendation(
              recommendationId,
              config.bank.defaultBankId
            );
      setRecommendations(prev => prev.filter(rec => rec.id !== updated.id));
    } catch (err) {
      console.error(`Failed to ${decision} recommendation:`, err);
      setRecommendationError(
        `We could not ${decision} that suggestion. The list is unchanged — please try again.`
      );
    } finally {
      setRecommendationBusyId(null);
    }
  };

  const handleEditChange = (field: keyof Customer, value: string | number | null) => {
    setEditedCustomer(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const startEditing = () => {
    setSaveMessage(null);
    setFieldErrors({});
    setEditedCustomer(customer || {});
    setActiveTab('details');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedCustomer(customer || {});
    setFieldErrors({});
    setSaveMessage(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!customer) return;
    const errors: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(f => {
      const v = editedCustomer[f];
      if (v == null || String(v).trim() === '') errors[f as string] = 'This field is required.';
    });
    const email = String(editedCustomer.primaryEmail || '');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.primaryEmail = 'Enter a valid email address.';
    setFieldErrors(errors);
    setSaveMessage(null);
    if (Object.keys(errors).length > 0) {
      setSaveMessage({
        tone: 'error',
        text: `Please fix ${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? '' : 's'} before saving. Your changes are still here.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await customerService.updateCustomer(customerId, editedCustomer);
      setCustomer(updated);
      setEditedCustomer(updated);
      setIsEditing(false);
      setSaveMessage({ tone: 'success', text: 'Customer details saved.' });
    } catch (err) {
      console.error('Failed to update customer:', err);
      setSaveMessage({
        tone: 'error',
        text: 'We could not save these changes. Your edits are still here — please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async () => {
    setStatusError(null);
    if (!newStatus) {
      setStatusError('Choose a status before updating.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await customerService.updateCustomerStatus(customerId, newStatus);
      setCustomer(updated);
      setShowStatusModal(false);
      setSaveMessage({
        tone: 'success',
        text: `Customer status set to ${formatEnum(newStatus)}.`,
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      setStatusError('We could not update the status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setIsSaving(true);
    try {
      if (deleteType === 'soft') {
        await customerService.softDeleteCustomer(customerId);
      } else {
        await customerService.hardDeleteCustomer(customerId);
      }
      router.push('/dashboard/customers');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setDeleteError('We could not remove this customer. Nothing was changed — please try again.');
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived values (all from the loaded records)
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

  const productMix = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach(a => {
      const key = a.accountTypeDisplay || accountTypeLabels[a.accountType] || formatEnum(a.accountType);
      map.set(key, (map.get(key) || 0) + Math.abs(a.currentBalance || 0));
    });
    const rows = Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 }));
  }, [accounts]);

  const timeline = useMemo(() => {
    if (!customer) return [];
    const events: { date: string; title: string; detail: string }[] = [];
    if (customer.customerSince)
      events.push({
        date: customer.customerSince,
        title: 'Relationship established',
        detail: `Onboarded as a ${formatEnum(customer.customerType).toLowerCase()} customer`,
      });
    if (customer.kycCompletionDate)
      events.push({
        date: customer.kycCompletionDate,
        title: 'KYC completed',
        detail: `Status: ${formatEnum(customer.kycStatus)}`,
      });
    if (customer.amlCheckDate)
      events.push({
        date: customer.amlCheckDate,
        title: 'AML check performed',
        detail: `Status: ${formatEnum(customer.amlCheckStatus)}`,
      });
    if (customer.riskRatingDate)
      events.push({
        date: customer.riskRatingDate,
        title: 'Risk rating assigned',
        detail: `Rating: ${formatEnum(customer.riskRating)}`,
      });
    applications.slice(0, 6).forEach(a =>
      events.push({
        date: a.submittedAt || a.createdAt,
        title: `Application ${a.applicationNumber}`,
        detail: `${a.product?.productName || 'Loan'} · ${formatCurrency(a.requestedAmount)}`,
      })
    );
    return events
      .filter(e => e.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [customer, applications]);

  const nextSteps = useMemo(() => {
    if (!customer) return [];
    const out: { label: string; href: string }[] = [];
    const kyc = customer.kycStatus?.toUpperCase() || '';
    if (!kyc || /NOT_STARTED|PENDING|PROGRESS|EXPIRED/.test(kyc))
      out.push({
        label: 'Complete KYC and AML verification',
        href: `/dashboard/kyc/cases/new?customerId=${customer.customerId}`,
      });
    if (openApplications.length > 0)
      out.push({
        label: `Review ${openApplications.length} open application${openApplications.length > 1 ? 's' : ''}`,
        href: `/dashboard/applications?customerId=${customer.customerId}`,
      });
    if (accounts.length === 0)
      out.push({
        label: 'Open the first account for this customer',
        href: `/dashboard/accounts/new?customerId=${customer.customerId}`,
      });
    if (deposits > 0 && exposure === 0)
      out.push({
        label: 'Explore a lending or credit opportunity',
        href: `/dashboard/applications/new?customerId=${customer.customerId}`,
      });
    return out;
  }, [customer, openApplications.length, accounts.length, deposits, exposure]);

  // -------------------------------------------------------------------------
  // Loading / error
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <p role="status" className="sr-only">
          Loading customer
        </p>
        <div
          className="h-36 animate-pulse rounded-3xl"
          style={{ backgroundColor: 'var(--rm-card)' }}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-3xl"
              style={{ backgroundColor: 'var(--rm-card)' }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div
            className="h-72 animate-pulse rounded-3xl xl:col-span-2"
            style={{ backgroundColor: 'var(--rm-card)' }}
          />
          <div className="h-72 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
        </div>
      </div>
    );
  }

  if (loadError || !customer) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl p-7 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Customer unavailable
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }} role="alert">
            {loadError || 'We could not find this customer.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={fetchCustomerData}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              Try again
            </button>
            <Link
              href="/dashboard/customers"
              className="rounded-full px-5 py-2.5 text-sm font-medium"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Back to customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusTone = customerStatusTone(customer.customerStatus);

  return (
    <div className="space-y-6">
      {/* ══ Back ══ */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium w-fit rounded-lg"
        style={{ color: 'var(--rm-text-muted)' }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Back to customers
      </Link>

      {/* ══ Header ══ */}
      <header className="rounded-3xl p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <span
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-base font-semibold"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
              aria-hidden="true"
            >
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <h1
                className="text-2xl font-semibold tracking-tight break-words"
                style={{ color: 'var(--rm-text)' }}
              >
                {displayName}
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {customer.customerNumber} · {formatEnum(customer.customerType)}
              </p>
              <div className="mt-3">
                <Pill tone={statusTone}>
                  {CUSTOMER_STATUSES.find(s => s.value === customer.customerStatus)?.label ||
                    formatEnum(customer.customerStatus)}
                </Pill>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isEditing ? (
              <>
                <SecondaryButton onClick={handleCancelEdit} disabled={isSaving}>
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                >
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <>
                <SecondaryButton
                  onClick={() => {
                    setNewStatus(customer.customerStatus);
                    setStatusError(null);
                    setShowStatusModal(true);
                  }}
                >
                  Change status
                </SecondaryButton>
                <SecondaryButton onClick={startEditing}>Edit details</SecondaryButton>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/dashboard/applications/new?customerId=${customer.customerId}`)
                  }
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                >
                  New application
                </button>
              </>
            )}
          </div>
        </div>

        {saveMessage && (
          <p
            role={saveMessage.tone === 'error' ? 'alert' : 'status'}
            className="mt-5 rounded-2xl px-5 py-4 text-sm"
            style={{
              backgroundColor:
                saveMessage.tone === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.14)',
              color: 'var(--rm-text)',
            }}
          >
            {saveMessage.text}
          </p>
        )}

        {/* Key facts */}
        <dl
          className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-6 sm:grid-cols-3 lg:grid-cols-6"
          style={{ borderColor: 'var(--rm-border)' }}
        >
          <Fact label="Customer number" value={customer.customerNumber || '—'} />
          <Fact label="Segment" value={formatEnum(customer.customerSegment)} />
          <Fact
            label={isBusiness ? 'Industry' : 'Occupation'}
            value={formatEnum(isBusiness ? customer.industrySector : customer.occupation)}
          />
          <Fact label="Relationship manager" value={rmName} />
          <Fact label="Customer since" value={formatDate(customer.customerSince)} />
          <Fact label="Risk rating" value={formatEnum(customer.riskRating) || 'Not rated'} />
        </dl>
      </header>

      {/* ══ Figures ══ */}
      <section
        aria-label="Relationship figures"
        className="grid grid-cols-2 gap-4 lg:grid-cols-5"
      >
        <Figure
          label="Total exposure"
          value={accounts.length ? compact(exposure) : '—'}
          hint="Credit balances"
        />
        <Figure
          label="Deposits"
          value={accounts.length ? compact(deposits) : '—'}
          hint="Deposit balances"
        />
        <Figure
          label="Active products"
          value={String(activeAccounts.length)}
          hint="Accounts with active status"
        />
        <Figure
          label="Open applications"
          value={String(openApplications.length)}
          hint="Not yet in a terminal state"
        />
        <Figure
          label={isBusiness ? 'Annual revenue' : 'Annual income'}
          value={annualFigure ? compact(annualFigure) : '—'}
          hint="As declared on the record"
        />
      </section>

      {/* ══ Tabs ══ */}
      <div
        role="tablist"
        aria-label="Customer sections"
        className="flex gap-1 overflow-x-auto rounded-full p-1 w-fit max-w-full"
        style={{ backgroundColor: 'rgba(127,127,127,0.10)' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={activeTab === t.id}
            aria-controls={`tabpanel-${t.id}`}
            tabIndex={activeTab === t.id ? 0 : -1}
            onClick={() => setActiveTab(t.id)}
            className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-90"
            style={{
              backgroundColor: activeTab === t.id ? 'var(--rm-card)' : 'transparent',
              color: activeTab === t.id ? 'var(--rm-text)' : 'var(--rm-text-muted)',
            }}
          >
            {t.label}
            {t.id === 'applications' && applications.length > 0 && (
              <span className="ml-1.5 tabular-nums opacity-70">{applications.length}</span>
            )}
            {t.id === 'accounts' && accounts.length > 0 && (
              <span className="ml-1.5 tabular-nums opacity-70">{accounts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══ */}
      <div
        role="tabpanel"
        id="tabpanel-overview"
        aria-labelledby="tab-overview"
        tabIndex={0}
        hidden={activeTab !== 'overview'}
        className={
          activeTab === 'overview' ? 'grid grid-cols-1 gap-6 xl:grid-cols-3' : 'hidden'
        }
      >
        <div className="space-y-6 xl:col-span-2 min-w-0">
          <Panel title="Relationship summary">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--rm-text-secondary)' }}>
              {buildSummary(customer, displayName, {
                exposure,
                deposits,
                products: activeAccounts.length,
                openApps: openApplications.length,
              })}
            </p>
          </Panel>

          <Panel title="Exposure and product mix">
            {productMix.length === 0 ? (
              <EmptyRow>No balances are recorded against this customer.</EmptyRow>
            ) : (
              <>
                <ul className="mt-1 space-y-3">
                  {productMix.map(m => (
                    <li key={m.label}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span
                          className="truncate"
                          style={{ color: 'var(--rm-text-secondary)' }}
                        >
                          {m.label}
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span
                            className="text-base font-medium tabular-nums"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {formatCurrency(m.value)}
                          </span>
                          <span
                            className="text-sm tabular-nums w-14 text-right"
                            style={{ color: 'var(--rm-text-muted)' }}
                          >
                            {m.pct.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${m.pct}%`, backgroundColor: 'var(--rm-accent)' }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel
            title="Active facilities"
            action={
              accounts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  View all accounts
                </button>
              ) : undefined
            }
          >
            {accounts.length === 0 ? (
              <EmptyRow>No accounts have been opened for this customer yet.</EmptyRow>
            ) : (
              <div
                role="region"
                aria-label="Active facilities, horizontally scrollable"
                tabIndex={0}
                className="mt-4 -mx-2 overflow-x-auto"
              >
                <table className="w-full" aria-label="Accounts held by this customer">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                      <Th>Account</Th>
                      <Th>Type</Th>
                      <Th align="right">Balance</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.slice(0, 5).map(a => (
                      <tr
                        key={a.accountId}
                        className="cursor-pointer"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                        onClick={() => router.push(`/dashboard/accounts/${a.accountId}`)}
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/dashboard/accounts/${a.accountId}`}
                            onClick={e => e.stopPropagation()}
                            className="text-base font-medium hover:underline"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {a.accountName}
                          </Link>
                          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {a.accountNumber}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {a.accountTypeDisplay || accountTypeLabels[a.accountType]}
                        </td>
                        <td
                          className="px-5 py-4 text-right text-base font-medium tabular-nums whitespace-nowrap"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {formatCurrency(a.currentBalance || 0, a.currency)}
                        </td>
                        <td className="px-5 py-4">
                          <Pill tone={accountStatusTone(a.status)}>
                            {a.statusDisplay || accountStatusLabels[a.status]}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Recent applications"
            action={
              applications.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('applications')}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  View all applications
                </button>
              ) : undefined
            }
          >
            {applications.length === 0 ? (
              <EmptyRow>No applications have been submitted yet.</EmptyRow>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {applications.slice(0, 4).map(a => (
                  <li key={a.applicationId}>
                    <Link
                      href={`/dashboard/applications/${a.applicationId}`}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 hover:opacity-90"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    >
                      <span className="min-w-0">
                        <span
                          className="block truncate text-base font-medium"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {a.applicationNumber} · {a.product?.productName || 'Loan'}
                        </span>
                        <span className="block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          Submitted {formatDate(a.submittedAt || a.createdAt)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span
                          className="text-base font-medium tabular-nums"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {formatCurrency(a.requestedAmount)}
                        </span>
                        <Pill tone={applicationStatusTone(a.lomsStatus || a.status)}>
                          {formatEnum(a.lomsStatus || a.status)}
                        </Pill>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Financial snapshot">
            <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {isBusiness ? (
                <>
                  <Fact
                    label="Annual revenue"
                    value={customer.annualRevenue ? formatCurrency(customer.annualRevenue) : '—'}
                  />
                  <Fact
                    label="Net worth"
                    value={customer.netWorth ? formatCurrency(customer.netWorth) : '—'}
                  />
                  <Fact
                    label="Employees"
                    value={customer.numberOfEmployees ? String(customer.numberOfEmployees) : '—'}
                  />
                  <Fact
                    label="Years in business"
                    value={customer.yearsInBusiness ? String(customer.yearsInBusiness) : '—'}
                  />
                </>
              ) : (
                <>
                  <Fact
                    label="Annual income"
                    value={customer.annualIncome ? formatCurrency(customer.annualIncome) : '—'}
                  />
                  <Fact
                    label="Net worth"
                    value={customer.netWorth ? formatCurrency(customer.netWorth) : '—'}
                  />
                  <Fact
                    label="Credit score"
                    value={customer.creditScore ? String(customer.creditScore) : '—'}
                  />
                  <Fact label="Employment" value={formatEnum(customer.employmentStatus)} />
                </>
              )}
            </dl>
          </Panel>

          <Panel title="Relationship timeline">
            {timeline.length === 0 ? (
              <EmptyRow>No dated events are recorded for this relationship yet.</EmptyRow>
            ) : (
              <ol className="mt-4 space-y-4">
                {timeline.map((e, i) => (
                  <li key={`${e.date}-${i}`} className="flex gap-4">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: 'var(--rm-accent)' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {e.title}
                      </span>
                      <span className="block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {formatDate(e.date)} · {e.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 min-w-0">
          <Panel title="Compliance status">
            <dl className="mt-1 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  KYC
                </dt>
                <dd>
                  <Pill tone={kycTone(customer.kycStatus)}>
                    {customer.kycStatus ? formatEnum(customer.kycStatus) : 'Not started'}
                  </Pill>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  AML check
                </dt>
                <dd>
                  <Pill tone={kycTone(customer.amlCheckStatus)}>
                    {customer.amlCheckStatus ? formatEnum(customer.amlCheckStatus) : 'Not run'}
                  </Pill>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  Risk rating
                </dt>
                <dd>
                  <Pill tone={riskTone(customer.riskRating)}>
                    {customer.riskRating ? formatEnum(customer.riskRating) : 'Not rated'}
                  </Pill>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  KYC completed
                </dt>
                <dd className="text-sm tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {formatDate(customer.kycCompletionDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  AML checked
                </dt>
                <dd className="text-sm tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {formatDate(customer.amlCheckDate)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setActiveTab('kyc')}
              className="mt-5 w-full rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Manage KYC and AML
            </button>
          </Panel>

          <Panel title="Intelligence signals">
            {intelligenceLoading ? (
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-2xl"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                ))}
              </div>
            ) : !intelligence || intelligence.activeSignals.length === 0 ? (
              <EmptyRow>No active signals — nothing requires attention right now.</EmptyRow>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {intelligence.activeSignals.map((sig, idx) => (
                  <li
                    key={`${sig.signalType}-${idx}`}
                    className="rounded-2xl px-5 py-4"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {formatEnum(sig.signalType)}
                      </p>
                      <Pill tone={severityTone(sig.severity)}>
                        {sig.severity ? formatEnum(sig.severity) : 'Unrated'} severity
                      </Pill>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
                      {sig.evidence?.applicationNumber
                        ? `${String(sig.evidence.applicationNumber)} · `
                        : ''}
                      Detected {formatDate(sig.detectedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {intelligence && intelligence.warnings.length > 0 && (
              <p className="mt-3 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                {intelligence.warnings.join(' ')}
              </p>
            )}
          </Panel>

          <Panel title="Proactive suggestions">
            {recommendationsLoading ? (
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-2xl"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <EmptyRow>No suggestions right now.</EmptyRow>
            ) : (
              <>
                {recommendationError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-2xl px-5 py-4 text-sm"
                    style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
                  >
                    {recommendationError}
                  </p>
                )}
                <ul className="mt-4 space-y-2.5">
                  {recommendations.map(rec => (
                    <li
                      key={rec.id}
                      className="rounded-2xl px-5 py-4"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    >
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {formatEnum(rec.recommendationType)}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {typeof rec.rationale?.reason === 'string'
                          ? rec.rationale.reason
                          : 'No rationale was provided with this suggestion.'}
                      </p>
                      <p className="mt-1 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                        Raised {formatDate(rec.createdAt)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRecommendationDecision(rec.id, 'accept')}
                          disabled={recommendationBusyId === rec.id}
                          className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{
                            backgroundColor: 'var(--rm-accent-muted)',
                            color: 'var(--rm-accent)',
                          }}
                        >
                          {recommendationBusyId === rec.id ? 'Working…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecommendationDecision(rec.id, 'dismiss')}
                          disabled={recommendationBusyId === rec.id}
                          className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{
                            backgroundColor: 'var(--rm-card)',
                            color: 'var(--rm-text-secondary)',
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Contact details">
            <dl className="mt-1 space-y-3">
              <ContactRow label="Email" value={customer.primaryEmail} icon={<MailIcon />} />
              {customer.primaryPhone && (
                <ContactRow label="Phone" value={customer.primaryPhone} icon={<PhoneIcon />} />
              )}
              {customer.mobilePhone && (
                <ContactRow label="Mobile" value={customer.mobilePhone} icon={<PhoneIcon />} />
              )}
              {(customer.city || customer.country) && (
                <ContactRow
                  label="Location"
                  value={[customer.city, customer.country].filter(Boolean).join(', ')}
                  icon={<PinIcon />}
                />
              )}
            </dl>
          </Panel>

          <Panel title="Suggested next steps">
            {nextSteps.length === 0 ? (
              <EmptyRow>Nothing outstanding — the relationship is in good standing.</EmptyRow>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {nextSteps.map(a => (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm hover:opacity-90"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    >
                      <span style={{ color: 'var(--rm-text)' }}>{a.label}</span>
                      <svg
                        className="w-4 h-4 shrink-0"
                        style={{ color: 'var(--rm-accent)' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Opportunity">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--rm-text-secondary)' }}>
              {buildOpportunity(customer, {
                deposits,
                exposure,
                products: activeAccounts.length,
              })}
            </p>
          </Panel>
        </div>
      </div>

      {/* ══ APPLICATIONS ══ */}
      <div
        role="tabpanel"
        id="tabpanel-applications"
        aria-labelledby="tab-applications"
        tabIndex={0}
        hidden={activeTab !== 'applications'}
      >
        <Panel title="Applications">
          {applications.length === 0 ? (
            <>
              <EmptyRow>No applications have been submitted for this customer.</EmptyRow>
              <Link
                href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                className="mt-5 inline-flex rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
              >
                Create the first application
              </Link>
            </>
          ) : (
            <div
              role="region"
              aria-label="Applications, horizontally scrollable"
              tabIndex={0}
              className="mt-4 -mx-2 overflow-x-auto"
            >
              <table className="w-full" aria-label="Applications for this customer">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <Th>Application number</Th>
                    <Th>Product</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(a => (
                    <tr
                      key={a.applicationId}
                      className="cursor-pointer"
                      style={{ borderBottom: '1px solid var(--rm-border)' }}
                      onClick={() => router.push(`/dashboard/applications/${a.applicationId}`)}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/applications/${a.applicationId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-base font-medium hover:underline"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {a.applicationNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {a.product?.productName || '—'}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base font-medium tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {formatCurrency(a.requestedAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <Pill tone={applicationStatusTone(a.lomsStatus || a.status)}>
                          {formatEnum(a.lomsStatus || a.status)}
                        </Pill>
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                        {formatDate(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ══ ACCOUNTS ══ */}
      <div
        role="tabpanel"
        id="tabpanel-accounts"
        aria-labelledby="tab-accounts"
        tabIndex={0}
        hidden={activeTab !== 'accounts'}
      >
        <Panel title="Accounts">
          {accounts.length === 0 ? (
            <>
              <EmptyRow>No accounts have been opened for this customer.</EmptyRow>
              <Link
                href={`/dashboard/accounts/new?customerId=${customer.customerId}`}
                className="mt-5 inline-flex rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
              >
                Open an account
              </Link>
            </>
          ) : (
            <div
              role="region"
              aria-label="Accounts, horizontally scrollable"
              tabIndex={0}
              className="mt-4 -mx-2 overflow-x-auto"
            >
              <table className="w-full" aria-label="Accounts for this customer">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <Th>Account</Th>
                    <Th>Type</Th>
                    <Th>Category</Th>
                    <Th align="right">Current balance</Th>
                    <Th align="right">Available</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr
                      key={a.accountId}
                      className="cursor-pointer"
                      style={{ borderBottom: '1px solid var(--rm-border)' }}
                      onClick={() => router.push(`/dashboard/accounts/${a.accountId}`)}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/accounts/${a.accountId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-base font-medium hover:underline"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {a.accountName}
                        </Link>
                        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {a.primaryIban || a.accountNumber}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {a.accountTypeDisplay || accountTypeLabels[a.accountType]}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {accountCategoryLabels[a.accountCategory]}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base font-medium tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {formatCurrency(a.currentBalance || 0, a.currency)}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--rm-text-secondary)' }}
                      >
                        {formatCurrency(a.availableBalance || 0, a.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <Pill tone={accountStatusTone(a.status)}>
                          {a.statusDisplay || accountStatusLabels[a.status]}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ══ DETAILS ══ */}
      <div
        role="tabpanel"
        id="tabpanel-details"
        aria-labelledby="tab-details"
        tabIndex={0}
        hidden={activeTab !== 'details'}
        className="space-y-6"
      >
        {saveMessage && (
          <p
            role={saveMessage.tone === 'error' ? 'alert' : 'status'}
            className="rounded-3xl px-6 py-5 text-sm"
            style={{
              backgroundColor:
                saveMessage.tone === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.14)',
              color: 'var(--rm-text)',
            }}
          >
            {saveMessage.text}
          </p>
        )}

        {isBusiness ? (
          <Section title="Business information">
            <Field label="Business name" k="businessName" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Legal name" k="businessLegalName" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Registration number" k="businessRegistrationNumber" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Business type" k="businessType" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Industry sector" k="industrySector" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Years in business" k="yearsInBusiness" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="number" />
            <Field label="Number of employees" k="numberOfEmployees" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="number" />
          </Section>
        ) : (
          <Section title="Personal information">
            <Field label="First name" k="firstName" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Middle name" k="middleName" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Last name" k="lastName" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
            <Field label="Date of birth" k="dateOfBirth" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="date" fmt={v => formatDate(v as string | undefined)} />
            <Field label="Gender" k="gender" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} options={GENDERS} />
            <Field label="Nationality" k="nationality" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} options={COUNTRIES} />
          </Section>
        )}

        <Section title="Contact information">
          <Field label="Email" k="primaryEmail" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="email" required />
          <Field label="Phone" k="primaryPhone" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="tel" required />
          <Field label="Mobile" k="mobilePhone" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="tel" />
          <Field label="Secondary email" k="secondaryEmail" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="email" />
        </Section>

        <Section title="Identity documents">
          <Field label="ID type" k="primaryIdentityType" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} options={IDENTITY_TYPES} />
          <Field label="ID number" k="primaryIdentityNumber" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
          <Field label="Tax reference or PPS" k="taxIdNumber" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
        </Section>

        <Section title="Address">
          <Field label="Address line 1" k="addressLine1" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
          <Field label="Address line 2" k="addressLine2" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
          <Field label="City" k="city" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
          <Field label="County or region" k="stateProvince" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
          <Field label="Eircode or postcode" k="postalCode" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
          <Field label="Country" k="country" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} options={COUNTRIES} />
        </Section>

        <Section title="Employment and financial">
          {!isBusiness && (
            <>
              <Field label="Employment status" k="employmentStatus" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} options={EMPLOYMENT_TYPES} />
              <Field label="Employer" k="employerName" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
              <Field label="Occupation" k="occupation" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} />
              <Field label="Annual income" k="annualIncome" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="number" fmt={v => (v ? formatCurrency(Number(v)) : '—')} />
            </>
          )}
          {isBusiness && (
            <Field label="Annual revenue" k="annualRevenue" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="number" fmt={v => (v ? formatCurrency(Number(v)) : '—')} />
          )}
          <Field label="Net worth" k="netWorth" c={customer} e={editedCustomer} ed={isEditing} err={fieldErrors} on={handleEditChange} type="number" fmt={v => (v ? formatCurrency(Number(v)) : '—')} />
          <ReadOnlyFact label="Credit score" value={customer.creditScore ? String(customer.creditScore) : '—'} />
          <ReadOnlyFact label="Risk rating" value={customer.riskRating ? formatEnum(customer.riskRating) : 'Not rated'} />
        </Section>

        {!isEditing && (
          <section className="rounded-3xl p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Remove this customer
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              Deactivating keeps the record recoverable. Permanent deletion cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
            >
              Remove customer
            </button>
          </section>
        )}
      </div>

      {/* ══ KYC ══ */}
      <div
        role="tabpanel"
        id="tabpanel-kyc"
        aria-labelledby="tab-kyc"
        tabIndex={0}
        hidden={activeTab !== 'kyc'}
      >
        <Panel
          title="KYC and AML status"
          action={
            <div className="flex gap-2.5 flex-wrap">
              {(!customer.kycStatus || /NOT_STARTED|PENDING|EXPIRED/.test(customer.kycStatus)) && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/dashboard/kyc/cases/new?customerId=${customer.customerId}`)
                  }
                  className="rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                >
                  Start KYC
                </button>
              )}
              <SecondaryButton
                onClick={() =>
                  router.push(`/dashboard/kyc/cases?customerId=${customer.customerId}`)
                }
              >
                View KYC cases
              </SecondaryButton>
            </div>
          }
        >
          <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                KYC status
              </dt>
              <dd className="mt-1.5">
                <Pill tone={kycTone(customer.kycStatus)}>
                  {customer.kycStatus ? formatEnum(customer.kycStatus) : 'Not started'}
                </Pill>
              </dd>
            </div>
            <Fact label="KYC completed" value={formatDate(customer.kycCompletionDate)} />
            <div>
              <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                AML status
              </dt>
              <dd className="mt-1.5">
                <Pill tone={kycTone(customer.amlCheckStatus)}>
                  {customer.amlCheckStatus ? formatEnum(customer.amlCheckStatus) : 'Not run'}
                </Pill>
              </dd>
            </div>
            <Fact label="AML checked" value={formatDate(customer.amlCheckDate)} />
          </dl>

          {(!customer.kycStatus || /NOT_STARTED|PENDING|EXPIRED/.test(customer.kycStatus)) && (
            <div
              className="mt-6 flex items-start gap-3 rounded-2xl px-5 py-4"
              style={{ backgroundColor: 'rgba(245,158,11,0.14)' }}
            >
              <svg
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: '#f59e0b' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <div>
                <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  KYC verification needed
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--rm-text-secondary)' }}>
                  This customer has not completed KYC and AML verification. Select “Start KYC” to
                  open a case.
                </p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ══ Footer ══ */}
      <p className="text-sm pb-2" style={{ color: 'var(--rm-text-muted)' }}>
        Figures are read from the customer, application and account records. The account summary
        endpoint does not return a balance as-at time, so no statement date is implied here.
      </p>

      {/* ══ Change status dialog ══ */}
      {showStatusModal && (
        <Dialog
          title="Change customer status"
          onClose={() => {
            if (!isSaving) setShowStatusModal(false);
          }}
        >
          <label
            htmlFor="customer-new-status"
            className="block text-sm mb-1.5"
            style={{ color: 'var(--rm-text-secondary)' }}
          >
            New status
          </label>
          <select
            id="customer-new-status"
            value={newStatus}
            onChange={e => setNewStatus(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm"
            style={{
              backgroundColor: 'var(--rm-input)',
              border: '1px solid var(--rm-border)',
              color: 'var(--rm-text)',
            }}
          >
            <option value="">Select a status</option>
            {CUSTOMER_STATUSES.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {statusError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl px-5 py-4 text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
            >
              {statusError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton onClick={() => setShowStatusModal(false)} disabled={isSaving}>
              Cancel
            </SecondaryButton>
            <button
              type="button"
              onClick={handleStatusChange}
              disabled={isSaving}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              {isSaving ? 'Updating…' : 'Update status'}
            </button>
          </div>
        </Dialog>
      )}

      {/* ══ Delete dialog ══ */}
      {showDeleteModal && (
        <Dialog
          title="Remove customer"
          onClose={() => {
            if (!isSaving) setShowDeleteModal(false);
          }}
        >
          <fieldset>
            <legend className="text-sm mb-3" style={{ color: 'var(--rm-text-secondary)' }}>
              How should this customer be removed?
            </legend>
            <div className="space-y-3">
              {(
                [
                  {
                    value: 'soft' as const,
                    title: 'Deactivate (recoverable)',
                    body: 'Marks the customer inactive. The record can be restored later.',
                  },
                  {
                    value: 'hard' as const,
                    title: 'Delete permanently',
                    body: 'Removes the customer record for good. This cannot be undone.',
                  },
                ]
              ).map(opt => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl px-5 py-4"
                  style={{
                    backgroundColor:
                      deleteType === opt.value ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                  }}
                >
                  <input
                    type="radio"
                    name="customer-delete-type"
                    value={opt.value}
                    checked={deleteType === opt.value}
                    onChange={() => setDeleteType(opt.value)}
                    className="mt-1"
                    style={{ accentColor: 'var(--rm-accent)' }}
                  />
                  <span>
                    <span className="block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {opt.title}
                    </span>
                    <span className="block text-sm mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
                      {opt.body}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {deleteError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl px-5 py-4 text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
            >
              {deleteError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton onClick={() => setShowDeleteModal(false)} disabled={isSaving}>
              Keep customer
            </SecondaryButton>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'rgba(220,38,38,1)' }}
            >
              {isSaving
                ? 'Working…'
                : deleteType === 'hard'
                  ? 'Delete permanently'
                  : 'Deactivate customer'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================================
// Copy builders — describe only what the loaded records support
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
      `The relationship holds ${m.products} active product${m.products > 1 ? 's' : ''}${m.exposure > 0 ? ` with total exposure of ${formatCurrency(m.exposure)}` : ''}${m.deposits > 0 ? ` and deposits of ${formatCurrency(m.deposits)}` : ''}.`
    );
  } else {
    parts.push('No products are currently active for this customer.');
  }
  parts.push(
    `The risk rating is ${c.riskRating ? formatEnum(c.riskRating).toLowerCase() : 'not yet assigned'} and the KYC status is ${c.kycStatus ? formatEnum(c.kycStatus).toLowerCase() : 'not started'}.`
  );
  if (m.openApps > 0)
    parts.push(
      `${m.openApps} application${m.openApps > 1 ? 's are' : ' is'} currently in progress.`
    );
  return parts.join(' ');
}

function buildOpportunity(
  c: Customer,
  m: { deposits: number; exposure: number; products: number }
): string {
  if (m.products === 0)
    return 'No products are booked yet. Onboarding and opening an initial account would activate this relationship.';
  if (m.deposits > 0 && m.exposure === 0)
    return 'There is a deposit base with no active lending, so credit or working-capital facilities could be explored.';
  if (m.exposure > 0 && m.deposits === 0)
    return 'This is an active borrower with no deposit relationship, so current or savings accounts could deepen it.';
  if (c.riskRating?.toUpperCase() === 'LOW')
    return 'A low risk rating with an established relationship suits premium product offers or limit increases.';
  return 'The relationship is balanced across deposits and lending. Monitor it for the next periodic review.';
}

// ============================================================================
// Presentational components
// ============================================================================

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
      style={{ backgroundColor: TONE_BG[tone], color: 'var(--rm-text)' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: TONE_DOT[tone] }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function SecondaryButton({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--rm-text-muted)' }}
    >
      {children}
    </th>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
      {children}
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}

function ReadOnlyFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </p>
      <p
        className="mt-1.5 text-xl font-semibold tabular-nums"
        style={{ color: 'var(--rm-text)' }}
      >
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--rm-text-muted)' }}>
        {hint}
      </p>
    </div>
  );
}

function ContactRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0" style={{ color: 'var(--rm-text-muted)' }} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {label}
        </dt>
        <dd className="text-base truncate" style={{ color: 'var(--rm-text)' }}>
          {value || '—'}
        </dd>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
        {title}
      </h2>
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

type FieldProps = {
  label: string;
  k: keyof Customer;
  c: Customer;
  e: Partial<Customer>;
  ed: boolean;
  err: Record<string, string>;
  on: (field: keyof Customer, value: string | number | null) => void;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  fmt?: (v: string | number | undefined) => string;
};

function Field({
  label,
  k,
  c,
  e,
  ed,
  err,
  on,
  type = 'text',
  required,
  options,
  fmt,
}: FieldProps) {
  const id = `customer-field-${String(k)}`;
  const errorId = `${id}-error`;
  const isRequired = required ?? REQUIRED_FIELDS.includes(k);
  const raw = (e[k] ?? c[k]) as string | number | undefined;
  const message = err[String(k)];

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    border: `1px solid ${message ? 'rgba(239,68,68,0.6)' : 'var(--rm-border)'}`,
    color: 'var(--rm-text)',
  };

  let display: string;
  if (options)
    display = options.find(o => o.value === c[k])?.label || (c[k] ? formatEnum(String(c[k])) : '—');
  else if (fmt) display = fmt(c[k] as string | number | undefined);
  else display = c[k] != null && c[k] !== '' ? String(c[k]) : '—';

  return (
    <div>
      <dt className="text-sm mb-1.5" style={{ color: 'var(--rm-text-muted)' }}>
        {ed ? (
          <label htmlFor={id}>
            {label}
            {isRequired && (
              <>
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </>
            )}
          </label>
        ) : (
          label
        )}
      </dt>
      <dd>
        {ed ? (
          <>
            {options ? (
              <select
                id={id}
                value={(raw as string) || ''}
                onChange={ev => on(k, ev.target.value)}
                required={isRequired}
                aria-required={isRequired || undefined}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? errorId : undefined}
                className="w-full rounded-xl px-4 py-2.5 text-sm"
                style={inputStyle}
              >
                <option value="">Select</option>
                {options.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={type}
                value={(raw as string | number) ?? ''}
                onChange={ev =>
                  on(
                    k,
                    type === 'number'
                      ? ev.target.value === ''
                        ? null
                        : parseFloat(ev.target.value)
                      : ev.target.value
                  )
                }
                required={isRequired}
                aria-required={isRequired || undefined}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? errorId : undefined}
                className="w-full rounded-xl px-4 py-2.5 text-sm"
                style={inputStyle}
              />
            )}
            {message && (
              <p id={errorId} role="alert" className="text-xs mt-1.5 text-red-700 dark:text-red-300">
                {message}
              </p>
            )}
          </>
        ) : (
          <p className="text-base" style={{ color: 'var(--rm-text)' }}>
            {display}
          </p>
        )}
      </dd>
    </div>
  );
}

/** Accessible modal: labelled, escape-to-close, focus moved in on open. */
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = `dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.55)' }}
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-3xl p-7"
        style={{ backgroundColor: 'var(--rm-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="mb-4 text-xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Icons (decorative)
// ============================================================================

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
