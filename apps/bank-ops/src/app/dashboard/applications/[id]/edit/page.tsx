'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import { customerService, type Customer } from '@/services/api/customerService';
import config from '@/config';
import { formatCurrency } from '@/lib/format';
import DynamicProductFields, {
  type FormValues,
} from '@/components/applications/DynamicProductFields';
import { getProductFieldConfig } from '@/config/productFieldConfig';

export default function EditApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const { user: currentUser } = useAppSelector(state => state.auth);
  const bankId = config.bank?.defaultBankId || '123e4567-e89b-12d3-a456-426614174000';

  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [requestedTermMonths, setRequestedTermMonths] = useState('');
  const [requestedInterestRate, setRequestedInterestRate] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanPurposeDescription, setLoanPurposeDescription] = useState('');

  // Product-specific additional fields (key-value map driven by productFieldConfig)
  const [additionalData, setAdditionalData] = useState<FormValues>({});

  useEffect(() => {
    loadData();
  }, [applicationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [appData, productsData] = await Promise.all([
        applicationService.getApplication(applicationId),
        productService.getAllProducts(bankId),
      ]);

      setApplication(appData);
      setProducts(productsData);

      // Fetch full customer details
      if (appData.customerId) {
        try {
          const customerData = await customerService.getCustomerById(appData.customerId);
          setCustomer(customerData);
        } catch (custErr) {
          console.error('Failed to load customer details:', custErr);
        }
      }

      // Populate form fields
      setSelectedProductId(appData.productId || '');
      setRequestedAmount(appData.requestedAmount?.toString() || '');
      setRequestedTermMonths(appData.requestedTermMonths?.toString() || '');
      // Interest rate is now stored as percentage (9.5 = 9.5%)
      setRequestedInterestRate(
        appData.requestedInterestRate ? appData.requestedInterestRate.toString() : ''
      );
      setLoanPurpose(appData.loanPurpose || '');
      setLoanPurposeDescription(appData.loanPurposeDescription || '');

      // Populate product-specific additional data from known application fields
      const productType =
        productsData.find(p => p.productId === appData.productId)?.productType || '';
      const initialAdditional: FormValues = {};

      // Map known ApplicationResponse fields into additionalData keys used by productFieldConfig
      const fieldMappings: Array<{ key: string; value: string | number | undefined | null }> = [
        { key: 'propertyAddress', value: appData.propertyAddress },
        { key: 'propertyCity', value: appData.propertyCity },
        { key: 'propertyState', value: appData.propertyState },
        { key: 'propertyValue', value: appData.propertyValue },
        { key: 'deposit_amount', value: appData.downPaymentAmount },
        { key: 'employmentStatus', value: appData.employmentStatus },
        { key: 'employerName', value: appData.employerName },
        { key: 'annualIncome', value: appData.statedAnnualIncome },
      ];

      for (const { key, value } of fieldMappings) {
        if (value != null && value !== '') {
          initialAdditional[key] = value.toString();
        }
      }

      // Also load any previously-saved additionalData from the response
      if ((appData as any).additionalData && typeof (appData as any).additionalData === 'object') {
        Object.assign(initialAdditional, (appData as any).additionalData);
      }

      setAdditionalData(initialAdditional);
    } catch (err: any) {
      setError(err.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData: any = {
        productId: selectedProductId,
        requestedAmount: parseFloat(requestedAmount),
        requestedTermMonths: parseInt(requestedTermMonths) || undefined,
        loanPurpose,
      };

      if (requestedInterestRate) {
        // Convert from percentage (displayed) back to decimal (stored)
        updateData.requestedInterestRate = parseFloat(requestedInterestRate);
      }
      if (loanPurposeDescription) {
        updateData.loanPurposeDescription = loanPurposeDescription;
      }

      // Map product-specific fields back to known backend columns
      const knownPropertyKeys = [
        'propertyAddress',
        'propertyCity',
        'propertyState',
        'propertyPostalCode',
        'propertyType',
      ];
      for (const k of knownPropertyKeys) {
        if (additionalData[k]) updateData[k] = additionalData[k];
      }
      if (additionalData['propertyValue']) {
        updateData.propertyValue = parseFloat(additionalData['propertyValue']);
      }
      if (additionalData['deposit_amount'] || additionalData['downPaymentAmount']) {
        updateData.downPaymentAmount = parseFloat(
          additionalData['deposit_amount'] || additionalData['downPaymentAmount'] || '0'
        );
      }
      // Vehicle fields
      if (additionalData['vehicleMake']) updateData.vehicleMake = additionalData['vehicleMake'];
      if (additionalData['vehicleModel']) updateData.vehicleModel = additionalData['vehicleModel'];
      if (additionalData['vehicleYear'])
        updateData.vehicleYear = parseInt(additionalData['vehicleYear']);
      if (additionalData['vehicleCondition'])
        updateData.vehicleCondition = additionalData['vehicleCondition'];
      if (additionalData['vehicleValue'])
        updateData.vehicleValue = parseFloat(additionalData['vehicleValue']);
      // Employment / income
      if (additionalData['employmentStatus'])
        updateData.employmentStatus = additionalData['employmentStatus'];
      if (additionalData['employerName']) updateData.employerName = additionalData['employerName'];
      if (additionalData['annualIncome'])
        updateData.statedAnnualIncome = parseFloat(additionalData['annualIncome']);

      // Store remaining product-specific fields as additionalData JSON (for backend extension)
      const backendMappedKeys = new Set([
        ...knownPropertyKeys,
        'propertyValue',
        'deposit_amount',
        'downPaymentAmount',
        'vehicleMake',
        'vehicleModel',
        'vehicleYear',
        'vehicleCondition',
        'vehicleValue',
        'employmentStatus',
        'employerName',
        'annualIncome',
      ]);
      const extraData: Record<string, string> = {};
      for (const [k, v] of Object.entries(additionalData)) {
        if (!backendMappedKeys.has(k) && v) {
          extraData[k] = v;
        }
      }
      if (Object.keys(extraData).length > 0) {
        updateData.additionalData = extraData;
      }

      await applicationService.updateApplication(applicationId, updateData);
      setSuccess('Application updated successfully!');

      // Redirect back to application detail after a short delay
      setTimeout(() => {
        router.push(`/dashboard/applications/${applicationId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update application');
    } finally {
      setSaving(false);
    }
  };

  // Get effective status - status and lomsStatus are now unified
  const effectiveStatus = application?.status || '';

  const canEdit =
    application &&
    [
      'DRAFT',
      'RETURNED',
      'SUBMITTED',
      'PENDING_KYC',
      'PENDING_CREDIT_CHECK',
      'IN_UNDERWRITING',
    ].includes(effectiveStatus) &&
    currentUser?.userId === application.createdByUserId;

  // Hooks must be called unconditionally (before any early returns)
  const selectedProduct = products.find(p => p.productId === selectedProductId);
  const productType = selectedProduct?.productType || '';
  const fieldConfig = useMemo(() => getProductFieldConfig(productType), [productType]);

  // Dynamic labels from product config
  const amountLabel = fieldConfig.amountLabel || 'Requested Amount';
  const termLabel = fieldConfig.termLabel;
  const hideTerm = termLabel === '';

  // Handler for product-specific field changes
  const handleAdditionalChange = useCallback((key: string, value: string) => {
    setAdditionalData(prev => ({ ...prev, [key]: value }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
        <button
          onClick={() => router.push(`/dashboard/applications/${applicationId}`)}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Application
        </button>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          You don&apos;t have permission to edit this application.
        </div>
        <button
          onClick={() => router.push(`/dashboard/applications/${applicationId}`)}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Application
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/dashboard/applications/${applicationId}`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Application
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Edit Application</h1>
        <p className="text-gray-600 mt-1">
          Application {application?.applicationNumber} • Status:{' '}
          {application?.status.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* Customer Details */}
        {customer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Customer Details
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/dashboard/customers/${customer.customerId}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit customer profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit Profile
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer Name
                </p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {customerService.getCustomerName(customer)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer Number
                </p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {customer.customerNumber}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer Type
                </p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {customerService.formatCustomerType(customer.customerType)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</p>
                <p className="text-sm text-slate-700 mt-0.5">{customer.primaryEmail || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm text-slate-700 mt-0.5">{customer.primaryPhone || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${
                    customer.customerStatus === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {customer.customerStatus}
                </span>
              </div>
              {customer.addressLine1 && (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Address
                  </p>
                  <p className="text-sm text-slate-700 mt-0.5">
                    {[
                      customer.addressLine1,
                      customer.addressLine2,
                      customer.city,
                      customer.stateProvince,
                      customer.postalCode,
                      customer.country,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}
              {customer.dateOfBirth && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Date of Birth
                  </p>
                  <p className="text-sm text-slate-700 mt-0.5">
                    {new Date(customer.dateOfBirth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {/* Employment & Financial Section */}
              {(customer.employmentStatus ||
                customer.employerName ||
                customer.occupation ||
                customer.annualIncome != null ||
                customer.annualRevenue != null ||
                customer.netWorth != null) && (
                <>
                  <div className="md:col-span-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Employment & Financial
                    </p>
                  </div>
                  {customer.employmentStatus && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Employment Status
                      </p>
                      <p className="text-sm text-slate-700 mt-0.5">
                        {customer.employmentStatus.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                  {customer.employerName && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Employer
                      </p>
                      <p className="text-sm text-slate-700 mt-0.5">{customer.employerName}</p>
                    </div>
                  )}
                  {customer.occupation && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Occupation
                      </p>
                      <p className="text-sm text-slate-700 mt-0.5">{customer.occupation}</p>
                    </div>
                  )}
                  {customer.annualIncome != null && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Annual Income
                      </p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">
                        {formatCurrency(customer.annualIncome)}
                      </p>
                    </div>
                  )}
                  {customer.annualRevenue != null && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Annual Revenue
                      </p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">
                        {formatCurrency(customer.annualRevenue)}
                      </p>
                    </div>
                  )}
                  {customer.netWorth != null && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Net Worth
                      </p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">
                        {formatCurrency(customer.netWorth)}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* KYC / AML / Credit Section */}
              {(customer.kycStatus ||
                customer.amlCheckStatus ||
                customer.creditScore != null ||
                customer.riskRating) && (
                <>
                  <div className="md:col-span-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      KYC, AML & Credit
                    </p>
                  </div>
                  {customer.kycStatus && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        KYC Status
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            customer.kycStatus === 'COMPLETED' || customer.kycStatus === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {customer.kycStatus}
                        </span>
                        {customer.kycCompletionDate && (
                          <span className="text-xs text-slate-400">
                            {new Date(customer.kycCompletionDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {customer.amlCheckStatus && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        AML Check
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            customer.amlCheckStatus === 'CLEAR' ||
                            customer.amlCheckStatus === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {customer.amlCheckStatus}
                        </span>
                        {customer.amlCheckDate && (
                          <span className="text-xs text-slate-400">
                            {new Date(customer.amlCheckDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {customer.creditScore != null && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Credit Score
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {customer.creditScore}
                        </p>
                        {customer.creditScoreDate && (
                          <span className="text-xs text-slate-400">
                            as of {new Date(customer.creditScoreDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {customer.riskRating && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Risk Rating
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            customer.riskRating === 'LOW'
                              ? 'bg-emerald-100 text-emerald-700'
                              : customer.riskRating === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {customer.riskRating}
                        </span>
                        {customer.riskRatingDate && (
                          <span className="text-xs text-slate-400">
                            {new Date(customer.riskRatingDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Loan Request Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Loan Request Details
          </h2>

          {/* Common fields: Product, Amount, Term, Rate, Purpose */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Product
              </label>
              <select
                value={selectedProductId}
                onChange={e => {
                  setSelectedProductId(e.target.value);
                  // Reset purpose when product changes since options differ per product
                  setLoanPurpose('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.productId} value={product.productId}>
                    {product.productName}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount (dynamic label) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {amountLabel}
              </label>
              <input
                type="number"
                value={requestedAmount}
                onChange={e => setRequestedAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter amount"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-500 mt-1">
                  Range: {formatCurrency(selectedProduct.minLoanAmount || 0)} –{' '}
                  {formatCurrency(selectedProduct.maxLoanAmount || 0)}
                </p>
              )}
            </div>

            {/* Term (hidden for credit cards / overdrafts) */}
            {!hideTerm && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {termLabel || 'Term (Months)'}
                </label>
                <input
                  type="number"
                  value={requestedTermMonths}
                  onChange={e => setRequestedTermMonths(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter term"
                />
                {selectedProduct && (
                  <p className="text-xs text-gray-500 mt-1">
                    Range: {selectedProduct.minTermMonths} – {selectedProduct.maxTermMonths} months
                  </p>
                )}
              </div>
            )}

            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={requestedInterestRate}
                onChange={e => setRequestedInterestRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter interest rate"
              />
            </div>

            {/* Purpose (dynamic options per product) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Loan Purpose
              </label>
              <select
                value={loanPurpose}
                onChange={e => setLoanPurpose(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select purpose</option>
                {fieldConfig.purposeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Purpose Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purpose Description
              </label>
              <textarea
                value={loanPurposeDescription}
                onChange={e => setLoanPurposeDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional details about the loan purpose"
              />
            </div>
          </div>

          {/* Product-specific dynamic fields */}
          {productType && (
            <DynamicProductFields
              productType={productType}
              values={additionalData}
              onChange={handleAdditionalChange}
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.push(`/dashboard/applications/${applicationId}`)}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !requestedAmount || !selectedProductId}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
