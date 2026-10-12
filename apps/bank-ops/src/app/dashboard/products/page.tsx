'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productService, type Product } from '@/services/api/productService';
import {
  dashboardService,
  type DashboardKpis,
  type WorklistItem,
} from '@/services/api/dashboard-service';
import { useAppSelector } from '@/store';
import config from '@/config';
import { getCurrencySymbol } from '@/lib/format';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

type FilterType = 'all' | 'active' | 'inactive';
type CategoryFilter = 'all' | 'PERSONAL_CONSUMER' | 'BUSINESS_SME' | 'SPECIALIZED_IRISH';
type CustomerTypeFilter = 'all' | 'INDIVIDUAL' | 'BUSINESS';

const PRODUCT_CATEGORIES = [
  { value: 'PERSONAL_CONSUMER', label: 'Personal & Consumer' },
  { value: 'BUSINESS_SME', label: 'Business & SME' },
  { value: 'SPECIALIZED_IRISH', label: 'Specialized Irish' },
];

const CUSTOMER_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual only' },
  { value: 'BUSINESS', label: 'Business only' },
];

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  ACTIVE: {
    label: 'Active',
    bg: 'rgba(16,185,129,0.14)',
    text: '#059669',
    dot: '#10b981',
  },
  INACTIVE: {
    label: 'Inactive',
    bg: 'rgba(127,127,127,0.14)',
    text: 'var(--rm-text-secondary)',
    dot: '#94a3b8',
  },
  DISCONTINUED: {
    label: 'Discontinued',
    bg: 'rgba(239,68,68,0.13)',
    text: '#b91c1c',
    dot: '#ef4444',
  },
};

/* Category accent tints — kept translucent so they read on light and dark. */
const CATEGORY_TINT: Record<string, { bg: string; text: string }> = {
  PERSONAL_CONSUMER: { bg: 'rgba(14,165,233,0.14)', text: '#0284c7' },
  BUSINESS_SME: { bg: 'rgba(99,102,241,0.15)', text: '#4f46e5' },
  SPECIALIZED_IRISH: { bg: 'rgba(16,185,129,0.14)', text: '#059669' },
};

function statusMeta(status: string) {
  return (
    STATUS_META[status] || {
      label: status ? status.charAt(0) + status.slice(1).toLowerCase() : 'Unknown',
      bg: 'rgba(127,127,127,0.14)',
      text: 'var(--rm-text-secondary)',
      dot: '#94a3b8',
    }
  );
}

function categoryLabel(category: string): string {
  const match = PRODUCT_CATEGORIES.find(c => c.value === category);
  if (match) return match.label;
  if (!category) return 'General';
  const words = category.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function categoryTint(category: string) {
  return CATEGORY_TINT[category] || { bg: 'rgba(127,127,127,0.14)', text: 'var(--rm-text-muted)' };
}

/**
 * Derived from the product's own configured rate and security requirements —
 * no hardcoded risk data.
 */
function riskProfile(p: Product): { label: string; color: string } {
  const rate = p.maxInterestRate ?? p.defaultInterestRate ?? 0;
  const secured = p.collateralRequired === true;
  if (rate >= 15 && !secured) return { label: 'High', color: '#dc2626' };
  if (rate >= 8) return { label: 'Medium', color: '#b45309' };
  return { label: 'Low', color: '#059669' };
}

const productIcon = (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.8}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    />
  </svg>
);

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [products, setProducts] = useState<Product[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

  // Delete flow — kept separate from the list error so a failed delete never
  // blanks the catalogue.
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currencySymbol = getCurrencySymbol();

  const compact = useCallback(
    (n: number): string => {
      const abs = Math.abs(n || 0);
      if (abs >= 1e9) return `${currencySymbol}${(n / 1e9).toFixed(1)}B`;
      if (abs >= 1e6) return `${currencySymbol}${(n / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `${currencySymbol}${(n / 1e3).toFixed(0)}K`;
      return `${currencySymbol}${Math.round(n || 0)}`;
    },
    [currencySymbol]
  );

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bankId = getBankId();
      const data = await productService.getAllProducts(bankId);
      setProducts(data ?? []);
      setLastUpdated(new Date());
      // Aggregates are best-effort — the catalogue still renders if they fail.
      try {
        const [k, w] = await Promise.all([
          dashboardService.getKpis(bankId),
          dashboardService.getWorklist(bankId, undefined, 500),
        ]);
        setKpis(k);
        setWorklist(w ?? []);
      } catch (aggErr) {
        console.warn('Product performance aggregates unavailable:', aggErr);
        setKpis(null);
        setWorklist([]);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('We could not load the product catalogue. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getBankId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        setDeleteTarget(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget, deleting]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (statusFilter === 'active') result = result.filter(p => p.productStatus === 'ACTIVE');
    else if (statusFilter === 'inactive') result = result.filter(p => p.productStatus === 'INACTIVE');
    if (categoryFilter !== 'all') result = result.filter(p => p.productCategory === categoryFilter);
    if (customerTypeFilter !== 'all') {
      result = result.filter(
        p =>
          p.eligibleCustomerTypes?.includes(customerTypeFilter) ||
          !p.eligibleCustomerTypes ||
          p.eligibleCustomerTypes.length === 0
      );
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        p =>
          p.productName.toLowerCase().includes(term) ||
          p.productCode.toLowerCase().includes(term) ||
          p.shortDescription?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [products, statusFilter, categoryFilter, customerTypeFilter, searchTerm]);

  // Per-product performance derived from the pipeline worklist (real data).
  const perfByProduct = useMemo(() => {
    const map = new Map<string, { apps: number; approved: number; booked: number; reqSum: number }>();
    for (const w of worklist) {
      const key = w.productId;
      if (!key) continue;
      const e = map.get(key) || { apps: 0, approved: 0, booked: 0, reqSum: 0 };
      e.apps += 1;
      e.reqSum += w.requestedAmount || 0;
      const st = (w.status || '').toUpperCase();
      if (/APPROV|BOOK|DISBURS|FUND|ACTIVE/.test(st)) e.approved += 1;
      if (/BOOK|DISBURS|FUND/.test(st)) e.booked += w.approvedAmount || w.requestedAmount || 0;
      map.set(key, e);
    }
    return map;
  }, [worklist]);

  const perfFor = useCallback(
    (p: Product) => {
      const e = perfByProduct.get(p.productId) || { apps: 0, approved: 0, booked: 0, reqSum: 0 };
      // Only report an average ticket when there are actual applications behind it.
      const avgTicket = e.apps > 0 ? e.reqSum / e.apps : null;
      const approvalRate = e.apps > 0 ? (e.approved / e.apps) * 100 : null;
      return { ...e, avgTicket, approvalRate };
    },
    [perfByProduct]
  );

  const performanceRows = useMemo(() => {
    const rows = filteredProducts.map(product => {
      const perf = perfFor(product);
      const risk = riskProfile(product);
      return {
        productId: product.productId,
        product,
        category: categoryLabel(product.productCategory),
        apps: perf.apps,
        booked: perf.booked,
        approvalRate: perf.approvalRate,
        avgTicket: perf.avgTicket,
        riskLabel: risk.label,
        riskColor: risk.color,
      };
    });
    return sortData(rows, sortConfig);
  }, [filteredProducts, perfFor, sortConfig]);

  const handleSort = (field: string) => setSortConfig(handleSortToggle(field, sortConfig));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await productService.deleteProduct(deleteTarget.productId);
      setProducts(prev => prev.filter(p => p.productId !== deleteTarget.productId));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
      // Scoped to the dialog — the catalogue stays on screen.
      setDeleteError('We could not delete this product. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setCustomerTypeFilter('all');
    setSearchTerm('');
  };

  const activeCount = products.filter(p => p.productStatus === 'ACTIVE').length;
  const categoriesCount = new Set(products.map(p => p.productCategory).filter(Boolean)).size;
  const pipelineCount = kpis?.inProgressCount ?? worklist.length;

  const insights = useMemo(() => {
    const rows = filteredProducts.map(p => ({ p, perf: perfFor(p) }));
    const withApps = rows.filter(r => r.perf.apps > 0);
    const topActive = [...withApps].sort((a, b) => b.perf.apps - a.perf.apps)[0];
    const topBooked = [...withApps].sort((a, b) => b.perf.booked - a.perf.booked)[0];
    const bestApproval = withApps
      .filter(r => (r.perf.approvalRate ?? 0) > 0)
      .sort((a, b) => (b.perf.approvalRate ?? 0) - (a.perf.approvalRate ?? 0))[0];
    const autoApproval = products.filter(p => p.autoApprovalEnabled).length;
    const featured = products.filter(p => p.isFeatured).length;
    return { topActive, topBooked, bestApproval, autoApproval, featured };
  }, [filteredProducts, perfFor, products]);

  const hasFilters =
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    customerTypeFilter !== 'all' ||
    !!searchTerm.trim();

  const kpiCards: { label: string; value: string; sub: string; tint: string; icon: ReactNode }[] = [
    {
      label: 'Active products',
      value: String(activeCount),
      sub: `Across ${categoriesCount} categor${categoriesCount === 1 ? 'y' : 'ies'}`,
      tint: 'rgba(14,165,233,0.14)',
      icon: productIcon,
    },
    {
      label: 'Applications in pipeline',
      value: pipelineCount.toLocaleString(),
      sub: `${products.length} product${products.length === 1 ? '' : 's'} in the catalogue`,
      tint: 'rgba(99,102,241,0.15)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Booked value this month',
      value: kpis ? compact(kpis.bookedThisMonthValue) : '—',
      sub: kpis
        ? `${kpis.bookedThisMonthCount} loan${kpis.bookedThisMonthCount === 1 ? '' : 's'} booked`
        : 'Pipeline data unavailable',
      tint: 'rgba(16,185,129,0.14)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6" />
        </svg>
      ),
    },
    {
      label: 'Conversion rate, last 30 days',
      value: kpis ? `${kpis.conversionRate30d.toFixed(1)}%` : '—',
      sub: 'Submitted to booked',
      tint: 'rgba(139,92,246,0.15)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />
        </svg>
      ),
    },
    {
      label: 'Needs action',
      value: kpis ? String(kpis.needsActionCount) : '—',
      sub: kpis ? `${kpis.stuckAtRiskCount} at risk of breaching SLA` : 'Pipeline data unavailable',
      tint: 'rgba(244,63,94,0.14)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
      ),
    },
  ];

  const headerSortClass = '!px-5 !text-sm !normal-case !tracking-normal !font-medium';

  return (
    <div className="space-y-6" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Products
          </h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            The lending catalogue, its configuration and how each product is performing.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              Updated{' '}
              {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Link
            href="/dashboard/products/new"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            New product
          </Link>
        </div>
      </header>

      {/* ══ Key numbers ══ */}
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {loading && products.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[152px] animate-pulse rounded-3xl"
                style={{ backgroundColor: 'var(--rm-card-hover)' }}
              />
            ))
          : kpiCards.map(c => (
              <div key={c.label} className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.tint, color: 'var(--rm-accent)' }}
                  aria-hidden="true"
                >
                  {c.icon}
                </span>
                <p
                  className="mt-3 text-2xl font-semibold tabular-nums"
                  style={{ color: 'var(--rm-text)' }}
                >
                  {c.value}
                </p>
                <p className="mt-0.5 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {c.label}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {c.sub}
                </p>
              </div>
            ))}
      </section>

      {/* ══ Filters ══ */}
      <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }} aria-label="Product filters">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label
              htmlFor="product-search"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Search
            </label>
            <input
              id="product-search"
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Name, code or description"
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="product-status"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Status
            </label>
            <select
              id="product-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as FilterType)}
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="product-category"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Category
            </label>
            <select
              id="product-category"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            >
              <option value="all">All categories</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="product-customer-type"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Customer type
            </label>
            <select
              id="product-customer-type"
              value={customerTypeFilter}
              onChange={e => setCustomerTypeFilter(e.target.value as CustomerTypeFilter)}
              className="w-full rounded-xl px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--rm-input)',
                border: '1px solid var(--rm-border)',
                color: 'var(--rm-text)',
              }}
            >
              <option value="all">All customer types</option>
              {CUSTOMER_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm tabular-nums" role="status" style={{ color: 'var(--rm-text-muted)' }}>
            {loading
              ? 'Loading products…'
              : `${filteredProducts.length} of ${products.length} products shown`}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--rm-accent)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* ══ Error ══ */}
      {error && (
        <section
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-3xl p-6"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
        >
          <svg
            className="h-5 w-5 shrink-0"
            style={{ color: '#b91c1c' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="min-w-0 flex-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
            {error}
          </p>
          <button
            onClick={loadData}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
          >
            Try again
          </button>
        </section>
      )}

      {/* ══ Loading skeleton ══ */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-3xl"
              style={{ backgroundColor: 'var(--rm-card-hover)' }}
            />
          ))}
          <p className="sr-only" role="status">
            Loading products
          </p>
        </div>
      )}

      {/* ══ Empty ══ */}
      {!loading && !error && filteredProducts.length === 0 && (
        <section className="rounded-3xl px-6 py-20 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(127,127,127,0.14)' }}
            aria-hidden="true"
          >
            <svg
              className="h-7 w-7"
              style={{ color: 'var(--rm-text-muted)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
             aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
            {products.length === 0 ? 'No products yet' : 'No products match these filters'}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {products.length === 0
              ? 'Create the first product to start taking applications.'
              : 'Try a different status, category or search term.'}
          </p>
          {products.length === 0 ? (
            <Link
              href="/dashboard/products/new"
              className="mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              New product
            </Link>
          ) : (
            <button
              onClick={clearFilters}
              className="mt-5 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Clear filters
            </button>
          )}
        </section>
      )}

      {/* ══ Catalogue ══ */}
      {!loading && filteredProducts.length > 0 && (
        <section aria-label="Product catalogue">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Catalogue
            </h2>
            <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map(product => {
              const sm = statusMeta(product.productStatus);
              const ct = categoryTint(product.productCategory);
              const rp = riskProfile(product);
              const perf = perfFor(product);
              return (
                <article
                  key={product.productId}
                  onClick={() => router.push(`/dashboard/products/${product.productId}`)}
                  className="cursor-pointer rounded-3xl p-6 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--rm-card)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: ct.bg, color: ct.text }}
                        aria-hidden="true"
                      >
                        {productIcon}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                          <Link
                            href={`/dashboard/products/${product.productId}`}
                            onClick={e => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {product.productName}
                          </Link>
                        </h3>
                        <p className="truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {product.productCode} · {categoryLabel(product.productCategory)}
                        </p>
                      </div>
                    </div>
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
                      style={{ backgroundColor: sm.bg, color: sm.text }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: sm.dot }}
                        aria-hidden="true"
                      />
                      {sm.label}
                    </span>
                  </div>

                  {product.shortDescription && (
                    <p
                      className="mt-4 line-clamp-2 text-sm"
                      style={{ color: 'var(--rm-text-secondary)' }}
                    >
                      {product.shortDescription}
                    </p>
                  )}

                  <dl className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Applications
                      </dt>
                      <dd className="text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {perf.apps}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Approval rate
                      </dt>
                      <dd className="text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {perf.approvalRate != null ? `${perf.approvalRate.toFixed(1)}%` : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Average ticket
                      </dt>
                      <dd className="text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {perf.avgTicket != null ? compact(perf.avgTicket) : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Risk profile
                      </dt>
                      <dd>
                        <span
                          className="inline-flex items-center gap-1.5 text-sm font-medium"
                          style={{ color: rp.color }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: rp.color }}
                            aria-hidden="true"
                          />
                          {rp.label}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                    {product.minInterestRate?.toFixed(2)}%–{product.maxInterestRate?.toFixed(2)}% ·{' '}
                    {compact(product.minLoanAmount)}–{compact(product.maxLoanAmount)} ·{' '}
                    {product.minTermMonths}–{product.maxTermMonths} months
                  </p>

                  <div
                    className="mt-4 flex items-center justify-between gap-3 border-t pt-4"
                    style={{ borderColor: 'var(--rm-border)' }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--rm-accent)' }}
                    >
                      View details
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          router.push(`/dashboard/products/${product.productId}/edit`);
                        }}
                        className="rounded-full p-2 transition-opacity hover:opacity-75"
                        style={{ color: 'var(--rm-text-muted)' }}
                        aria-label={`Edit ${product.productName}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setDeleteTarget(product);
                        }}
                        className="rounded-full p-2 transition-opacity hover:opacity-75"
                        style={{ color: '#b91c1c' }}
                        aria-label={`Delete ${product.productName}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ══ Performance + insights ══ */}
      {!loading && performanceRows.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section
            className="overflow-hidden rounded-3xl xl:col-span-2"
            style={{ backgroundColor: 'var(--rm-card)' }}
            aria-label="Product performance"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 p-6 pb-4">
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                Performance
              </h2>
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Derived from the live application pipeline · amounts in {currencySymbol}
              </p>
            </div>
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Product performance, scrollable"
              tabIndex={0}
            >
              <table className="w-full" aria-label="Product performance from the application pipeline">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <SortableHeader
                      label="Product"
                      field="product.productName"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Applications"
                      field="apps"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Booked value"
                      field="booked"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Approval rate"
                      field="approvalRate"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Average ticket"
                      field="avgTicket"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                      className={headerSortClass}
                    />
                    <SortableHeader
                      label="Risk profile"
                      field="riskLabel"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                      className={headerSortClass}
                    />
                  </tr>
                </thead>
                <tbody>
                  {performanceRows.map(row => (
                    <tr
                      key={row.productId}
                      onClick={() => router.push(`/dashboard/products/${row.productId}`)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--rm-border)' }}
                      onMouseEnter={e =>
                        (e.currentTarget.style.backgroundColor = 'rgba(127,127,127,0.06)')
                      }
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/products/${row.productId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-base font-medium hover:underline"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {row.product.productName}
                        </Link>
                        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {row.category}
                        </p>
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {row.apps}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base font-semibold tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {row.booked > 0 ? compact(row.booked) : '—'}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {row.approvalRate != null ? `${row.approvalRate.toFixed(1)}%` : '—'}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-base tabular-nums"
                        style={{ color: 'var(--rm-text-secondary)' }}
                      >
                        {row.avgTicket != null ? compact(row.avgTicket) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className="inline-flex items-center gap-1.5 text-sm font-medium"
                          style={{ color: row.riskColor }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: row.riskColor }}
                            aria-hidden="true"
                          />
                          {row.riskLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className="flex items-center justify-between gap-3 px-5 py-4"
              style={{ borderTop: '1px solid var(--rm-border)' }}
            >
              <Link
                href="/dashboard/applications"
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--rm-accent)' }}
              >
                View the application pipeline
              </Link>
            </div>
          </section>

          <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }} aria-label="Product insights">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Insights
            </h2>
            <div className="mt-4 space-y-3">
              {insights.topActive && (
                <InsightCard
                  tint="rgba(14,165,233,0.14)"
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  }
                  title="Most active product"
                  body={`${insights.topActive.p.productName} leads the pipeline with ${insights.topActive.perf.apps} application${insights.topActive.perf.apps === 1 ? '' : 's'}.`}
                  onClick={() => router.push(`/dashboard/products/${insights.topActive!.p.productId}`)}
                />
              )}

              {insights.topBooked && insights.topBooked.perf.booked > 0 && (
                <InsightCard
                  tint="rgba(16,185,129,0.14)"
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10l8-6 8 6v11" />
                    </svg>
                  }
                  title="Highest booked value"
                  body={`${insights.topBooked.p.productName} has ${compact(insights.topBooked.perf.booked)} booked in the current pipeline.`}
                  onClick={() => router.push(`/dashboard/products/${insights.topBooked!.p.productId}`)}
                />
              )}

              {insights.bestApproval && (
                <InsightCard
                  tint="rgba(139,92,246,0.15)"
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="Best approval rate"
                  body={`${insights.bestApproval.p.productName} converts at ${(insights.bestApproval.perf.approvalRate ?? 0).toFixed(1)}%.`}
                  onClick={() => router.push(`/dashboard/products/${insights.bestApproval!.p.productId}`)}
                />
              )}

              {(insights.autoApproval > 0 || insights.featured > 0) && (
                <InsightCard
                  tint="rgba(245,158,11,0.15)"
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                  title="Configuration"
                  body={`${insights.autoApproval} product${insights.autoApproval === 1 ? '' : 's'} enabled for auto-approval · ${insights.featured} featured.`}
                />
              )}

              {!insights.topActive && !insights.topBooked && !insights.bestApproval && (
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No applications in the pipeline yet, so there is no performance to report.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ══ Delete confirmation ══ */}
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
            aria-labelledby="delete-product-title"
            aria-describedby="delete-product-body"
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
            <h2 id="delete-product-title" className="text-xl font-semibold" style={{ color: 'var(--rm-text)' }}>
              Delete {deleteTarget.productName}?
            </h2>
            <p id="delete-product-body" className="mt-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              This removes the product and its configuration from the catalogue. It cannot be
              undone.
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
                {deleting ? 'Deleting…' : 'Delete product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({
  tint,
  icon,
  title,
  body,
  onClick,
}: {
  tint: string;
  icon: ReactNode;
  title: string;
  body: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: tint, color: 'var(--rm-accent)' }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
          {title}
        </span>
        <span className="mt-0.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
          {body}
        </span>
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="flex gap-3 rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-input)' }}>
        {content}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full gap-3 rounded-2xl p-4 text-left transition-opacity hover:opacity-80"
      style={{ backgroundColor: 'var(--rm-input)' }}
    >
      {content}
    </button>
  );
}
