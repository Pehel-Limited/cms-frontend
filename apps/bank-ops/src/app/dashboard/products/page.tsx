'use client';

import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productService, type Product } from '@/services/api/productService';
import { dashboardService, type DashboardKpis, type WorklistItem } from '@/services/api/dashboard-service';
import { useAppSelector } from '@/store';
import config from '@/config';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';

type FilterType = 'all' | 'active' | 'inactive';
type CategoryFilter = 'all' | 'PERSONAL_CONSUMER' | 'BUSINESS_SME' | 'SPECIALIZED_IRISH';
type CustomerTypeFilter = 'all' | 'INDIVIDUAL' | 'BUSINESS';

const PRODUCT_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'PERSONAL_CONSUMER', label: 'Personal & Consumer' },
  { value: 'BUSINESS_SME', label: 'Business & SME' },
  { value: 'SPECIALIZED_IRISH', label: 'Specialized Irish' },
];

const CUSTOMER_TYPES = [
  { value: 'all', label: 'All Customer Types' },
  { value: 'INDIVIDUAL', label: 'Individual Only' },
  { value: 'BUSINESS', label: 'Business Only' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: '#10b981' },
  INACTIVE: { label: 'Inactive', color: '#94a3b8' },
  DISCONTINUED: { label: 'Discontinued', color: '#ef4444' },
};

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  PERSONAL_CONSUMER: { label: 'Personal & Consumer', color: '#0ea5e9' },
  BUSINESS_SME: { label: 'Business & SME', color: '#6366f1' },
  SPECIALIZED_IRISH: { label: 'Specialized Irish', color: '#10b981' },
};

function statusMeta(status: string) {
  return STATUS_META[status] || { label: status || 'Unknown', color: '#94a3b8' };
}
function categoryMeta(cat: string) {
  return CATEGORY_META[cat] || { label: (cat || 'General').replace(/_/g, ' '), color: '#64748b' };
}

function riskProfile(p: Product): { label: string; color: string } {
  const rate = p.maxInterestRate ?? p.defaultInterestRate ?? 0;
  const secured = p.collateralRequired === true;
  if (rate >= 15 && !secured) return { label: 'High', color: '#ef4444' };
  if (rate >= 8) return { label: 'Medium', color: '#f59e0b' };
  return { label: 'Low', color: '#10b981' };
}

const productIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
          return userData.bankId || '123e4567-e89b-12d3-a456-426614174000';
        } catch {
          return '123e4567-e89b-12d3-a456-426614174000';
        }
      }
    }
    return '123e4567-e89b-12d3-a456-426614174000';
  }, [user?.bankId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const bankId = getBankId();
      const data = await productService.getAllProducts(bankId);
      setProducts(data);
      // Aggregates are best-effort — the catalog still renders if they fail.
      try {
        const [k, w] = await Promise.all([
          dashboardService.getKpis(bankId),
          dashboardService.getWorklist(bankId, undefined, 500),
        ]);
        setKpis(k);
        setWorklist(w);
      } catch (aggErr) {
        console.warn('Product performance aggregates unavailable:', aggErr);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [getBankId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
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
      const avgTicket =
        e.apps > 0
          ? e.reqSum / e.apps
          : p.defaultLoanAmount ?? (p.minLoanAmount + p.maxLoanAmount) / 2;
      const approvalRate = e.apps > 0 ? (e.approved / e.apps) * 100 : null;
      return { ...e, avgTicket, approvalRate };
    },
    [perfByProduct]
  );

  const handleDelete = async (productId: string) => {
    try {
      setDeleting(true);
      await productService.deleteProduct(productId);
      setProducts(products.filter(p => p.productId !== productId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
      setError('Failed to delete product. Please try again.');
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

  const formatCustomerTypes = (types?: string[]): string => {
    if (!types || types.length === 0) return 'All';
    if (types.length === 2) return 'All';
    return types.map(t => (t === 'INDIVIDUAL' ? 'Individual' : 'Business')).join(', ');
  };

  const activeCount = products.filter(p => p.productStatus === 'ACTIVE').length;
  const categoriesCount = new Set(products.map(p => p.productCategory)).size;
  const pipelineCount = kpis?.inProgressCount ?? worklist.length;

  const kpiCards: {
    label: string;
    value: string;
    sub: string;
    accent: string;
    icon: ReactNode;
  }[] = [
    {
      label: 'Active Products',
      value: String(activeCount),
      sub: `Across ${categoriesCount} categor${categoriesCount === 1 ? 'y' : 'ies'}`,
      accent: '#0ea5e9',
      icon: productIcon,
    },
    {
      label: 'Applications (Pipeline)',
      value: pipelineCount.toLocaleString(),
      sub: `${products.length} product${products.length === 1 ? '' : 's'} live`,
      accent: '#6366f1',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Booked Value (MTD)',
      value: kpis ? compact(kpis.bookedThisMonthValue) : '—',
      sub: kpis ? `${kpis.bookedThisMonthCount} loan${kpis.bookedThisMonthCount === 1 ? '' : 's'} booked` : 'No data',
      accent: '#10b981',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6" />
        </svg>
      ),
    },
    {
      label: 'Conversion Rate (30d)',
      value: kpis ? `${kpis.conversionRate30d.toFixed(1)}%` : '—',
      sub: 'Submitted → Booked',
      accent: '#8b5cf6',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />
        </svg>
      ),
    },
    {
      label: 'Needs Action',
      value: kpis ? String(kpis.needsActionCount) : '—',
      sub: kpis ? `${kpis.stuckAtRiskCount} at risk` : 'No data',
      accent: '#f43f5e',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
      ),
    },
  ];

  // Insights derived from real per-product performance.
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
    statusFilter !== 'all' || categoryFilter !== 'all' || customerTypeFilter !== 'all' || !!searchTerm;

  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* ──── Page header ──── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>Products</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
            Monitor product performance, manage offerings and drive growth.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>As of {today}</span>
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Product
          </Link>
        </div>
      </div>

      {/* ──── KPI cards ──── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map(c => (
          <div
            key={c.label}
            className="rounded-2xl p-4"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: `${c.accent}1f`, color: c.accent }}
            >
              {c.icon}
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>
              {c.label}
            </p>
            <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--rm-text)' }}>
              {c.value}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--rm-text-secondary)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ──── Filters ──── */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, code, or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as FilterType)}
            className="px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 appearance-none"
            style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
            className="px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 appearance-none"
            style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
          >
            {PRODUCT_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={customerTypeFilter}
            onChange={e => setCustomerTypeFilter(e.target.value as CustomerTypeFilter)}
            className="px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 appearance-none"
            style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
          >
            {CUSTOMER_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              Showing <span className="font-semibold" style={{ color: 'var(--rm-text-secondary)' }}>{filteredProducts.length}</span> of{' '}
              <span className="font-semibold" style={{ color: 'var(--rm-text-secondary)' }}>{products.length}</span> products
            </p>
            <button onClick={clearFilters} className="text-xs font-semibold hover:underline" style={{ color: 'var(--rm-accent)' }}>
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ──── Error ──── */}
      {error && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#ef444418', border: '1px solid #ef444455' }}>
          <svg className="w-5 h-5 shrink-0" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm" style={{ color: 'var(--rm-text)' }}>{error}</span>
          <button onClick={loadData} className="ml-auto text-sm font-medium hover:underline" style={{ color: '#ef4444' }}>Retry</button>
        </div>
      )}

      {/* ──── Loading ──── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="relative w-14 h-14 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: 'var(--rm-border)' }} />
              <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin" style={{ borderTopColor: 'var(--rm-accent)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>Loading products...</p>
          </div>
        </div>
      )}

      {/* ──── Empty ──── */}
      {!loading && !error && filteredProducts.length === 0 && (
        <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--rm-input)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="font-semibold text-lg" style={{ color: 'var(--rm-text)' }}>No products found</p>
          <p className="text-sm mt-1 mb-6" style={{ color: 'var(--rm-text-muted)' }}>
            {products.length === 0 ? 'Get started by creating your first product.' : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {/* ──── Product Catalog ──── */}
      {!loading && !error && filteredProducts.length > 0 && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>Product Catalog</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}>
              {filteredProducts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map(product => {
              const sm = statusMeta(product.productStatus);
              const cm = categoryMeta(product.productCategory);
              const rp = riskProfile(product);
              const perf = perfFor(product);
              return (
                <div
                  key={product.productId}
                  onClick={() => router.push(`/dashboard/products/${product.productId}`)}
                  className="rounded-2xl p-4 cursor-pointer transition-colors group"
                  style={{ backgroundColor: 'var(--rm-bg)', border: '1px solid var(--rm-border)' }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cm.color}1f`, color: cm.color }}>
                        {productIcon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{product.productName}</h3>
                        <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>{product.productCode}</p>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${sm.color}22`, color: sm.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sm.color }} />
                      {sm.label}
                    </span>
                  </div>

                  {/* Description */}
                  {product.shortDescription && (
                    <p className="text-xs line-clamp-2 mb-3 min-h-[2rem]" style={{ color: 'var(--rm-text-secondary)' }}>
                      {product.shortDescription}
                    </p>
                  )}

                  {/* Metric rows */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--rm-text-muted)' }}>Applications</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>{perf.apps}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--rm-text-muted)' }}>Approval Rate</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {perf.approvalRate != null ? `${perf.approvalRate.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--rm-text-muted)' }}>Avg. Ticket Size</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>{compact(perf.avgTicket)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--rm-text-muted)' }}>Risk Profile</span>
                      <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: rp.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rp.color }} />
                        {rp.label}
                      </span>
                    </div>
                  </div>

                  {/* Config footer */}
                  <p className="text-[11px] mt-3 tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                    {product.minInterestRate?.toFixed(2)}%–{product.maxInterestRate?.toFixed(2)}% · {compact(product.minLoanAmount)}–{compact(product.maxLoanAmount)} · {product.minTermMonths}–{product.maxTermMonths} mo
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--rm-border)' }}>
                    <span className="text-xs font-semibold inline-flex items-center gap-1 group-hover:gap-1.5 transition-all" style={{ color: 'var(--rm-accent)' }}>
                      View Details
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/dashboard/products/${product.productId}/edit`); }}
                        className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                        style={{ color: 'var(--rm-text-muted)' }}
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(product.productId); }}
                        className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                        style={{ color: '#ef4444' }}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──── Performance table + Insights ──── */}
      {!loading && !error && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Performance table */}
          <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rm-border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>Product Performance (Pipeline)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--rm-bg)', borderBottom: '1px solid var(--rm-border)' }}>
                    {['Product', 'Applications', 'Booked Value', 'Approval Rate', 'Avg. Ticket', 'Risk'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--rm-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => {
                    const cm = categoryMeta(product.productCategory);
                    const rp = riskProfile(product);
                    const perf = perfFor(product);
                    return (
                      <tr
                        key={product.productId}
                        onClick={() => router.push(`/dashboard/products/${product.productId}`)}
                        className="cursor-pointer transition-colors hover:opacity-90"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cm.color}1f`, color: cm.color }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--rm-text)' }}>{product.productName}</p>
                              <p className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>{cm.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums" style={{ color: 'var(--rm-text)' }}>{perf.apps}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                          {perf.booked > 0 ? compact(perf.booked) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums" style={{ color: 'var(--rm-text)' }}>
                          {perf.approvalRate != null ? `${perf.approvalRate.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>{compact(perf.avgTicket)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: rp.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rp.color }} />
                            {rp.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--rm-border)' }}>
              <Link href="/dashboard/applications" className="text-xs font-semibold inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--rm-accent)' }}>
                View application pipeline
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
              <span className="text-[11px]" style={{ color: 'var(--rm-text-muted)' }}>All amounts in {currencySymbol}</span>
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>Product Insights</h2>

            {insights.topActive && (
              <InsightCard
                accent="#0ea5e9"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                title="Most Active Product"
                body={`${insights.topActive.p.productName} leads the pipeline with ${insights.topActive.perf.apps} application${insights.topActive.perf.apps === 1 ? '' : 's'}.`}
                onClick={() => router.push(`/dashboard/products/${insights.topActive!.p.productId}`)}
              />
            )}

            {insights.topBooked && insights.topBooked.perf.booked > 0 && (
              <InsightCard
                accent="#10b981"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10l8-6 8 6v11" /></svg>}
                title="Highest Booked Value"
                body={`${insights.topBooked.p.productName} has booked ${compact(insights.topBooked.perf.booked)} this pipeline.`}
                onClick={() => router.push(`/dashboard/products/${insights.topBooked!.p.productId}`)}
              />
            )}

            {insights.bestApproval && (
              <InsightCard
                accent="#8b5cf6"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                title="Best Approval Rate"
                body={`${insights.bestApproval.p.productName} converts at ${(insights.bestApproval.perf.approvalRate ?? 0).toFixed(1)}% approval.`}
                onClick={() => router.push(`/dashboard/products/${insights.bestApproval!.p.productId}`)}
              />
            )}

            {(insights.autoApproval > 0 || insights.featured > 0) && (
              <InsightCard
                accent="#f59e0b"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                title="Configuration"
                body={`${insights.autoApproval} product${insights.autoApproval === 1 ? '' : 's'} enabled for auto-approval · ${insights.featured} featured.`}
              />
            )}

            <Link
              href="/dashboard/products/new"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add New Product
            </Link>
          </div>
        </div>
      )}

      {/* ──── Delete Confirmation Modal ──── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ef444418' }}>
              <svg className="w-6 h-6" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--rm-text)' }}>Delete Product</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--rm-text-muted)' }}>
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 font-medium rounded-xl transition-colors hover:opacity-80"
                style={{ color: 'var(--rm-text-secondary)', backgroundColor: 'var(--rm-input)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-white font-medium rounded-xl disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#dc2626' }}
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

function InsightCard({
  accent,
  icon,
  title,
  body,
  onClick,
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  body: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 flex gap-3 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      style={{ backgroundColor: 'var(--rm-bg)', border: '1px solid var(--rm-border)' }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1f`, color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</p>
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--rm-text-secondary)' }}>{body}</p>
      </div>
    </div>
  );
}
