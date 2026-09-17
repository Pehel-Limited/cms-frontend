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
      <div className="space-y-5">
        <div className="mesh-hero rounded-3xl p-6 sm:p-7">
          <div className="h-7 w-48 animate-pulse rounded-xl bg-white/20" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-xl bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card space-y-4">
              <div className="skeleton h-6 w-3/4" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────
  if (error) {
    return (
      <div className="alert alert-error">
        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div className="flex-1">
          <p className="font-semibold">Couldn&apos;t load products</p>
          <p className="mt-0.5 text-sm opacity-80">{error}</p>
        </div>
        <button onClick={loadProducts} className="btn btn-sm btn-outline shrink-0">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="mesh-hero relative overflow-hidden rounded-3xl p-6 shadow-float sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Loan products</h2>
          <p className="mt-1 text-sm text-white/70">
            Browse what&apos;s available and check your eligibility — {products.length} product{products.length === 1 ? '' : 's'} on offer
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
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
              type="search"
              placeholder="Search products..."
              aria-label="Search products"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            aria-label="Filter by product type"
            className="select sm:w-44"
          >
            <option value="">All types</option>
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
            aria-label="Filter by category"
            className="select sm:w-44"
          >
            <option value="">All categories</option>
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
              aria-pressed={showFeatured}
              className={`btn shrink-0 ${
                showFeatured
                  ? 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'btn-secondary'
              }`}
            >
              Featured
            </button>
          )}
        </div>

        {/* Active filters summary */}
        {(search || typeFilter || categoryFilter || showFeatured) && (
          <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
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
              className="link-arrow ml-1"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p className="empty-state-title">No products match your filters</p>
          <p className="empty-state-text">Try broadening your search or clearing the filters above.</p>
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
      className="card card-hover group flex flex-col p-0"
    >
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
            >
              {svgIcon}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold" style={{ color: 'var(--text-primary)' }}>
                {product.productName}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{typeLabel}</p>
            </div>
          </div>
          {product.isFeatured && <span className="badge badge-warning shrink-0">Featured</span>}
        </div>

        {/* Description */}
        {product.shortDescription && (
          <p className="mb-4 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {product.shortDescription}
          </p>
        )}

        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          {[
            {
              label: 'Amount',
              value: `${formatCurrency(product.minLoanAmount)} – ${formatCurrency(product.maxLoanAmount)}`,
            },
            {
              label: 'Rate',
              value:
                product.minInterestRate !== product.maxInterestRate
                  ? `${formatRate(product.minInterestRate)} – ${formatRate(product.maxInterestRate)}`
                  : formatRate(product.minInterestRate),
            },
            { label: 'Term', value: `${product.minTermMonths} – ${product.maxTermMonths} months` },
            {
              label: 'Repayment',
              value: (product.repaymentFrequency || 'Monthly').toLowerCase(),
              capitalize: true,
            },
          ].map(info => (
            <div
              key={info.label}
              className="rounded-xl px-3 py-2"
              style={{ backgroundColor: 'var(--surface-input)' }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {info.label}
              </p>
              <p
                className={`text-sm font-semibold ${info.capitalize ? 'capitalize' : ''}`}
                style={{ color: 'var(--text-primary)' }}
              >
                {info.value}
              </p>
            </div>
          ))}
        </div>

        {/* Feature Badges */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {product.collateralRequired && (
            <span className="badge badge-warning">Collateral required</span>
          )}
          {product.prepaymentAllowed && (
            <span className="badge badge-success">Early repayment</span>
          )}
          {product.requiresGuarantor && (
            <span className="badge badge-info">Guarantor required</span>
          )}
          {product.downPaymentRequired && (
            <span className="badge badge-primary">Down payment</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="rounded-b-2xl px-6 py-3"
        style={{ borderTop: '1px solid var(--surface-border)', backgroundColor: 'var(--surface-input)' }}
      >
        <span className="link-arrow text-sm">
          View details <span data-arrow aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}
