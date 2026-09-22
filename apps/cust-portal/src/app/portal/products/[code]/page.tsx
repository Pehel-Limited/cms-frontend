'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  productService,
  LoanProduct,
  EligibilityCheck,
  PRODUCT_TYPE_LABELS,
} from '@/services/api/product-service';
import { formatCurrency } from '@/lib/format';

/* ── SVG icon map (decorative — the container is aria-hidden) ── */
const PRODUCT_SVG: Record<string, React.ReactNode> = {
  PERSONAL_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  MORTGAGE: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  HOME_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  AUTO_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7h8m-8 4h8m-4 4v4m-4-6h8l1-4H7l1 4zm-2 6h12"
      />
    </svg>
  ),
  BUSINESS_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  DEFAULT: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

const INFO_SVG: Record<string, React.ReactNode> = {
  amount: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  rate: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  term: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [product, setProduct] = useState<LoanProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eligibility, setEligibility] = useState<EligibilityCheck | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [code]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productService.getProductByCode(code);
      setProduct(data);
    } catch (err: any) {
      setError(err.message || 'Product not found');
    } finally {
      setLoading(false);
    }
  };

  const handleEligibilityCheck = async () => {
    try {
      setCheckingEligibility(true);
      const result = await productService.checkEligibility(code);
      setEligibility(result);
    } catch {
      setEligibility({
        status: 'NEEDS_REVIEW',
        summary: 'Could not complete the eligibility check. You can still start an application.',
        checks: [],
        canApply: true,
      });
    } finally {
      setCheckingEligibility(false);
    }
  };

  const formatRate = (n: number) => `${n}%`;

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="mesh-hero rounded-3xl p-6 sm:p-8">
          <div className="skeleton h-4 w-24 bg-white/20" />
          <div className="skeleton mt-4 h-8 w-56 bg-white/20" />
          <div className="skeleton mt-2 h-4 w-80 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card space-y-4">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error / Not Found ────────────────────────────
  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 110 20 10 10 0 010-20z"
              />
            </svg>
          </div>
          <h1 className="empty-state-title">Product not found</h1>
          <p className="empty-state-text">
            {error || 'The requested product does not exist.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button onClick={loadProduct} className="btn btn-secondary btn-sm">
              Try again
            </button>
            <Link href="/portal/products" className="btn btn-primary btn-sm">
              Back to products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const svgIcon = PRODUCT_SVG[product.productType] || PRODUCT_SVG.DEFAULT;
  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] || product.productType;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="mesh-hero relative overflow-hidden rounded-3xl p-6 text-white shadow-float sm:p-8">
        <div
          className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-white/70">
            <Link href="/portal/products" className="transition-colors hover:text-white">
              Products
            </Link>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white" aria-current="page">
              {product.productName}
            </span>
          </nav>

          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur"
                aria-hidden="true"
              >
                {svgIcon}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {product.productName}
                  </h1>
                  {product.isFeatured && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/20 px-2.5 py-1 text-sm font-medium text-amber-100">
                      Featured
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/70">
                  {typeLabel}
                  {product.productCategory ? ` · ${product.productCategory}` : ''}
                </p>
                {product.shortDescription && (
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                    {product.shortDescription}
                  </p>
                )}
                {/* Only asserted when the product actually carries an SLA */}
                {product.slaDays != null && (
                  <p className="mt-3 text-sm text-white/70">
                    Decision target: {product.slaDays} business day
                    {product.slaDays === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex shrink-0 flex-col gap-2 md:items-end">
              <button
                onClick={() =>
                  router.push(`/portal/applications/new?product=${product.productCode}`)
                }
                className="btn bg-white px-6 py-3 text-base text-[#7f2b7b] shadow-lg hover:bg-white/90"
              >
                Start application
              </button>
              <button
                onClick={handleEligibilityCheck}
                disabled={checkingEligibility}
                className="btn border border-white/30 bg-white/10 px-6 py-2 text-white backdrop-blur hover:bg-white/20"
              >
                {checkingEligibility ? 'Checking…' : 'Check eligibility'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Eligibility Result */}
      {eligibility && <EligibilityResult eligibility={eligibility} />}

      {/* Key Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <InfoCard title="Loan amount" icon={INFO_SVG.amount}>
          <InfoRow label="Minimum" value={formatCurrency(product.minLoanAmount)} />
          <InfoRow label="Maximum" value={formatCurrency(product.maxLoanAmount)} />
          {product.defaultLoanAmount != null && (
            <InfoRow label="Typical" value={formatCurrency(product.defaultLoanAmount)} />
          )}
        </InfoCard>

        <InfoCard title="Interest rate" icon={INFO_SVG.rate}>
          <InfoRow label="Type" value={product.interestType || '—'} />
          <InfoRow label="From" value={formatRate(product.minInterestRate)} />
          <InfoRow label="To" value={formatRate(product.maxInterestRate)} />
          {product.defaultInterestRate != null && (
            <InfoRow label="Typical" value={formatRate(product.defaultInterestRate)} />
          )}
        </InfoCard>

        <InfoCard title="Term and repayment" icon={INFO_SVG.term}>
          <InfoRow label="Minimum term" value={`${product.minTermMonths} months`} />
          <InfoRow label="Maximum term" value={`${product.maxTermMonths} months`} />
          {product.defaultTermMonths != null && (
            <InfoRow label="Typical" value={`${product.defaultTermMonths} months`} />
          )}
          <InfoRow label="Frequency" value={product.repaymentFrequency || 'Monthly'} />
        </InfoCard>
      </div>

      {/* Fees & Features */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Fees</h2>
          </div>
          <div className="space-y-3 p-5">
            {product.processingFee != null && (
              <InfoRow label="Processing fee" value={formatCurrency(product.processingFee)} />
            )}
            {product.processingFeePercentage != null && (
              <InfoRow label="Processing fee percentage" value={`${product.processingFeePercentage}%`} />
            )}
            {product.latePaymentFee != null && (
              <InfoRow label="Late payment fee" value={formatCurrency(product.latePaymentFee)} />
            )}
            {product.prepaymentPenaltyPercentage != null && (
              <InfoRow
                label="Early repayment penalty"
                value={`${product.prepaymentPenaltyPercentage}%`}
              />
            )}
            {product.processingFee == null &&
              product.processingFeePercentage == null &&
              product.latePaymentFee == null &&
              product.prepaymentPenaltyPercentage == null && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No fees are published for this product.
                </p>
              )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Requirements</h2>
          </div>
          <div className="space-y-3 p-5">
            <FeatureRow label="Collateral required" value={product.collateralRequired} />
            {product.collateralRequired && product.loanToValueRatio != null && (
              <InfoRow label="Loan-to-value ratio" value={`${product.loanToValueRatio}%`} />
            )}
            {product.collateralTypes && product.collateralTypes.length > 0 && (
              <InfoRow label="Accepted collateral" value={product.collateralTypes.join(', ')} />
            )}
            <FeatureRow label="Down payment required" value={product.downPaymentRequired} />
            {product.downPaymentRequired && product.minDownPaymentPercentage != null && (
              <InfoRow label="Minimum down payment" value={`${product.minDownPaymentPercentage}%`} />
            )}
            <FeatureRow label="Guarantor required" value={product.requiresGuarantor} />
            {product.requiresGuarantor && product.minGuarantors != null && (
              <InfoRow label="Minimum guarantors" value={`${product.minGuarantors}`} />
            )}
            <FeatureRow label="Early repayment allowed" value={product.prepaymentAllowed} />
          </div>
        </div>
      </div>

      {/* Eligibility Criteria */}
      {hasEligibilityCriteria(product) && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Eligibility criteria</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {product.eligibleCustomerTypes && product.eligibleCustomerTypes.length > 0 && (
              <CriterionBox
                label="Customer type"
                value={product.eligibleCustomerTypes.join(', ')}
              />
            )}
            {product.minCustomerAge != null && (
              <CriterionBox label="Minimum age" value={`${product.minCustomerAge} years`} />
            )}
            {product.maxCustomerAge != null && (
              <CriterionBox label="Maximum age" value={`${product.maxCustomerAge} years`} />
            )}
            {product.minCreditScore != null && (
              <CriterionBox label="Minimum credit score" value={`${product.minCreditScore}`} />
            )}
            {product.minAnnualIncome != null && (
              <CriterionBox
                label="Minimum annual income"
                value={formatCurrency(product.minAnnualIncome)}
              />
            )}
            {product.minYearsInBusiness != null && (
              <CriterionBox
                label="Minimum years in business"
                value={`${product.minYearsInBusiness} years`}
              />
            )}
            {product.minBusinessRevenue != null && (
              <CriterionBox
                label="Minimum business revenue"
                value={formatCurrency(product.minBusinessRevenue)}
              />
            )}
          </div>
        </div>
      )}

      {/* Detailed Description */}
      {product.detailedDescription && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">About this product</h2>
          </div>
          <p className="whitespace-pre-line p-5 text-base leading-7" style={{ color: 'var(--text-secondary)' }}>
            {product.detailedDescription}
          </p>
        </div>
      )}

      {/* Terms & Conditions */}
      {product.termsAndConditions && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Terms and conditions</h2>
          </div>
          <div
            className="max-h-72 overflow-y-auto p-5"
            role="region"
            aria-label="Terms and conditions — scrollable"
            tabIndex={0}
          >
            <p className="whitespace-pre-line text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {product.termsAndConditions}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function EligibilityResult({ eligibility }: { eligibility: EligibilityCheck }) {
  const statusConfig = {
    ELIGIBLE: {
      className: 'alert-success',
      heading: 'You are eligible',
      icon: (
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    NOT_ELIGIBLE: {
      className: 'alert-error',
      heading: 'You may not be eligible',
      icon: (
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    NEEDS_REVIEW: {
      className: 'alert-warning',
      heading: 'Eligibility needs review',
      icon: (
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      ),
    },
  };

  const cfg = statusConfig[eligibility.status] || statusConfig.NEEDS_REVIEW;

  const checkIcons: Record<string, React.ReactNode> = {
    PASS: (
      <svg
        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    FAIL: (
      <svg
        className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
    SKIPPED: (
      <svg
        className="h-4 w-4 shrink-0"
        style={{ color: 'var(--text-muted)' }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 5l7 7-7 7M5 5l7 7-7 7"
        />
      </svg>
    ),
  };

  const RESULT_LABELS: Record<string, string> = {
    PASS: 'Met',
    FAIL: 'Not met',
    SKIPPED: 'Not checked',
  };

  return (
    <div className={`alert ${cfg.className}`} role="status" aria-live="polite">
      {cfg.icon}
      <div className="flex-1">
        <h2 className="text-base font-semibold">{cfg.heading}</h2>
        <p className="mt-1 text-sm leading-6">{eligibility.summary}</p>

        {eligibility.checks.length > 0 && (
          <ul className="mt-4 space-y-2">
            {eligibility.checks.map((check, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5">{checkIcons[check.result] || checkIcons.SKIPPED}</span>
                <span>
                  <span className="font-medium">{check.criterion}: </span>
                  {check.detail}
                  <span className="ml-1.5 font-medium">
                    ({RESULT_LABELS[check.result] || check.result})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {eligibility.canApply && eligibility.status !== 'ELIGIBLE' && (
          <p className="mt-3 text-sm italic opacity-80">
            You can still start a draft application — it will be reviewed by our team.
          </p>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-base font-semibold tabular-nums"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className={`badge ${value ? 'badge-warning' : 'badge-success'}`}
      >
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  );
}

function CriterionBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ backgroundColor: 'var(--surface-input)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p
        className="mt-0.5 text-base font-semibold tabular-nums"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function hasEligibilityCriteria(product: LoanProduct): boolean {
  return !!(
    (product.eligibleCustomerTypes && product.eligibleCustomerTypes.length > 0) ||
    product.minCustomerAge ||
    product.maxCustomerAge ||
    product.minCreditScore ||
    product.minAnnualIncome ||
    product.minYearsInBusiness ||
    product.minBusinessRevenue
  );
}
