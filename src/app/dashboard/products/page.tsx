'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { productService, type Product } from '@/services/api/productService';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'featured'>('all');

  const DEMO_BANK_ID = '123e4567-e89b-12d3-a456-426614174000'; // Demo Bank from database

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const data =
        filter === 'featured'
          ? await productService.getFeaturedProducts(DEMO_BANK_ID)
          : await productService.getAllProducts(DEMO_BANK_ID);

      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getProductIcon = (productType: string) => {
    const icons: Record<string, string> = {
      PERSONAL_LOAN: '💰',
      HOME_LOAN: '🏡',
      AUTO_LOAN: '🚗',
      BUSINESS_LOAN: '🏢',
      EDUCATION_LOAN: '🎓',
      GOLD_LOAN: '✨',
    };
    return icons[productType] || '💼';
  };

  const getProductColor = (productType: string) => {
    const colors: Record<string, string> = {
      PERSONAL_LOAN: 'blue',
      HOME_LOAN: 'green',
      AUTO_LOAN: 'purple',
      BUSINESS_LOAN: 'indigo',
      EDUCATION_LOAN: 'yellow',
      GOLD_LOAN: 'amber',
    };
    return colors[productType] || 'gray';
  };

  const formatFeatures = (product: Product): string[] => {
    const features: string[] = [];

    if (product.isOnlineApplicationEnabled) features.push('Online application available');
    if (product.prepaymentAllowed) features.push('Prepayment allowed');
    if (!product.collateralRequired) features.push('No collateral required');
    if (product.autoApprovalEnabled) features.push('Fast auto-approval');

    return features;
  };

  const formatEligibility = (product: Product): string[] => {
    const criteria: string[] = [];

    if (product.minCustomerAge || product.maxCustomerAge) {
      criteria.push(`Age: ${product.minCustomerAge || 18}-${product.maxCustomerAge || 65} years`);
    }
    if (product.minCreditScore) {
      criteria.push(`Min credit score: ${product.minCreditScore}`);
    }
    if (product.minAnnualIncome) {
      criteria.push(`Min income: ${productService.formatCurrency(product.minAnnualIncome)}/year`);
    }
    if (product.minYearsInBusiness) {
      criteria.push(`Min ${product.minYearsInBusiness} years in business`);
    }

    return criteria;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Loan Products</h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Browse and recommend products to customers
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-primary-600 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Filter Tabs */}
        <div className="mb-6 flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setFilter('all')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              filter === 'all'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setFilter('featured')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              filter === 'featured'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Featured Only
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && products.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filter.</p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {products.map(product => {
              const icon = getProductIcon(product.productType);
              const color = getProductColor(product.productType);
              const features = formatFeatures(product);
              const eligibility = formatEligibility(product);

              return (
                <div
                  key={product.productId}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className={`bg-${color}-50 px-6 py-4 border-b border-${color}-100`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">{icon}</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-bold text-gray-900">
                              {product.productName}
                            </h3>
                            {product.isFeatured && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Featured
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{product.shortDescription}</p>
                          <p className="text-xs text-gray-500 mt-1">Code: {product.productCode}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Key Details */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Interest Rate</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {productService.formatInterestRate(product.minInterestRate)} -{' '}
                          {productService.formatInterestRate(product.maxInterestRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {productService.formatCurrency(product.minLoanAmount)} -{' '}
                          {productService.formatCurrency(product.maxLoanAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Tenure</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {productService.formatTenure(product.minTermMonths)} -{' '}
                          {productService.formatTenure(product.maxTermMonths)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Processing Fee</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {product.processingFeePercentage
                            ? `${product.processingFeePercentage}% + GST`
                            : product.processingFee
                              ? `${productService.formatCurrency(product.processingFee)} + GST`
                              : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Features */}
                    {features.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-700 mb-2">Key Features</p>
                        <ul className="space-y-1">
                          {features.map((feature, idx) => (
                            <li key={idx} className="flex items-start text-xs text-gray-600">
                              <svg
                                className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Eligibility */}
                    {eligibility.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Eligibility Criteria
                        </p>
                        <ul className="space-y-1">
                          {eligibility.map((criteria, idx) => (
                            <li key={idx} className="flex items-start text-xs text-gray-600">
                              <svg
                                className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {criteria}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3">
                      <Link
                        href={`/dashboard/applications/new?productId=${product.productId}`}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                      >
                        Create Application
                      </Link>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
