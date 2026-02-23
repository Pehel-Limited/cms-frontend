'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  productService,
  LoanProduct,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_ICONS,
} from '@/services/api/product-service';
import { formatCurrency } from '@/lib/format';

export default function ProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productService.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Derive unique types and categories from loaded products
  const productTypes = useMemo(() => {
    const types = new Set(products.map(p => p.productType).filter(Boolean));
    return Array.from(types).sort();
  }, [products]);

  const productCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.productCategory).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  // Filter products client-side
  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.productName.toLowerCase().includes(q) &&
          !p.productCode.toLowerCase().includes(q) &&
          !(p.shortDescription || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (typeFilter && p.productType !== typeFilter) return false;
      if (categoryFilter && p.productCategory !== categoryFilter) return false;
      if (showFeatured && !p.isFeatured) return false;
      return true;
    });
  }, [products, search, typeFilter, categoryFilter, showFeatured]);

  const featuredCount = products.filter(p => p.isFeatured).length;

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8">
          <div className="h-7 bg-white/20 rounded-xl w-48 animate-pulse" />
          <div className="h-4 bg-white/10 rounded-xl w-72 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 animate-pulse"
            >
              <div className="h-6 bg-slate-200/70 rounded-xl w-3/4" />
              <div className="h-4 bg-slate-100 rounded-xl w-full" />
              <div className="h-4 bg-slate-100 rounded-xl w-2/3" />
              <div className="h-10 bg-slate-200/70 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200/60 rounded-2xl p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-3">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={loadProducts}
          className="mt-4 text-sm font-medium text-red-700 underline decoration-red-300 underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white">Loan Products</h1>
          <p className="text-white/70 mt-1">
            Browse available loan products and check your eligibility
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-[#7f2b7b]"
          >
            <option value="">All Types</option>
            {productTypes.map(t => (
              <option key={t} value={t}>
                {PRODUCT_TYPE_LABELS[t] || t}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-[#7f2b7b]"
          >
            <option value="">All Categories</option>
            {productCategories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Featured Toggle */}
          {featuredCount > 0 && (
            <button
              onClick={() => setShowFeatured(!showFeatured)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                showFeatured
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Featured
            </button>
          )}
        </div>

        {/* Active filters summary */}
        {(search || typeFilter || categoryFilter || showFeatured) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <span>
              Showing {filtered.length} of {products.length} products
            </span>
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('');
                setCategoryFilter('');
                setShowFeatured(false);
              }}
              className="text-[#7f2b7b] hover:underline ml-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80">
          <svg
            className="w-12 h-12 text-slate-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-slate-500">No products match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(product => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Product Card Component ──────────────────────────────────────

const PRODUCT_SVG_ICONS: Record<string, React.ReactNode> = {
  PERSONAL_LOAN: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  MORTGAGE: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  HOME_LOAN: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  AUTO_LOAN: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7h8m-8 4h8m-4 4v4m-4-6h8l1-4H7l1 4zm-2 6h12"
      />
    </svg>
  ),
  BUSINESS_LOAN: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  DEFAULT: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

function ProductCard({ product }: { product: LoanProduct }) {
  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] || product.productType;
  const svgIcon = PRODUCT_SVG_ICONS[product.productType] || PRODUCT_SVG_ICONS.DEFAULT;

  const formatRate = (n: number) => `${n}%`;

  return (
    <Link
      href={`/portal/products/${product.productCode}`}
      className="group bg-white rounded-2xl border border-slate-200/80 hover:border-[#7f2b7b]/30 hover:shadow-md transition-all duration-200 flex flex-col"
    >
      <div className="p-6 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center text-[#7f2b7b]">
              {svgIcon}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-[#7f2b7b] transition-colors">
                {product.productName}
              </h3>
              <p className="text-xs text-slate-500">{typeLabel}</p>
            </div>
          </div>
          {product.isFeatured && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Featured
            </span>
          )}
        </div>

        {/* Description */}
        {product.shortDescription && (
          <p className="text-sm text-slate-600 mb-4 line-clamp-2">{product.shortDescription}</p>
        )}

        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50/50 rounded-xl px-3 py-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Amount</p>
            <p className="font-medium text-slate-900">
              {formatCurrency(product.minLoanAmount)} – {formatCurrency(product.maxLoanAmount)}
            </p>
          </div>
          <div className="bg-slate-50/50 rounded-xl px-3 py-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Rate</p>
            <p className="font-medium text-slate-900">
              {formatRate(product.minInterestRate)}
              {product.minInterestRate !== product.maxInterestRate &&
                ` – ${formatRate(product.maxInterestRate)}`}
            </p>
          </div>
          <div className="bg-slate-50/50 rounded-xl px-3 py-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Term</p>
            <p className="font-medium text-slate-900">
              {product.minTermMonths} – {product.maxTermMonths} months
            </p>
          </div>
          <div className="bg-slate-50/50 rounded-xl px-3 py-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Repayment</p>
            <p className="font-medium text-slate-900 capitalize">
              {(product.repaymentFrequency || 'Monthly').toLowerCase()}
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {product.collateralRequired && (
            <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded-full">
              Collateral Required
            </span>
          )}
          {product.prepaymentAllowed && (
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">
              Early Repayment
            </span>
          )}
          {product.requiresGuarantor && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
              Guarantor Required
            </span>
          )}
          {product.downPaymentRequired && (
            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">
              Down Payment
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
        <span className="text-sm font-medium text-[#7f2b7b] group-hover:text-[#6b2568]">
          View Details →
        </span>
      </div>
    </Link>
  );
}
