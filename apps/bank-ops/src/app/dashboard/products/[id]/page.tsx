'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  productService,
  type Product,
  type RatePlan,
  type CreateRatePlanRequest,
  type UpdateRatePlanRequest,
} from '@/services/api/productService';
import { useAppSelector } from '@/store';
import config from '@/config';
import { formatCurrency as sharedFormatCurrency } from '@/lib/format';

// ============================================================================
// Theme-aware colour map (hex → works in light & dark)
// ============================================================================

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#10b981',
  INACTIVE: '#64748b',
  DISCONTINUED: '#ef4444',
};

const PRODUCT_SVG: Record<string, React.ReactNode> = {
  PERSONAL_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  PCP: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M12 17h.01M16 17h.01M3 9h18M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  ),
  HIRE_PURCHASE: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  CREDIT_CARD: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  OVERDRAFT: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  MORTGAGE: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  HOME_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  AUTO_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M12 17h.01M16 17h.01M3 9h18M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  ),
  BUSINESS_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  SME_TERM_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

const DEFAULT_SVG = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { user } = useAppSelector(state => state.auth);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getBankId = useCallback((): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || '123e4567-e89b-12d3-a456-426614174000';
        } catch {
          return '123e4567-e89b-12d3-a456-426614174000';
        }
      }
    }
    return '123e4567-e89b-12d3-a456-426614174000';
  }, [user?.bankId]);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const bankId = getBankId();
        const products = await productService.getAllProducts(bankId);
        const found = products.find(p => p.productId === productId);

        if (!found) {
          setError('Product not found');
          return;
        }

        setProduct(found);
      } catch (err) {
        console.error('Failed to load product:', err);
        setError('Failed to load product. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
  }, [productId, getBankId]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await productService.deleteProduct(productId);
      router.push('/dashboard/products');
    } catch (err) {
      console.error('Failed to delete product:', err);
      setError('Failed to delete product. Please try again.');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'N/A';
    return sharedFormatCurrency(amount);
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatCustomerTypes = (types?: string[]): string => {
    if (!types || types.length === 0) return 'All Customer Types';
    if (types.length === 2) return 'All Customer Types';
    return types.map(t => (t === 'INDIVIDUAL' ? 'Individual' : 'Business')).join(', ');
  };

  // ------------------------------------------------------------------ loading
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-5">
          <div className="h-32 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
              ))}
            </div>
            <div className="space-y-5">
              {[1, 2].map(i => (
                <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- error
  if (error || !product) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>Error Loading Product</h3>
            <p className="mt-1" style={{ color: 'var(--rm-text-muted)' }}>{error || 'Product not found'}</p>
            <Link href="/dashboard/products" className="mt-4 inline-block text-sm font-medium" style={{ color: 'var(--rm-accent)' }}>
              ← Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const icon = PRODUCT_SVG[product.productType] || DEFAULT_SVG;
  const statusColor = STATUS_COLOR[product.productStatus] || '#64748b';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
      <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-5">
        {/* Back link */}
        <Link href="/dashboard/products" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
          Back to Products
        </Link>

        {/* Header */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                {icon}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--rm-text)' }}>{product.productName}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                    {product.productStatus}
                  </span>
                </div>
                <p className="mt-1 font-mono text-sm" style={{ color: 'var(--rm-text-muted)' }}>Code: {product.productCode}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => router.push(`/dashboard/products/${productId}/edit`)} className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors" style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-card)' }}>
                Edit
              </button>
              <button onClick={() => setDeleteConfirm(true)} className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
                Delete
              </button>
              <Link href={`/dashboard/applications/new?productId=${productId}`} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--rm-accent)' }}>
                + New Application
              </Link>
            </div>
          </div>

          {/* Info row */}
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4" style={{ borderColor: 'var(--rm-border)' }}>
            <InfoItem label="Category" value={product.productCategory?.replace(/_/g, ' ') || '—'} />
            <InfoItem label="Type" value={product.productType?.replace(/_/g, ' ') || '—'} />
            <InfoItem label="Eligible For" value={formatCustomerTypes(product.eligibleCustomerTypes)} />
            <InfoItem label="SLA" value={`${product.slaDays || 3} days`} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Description */}
            {(product.shortDescription || product.detailedDescription) && (
              <Panel>
                <PanelHeader title="Description" />
                {product.shortDescription && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>{product.shortDescription}</p>
                )}
                {product.detailedDescription && (
                  <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>{product.detailedDescription}</p>
                )}
              </Panel>
            )}

            {/* Financial Details */}
            <Panel>
              <PanelHeader icon={<CoinIcon />} title="Financial Details" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Loan Amount Range', value: `${formatCurrency(product.minLoanAmount)} – ${formatCurrency(product.maxLoanAmount)}` },
                  { label: 'Interest Rate Range', value: `${formatPercentage(product.minInterestRate)} – ${formatPercentage(product.maxInterestRate)}` },
                  { label: 'Term Range', value: `${product.minTermMonths} – ${product.maxTermMonths} months` },
                  { label: 'Interest Type', value: product.interestType },
                  { label: 'Processing Fee', value: product.processingFeePercentage ? formatPercentage(product.processingFeePercentage) : formatCurrency(product.processingFee) },
                  { label: 'Repayment Frequency', value: product.repaymentFrequency || 'Monthly' },
                ].map(item => (
                  <Tile key={item.label} label={item.label} value={String(item.value ?? '—')} />
                ))}
              </div>
            </Panel>

            {/* Rate Plans */}
            <RatePlansPanel productId={productId} />

            {/* Eligibility Criteria */}
            <Panel>
              <PanelHeader icon={<ShieldIcon />} title="Eligibility Criteria" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Customer Age', value: `${product.minCustomerAge || 18} – ${product.maxCustomerAge || 65} years` },
                  { label: 'Min Credit Score', value: product.minCreditScore || 'N/A' },
                  { label: 'Min Annual Income', value: formatCurrency(product.minAnnualIncome) },
                  { label: 'Min Years in Business', value: product.minYearsInBusiness || 'N/A' },
                ].map(item => (
                  <Tile key={item.label} label={item.label} value={String(item.value)} />
                ))}
              </div>
            </Panel>

            {/* Regulatory & EU Details */}
            {(product.regulatoryBody || product.interestLogicDescription || product.principalStructure) && (
              <Panel>
                <PanelHeader icon={<DocIcon />} title="Regulatory & EU Details" />
                <div className="mt-4 space-y-4">
                  {product.regulatoryBody && <DetailRow label="Regulatory Body" value={product.regulatoryBody} />}
                  {product.interestLogicDescription && <DetailRow label="Interest Logic" value={product.interestLogicDescription} />}
                  {product.principalStructure && <DetailRow label="Principal Structure" value={product.principalStructure} />}
                </div>
              </Panel>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Features */}
            <Panel>
              <PanelHeader title="Features" />
              <ul className="mt-3 space-y-2.5">
                {[
                  { enabled: product.prepaymentAllowed, label: 'Prepayment Allowed', warn: false },
                  { enabled: !product.collateralRequired, label: product.collateralRequired ? 'Collateral Required' : 'No Collateral', warn: product.collateralRequired },
                  { enabled: product.isOnlineApplicationEnabled, label: 'Online Application', warn: false },
                  { enabled: product.autoApprovalEnabled, label: 'Auto-Approval', warn: false },
                  { enabled: !product.requiresGuarantor, label: product.requiresGuarantor ? 'Guarantor Required' : 'No Guarantor', warn: product.requiresGuarantor },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-2.5 text-sm">
                    <FeatureIcon warn={!!item.warn} enabled={!!item.enabled} />
                    <span style={{ color: 'var(--rm-text-secondary)' }}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Quick Actions */}
            <Panel>
              <PanelHeader title="Quick Actions" />
              <div className="mt-3 space-y-2">
                <Link href={`/dashboard/applications/new?productId=${productId}`} className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--rm-accent)' }}>
                  Create Application
                </Link>
                <Link href={`/dashboard/products/${productId}/edit`} className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors" style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}>
                  Edit Product
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                <svg className="h-6 w-6" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>Delete Product</h3>
            <p className="mb-6 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Are you sure you want to delete &quot;{product.productName}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteConfirm(false)} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50" style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#ef4444' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Rate Plans management
// ============================================================================

const RATE_TYPE_OPTIONS = ['VARIABLE', 'FIXED', 'GREEN_FIXED', 'GREEN_VARIABLE'];

type RatePlanFormState = {
  planCode: string;
  label: string;
  rateType: string;
  ltvMinPercentage: string;
  ltvMaxPercentage: string;
  fixedTermYears: string;
  interestRate: string;
  aprc: string;
  costPerThousand: string;
  isGreen: boolean;
  displayOrder: string;
  isActive: boolean;
};

const EMPTY_RATE_PLAN_FORM: RatePlanFormState = {
  planCode: '',
  label: '',
  rateType: 'FIXED',
  ltvMinPercentage: '',
  ltvMaxPercentage: '',
  fixedTermYears: '',
  interestRate: '',
  aprc: '',
  costPerThousand: '',
  isGreen: false,
  displayOrder: '0',
  isActive: true,
};

function ratePlanToForm(plan: RatePlan): RatePlanFormState {
  return {
    planCode: plan.planCode,
    label: plan.label,
    rateType: plan.rateType,
    ltvMinPercentage: plan.ltvMinPercentage?.toString() ?? '',
    ltvMaxPercentage: plan.ltvMaxPercentage?.toString() ?? '',
    fixedTermYears: plan.fixedTermYears?.toString() ?? '',
    interestRate: plan.interestRate?.toString() ?? '',
    aprc: plan.aprc?.toString() ?? '',
    costPerThousand: plan.costPerThousand?.toString() ?? '',
    isGreen: !!plan.isGreen,
    displayOrder: plan.displayOrder?.toString() ?? '0',
    isActive: plan.isActive !== false,
  };
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function formToRequest(form: RatePlanFormState): CreateRatePlanRequest {
  return {
    planCode: form.planCode.trim().toUpperCase(),
    label: form.label.trim(),
    rateType: form.rateType,
    ltvMinPercentage: parseOptionalNumber(form.ltvMinPercentage),
    ltvMaxPercentage: parseOptionalNumber(form.ltvMaxPercentage),
    fixedTermYears: parseOptionalNumber(form.fixedTermYears),
    interestRate: Number(form.interestRate),
    aprc: parseOptionalNumber(form.aprc),
    costPerThousand: parseOptionalNumber(form.costPerThousand),
    isGreen: form.isGreen,
    displayOrder: parseOptionalNumber(form.displayOrder) ?? 0,
    isActive: form.isActive,
  };
}

function RatePlansPanel({ productId }: { productId: string }) {
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);
  const [form, setForm] = useState<RatePlanFormState>(EMPTY_RATE_PLAN_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RatePlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRatePlans = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const plans = await productService.getRatePlans(productId, false);
      setRatePlans(plans);
    } catch (err) {
      console.error('Failed to load rate plans:', err);
      setLoadError('Failed to load rate plans.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadRatePlans();
  }, [loadRatePlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm(EMPTY_RATE_PLAN_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (plan: RatePlan) => {
    setEditingPlan(plan);
    setForm(ratePlanToForm(plan));
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.planCode.trim() || !form.label.trim() || form.interestRate.trim() === '') {
      setFormError('Plan code, label and interest rate are required.');
      return;
    }
    if (!/^[A-Z0-9_]+$/.test(form.planCode.trim().toUpperCase())) {
      setFormError('Plan code must contain only letters, digits and underscores.');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const request = formToRequest(form);

      if (editingPlan) {
        const update: UpdateRatePlanRequest = request;
        await productService.updateRatePlan(productId, editingPlan.ratePlanId, update);
      } else {
        await productService.createRatePlan(productId, request);
      }

      setShowModal(false);
      await loadRatePlans();
    } catch (err: unknown) {
      console.error('Failed to save rate plan:', err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save rate plan. Please check the values and try again.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await productService.deleteRatePlan(productId, deleteTarget.ratePlanId);
      setDeleteTarget(null);
      await loadRatePlans();
    } catch (err) {
      console.error('Failed to delete rate plan:', err);
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (plan: RatePlan) => {
    try {
      await productService.updateRatePlan(productId, plan.ratePlanId, { isActive: !plan.isActive });
      await loadRatePlans();
    } catch (err) {
      console.error('Failed to toggle rate plan status:', err);
    }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <PanelHeader icon={<CoinIcon />} title="Rate Plans" />
        <button
          onClick={openCreateModal}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--rm-accent)' }}
        >
          + Add Rate Plan
        </button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
          ))}
        </div>
      ) : loadError ? (
        <p className="mt-4 text-sm" style={{ color: '#ef4444' }}>{loadError}</p>
      ) : ratePlans.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          No rate plans configured yet. Add one so customers see real, admin-managed rates instead of a generic range.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: 'var(--rm-text-muted)' }}>
                <th className="pb-2 pr-3 font-medium">Plan</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">LTV</th>
                <th className="pb-2 pr-3 font-medium">Term</th>
                <th className="pb-2 pr-3 font-medium">Rate</th>
                <th className="pb-2 pr-3 font-medium">APRC</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ratePlans.map(plan => (
                <tr key={plan.ratePlanId} className="border-t" style={{ borderColor: 'var(--rm-border)' }}>
                  <td className="py-2 pr-3">
                    <div className="font-medium" style={{ color: 'var(--rm-text)' }}>
                      {plan.label} {plan.isGreen && <span className="ml-1 text-xs" style={{ color: '#10b981' }}>🌱</span>}
                    </div>
                    <div className="font-mono text-xs" style={{ color: 'var(--rm-text-muted)' }}>{plan.planCode}</div>
                  </td>
                  <td className="py-2 pr-3" style={{ color: 'var(--rm-text-secondary)' }}>{plan.rateType.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-3" style={{ color: 'var(--rm-text-secondary)' }}>
                    {plan.ltvMinPercentage != null || plan.ltvMaxPercentage != null
                      ? `${plan.ltvMinPercentage ?? 0}–${plan.ltvMaxPercentage ?? 100}%`
                      : '—'}
                  </td>
                  <td className="py-2 pr-3" style={{ color: 'var(--rm-text-secondary)' }}>
                    {plan.fixedTermYears ? `${plan.fixedTermYears} yr fixed` : 'Variable'}
                  </td>
                  <td className="py-2 pr-3 font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {Number(plan.interestRate).toFixed(2)}%
                  </td>
                  <td className="py-2 pr-3 tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                    {plan.aprc != null ? `${Number(plan.aprc).toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => toggleActive(plan)}
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: plan.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.15)',
                        color: plan.isActive ? '#10b981' : '#64748b',
                      }}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(plan)} className="text-xs font-semibold" style={{ color: 'var(--rm-accent)' }}>
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(plan)} className="text-xs font-semibold" style={{ color: '#ef4444' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowModal(false)}>
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
              {editingPlan ? 'Edit Rate Plan' : 'Add Rate Plan'}
            </h3>

            {formError && (
              <p className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {formError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Plan Code" span={2}>
                <input
                  value={form.planCode}
                  onChange={e => setForm({ ...form, planCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. FIXED_3YR_LTV"
                  disabled={!!editingPlan}
                  className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="Label" span={2}>
                <input
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. 3 Year LTV Fixed"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="Rate Type">
                <select
                  value={form.rateType}
                  onChange={e => setForm({ ...form, rateType: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                >
                  {RATE_TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Interest Rate (%)">
                <input
                  type="number"
                  step="0.01"
                  value={form.interestRate}
                  onChange={e => setForm({ ...form, interestRate: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="LTV Min (%)">
                <input
                  type="number"
                  step="0.01"
                  value={form.ltvMinPercentage}
                  onChange={e => setForm({ ...form, ltvMinPercentage: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="LTV Max (%)">
                <input
                  type="number"
                  step="0.01"
                  value={form.ltvMaxPercentage}
                  onChange={e => setForm({ ...form, ltvMaxPercentage: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="Fixed Term (years)">
                <input
                  type="number"
                  value={form.fixedTermYears}
                  onChange={e => setForm({ ...form, fixedTermYears: e.target.value })}
                  placeholder="Blank = variable"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="APRC (%)">
                <input
                  type="number"
                  step="0.01"
                  value={form.aprc}
                  onChange={e => setForm({ ...form, aprc: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="Cost per €1,000">
                <input
                  type="number"
                  step="0.01"
                  value={form.costPerThousand}
                  onChange={e => setForm({ ...form, costPerThousand: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <FormField label="Display Order">
                <input
                  type="number"
                  value={form.displayOrder}
                  onChange={e => setForm({ ...form, displayOrder: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-bg)', color: 'var(--rm-text)' }}
                />
              </FormField>
              <div className="col-span-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  <input type="checkbox" checked={form.isGreen} onChange={e => setForm({ ...form, isGreen: e.target.checked })} />
                  Green / sustainability discount
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                  Active
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {saving ? 'Saving…' : editingPlan ? 'Save Changes' : 'Add Rate Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }} onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-center text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>Delete Rate Plan</h3>
            <p className="mb-6 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Are you sure you want to delete &quot;{deleteTarget.label}&quot;? This cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50" style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#ef4444' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? 'col-span-2' : undefined}>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rm-text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

// ============================================================================
// Presentational helpers
// ============================================================================

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>{children}</div>;
}

function PanelHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}>{icon}</span>}
      <h3 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</h3>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="mt-1 text-sm font-medium capitalize" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}>
      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="text-sm" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function FeatureIcon({ warn, enabled }: { warn: boolean; enabled: boolean }) {
  const color = warn ? '#f59e0b' : enabled ? '#10b981' : '#64748b';
  const path = warn ? 'M12 9v2m0 4h.01' : enabled ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12';
  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22` }}>
      <svg className="h-3.5 w-3.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
      </svg>
    </span>
  );
}

function CoinIcon() {
  return (<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
}

function ShieldIcon() {
  return (<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>);
}

function DocIcon() {
  return (<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>);
}
