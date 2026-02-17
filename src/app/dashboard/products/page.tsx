'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productService, type Product } from '@/services/api/productService';
import { useAppSelector } from '@/store';
import config from '@/config';

type FilterType = 'all' | 'active' | 'inactive' | 'featured';
type CategoryFilter = 'all' | 'PERSONAL_CONSUMER' | 'BUSINESS_SME' | 'SPECIALIZED_IRISH';
type CustomerTypeFilter = 'all' | 'INDIVIDUAL' | 'BUSINESS';
type ViewMode = 'table' | 'card';

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

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  DISCONTINUED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

const CATEGORY_BADGE: Record<string, { bg: string; text: string; icon: ReactNode }> = {
  PERSONAL_CONSUMER: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  BUSINESS_SME: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  SPECIALIZED_IRISH: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
};

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

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

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const bankId = getBankId();
      const data = await productService.getAllProducts(bankId);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [getBankId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Apply filters
  useEffect(() => {
    let result = [...products];

    if (statusFilter === 'active') {
      result = result.filter(p => p.productStatus === 'ACTIVE');
    } else if (statusFilter === 'inactive') {
      result = result.filter(p => p.productStatus === 'INACTIVE');
    } else if (statusFilter === 'featured') {
      result = result.filter(p => p.isFeatured);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(p => p.productCategory === categoryFilter);
    }

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

    setFilteredProducts(result);
  }, [products, statusFilter, categoryFilter, customerTypeFilter, searchTerm]);

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

  const formatCustomerTypes = (types?: string[]): string => {
    if (!types || types.length === 0) return 'All';
    if (types.length === 2) return 'All';
    return types.map(t => (t === 'INDIVIDUAL' ? 'Individual' : 'Business')).join(', ');
  };

  const getStatusBadge = (status: string) =>
    STATUS_BADGE[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

  const getCategoryBadge = (cat: string) =>
    CATEGORY_BADGE[cat] || {
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
      ),
    };

  const statCards = [
    {
      label: 'Total',
      value: products.length,
      icon: (
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
          <svg
            className="w-4 h-4 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
      ),
      color: 'text-slate-900',
    },
    {
      label: 'Active',
      value: products.filter(p => p.productStatus === 'ACTIVE').length,
      icon: (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto">
          <svg
            className="w-4 h-4 text-emerald-600"
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
        </div>
      ),
      color: 'text-emerald-600',
    },
    {
      label: 'Featured',
      value: products.filter(p => p.isFeatured).length,
      icon: (
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mx-auto">
          <svg
            className="w-4 h-4 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </div>
      ),
      color: 'text-amber-600',
    },
    {
      label: 'Categories',
      value: new Set(products.map(p => p.productCategory)).size,
      icon: (
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mx-auto">
          <svg
            className="w-4 h-4 text-violet-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
      ),
      color: 'text-violet-600',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ──── Gradient header banner ──── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a3a7a] via-[#1e4da0] to-[#3b82f6]">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 w-56 h-56 bg-blue-400/10 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-100"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
        </svg>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-14">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Product Management</h1>
              <p className="text-blue-200 text-sm mt-1">
                Manage loan products for Irish/EU banking
              </p>
            </div>
            <Link
              href="/dashboard/products/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Product
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 space-y-4">
        {/* ──── Stats strip ──── */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {statCards.map(s => (
            <div
              key={s.label}
              className="flex-none min-w-[140px] bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm px-5 py-3 text-center"
            >
              {s.icon}
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ──── Filters card ──── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                placeholder="Search by name, code, or description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as FilterType)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors appearance-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="featured">Featured</option>
            </select>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors appearance-none"
            >
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <select
              value={customerTypeFilter}
              onChange={e => setCustomerTypeFilter(e.target.value as CustomerTypeFilter)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors appearance-none"
            >
              {CUSTOMER_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ──── View toggle + count ──── */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700">{filteredProducts.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{products.length}</span> products
            </p>
            <div className="flex items-center bg-white rounded-xl border border-slate-200/80 shadow-sm p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Table view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Card view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ──── Error ──── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
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
            <span className="text-sm">{error}</span>
            <button
              onClick={loadProducts}
              className="ml-auto text-sm font-medium text-red-800 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ──── Loading ──── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Loading products...</p>
            </div>
          </div>
        )}

        {/* ──── Empty state ──── */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm py-20 text-center">
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
                  strokeWidth={1.8}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold text-lg">No products found</p>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              {products.length === 0
                ? 'Get started by creating your first product.'
                : 'Try adjusting your filters.'}
            </p>
            {products.length === 0 && (
              <Link
                href="/dashboard/products/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Product
              </Link>
            )}
          </div>
        )}

        {/* ──── TABLE VIEW ──── */}
        {!loading && !error && filteredProducts.length > 0 && viewMode === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Rates & Terms
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Eligible For
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProducts.map(product => {
                    const sb = getStatusBadge(product.productStatus);
                    const cb = getCategoryBadge(product.productCategory);
                    return (
                      <tr
                        key={product.productId}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/dashboard/products/${product.productId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {product.productName}
                            </p>
                            {product.isFeatured && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                                ★
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{product.productCode}</p>
                          {product.shortDescription && (
                            <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                              {product.shortDescription}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cb.bg} ${cb.text}`}
                          >
                            {cb.icon} {product.productCategory?.replace(/_/g, ' ')}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">
                            {product.productType?.replace(/_/g, ' ')}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-slate-900 tabular-nums">
                            {product.minInterestRate?.toFixed(2)}% –{' '}
                            {product.maxInterestRate?.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            €{product.minLoanAmount?.toLocaleString()} – €
                            {product.maxLoanAmount?.toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-400">
                            {product.minTermMonths} – {product.maxTermMonths} mo
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {formatCustomerTypes(product.eligibleCustomerTypes) === 'All' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                                All Types
                              </span>
                            ) : (
                              product.eligibleCustomerTypes?.map(type => (
                                <span
                                  key={type}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${type === 'INDIVIDUAL' ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${type === 'INDIVIDUAL' ? 'bg-sky-500' : 'bg-indigo-500'}`}
                                  />
                                  {type}
                                </span>
                              ))
                            )}
                          </div>
                          {product.regulatoryBody && (
                            <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1">
                              <svg
                                className="w-3 h-3 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              {product.regulatoryBody}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sb.bg} ${sb.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${sb.dot}`} />
                            {product.productStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end items-center gap-1">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                router.push(`/dashboard/products/${product.productId}`);
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                router.push(`/dashboard/products/${product.productId}/edit`);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setDeleteConfirm(product.productId);
                              }}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ──── CARD VIEW ──── */}
        {!loading && !error && filteredProducts.length > 0 && viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => {
              const sb = getStatusBadge(product.productStatus);
              const cb = getCategoryBadge(product.productCategory);
              return (
                <div
                  key={product.productId}
                  onClick={() => router.push(`/dashboard/products/${product.productId}`)}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden"
                >
                  {/* Card top accent */}
                  <div
                    className={`h-1.5 ${product.productStatus === 'ACTIVE' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : product.productStatus === 'DISCONTINUED' ? 'bg-gradient-to-r from-red-400 to-rose-500' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`}
                  />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                            {product.productName}
                          </h3>
                          {product.isFeatured && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                              ★ Featured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{product.productCode}</p>
                      </div>
                      <span
                        className={`shrink-0 ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sb.bg} ${sb.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${sb.dot}`} />
                        {product.productStatus}
                      </span>
                    </div>

                    {/* Description */}
                    {product.shortDescription && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                        {product.shortDescription}
                      </p>
                    )}

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Interest Rate
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                          {product.minInterestRate?.toFixed(2)}% –{' '}
                          {product.maxInterestRate?.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Loan Amount
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                          €{(product.minLoanAmount || 0).toLocaleString()} – €
                          {(product.maxLoanAmount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Term
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {product.minTermMonths} – {product.maxTermMonths} months
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Category
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 mt-0.5 text-xs font-medium ${cb.text}`}
                        >
                          {cb.icon} {product.productCategory?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Footer: eligible + actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap gap-1">
                        {formatCustomerTypes(product.eligibleCustomerTypes) === 'All' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-600">
                            All Types
                          </span>
                        ) : (
                          product.eligibleCustomerTypes?.map(type => (
                            <span
                              key={type}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${type === 'INDIVIDUAL' ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600'}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${type === 'INDIVIDUAL' ? 'bg-sky-500' : 'bg-indigo-500'}`}
                              />
                              {type}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/dashboard/products/${product.productId}/edit`);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Edit"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setDeleteConfirm(product.productId);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ──── Delete Confirmation Modal ──── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Delete Product</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
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
