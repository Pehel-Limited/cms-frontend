'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { productService, type Product } from '@/services/api/productService';
import { useAppSelector } from '@/store';
import config from '@/config';
import { formatCurrency as sharedFormatCurrency } from '@/lib/format';

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400',
  INACTIVE: 'bg-slate-400',
  DISCONTINUED: 'bg-red-400',
};

const STATUS_BG: Record<string, string> = {
  ACTIVE: 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/20',
  INACTIVE: 'bg-white/10 text-white/80 border border-white/20',
  DISCONTINUED: 'bg-red-400/20 text-red-200 border border-red-400/20',
};

const PRODUCT_SVG: Record<string, React.ReactNode> = {
  PERSONAL_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  PCP: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 17h.01M12 17h.01M16 17h.01M3 9h18M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
    </svg>
  ),
  HIRE_PURCHASE: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  CREDIT_CARD: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  ),
  OVERDRAFT: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
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
        d="M8 17h.01M12 17h.01M16 17h.01M3 9h18M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
    </svg>
  ),
  BUSINESS_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  SME_TERM_LOAN: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
};

const DEFAULT_SVG = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    />
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8 animate-pulse">
          <div className="h-4 bg-white/20 rounded-xl w-32 mb-4" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10" />
            <div className="space-y-2">
              <div className="h-6 bg-white/20 rounded-xl w-56" />
              <div className="h-4 bg-white/10 rounded-xl w-40" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse"
              >
                <div className="h-5 bg-slate-200/70 rounded-xl w-40 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-16 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse"
              >
                <div className="h-5 bg-slate-200/70 rounded-xl w-28 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-4 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            {error || 'Product not found'}
          </h2>
          <Link
            href="/dashboard/products"
            className="text-sm text-[#7f2b7b] hover:text-[#6b2568] font-medium mt-3 inline-block"
          >
            &larr; Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const icon = PRODUCT_SVG[product.productType] || DEFAULT_SVG;

  return (
    <div className="p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative">
          <Link
            href="/dashboard/products"
            className="text-white/60 hover:text-white text-sm mb-3 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Products
          </Link>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-white">
                {icon}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{product.productName}</h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_BG[product.productStatus] || 'bg-white/10 text-white/80 border border-white/20'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[product.productStatus] || 'bg-white/60'}`}
                    />
                    {product.productStatus}
                  </span>
                </div>
                <p className="text-white/60 text-sm mt-0.5">Code: {product.productCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/dashboard/products/${productId}/edit`)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </button>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/20 text-red-200 text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
              <Link
                href={`/dashboard/applications/new?productId=${productId}`}
                className="px-4 py-2 bg-white text-[#7f2b7b] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors"
              >
                + New Application
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {(product.shortDescription || product.detailedDescription) && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Description</h2>
              {product.shortDescription && (
                <p className="text-sm text-slate-600 mb-2">{product.shortDescription}</p>
              )}
              {product.detailedDescription && (
                <p className="text-sm text-slate-500">{product.detailedDescription}</p>
              )}
            </div>
          )}

          {/* Financial Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[#7f2b7b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Financial Details
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Loan Amount Range',
                  value: `${formatCurrency(product.minLoanAmount)} – ${formatCurrency(product.maxLoanAmount)}`,
                },
                {
                  label: 'Interest Rate Range',
                  value: `${formatPercentage(product.minInterestRate)} – ${formatPercentage(product.maxInterestRate)}`,
                },
                {
                  label: 'Term Range',
                  value: `${product.minTermMonths} – ${product.maxTermMonths} months`,
                },
                { label: 'Interest Type', value: product.interestType },
                {
                  label: 'Processing Fee',
                  value: product.processingFeePercentage
                    ? formatPercentage(product.processingFeePercentage)
                    : formatCurrency(product.processingFee),
                },
                { label: 'Repayment Frequency', value: product.repaymentFrequency || 'Monthly' },
              ].map(item => (
                <div key={item.label} className="p-3 bg-slate-50/50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Eligibility Criteria */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[#7f2b7b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Eligibility Criteria
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Customer Age',
                  value: `${product.minCustomerAge || 18} – ${product.maxCustomerAge || 65} years`,
                },
                { label: 'Min Credit Score', value: product.minCreditScore || 'N/A' },
                { label: 'Min Annual Income', value: formatCurrency(product.minAnnualIncome) },
                { label: 'Min Years in Business', value: product.minYearsInBusiness || 'N/A' },
              ].map(item => (
                <div key={item.label} className="p-3 bg-slate-50/50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    {String(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Irish/EU Details */}
          {(product.regulatoryBody ||
            product.interestLogicDescription ||
            product.principalStructure) && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#7f2b7b]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                  />
                </svg>
                Regulatory &amp; EU Details
              </h2>
              <div className="space-y-4">
                {product.regulatoryBody && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Regulatory Body</p>
                    <p className="text-sm text-slate-900">{product.regulatoryBody}</p>
                  </div>
                )}
                {product.interestLogicDescription && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Interest Logic</p>
                    <p className="text-sm text-slate-900">{product.interestLogicDescription}</p>
                  </div>
                )}
                {product.principalStructure && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Principal Structure</p>
                    <p className="text-sm text-slate-900">{product.principalStructure}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Product Info</h3>
            <dl className="space-y-3">
              {[
                { label: 'Category', value: product.productCategory?.replace(/_/g, ' ') },
                { label: 'Type', value: product.productType?.replace(/_/g, ' ') },
                {
                  label: 'Eligible For',
                  value: formatCustomerTypes(product.eligibleCustomerTypes),
                },
                { label: 'SLA', value: `${product.slaDays || 3} days` },
              ].map(item => (
                <div key={item.label}>
                  <dt className="text-xs text-slate-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Features */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Features</h3>
            <ul className="space-y-2.5">
              {[
                { enabled: product.prepaymentAllowed, label: 'Prepayment Allowed', warn: false },
                {
                  enabled: !product.collateralRequired,
                  label: product.collateralRequired ? 'Collateral Required' : 'No Collateral',
                  warn: product.collateralRequired,
                },
                {
                  enabled: product.isOnlineApplicationEnabled,
                  label: 'Online Application',
                  warn: false,
                },
                { enabled: product.autoApprovalEnabled, label: 'Auto-Approval', warn: false },
                {
                  enabled: !product.requiresGuarantor,
                  label: product.requiresGuarantor ? 'Guarantor Required' : 'No Guarantor',
                  warn: product.requiresGuarantor,
                },
              ].map(item => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm">
                  {item.warn ? (
                    <span className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-amber-500"
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
                    </span>
                  ) : item.enabled ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-slate-400"
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
                    </span>
                  )}
                  <span className="text-slate-700">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/dashboard/applications/new?productId=${productId}`}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-[#7f2b7b] text-white text-sm font-medium rounded-xl hover:bg-[#6b2568] transition-colors"
              >
                Create Application
              </Link>
              <Link
                href={`/dashboard/products/${productId}/edit`}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Edit Product
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-red-50">
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              Delete Product
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Are you sure you want to delete &quot;{product.productName}&quot;? This action cannot
              be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
