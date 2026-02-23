'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productService, type CreateProductRequest } from '@/services/api/productService';
import { useAppSelector } from '@/store';
import config from '@/config';

const PRODUCT_CATEGORIES = [
  { value: 'PERSONAL_CONSUMER', label: 'Personal & Consumer Products' },
  { value: 'BUSINESS_SME', label: 'Business & SME Products' },
  { value: 'SPECIALIZED_IRISH', label: 'Specialized Irish Products' },
];

const PRODUCT_TYPES_BY_CATEGORY: Record<string, { value: string; label: string }[]> = {
  PERSONAL_CONSUMER: [
    { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
    { value: 'PCP', label: 'Personal Contract Purchase (PCP)' },
    { value: 'HIRE_PURCHASE', label: 'Hire Purchase (HP)' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'OVERDRAFT', label: 'Overdraft' },
    { value: 'BNPL', label: 'Buy Now Pay Later (BNPL)' },
    { value: 'MORTGAGE', label: 'Mortgage' },
  ],
  BUSINESS_SME: [
    { value: 'SME_TERM_LOAN', label: 'SME Term Loan' },
    { value: 'BUSINESS_OVERDRAFT', label: 'Business Overdraft' },
    { value: 'INVOICE_FINANCE', label: 'Invoice Finance / Factoring' },
    { value: 'BUSINESS_CREDIT_CARD', label: 'Business Credit Card' },
    { value: 'COMMERCIAL_MORTGAGE', label: 'Commercial Mortgage' },
    { value: 'ASSET_LEASING', label: 'Asset Leasing / Equipment Finance' },
  ],
  SPECIALIZED_IRISH: [
    { value: 'AGRI_LOAN', label: 'Agri-Loans' },
    { value: 'CREDIT_UNION_LOAN', label: 'Credit Union Loan' },
    { value: 'GREEN_LOAN', label: 'Green Loans / Sustainable Finance' },
    { value: 'MICROFINANCE', label: 'Microfinance / Micro-Loan' },
  ],
};

const INTEREST_TYPES = [
  { value: 'FIXED', label: 'Fixed Rate' },
  { value: 'VARIABLE', label: 'Variable Rate' },
  { value: 'HYBRID', label: 'Hybrid (Fixed + Variable)' },
];

const REPAYMENT_FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
];

const REGULATORY_BODIES = [
  { value: 'CBI', label: 'Central Bank of Ireland (CBI)' },
  { value: 'CCPC', label: 'Competition & Consumer Protection Commission (CCPC)' },
  { value: 'ECB', label: 'European Central Bank (ECB)' },
  { value: 'EBA', label: 'European Banking Authority (EBA)' },
];

const CUSTOMER_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual Customers' },
  { value: 'BUSINESS', label: 'Business Customers' },
];

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'basic' | 'financial' | 'eligibility' | 'features' | 'irish'
  >('basic');

  const getBankId = (): string => {
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
  };

  const [formData, setFormData] = useState<Partial<CreateProductRequest>>({
    bankId: getBankId(),
    productCategory: 'PERSONAL_CONSUMER',
    productType: 'PERSONAL_LOAN',
    interestType: 'FIXED',
    repaymentFrequency: 'MONTHLY',
    eligibleCustomerTypes: ['INDIVIDUAL', 'BUSINESS'],
    minLoanAmount: 1000,
    maxLoanAmount: 50000,
    minInterestRate: 5.0,
    maxInterestRate: 15.0,
    minTermMonths: 6,
    maxTermMonths: 60,
    prepaymentAllowed: true,
    collateralRequired: false,
    isOnlineApplicationEnabled: true,
    isFeatured: false,
    autoApprovalEnabled: false,
    slaDays: 3,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCustomerTypeChange = (type: string) => {
    const currentTypes = formData.eligibleCustomerTypes || [];
    if (currentTypes.includes(type)) {
      if (currentTypes.length > 1) {
        setFormData(prev => ({
          ...prev,
          eligibleCustomerTypes: currentTypes.filter(t => t !== type),
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        eligibleCustomerTypes: [...currentTypes, type],
      }));
    }
  };

  const handleCategoryChange = (category: string) => {
    const productTypes = PRODUCT_TYPES_BY_CATEGORY[category] || [];
    setFormData(prev => ({
      ...prev,
      productCategory: category,
      productType: productTypes[0]?.value || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.productCode || !formData.productName) {
      setError('Product code and name are required.');
      return;
    }

    if (!formData.minLoanAmount || !formData.maxLoanAmount) {
      setError('Loan amount range is required.');
      return;
    }

    if (!formData.minInterestRate || !formData.maxInterestRate) {
      setError('Interest rate range is required.');
      return;
    }

    if (!formData.minTermMonths || !formData.maxTermMonths) {
      setError('Term range is required.');
      return;
    }

    try {
      setSaving(true);
      await productService.createProduct(formData as CreateProductRequest);
      router.push('/dashboard/products');
    } catch (err) {
      console.error('Failed to create product:', err);
      setError('Failed to create product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '📋' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'eligibility', label: 'Eligibility', icon: '✅' },
    { id: 'features', label: 'Features', icon: '⚙️' },
    { id: 'irish', label: 'Irish/EU Details', icon: '🇮🇪' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Create New Product</h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Add a new loan product to your portfolio
              </p>
            </div>
            <Link
              href="/dashboard/products"
              className="text-sm text-gray-600 hover:text-primary-600 font-medium"
            >
              ← Back to Products
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Error Display */}
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

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-6 py-4 text-sm font-medium border-b-2 ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Code *
                      </label>
                      <input
                        type="text"
                        name="productCode"
                        value={formData.productCode || ''}
                        onChange={handleInputChange}
                        placeholder="e.g., PL-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        name="productName"
                        value={formData.productName || ''}
                        onChange={handleInputChange}
                        placeholder="e.g., Personal Loan"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Category *
                      </label>
                      <select
                        name="productCategory"
                        value={formData.productCategory || ''}
                        onChange={e => handleCategoryChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {PRODUCT_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Type *
                      </label>
                      <select
                        name="productType"
                        value={formData.productType || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {(PRODUCT_TYPES_BY_CATEGORY[formData.productCategory || ''] || []).map(
                          type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Short Description
                    </label>
                    <input
                      type="text"
                      name="shortDescription"
                      value={formData.shortDescription || ''}
                      onChange={handleInputChange}
                      placeholder="Brief description for product cards"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Detailed Description
                    </label>
                    <textarea
                      name="detailedDescription"
                      value={formData.detailedDescription || ''}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Full product description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Eligible Customer Types *
                    </label>
                    <div className="flex space-x-4">
                      {CUSTOMER_TYPES.map(type => (
                        <label key={type.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.eligibleCustomerTypes?.includes(type.value) || false}
                            onChange={() => handleCustomerTypeChange(type.value)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {type.value === 'INDIVIDUAL' ? '👤' : '🏢'} {type.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Select which customer types can apply for this product
                    </p>
                  </div>
                </div>
              )}

              {/* Financial Tab */}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Loan Amount (€) *
                      </label>
                      <input
                        type="number"
                        name="minLoanAmount"
                        value={formData.minLoanAmount || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Loan Amount (€) *
                      </label>
                      <input
                        type="number"
                        name="maxLoanAmount"
                        value={formData.maxLoanAmount || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Loan Amount (€)
                      </label>
                      <input
                        type="number"
                        name="defaultLoanAmount"
                        value={formData.defaultLoanAmount || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Interest Type *
                      </label>
                      <select
                        name="interestType"
                        value={formData.interestType || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {INTEREST_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Interest Rate (%) *
                      </label>
                      <input
                        type="number"
                        name="minInterestRate"
                        value={formData.minInterestRate || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Interest Rate (%) *
                      </label>
                      <input
                        type="number"
                        name="maxInterestRate"
                        value={formData.maxInterestRate || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        name="defaultInterestRate"
                        value={formData.defaultInterestRate || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Term (months) *
                      </label>
                      <input
                        type="number"
                        name="minTermMonths"
                        value={formData.minTermMonths || ''}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Term (months) *
                      </label>
                      <input
                        type="number"
                        name="maxTermMonths"
                        value={formData.maxTermMonths || ''}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Term (months)
                      </label>
                      <input
                        type="number"
                        name="defaultTermMonths"
                        value={formData.defaultTermMonths || ''}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Repayment Frequency
                      </label>
                      <select
                        name="repaymentFrequency"
                        value={formData.repaymentFrequency || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {REPAYMENT_FREQUENCIES.map(freq => (
                          <option key={freq.value} value={freq.value}>
                            {freq.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Processing Fee (€)
                      </label>
                      <input
                        type="number"
                        name="processingFee"
                        value={formData.processingFee || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Processing Fee (%)
                      </label>
                      <input
                        type="number"
                        name="processingFeePercentage"
                        value={formData.processingFeePercentage || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Late Payment Fee (€)
                      </label>
                      <input
                        type="number"
                        name="latePaymentFee"
                        value={formData.latePaymentFee || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Eligibility Tab */}
              {activeTab === 'eligibility' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Customer Age
                      </label>
                      <input
                        type="number"
                        name="minCustomerAge"
                        value={formData.minCustomerAge || ''}
                        onChange={handleInputChange}
                        min="18"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Customer Age
                      </label>
                      <input
                        type="number"
                        name="maxCustomerAge"
                        value={formData.maxCustomerAge || ''}
                        onChange={handleInputChange}
                        min="18"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Credit Score
                      </label>
                      <input
                        type="number"
                        name="minCreditScore"
                        value={formData.minCreditScore || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="900"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Annual Income (€)
                      </label>
                      <input
                        type="number"
                        name="minAnnualIncome"
                        value={formData.minAnnualIncome || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="1000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Years in Business (for business loans)
                      </label>
                      <input
                        type="number"
                        name="minYearsInBusiness"
                        value={formData.minYearsInBusiness || ''}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Business Revenue (€)
                      </label>
                      <input
                        type="number"
                        name="minBusinessRevenue"
                        value={formData.minBusinessRevenue || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="1000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Features Tab */}
              {activeTab === 'features' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-gray-900">Product Features</h3>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="prepaymentAllowed"
                          checked={formData.prepaymentAllowed || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Prepayment Allowed</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="collateralRequired"
                          checked={formData.collateralRequired || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Collateral Required</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="downPaymentRequired"
                          checked={formData.downPaymentRequired || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Down Payment Required</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="requiresGuarantor"
                          checked={formData.requiresGuarantor || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Requires Guarantor</span>
                      </label>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-gray-900">Application Settings</h3>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="isOnlineApplicationEnabled"
                          checked={formData.isOnlineApplicationEnabled || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Online Application Enabled
                        </span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="autoApprovalEnabled"
                          checked={formData.autoApprovalEnabled || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Auto-Approval Enabled</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="isFeatured"
                          checked={formData.isFeatured || false}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Featured Product</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prepayment Penalty (%)
                      </label>
                      <input
                        type="number"
                        name="prepaymentPenaltyPercentage"
                        value={formData.prepaymentPenaltyPercentage || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Loan to Value Ratio (%)
                      </label>
                      <input
                        type="number"
                        name="loanToValueRatio"
                        value={formData.loanToValueRatio || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SLA Days
                      </label>
                      <input
                        type="number"
                        name="slaDays"
                        value={formData.slaDays || ''}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  {formData.autoApprovalEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auto-Approval Max Amount (€)
                        </label>
                        <input
                          type="number"
                          name="autoApprovalMaxAmount"
                          value={formData.autoApprovalMaxAmount || ''}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auto-Approval Min Credit Score
                        </label>
                        <input
                          type="number"
                          name="autoApprovalMinCreditScore"
                          value={formData.autoApprovalMinCreditScore || ''}
                          onChange={handleInputChange}
                          min="0"
                          max="900"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Irish/EU Details Tab */}
              {activeTab === 'irish' && (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex">
                      <span className="text-2xl mr-3">🇮🇪</span>
                      <div>
                        <h3 className="text-sm font-medium text-green-800">
                          Irish/EU Banking Details
                        </h3>
                        <p className="text-xs text-green-700 mt-1">
                          Specific fields for Irish and EU regulatory compliance
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Regulatory Body
                    </label>
                    <select
                      name="regulatoryBody"
                      value={formData.regulatoryBody || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select Regulatory Body</option>
                      {REGULATORY_BODIES.map(body => (
                        <option key={body.value} value={body.value}>
                          {body.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interest Logic Description
                    </label>
                    <textarea
                      name="interestLogicDescription"
                      value={formData.interestLogicDescription || ''}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="e.g., Simple interest, Flat rate calculation, Reducing balance method..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Describe how interest is calculated (reducing balance, flat rate, etc.)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Principal Structure
                    </label>
                    <textarea
                      name="principalStructure"
                      value={formData.principalStructure || ''}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="e.g., Equal monthly installments, Balloon payment at end, Interest-only period..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Describe how principal repayment is structured
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marketing Description
                    </label>
                    <textarea
                      name="marketingDescription"
                      value={formData.marketingDescription || ''}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Marketing copy for product promotion..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Terms & Conditions
                    </label>
                    <textarea
                      name="termsAndConditions"
                      value={formData.termsAndConditions || ''}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Key terms and conditions for this product..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/dashboard/products"
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Product'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
