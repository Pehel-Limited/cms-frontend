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

/* ── SVG icon map ──────────────────────────────────────────── */
const PRODUCT_SVG: Record<string, React.ReactNode> = {
  PERSONAL_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  MORTGAGE: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  HOME_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  AUTO_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7h8m-8 4h8m-4 4v4m-4-6h8l1-4H7l1 4zm-2 6h12"
      />
    </svg>
  ),
  BUSINESS_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  DEFAULT: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  rate: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  term: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        summary: 'Could not complete eligibility check. You can still start an application.',
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
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8 animate-pulse">
          <div className="h-5 bg-white/20 rounded-xl w-24 mb-4" />
          <div className="h-7 bg-white/20 rounded-xl w-56" />
          <div className="h-4 bg-white/10 rounded-xl w-80 mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 animate-pulse"
            >
              <div className="h-5 bg-slate-200/70 rounded-xl w-32" />
              <div className="h-4 bg-slate-100 rounded-xl w-full" />
              <div className="h-4 bg-slate-100 rounded-xl w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error / Not Found ────────────────────────────
  if (error || !product) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 110 20 10 10 0 010-20z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Product Not Found</h2>
        <p className="text-slate-500 mb-4">{error || 'The requested product does not exist.'}</p>
        <Link
          href="/portal/products"
          className="text-[#7f2b7b] hover:underline text-sm font-medium"
        >
          ← Back to Products
        </Link>
      </div>
    );
  }

  const svgIcon = PRODUCT_SVG[product.productType] || PRODUCT_SVG.DEFAULT;
  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] || product.productType;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />

        <div className="relative">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-4">
            <Link href="/portal/products" className="hover:text-white/90 transition-colors">
              Products
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/90">{product.productName}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-white">
                {svgIcon}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-white">{product.productName}</h1>
                  {product.isFeatured && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400/20 text-amber-200 text-xs font-medium rounded-full border border-amber-400/20">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Featured
                    </span>
                  )}
                </div>
                <p className="text-white/60">
                  {typeLabel} • {product.productCategory || 'General'}
                </p>
                {product.shortDescription && (
                  <p className="text-white/70 mt-2 max-w-xl">{product.shortDescription}</p>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-2 md:items-end shrink-0">
              <button
                onClick={() =>
                  router.push(`/portal/applications/new?product=${product.productCode}`)
                }
                className="px-6 py-3 bg-white text-[#7f2b7b] rounded-xl font-semibold hover:bg-white/90 transition-colors text-center shadow-lg"
              >
                Start Application
              </button>
              <button
                onClick={handleEligibilityCheck}
                disabled={checkingEligibility}
                className="px-6 py-2 border border-white/30 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50 backdrop-blur"
              >
                {checkingEligibility ? 'Checking...' : 'Check My Eligibility'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Eligibility Result */}
      {eligibility && <EligibilityResult eligibility={eligibility} />}

      {/* Key Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <InfoCard title="Loan Amount" icon={INFO_SVG.amount}>
          <InfoRow label="Minimum" value={formatCurrency(product.minLoanAmount)} />
          <InfoRow label="Maximum" value={formatCurrency(product.maxLoanAmount)} />
          {product.defaultLoanAmount && (
            <InfoRow label="Typical" value={formatCurrency(product.defaultLoanAmount)} />
          )}
        </InfoCard>

        <InfoCard title="Interest Rate" icon={INFO_SVG.rate}>
          <InfoRow label="Type" value={product.interestType || '—'} />
          <InfoRow label="From" value={formatRate(product.minInterestRate)} />
          <InfoRow label="To" value={formatRate(product.maxInterestRate)} />
          {product.defaultInterestRate && (
            <InfoRow label="Typical" value={formatRate(product.defaultInterestRate)} />
          )}
        </InfoCard>

        <InfoCard title="Term & Repayment" icon={INFO_SVG.term}>
          <InfoRow label="Min Term" value={`${product.minTermMonths} months`} />
          <InfoRow label="Max Term" value={`${product.maxTermMonths} months`} />
          {product.defaultTermMonths && (
            <InfoRow label="Typical" value={`${product.defaultTermMonths} months`} />
          )}
          <InfoRow label="Frequency" value={product.repaymentFrequency || 'Monthly'} />
        </InfoCard>
      </div>

      {/* Fees & Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Fees</h3>
          <div className="space-y-3">
            {product.processingFee != null && (
              <InfoRow label="Processing Fee" value={formatCurrency(product.processingFee)} />
            )}
            {product.processingFeePercentage != null && (
              <InfoRow label="Processing Fee %" value={`${product.processingFeePercentage}%`} />
            )}
            {product.latePaymentFee != null && (
              <InfoRow label="Late Payment Fee" value={formatCurrency(product.latePaymentFee)} />
            )}
            {product.prepaymentPenaltyPercentage != null && (
              <InfoRow
                label="Early Repayment Penalty"
                value={`${product.prepaymentPenaltyPercentage}%`}
              />
            )}
            {!product.processingFee &&
              !product.processingFeePercentage &&
              !product.latePaymentFee && (
                <p className="text-sm text-slate-500">No fees specified</p>
              )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Requirements</h3>
          <div className="space-y-3">
            <FeatureRow label="Collateral Required" value={product.collateralRequired} />
            {product.collateralRequired && product.loanToValueRatio && (
              <InfoRow label="Loan-to-Value Ratio" value={`${product.loanToValueRatio}%`} />
            )}
            {product.collateralTypes && product.collateralTypes.length > 0 && (
              <InfoRow label="Accepted Collateral" value={product.collateralTypes.join(', ')} />
            )}
            <FeatureRow label="Down Payment Required" value={product.downPaymentRequired} />
            {product.downPaymentRequired && product.minDownPaymentPercentage && (
              <InfoRow label="Min Down Payment" value={`${product.minDownPaymentPercentage}%`} />
            )}
            <FeatureRow label="Guarantor Required" value={product.requiresGuarantor} />
            {product.requiresGuarantor && product.minGuarantors && (
              <InfoRow label="Min Guarantors" value={`${product.minGuarantors}`} />
            )}
            <FeatureRow label="Early Repayment Allowed" value={product.prepaymentAllowed} />
          </div>
        </div>
      </div>

      {/* Eligibility Criteria */}
      {hasEligibilityCriteria(product) && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Eligibility Criteria</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {product.eligibleCustomerTypes && product.eligibleCustomerTypes.length > 0 && (
              <CriterionBox
                label="Customer Type"
                value={product.eligibleCustomerTypes.join(', ')}
              />
            )}
            {product.minCustomerAge && (
              <CriterionBox label="Minimum Age" value={`${product.minCustomerAge} years`} />
            )}
            {product.maxCustomerAge && (
              <CriterionBox label="Maximum Age" value={`${product.maxCustomerAge} years`} />
            )}
            {product.minCreditScore && (
              <CriterionBox label="Min Credit Score" value={`${product.minCreditScore}`} />
            )}
            {product.minAnnualIncome && (
              <CriterionBox
                label="Min Annual Income"
                value={formatCurrency(product.minAnnualIncome)}
              />
            )}
            {product.minYearsInBusiness && (
              <CriterionBox
                label="Min Years in Business"
                value={`${product.minYearsInBusiness} years`}
              />
            )}
            {product.minBusinessRevenue && (
              <CriterionBox
                label="Min Business Revenue"
                value={formatCurrency(product.minBusinessRevenue)}
              />
            )}
          </div>
        </div>
      )}

      {/* Detailed Description */}
      {product.detailedDescription && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">About This Product</h3>
          <p className="text-slate-600 whitespace-pre-line">{product.detailedDescription}</p>
        </div>
      )}

      {/* Terms & Conditions */}
      {product.termsAndConditions && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Terms & Conditions</h3>
          <p className="text-slate-600 text-sm whitespace-pre-line">{product.termsAndConditions}</p>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-[#7f2b7b]/5 via-[#a0369b]/5 to-[#7f2b7b]/5 rounded-2xl border border-[#7f2b7b]/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Ready to apply?</h3>
          <p className="text-sm text-slate-600">
            Start your application online. Most applications are reviewed within{' '}
            {product.slaDays || 5} business days.
          </p>
        </div>
        <button
          onClick={() => router.push(`/portal/applications/new?product=${product.productCode}`)}
          className="px-6 py-3 bg-[#7f2b7b] text-white rounded-xl font-semibold hover:bg-[#6b2568] transition-colors whitespace-nowrap shadow-lg"
        >
          Start Application
        </button>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function EligibilityResult({ eligibility }: { eligibility: EligibilityCheck }) {
  const statusConfig = {
    ELIGIBLE: {
      bg: 'bg-emerald-50 border-emerald-200/60',
      dot: 'bg-emerald-500',
      heading: 'text-emerald-800',
      icon: (
        <svg
          className="w-5 h-5 text-emerald-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
      bg: 'bg-red-50 border-red-200/60',
      dot: 'bg-red-500',
      heading: 'text-red-800',
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      bg: 'bg-amber-50 border-amber-200/60',
      dot: 'bg-amber-500',
      heading: 'text-amber-800',
      icon: (
        <svg
          className="w-5 h-5 text-amber-600"
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
      ),
    },
  };

  const cfg = statusConfig[eligibility.status] || statusConfig.NEEDS_REVIEW;

  const checkIcons: Record<string, React.ReactNode> = {
    PASS: (
      <svg
        className="w-4 h-4 text-emerald-600 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    FAIL: (
      <svg
        className="w-4 h-4 text-red-500 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
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
        className="w-4 h-4 text-slate-400 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
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

  return (
    <div className={`rounded-2xl border p-6 ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{cfg.icon}</div>
        <div className="flex-1">
          <h3 className={`font-semibold ${cfg.heading}`}>
            {eligibility.status === 'ELIGIBLE' && 'You are eligible!'}
            {eligibility.status === 'NOT_ELIGIBLE' && 'You may not be eligible'}
            {eligibility.status === 'NEEDS_REVIEW' && 'Eligibility under review'}
          </h3>
          <p className="text-sm text-slate-700 mt-1">{eligibility.summary}</p>

          {eligibility.checks.length > 0 && (
            <div className="mt-4 space-y-2">
              {eligibility.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5">{checkIcons[check.result] || checkIcons.SKIPPED}</span>
                  <div>
                    <span className="font-medium text-slate-900">{check.criterion}: </span>
                    <span className="text-slate-600">{check.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {eligibility.canApply && eligibility.status !== 'ELIGIBLE' && (
            <p className="text-xs text-slate-500 mt-3 italic">
              You can still start a draft application — it will be reviewed by our team.
            </p>
          )}
        </div>
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
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center text-[#7f2b7b]">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-sm font-medium ${value ? 'text-amber-600' : 'text-emerald-600'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  );
}

function CriterionBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50/50 rounded-xl p-3">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
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
