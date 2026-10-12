'use client';

import { useCallback, useEffect, useState } from 'react';
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
// Theme-aware colour map (translucent tints read on light and dark surfaces)
// ============================================================================

const STATUS_TINT: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: { bg: 'rgba(16,185,129,0.14)', text: '#059669', dot: '#10b981' },
  INACTIVE: { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-secondary)', dot: '#94a3b8' },
  DISCONTINUED: { bg: 'rgba(239,68,68,0.13)', text: '#b91c1c', dot: '#ef4444' },
};

const PRODUCT_SVG: Record<string, React.ReactNode> = {
  PERSONAL_LOAN: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  PCP: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M12 17h.01M16 17h.01M3 9h18M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  ),
  HIRE_PURCHASE: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  CREDIT_CARD: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  OVERDRAFT: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  MORTGAGE: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  HOME_LOAN: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  AUTO_LOAN: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M12 17h.01M16 17h.01M3 9h18M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  ),
  BUSINESS_LOAN: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  SME_TERM_LOAN: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

const DEFAULT_SVG = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

function humanize(value?: string): string {
  if (!value) return '—';
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return apiMessage || fallback;
}

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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const getBankId = useCallback((): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  }, [user?.bankId]);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bankId = getBankId();
      const products = await productService.getAllProducts(bankId);
      const found = (products ?? []).find(p => p.productId === productId);
      if (!found) {
        setProduct(null);
        setError('This product is no longer in the catalogue.');
        return;
      }
      setProduct(found);
    } catch (err) {
      console.error('Failed to load product:', err);
      setError('We could not load this product. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getBankId, productId]);

  useEffect(() => {
    if (productId) loadProduct();
  }, [productId, loadProduct]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        setDeleteConfirm(false);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteConfirm, deleting]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await productService.deleteProduct(productId);
      router.push('/dashboard/products');
    } catch (err) {
      console.error('Failed to delete product:', err);
      // Scoped to the dialog so the product page is never blanked out.
      setDeleteError('We could not delete this product. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const formatAmount = (amount?: number) =>
    amount === undefined || amount === null ? '—' : sharedFormatCurrency(amount);

  const formatPercentage = (value?: number) =>
    value === undefined || value === null ? '—' : `${value.toFixed(2)}%`;

  const formatCustomerTypes = (types?: string[]): string => {
    if (!types || types.length === 0 || types.length === 2) return 'All customer types';
    return types.map(t => (t === 'INDIVIDUAL' ? 'Individual' : 'Business')).join(', ');
  };

  // ------------------------------------------------------------------ loading
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
            ))}
          </div>
        </div>
        <p className="sr-only" role="status">
          Loading product
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------- error
  if (error || !product) {
    return (
      <div className="space-y-6">
        <section
          role="alert"
          className="rounded-3xl px-6 py-16 text-center"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          <p className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
            We could not load this product
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {error || 'Product not found'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={loadProduct}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              Try again
            </button>
            <Link
              href="/dashboard/products"
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Back to products
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const icon = PRODUCT_SVG[product.productType] || DEFAULT_SVG;
  const tint = STATUS_TINT[product.productStatus] || STATUS_TINT.INACTIVE;

  return (
    <div className="space-y-6" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back to products
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                  {product.productName}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: tint.bg, color: tint.text }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tint.dot }}
                    aria-hidden="true"
                  />
                  {humanize(product.productStatus)}
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {product.productCode} · {humanize(product.productCategory)} ·{' '}
                {humanize(product.productType)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirm(true);
              }}
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(239,68,68,0.13)', color: '#b91c1c' }}
            >
              Delete
            </button>
            <button
              onClick={() => router.push(`/dashboard/products/${productId}/edit`)}
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Edit product
            </button>
            <Link
              href={`/dashboard/applications/new?productId=${productId}`}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              New application
            </Link>
          </div>
        </div>

        <dl
          className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-6 sm:grid-cols-4"
          style={{ borderColor: 'var(--rm-border)' }}
        >
          <InfoItem label="Category" value={humanize(product.productCategory)} />
          <InfoItem label="Product type" value={humanize(product.productType)} />
          <InfoItem label="Eligible for" value={formatCustomerTypes(product.eligibleCustomerTypes)} />
          <InfoItem
            label="Decision SLA"
            value={product.slaDays ? `${product.slaDays} days` : '—'}
          />
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {(product.shortDescription || product.detailedDescription) && (
            <Panel>
              <PanelHeader title="Description" headingId="product-description" />
              {product.shortDescription && (
                <p className="mt-4 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
                  {product.shortDescription}
                </p>
              )}
              {product.detailedDescription && (
                <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {product.detailedDescription}
                </p>
              )}
            </Panel>
          )}

          <Panel>
            <PanelHeader icon={<CoinIcon />} title="Pricing and terms" headingId="financial-details" />
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile
                label="Loan amount range"
                value={`${formatAmount(product.minLoanAmount)} – ${formatAmount(product.maxLoanAmount)}`}
              />
              <Tile
                label="Interest rate range"
                value={`${formatPercentage(product.minInterestRate)} – ${formatPercentage(product.maxInterestRate)}`}
              />
              <Tile
                label="Term range"
                value={
                  product.minTermMonths != null && product.maxTermMonths != null
                    ? `${product.minTermMonths} – ${product.maxTermMonths} months`
                    : '—'
                }
              />
              <Tile label="Interest type" value={humanize(product.interestType)} />
              <Tile
                label="Processing fee"
                value={
                  product.processingFeePercentage
                    ? formatPercentage(product.processingFeePercentage)
                    : product.processingFee != null
                      ? formatAmount(product.processingFee)
                      : '—'
                }
              />
              <Tile label="Repayment frequency" value={humanize(product.repaymentFrequency)} />
              <Tile
                label="Default amount"
                value={formatAmount(product.defaultLoanAmount)}
              />
              <Tile
                label="Late payment fee"
                value={product.latePaymentFee != null ? formatAmount(product.latePaymentFee) : '—'}
              />
            </dl>
          </Panel>

          <RatePlansPanel productId={productId} />

          <Panel>
            <PanelHeader icon={<ShieldIcon />} title="Eligibility" headingId="eligibility" />
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile
                label="Customer age"
                value={
                  product.minCustomerAge != null || product.maxCustomerAge != null
                    ? `${product.minCustomerAge ?? '—'} – ${product.maxCustomerAge ?? '—'} years`
                    : '—'
                }
              />
              <Tile
                label="Minimum credit score"
                value={product.minCreditScore != null ? String(product.minCreditScore) : '—'}
              />
              <Tile label="Minimum annual income" value={formatAmount(product.minAnnualIncome)} />
              <Tile
                label="Minimum years in business"
                value={product.minYearsInBusiness != null ? String(product.minYearsInBusiness) : '—'}
              />
              <Tile
                label="Minimum business revenue"
                value={formatAmount(product.minBusinessRevenue)}
              />
              <Tile
                label="Loan to value ratio"
                value={
                  product.loanToValueRatio != null ? `${product.loanToValueRatio}%` : '—'
                }
              />
            </dl>
          </Panel>

          {(product.regulatoryBody ||
            product.interestLogicDescription ||
            product.principalStructure ||
            product.termsAndConditions) && (
            <Panel>
              <PanelHeader icon={<DocIcon />} title="Regulatory and EU details" headingId="regulatory" />
              <dl className="mt-4 space-y-4">
                {product.regulatoryBody && (
                  <DetailRow label="Regulatory body" value={humanize(product.regulatoryBody)} />
                )}
                {product.interestLogicDescription && (
                  <DetailRow label="Interest logic" value={product.interestLogicDescription} />
                )}
                {product.principalStructure && (
                  <DetailRow label="Principal structure" value={product.principalStructure} />
                )}
                {product.termsAndConditions && (
                  <DetailRow label="Terms and conditions" value={product.termsAndConditions} />
                )}
              </dl>
            </Panel>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Features" headingId="features" />
            <ul className="mt-4 space-y-3">
              {[
                { enabled: product.prepaymentAllowed === true, label: product.prepaymentAllowed ? 'Prepayment allowed' : 'Prepayment not allowed', warn: false },
                {
                  enabled: !product.collateralRequired,
                  label: product.collateralRequired ? 'Collateral required' : 'No collateral required',
                  warn: product.collateralRequired === true,
                },
                {
                  enabled: product.isOnlineApplicationEnabled === true,
                  label: product.isOnlineApplicationEnabled
                    ? 'Online applications enabled'
                    : 'Online applications disabled',
                  warn: false,
                },
                {
                  enabled: product.autoApprovalEnabled === true,
                  label: product.autoApprovalEnabled ? 'Auto-approval enabled' : 'Auto-approval disabled',
                  warn: false,
                },
                {
                  enabled: !product.requiresGuarantor,
                  label: product.requiresGuarantor ? 'Guarantor required' : 'No guarantor required',
                  warn: product.requiresGuarantor === true,
                },
                {
                  enabled: product.isFeatured === true,
                  label: product.isFeatured ? 'Featured product' : 'Not featured',
                  warn: false,
                },
              ].map(item => (
                <li key={item.label} className="flex items-center gap-2.5">
                  <FeatureIcon warn={item.warn} enabled={item.enabled} />
                  <span className="text-base" style={{ color: 'var(--rm-text-secondary)' }}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {(product.autoApprovalEnabled || product.collateralRequired) && (
            <Panel>
              <PanelHeader title="Auto-approval limits" headingId="auto-approval" />
              <dl className="mt-4 space-y-3">
                {product.autoApprovalMaxAmount != null && (
                  <DetailRow
                    label="Maximum amount"
                    value={formatAmount(product.autoApprovalMaxAmount)}
                  />
                )}
                {product.autoApprovalMinCreditScore != null && (
                  <DetailRow
                    label="Minimum credit score"
                    value={String(product.autoApprovalMinCreditScore)}
                  />
                )}
                {product.autoApprovalMaxAmount == null &&
                  product.autoApprovalMinCreditScore == null && (
                    <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Auto-approval is enabled without configured limits.
                    </p>
                  )}
              </dl>
            </Panel>
          )}
        </div>
      </div>

      {/* ══ Delete confirmation ══ */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
          onClick={() => {
            if (!deleting) {
              setDeleteConfirm(false);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            aria-describedby="delete-product-body"
            className="w-full max-w-md rounded-3xl p-7"
            style={{ backgroundColor: 'var(--rm-card)' }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape' && !deleting) {
                setDeleteConfirm(false);
                setDeleteError(null);
              }
            }}
          >
            <h2 id="delete-product-title" className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
              Delete {product.productName}?
            </h2>
            <p id="delete-product-body" className="mt-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              This removes the product and its rate plans from the catalogue. It cannot be undone.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: 'var(--rm-text)' }}
              >
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                onClick={() => {
                  setDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'rgba(220,38,38,0.92)' }}
              >
                {deleting ? 'Deleting…' : 'Delete product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Rate plans management
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
  const [listError, setListError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);
  const [form, setForm] = useState<RatePlanFormState>(EMPTY_RATE_PLAN_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RatePlan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadRatePlans = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const plans = await productService.getRatePlans(productId, false);
      setRatePlans(plans ?? []);
    } catch (err) {
      console.error('Failed to load rate plans:', err);
      setLoadError('We could not load the rate plans for this product.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadRatePlans();
  }, [loadRatePlans]);

  useEffect(() => {
    if (!showModal && !deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget && !deleting) {
        setDeleteTarget(null);
        setDeleteError(null);
      } else if (showModal && !saving) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal, deleteTarget, saving, deleting]);

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

    setSaving(true);
    setFormError(null);
    try {
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
      // The dialog stays open with everything the user typed intact.
      setFormError(errorMessage(err, 'We could not save the rate plan. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await productService.deleteRatePlan(productId, deleteTarget.ratePlanId);
      setDeleteTarget(null);
      await loadRatePlans();
    } catch (err) {
      console.error('Failed to delete rate plan:', err);
      setDeleteError('We could not delete this rate plan. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (plan: RatePlan) => {
    setListError(null);
    try {
      await productService.updateRatePlan(productId, plan.ratePlanId, { isActive: !plan.isActive });
      await loadRatePlans();
    } catch (err) {
      console.error('Failed to toggle rate plan status:', err);
      setListError(
        `We could not ${plan.isActive ? 'deactivate' : 'activate'} “${plan.label}”. Please try again.`
      );
    }
  };

  const fieldId = (key: keyof RatePlanFormState) => `rate-plan-${key}`;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PanelHeader icon={<CoinIcon />} title="Rate plans" headingId="rate-plans" />
        <button
          onClick={openCreateModal}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--rm-accent)' }}
        >
          Add rate plan
        </button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-2xl"
              style={{ backgroundColor: 'var(--rm-card-hover)' }}
            />
          ))}
          <p className="sr-only" role="status">
            Loading rate plans
          </p>
        </div>
      ) : loadError ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="min-w-0 flex-1 text-sm" style={{ color: 'var(--rm-text)' }}>
            {loadError}
          </p>
          <button
            onClick={loadRatePlans}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)' }}
          >
            Try again
          </button>
        </div>
      ) : ratePlans.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          No rate plans configured yet. Add one so customers see admin-managed rates instead of a
          generic range.
        </p>
      ) : (
        <>
          {listError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: 'var(--rm-text)' }}
            >
              {listError}
            </p>
          )}
          <div
            className="mt-4 overflow-x-auto"
            role="region"
            aria-label="Rate plans, scrollable"
            tabIndex={0}
          >
            <table className="w-full text-left" aria-label="Rate plans">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                  <Th>Plan</Th>
                  <Th>Type</Th>
                  <Th>LTV</Th>
                  <Th>Term</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">APRC</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {ratePlans.map(plan => (
                  <tr key={plan.ratePlanId} style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <td className="px-5 py-4">
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {plan.label}
                        {plan.isGreen && (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-sm font-medium"
                            style={{
                              backgroundColor: 'rgba(16,185,129,0.14)',
                              color: '#047857',
                            }}
                          >
                            Green
                          </span>
                        )}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {plan.planCode}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {humanize(plan.rateType)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                        {plan.ltvMinPercentage != null || plan.ltvMaxPercentage != null
                          ? `${plan.ltvMinPercentage ?? 0}–${plan.ltvMaxPercentage ?? 100}%`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {plan.fixedTermYears ? `${plan.fixedTermYears} year fixed` : 'Variable'}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-right text-base font-semibold tabular-nums"
                      style={{ color: 'var(--rm-text)' }}
                    >
                      {Number(plan.interestRate).toFixed(2)}%
                    </td>
                    <td
                      className="px-5 py-4 text-right text-sm tabular-nums"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      {plan.aprc != null ? `${Number(plan.aprc).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => toggleActive(plan)}
                        className="rounded-full px-3 py-1 text-sm font-medium transition-opacity hover:opacity-80"
                        style={{
                          backgroundColor: plan.isActive
                            ? 'rgba(16,185,129,0.14)'
                            : 'rgba(127,127,127,0.14)',
                          color: plan.isActive ? '#047857' : 'var(--rm-text-secondary)',
                        }}
                        aria-label={`${plan.isActive ? 'Deactivate' : 'Activate'} the ${plan.label} rate plan`}
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditModal(plan)}
                          className="text-sm font-medium hover:underline"
                          style={{ color: 'var(--rm-accent)' }}
                        >
                          Edit<span className="sr-only"> {plan.label}</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(plan);
                          }}
                          className="text-sm font-medium hover:underline"
                          style={{ color: '#b91c1c' }}
                        >
                          Delete<span className="sr-only"> {plan.label}</span>
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / edit dialog */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
          onClick={() => {
            if (!saving) setShowModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rate-plan-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-7"
            style={{ backgroundColor: 'var(--rm-card)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 id="rate-plan-title" className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
              {editingPlan ? `Edit ${editingPlan.label}` : 'Add rate plan'}
            </h3>

            {formError && (
              <p
                role="alert"
                className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: 'var(--rm-text)' }}
              >
                {formError}
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id={fieldId('planCode')}
                label="Plan code"
                required
                span={2}
                hint="Letters, digits and underscores only"
              >
                <input
                  id={fieldId('planCode')}
                  value={form.planCode}
                  onChange={e => setForm({ ...form, planCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. FIXED_3YR_LTV"
                  disabled={!!editingPlan}
                  required
                  aria-required="true"
                  aria-describedby={`${fieldId('planCode')}-hint`}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base disabled:opacity-60"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('label')} label="Label" required span={2}>
                <input
                  id={fieldId('label')}
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. 3 year LTV fixed"
                  required
                  aria-required="true"
                  className="w-full rounded-xl px-3.5 py-2.5 text-base"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('rateType')} label="Rate type">
                <select
                  id={fieldId('rateType')}
                  value={form.rateType}
                  onChange={e => setForm({ ...form, rateType: e.target.value })}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base"
                  style={inputStyle}
                >
                  {RATE_TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id={fieldId('interestRate')} label="Interest rate (%)" required>
                <input
                  id={fieldId('interestRate')}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={form.interestRate}
                  onChange={e => setForm({ ...form, interestRate: e.target.value })}
                  required
                  aria-required="true"
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('ltvMinPercentage')} label="LTV minimum (%)">
                <input
                  id={fieldId('ltvMinPercentage')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  value={form.ltvMinPercentage}
                  onChange={e => setForm({ ...form, ltvMinPercentage: e.target.value })}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('ltvMaxPercentage')} label="LTV maximum (%)">
                <input
                  id={fieldId('ltvMaxPercentage')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  value={form.ltvMaxPercentage}
                  onChange={e => setForm({ ...form, ltvMaxPercentage: e.target.value })}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <FormField
                id={fieldId('fixedTermYears')}
                label="Fixed term (years)"
                hint="Leave blank for a variable rate"
              >
                <input
                  id={fieldId('fixedTermYears')}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.fixedTermYears}
                  onChange={e => setForm({ ...form, fixedTermYears: e.target.value })}
                  aria-describedby={`${fieldId('fixedTermYears')}-hint`}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('aprc')} label="APRC (%)">
                <input
                  id={fieldId('aprc')}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={form.aprc}
                  onChange={e => setForm({ ...form, aprc: e.target.value })}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('costPerThousand')} label="Cost per €1,000">
                <input
                  id={fieldId('costPerThousand')}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={form.costPerThousand}
                  onChange={e => setForm({ ...form, costPerThousand: e.target.value })}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <FormField id={fieldId('displayOrder')} label="Display order">
                <input
                  id={fieldId('displayOrder')}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.displayOrder}
                  onChange={e => setForm({ ...form, displayOrder: e.target.value })}
                  className="w-full rounded-xl px-3.5 py-2.5 text-base tabular-nums"
                  style={inputStyle}
                />
              </FormField>

              <div className="sm:col-span-2">
                <fieldset>
                  <legend className="mb-2 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                    Flags
                  </legend>
                  <div className="flex flex-wrap items-center gap-5">
                    <label
                      htmlFor="rate-plan-isGreen"
                      className="flex items-center gap-2 text-base"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      <input
                        id="rate-plan-isGreen"
                        type="checkbox"
                        checked={form.isGreen}
                        onChange={e => setForm({ ...form, isGreen: e.target.checked })}
                        className="h-4 w-4"
                        style={{ accentColor: 'var(--rm-accent)' }}
                      />
                      Green or sustainability discount
                    </label>
                    <label
                      htmlFor="rate-plan-isActive"
                      className="flex items-center gap-2 text-base"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      <input
                        id="rate-plan-isActive"
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => setForm({ ...form, isActive: e.target.checked })}
                        className="h-4 w-4"
                        style={{ accentColor: 'var(--rm-accent)' }}
                      />
                      Active
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={handleSave}
                disabled={saving}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {saving ? 'Saving…' : editingPlan ? 'Save changes' : 'Add rate plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
          onClick={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-rate-plan-title"
            aria-describedby="delete-rate-plan-body"
            className="w-full max-w-md rounded-3xl p-7"
            style={{ backgroundColor: 'var(--rm-card)' }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape' && !deleting) {
                setDeleteTarget(null);
                setDeleteError(null);
              }
            }}
          >
            <h3 id="delete-rate-plan-title" className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
              Delete {deleteTarget.label}?
            </h3>
            <p id="delete-rate-plan-body" className="mt-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              This rate plan will no longer be offered on the product. It cannot be undone.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: 'var(--rm-text)' }}
              >
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'rgba(220,38,38,0.92)' }}
              >
                {deleting ? 'Deleting…' : 'Delete rate plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
};

function FormField({
  id,
  label,
  children,
  span,
  required,
  hint,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  span?: number;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : undefined}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium"
        style={{ color: 'var(--rm-text-secondary)' }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Presentational helpers
// ============================================================================

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  icon,
  headingId,
}: {
  title: string;
  icon?: React.ReactNode;
  headingId: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon && (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <h2
        id={headingId}
        className="text-xl font-semibold tracking-tight"
        style={{ color: 'var(--rm-text)' }}
      >
        {title}
      </h2>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-input)' }}>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
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

function FeatureIcon({ warn, enabled }: { warn: boolean; enabled: boolean }) {
  const bg = warn ? 'rgba(245,158,11,0.15)' : enabled ? 'rgba(16,185,129,0.14)' : 'rgba(127,127,127,0.14)';
  const color = warn ? '#b45309' : enabled ? '#047857' : 'var(--rm-text-muted)';
  const path = warn ? 'M12 9v2m0 4h.01' : enabled ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12';
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      <svg className="h-3.5 w-3.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </span>
  );
}

function CoinIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  );
}
