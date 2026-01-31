'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import config from '@/config';

export default function EditApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const { user: currentUser } = useAppSelector(state => state.auth);
  const bankId = config.bank?.defaultBankId || '123e4567-e89b-12d3-a456-426614174000';

  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
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

  // Financial info
  const [statedAnnualIncome, setStatedAnnualIncome] = useState('');
  const [statedMonthlyExpenses, setStatedMonthlyExpenses] = useState('');

  // Employment info
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [yearsWithEmployer, setYearsWithEmployer] = useState('');
  const [jobTitle, setJobTitle] = useState('');

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

      setStatedAnnualIncome(appData.statedAnnualIncome?.toString() || '');
      setStatedMonthlyExpenses(appData.statedMonthlyExpenses?.toString() || '');

      setEmploymentStatus(appData.employmentStatus || '');
      setEmployerName(appData.employerName || '');
      setYearsWithEmployer(appData.yearsWithEmployer?.toString() || '');
      setJobTitle(appData.jobTitle || '');

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
      if (statedAnnualIncome) {
        updateData.statedAnnualIncome = parseFloat(statedAnnualIncome);
      }
      if (statedMonthlyExpenses) {
        updateData.statedMonthlyExpenses = parseFloat(statedMonthlyExpenses);
      }
      if (employmentStatus) {
        updateData.employmentStatus = employmentStatus;
      }
      if (employerName) {
        updateData.employerName = employerName;
      }
      if (yearsWithEmployer) {
        updateData.yearsWithEmployer = parseInt(yearsWithEmployer);
      }
      if (jobTitle) {
        updateData.jobTitle = jobTitle;
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

  // Get effective status - prefer lomsStatus over legacy status
  const effectiveStatus = application?.lomsStatus || application?.status || '';

  const canEdit =
    application &&
    [
      'DRAFT',
      'RETURNED',
      'UNDER_REVIEW',
      'CREDIT_CHECK',
      'UNDERWRITING',
      'SUBMITTED',
      'KYC_PENDING',
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
        {/* Loan Request Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loan Request</h2>
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
                Requested Amount (€)
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
                  Range: €{selectedProduct.minLoanAmount?.toLocaleString()} - €
                  {selectedProduct.maxLoanAmount?.toLocaleString()}
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

        {/* Financial Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual Income (€)
              </label>
              <input
                type="number"
                value={statedAnnualIncome}
                onChange={e => setStatedAnnualIncome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter annual income"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Expenses (€)
              </label>
              <input
                type="number"
                value={statedMonthlyExpenses}
                onChange={e => setStatedMonthlyExpenses(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter monthly expenses"
              />
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Employment Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Status
              </label>
              <select
                value={employmentStatus}
                onChange={e => setEmploymentStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status</option>
                <option value="EMPLOYED">Employed</option>
                <option value="SELF_EMPLOYED">Self Employed</option>
                <option value="RETIRED">Retired</option>
                <option value="UNEMPLOYED">Unemployed</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer Name</label>
              <input
                type="text"
                value={employerName}
                onChange={e => setEmployerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter employer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Years with Employer
              </label>
              <input
                type="number"
                value={yearsWithEmployer}
                onChange={e => setYearsWithEmployer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter years"
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
                  Property Value (€)
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Down Payment (€)
                </label>
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
