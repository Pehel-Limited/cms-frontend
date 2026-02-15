'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { productService, type Product } from '@/services/api/productService';
import { useAppSelector } from '@/store';
import config from '@/config';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  DISCONTINUED: 'bg-red-100 text-red-800',
};

const PRODUCT_TYPE_ICONS: Record<string, string> = {
  PERSONAL_LOAN: '💰',
  PCP: '🚗',
  HIRE_PURCHASE: '🚙',
  CREDIT_CARD: '💳',
  OVERDRAFT: '🏦',
  BNPL: '🛒',
  MORTGAGE: '🏠',
  SME_TERM_LOAN: '🏢',
  BUSINESS_OVERDRAFT: '💼',
  INVOICE_FINANCE: '📄',
  BUSINESS_CREDIT_CARD: '💳',
  COMMERCIAL_MORTGAGE: '🏭',
  ASSET_LEASING: '⚙️',
  AGRI_LOAN: '🌾',
  CREDIT_UNION_LOAN: '🤝',
  GREEN_LOAN: '🌿',
  MICROFINANCE: '🌱',
  HOME_LOAN: '🏡',
  AUTO_LOAN: '🚗',
  BUSINESS_LOAN: '🏢',
};

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
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto py-12 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-lg font-medium text-red-800">{error || 'Product not found'}</h2>
            <Link
              href="/dashboard/products"
              className="mt-4 inline-block text-primary-600 hover:text-primary-700"
            >
              ← Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-3xl mr-3">
                {PRODUCT_TYPE_ICONS[product.productType] || '💼'}
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-gray-900">{product.productName}</h1>
                  {product.isFeatured && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      ★ Featured
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[product.productStatus] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {product.productStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Code: {product.productCode}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/dashboard/products/${productId}/edit`)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Product
              </button>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                href="/dashboard/products"
                className="text-sm text-gray-600 hover:text-primary-600 font-medium"
              >
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {(product.shortDescription || product.detailedDescription) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
                {product.shortDescription && (
                  <p className="text-sm text-gray-600 mb-2">{product.shortDescription}</p>
                )}
                {product.detailedDescription && (
                  <p className="text-sm text-gray-500">{product.detailedDescription}</p>
                )}
              </div>
            )}

            {/* Financial Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">💰 Financial Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Loan Amount Range</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(product.minLoanAmount)} -{' '}
                    {formatCurrency(product.maxLoanAmount)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Interest Rate Range</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatPercentage(product.minInterestRate)} -{' '}
                    {formatPercentage(product.maxInterestRate)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Term Range</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {product.minTermMonths} - {product.maxTermMonths} months
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Interest Type</p>
                  <p className="text-sm font-semibold text-gray-900">{product.interestType}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Processing Fee</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {product.processingFeePercentage
                      ? formatPercentage(product.processingFeePercentage)
                      : formatCurrency(product.processingFee)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Repayment Frequency</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {product.repaymentFrequency || 'Monthly'}
                  </p>
                </div>
              </div>
            </div>

            {/* Eligibility Criteria */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">✅ Eligibility Criteria</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Customer Age</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {product.minCustomerAge || 18} - {product.maxCustomerAge || 65} years
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Min Credit Score</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {product.minCreditScore || 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Min Annual Income</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(product.minAnnualIncome)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Min Years in Business</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {product.minYearsInBusiness || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Irish/EU Details */}
            {(product.regulatoryBody ||
              product.interestLogicDescription ||
              product.principalStructure) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">🇮🇪 Irish/EU Details</h2>
                <div className="space-y-4">
                  {product.regulatoryBody && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Regulatory Body</p>
                      <p className="text-sm text-gray-900">{product.regulatoryBody}</p>
                    </div>
                  )}
                  {product.interestLogicDescription && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Interest Logic</p>
                      <p className="text-sm text-gray-900">{product.interestLogicDescription}</p>
                    </div>
                  )}
                  {product.principalStructure && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Principal Structure</p>
                      <p className="text-sm text-gray-900">{product.principalStructure}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Product Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-gray-500">Category</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.productCategory?.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Type</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.productType?.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Eligible For</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formatCustomerTypes(product.eligibleCustomerTypes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">SLA</dt>
                  <dd className="text-sm font-medium text-gray-900">{product.slaDays || 3} days</dd>
                </div>
              </dl>
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Features</h3>
              <ul className="space-y-2">
                <li className="flex items-center text-sm">
                  <span
                    className={`w-4 h-4 mr-2 ${product.prepaymentAllowed ? 'text-green-500' : 'text-gray-300'}`}
                  >
                    {product.prepaymentAllowed ? '✓' : '✗'}
                  </span>
                  Prepayment Allowed
                </li>
                <li className="flex items-center text-sm">
                  <span
                    className={`w-4 h-4 mr-2 ${product.collateralRequired ? 'text-yellow-500' : 'text-green-500'}`}
                  >
                    {product.collateralRequired ? '!' : '✓'}
                  </span>
                  {product.collateralRequired ? 'Collateral Required' : 'No Collateral'}
                </li>
                <li className="flex items-center text-sm">
                  <span
                    className={`w-4 h-4 mr-2 ${product.isOnlineApplicationEnabled ? 'text-green-500' : 'text-gray-300'}`}
                  >
                    {product.isOnlineApplicationEnabled ? '✓' : '✗'}
                  </span>
                  Online Application
                </li>
                <li className="flex items-center text-sm">
                  <span
                    className={`w-4 h-4 mr-2 ${product.autoApprovalEnabled ? 'text-green-500' : 'text-gray-300'}`}
                  >
                    {product.autoApprovalEnabled ? '✓' : '✗'}
                  </span>
                  Auto-Approval
                </li>
                <li className="flex items-center text-sm">
                  <span
                    className={`w-4 h-4 mr-2 ${product.requiresGuarantor ? 'text-yellow-500' : 'text-green-500'}`}
                  >
                    {product.requiresGuarantor ? '!' : '✓'}
                  </span>
                  {product.requiresGuarantor ? 'Guarantor Required' : 'No Guarantor'}
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href={`/dashboard/applications/new?productId=${productId}`}
                  className="w-full inline-flex justify-center items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                >
                  Create Application
                </Link>
                <Link
                  href={`/dashboard/products/${productId}/edit`}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Edit Product
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
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
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Delete Product</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to delete &quot;{product.productName}&quot;? This action cannot
              be undone.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
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
