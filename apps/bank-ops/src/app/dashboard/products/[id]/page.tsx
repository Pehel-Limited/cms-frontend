'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { productService, type Product } from '@/services/api/productService';
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
