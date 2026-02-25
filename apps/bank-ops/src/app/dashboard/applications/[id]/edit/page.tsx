'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import { customerService, type Customer } from '@/services/api/customerService';
import config from '@/config';
import { formatCurrency } from '@/lib/format';

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

  // Property info (for home loans)
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyState, setPropertyState] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [downPaymentAmount, setDownPaymentAmount] = useState('');

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

      setPropertyAddress(appData.propertyAddress || '');
      setPropertyCity(appData.propertyCity || '');
      setPropertyState(appData.propertyState || '');
      setPropertyValue(appData.propertyValue?.toString() || '');
      setDownPaymentAmount(appData.downPaymentAmount?.toString() || '');
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
        requestedTermMonths: parseInt(requestedTermMonths),
        loanPurpose,
      };

      if (requestedInterestRate) {
        // Convert from percentage (displayed) back to decimal (stored)
        updateData.requestedInterestRate = parseFloat(requestedInterestRate);
      }
      if (loanPurposeDescription) {
        updateData.loanPurposeDescription = loanPurposeDescription;
      }
      if (propertyAddress) {
        updateData.propertyAddress = propertyAddress;
      }
      if (propertyCity) {
        updateData.propertyCity = propertyCity;
      }
      if (propertyState) {
        updateData.propertyState = propertyState;
      }
      if (propertyValue) {
        updateData.propertyValue = parseFloat(propertyValue);
      }
      if (downPaymentAmount) {
        updateData.downPaymentAmount = parseFloat(downPaymentAmount);
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

  const selectedProduct = products.find(p => p.productId === selectedProductId);

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
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loan Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.productId} value={product.productId}>
                    {product.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requested Amount
              </label>
              <input
                type="number"
                value={requestedAmount}
                onChange={e => setRequestedAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter amount"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-500 mt-1">
                  Range: {formatCurrency(selectedProduct.minLoanAmount || 0)} –{' '}
                  {formatCurrency(selectedProduct.maxLoanAmount || 0)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term (Months)</label>
              <input
                type="number"
                value={requestedTermMonths}
                onChange={e => setRequestedTermMonths(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter term in months"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-500 mt-1">
                  Range: {selectedProduct.minTermMonths} - {selectedProduct.maxTermMonths} months
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={requestedInterestRate}
                onChange={e => setRequestedInterestRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter interest rate"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Purpose</label>
              <select
                value={loanPurpose}
                onChange={e => setLoanPurpose(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select purpose</option>
                <option value="HOME_PURCHASE">Home Purchase</option>
                <option value="HOME_CONSTRUCTION">Home Construction</option>
                <option value="HOME_RENOVATION">Home Renovation</option>
                <option value="VEHICLE_PURCHASE">Vehicle Purchase</option>
                <option value="BUSINESS_EXPANSION">Business Expansion</option>
                <option value="WORKING_CAPITAL">Working Capital</option>
                <option value="EQUIPMENT_PURCHASE">Equipment Purchase</option>
                <option value="DEBT_CONSOLIDATION">Debt Consolidation</option>
                <option value="EDUCATION">Education</option>
                <option value="PERSONAL_USE">Personal Use</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose Description
              </label>
              <textarea
                value={loanPurposeDescription}
                onChange={e => setLoanPurposeDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional details about the loan purpose"
              />
            </div>
          </div>
        </div>

        {/* Property Information (for home loans) */}
        {selectedProduct?.productType === 'HOME_LOAN' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter property address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={propertyCity}
                  onChange={e => setPropertyCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={propertyState}
                  onChange={e => setPropertyState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter state"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Value
                </label>
                <input
                  type="number"
                  value={propertyValue}
                  onChange={e => setPropertyValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter property value"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment</label>
                <input
                  type="number"
                  value={downPaymentAmount}
                  onChange={e => setDownPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter down payment"
                />
              </div>
            </div>
          </div>
        )}

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
            disabled={saving || !requestedAmount || !requestedTermMonths || !selectedProductId}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
