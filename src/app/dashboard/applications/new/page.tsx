'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applicationService, CreateApplicationRequest } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import { customerService, type Customer } from '@/services/api/customerService';
import config from '@/config';

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preselectedProductId = searchParams.get('productId');
  const preselectedCustomerId = searchParams.get('customerId');
  const bankId = config.bank?.defaultBankId || '123e4567-e89b-12d3-a456-426614174000';

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preselectedProductId && products.length > 0) {
      const product = products.find(p => p.productId === preselectedProductId);
      if (product) {
        setSelectedProduct(product);
        if (product.defaultLoanAmount) setLoanAmount(product.defaultLoanAmount.toString());
        if (product.defaultTermMonths) setLoanTerm(product.defaultTermMonths.toString());
        if (product.defaultInterestRate)
          setInterestRate((product.defaultInterestRate * 100).toString());
        // Automatically move to step 2 (customer selection) when product is preselected
        setStep(2);
      }
    }
  }, [preselectedProductId, products]);

  useEffect(() => {
    if (preselectedCustomerId) {
      loadCustomerById(preselectedCustomerId);
    }
  }, [preselectedCustomerId]);

  const loadProducts = async () => {
    try {
      const data = await productService.getAllProducts(bankId);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products');
    }
  };

  const loadCustomerById = async (customerId: string) => {
    try {
      const customer = await customerService.getCustomerById(customerId);
      setSelectedCustomer(customer);
      setStep(3);
    } catch (err) {
      console.error('Failed to load customer:', err);
    }
  };

  const searchCustomers = async (term: string) => {
    if (!term.trim()) {
      setCustomerSearchResults([]);
      return;
    }

    try {
      setSearchingCustomers(true);
      console.log('Searching for customers with term:', term);
      const results = await customerService.searchCustomers({ searchTerm: term });
      console.log('Customer search results:', results);
      setCustomerSearchResults(results);
    } catch (err) {
      console.error('Failed to search customers:', err);
      setError('Failed to search customers. Please try again.');
    } finally {
      setSearchingCustomers(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (step === 2) {
        searchCustomers(customerSearchTerm);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [customerSearchTerm, step]);

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedCustomer) {
      setError('Please select both product and customer');
      return;
    }

    if (!loanAmount || !loanTerm || !interestRate || !loanPurpose) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: CreateApplicationRequest = {
        bankId,
        productId: selectedProduct.productId,
        customerId: selectedCustomer.customerId,
        requestedAmount: parseFloat(loanAmount),
        requestedTermMonths: parseInt(loanTerm),
        proposedInterestRate: parseFloat(interestRate) / 100,
        loanPurpose,
        notes: notes || undefined,
        channel: 'RELATIONSHIP_MANAGER',
      };

      const application = await applicationService.createApplication(request);
      router.push(`/dashboard/applications/${application.applicationId}`);
    } catch (err: any) {
      console.error('Failed to create application:', err);
      setError(err?.response?.data?.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  const renderProductSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Loan Product</h2>
        <p className="text-gray-600">Choose the loan product for this application</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(product => (
          <div
            key={product.productId}
            onClick={() => {
              setSelectedProduct(product);
              if (product.defaultLoanAmount) setLoanAmount(product.defaultLoanAmount.toString());
              if (product.defaultTermMonths) setLoanTerm(product.defaultTermMonths.toString());
              if (product.defaultInterestRate)
                setInterestRate((product.defaultInterestRate * 100).toString());
              setStep(2);
            }}
            className={`cursor-pointer border-2 rounded-lg p-6 transition-all hover:shadow-lg ${
              selectedProduct?.productId === product.productId
                ? 'border-primary-600 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{product.productName}</h3>
              {product.isFeatured && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  Featured
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">{product.shortDescription}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Interest Rate:</span>
                <span className="font-medium">
                  {productService.formatInterestRate(
                    product.minInterestRate,
                    product.maxInterestRate
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loan Amount:</span>
                <span className="font-medium">
                  {productService.formatLoanAmount(product.minLoanAmount, product.maxLoanAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tenure:</span>
                <span className="font-medium">
                  {productService.formatTenure(product.minTermMonths, product.maxTermMonths)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCustomerSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Customer</h2>
          <p className="text-gray-600">Search and select an existing customer</p>
        </div>
        <button onClick={() => setStep(1)} className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to Products
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Selected Product: {selectedProduct.productName}
              </h3>
              <p className="mt-1 text-sm text-blue-700">{selectedProduct.shortDescription}</p>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Search by name, email, phone, or customer number..."
          value={customerSearchTerm}
          onChange={e => setCustomerSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
          autoFocus
        />
        <svg
          className="absolute left-3 top-4 h-5 w-5 text-gray-400"
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
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {searchingCustomers && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}

        {!searchingCustomers && customerSearchTerm && customerSearchResults.length === 0 && (
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
            <p className="mt-1 text-sm text-gray-500">Try a different search term</p>
          </div>
        )}

        {!searchingCustomers && !customerSearchTerm && (
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Search for a customer</h3>
            <p className="mt-1 text-sm text-gray-500">
              Enter a name, email, or phone number to begin
            </p>
          </div>
        )}

        {!searchingCustomers && customerSearchResults.length > 0 && (
          <div className="divide-y divide-gray-200">
            {customerSearchResults.map(customer => (
              <div
                key={customer.customerId}
                onClick={() => {
                  setSelectedCustomer(customer);
                  setStep(3);
                }}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-600 font-semibold text-lg">
                          {customerService.getCustomerName(customer).charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-base font-medium text-gray-900">
                        {customerService.getCustomerName(customer)}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {customer.customerNumber} •{' '}
                        {customerService.formatCustomerType(customer.customerType)}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-600">{customer.primaryEmail}</span>
                        <span className="text-sm text-gray-600">{customer.primaryPhone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {customer.riskRating && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${customerService.getRiskRatingColor(
                          customer.riskRating
                        )}-100 text-${customerService.getRiskRatingColor(customer.riskRating)}-800`}
                      >
                        {customer.riskRating}
                      </span>
                    )}
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderApplicationForm = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Details</h2>
          <p className="text-gray-600">Complete the loan application information</p>
        </div>
        <button onClick={() => setStep(2)} className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to Customer Selection
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Selected Product</h3>
          <p className="text-lg font-semibold text-gray-900">{selectedProduct?.productName}</p>
          <p className="text-sm text-gray-600 mt-1">{selectedProduct?.productCode}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Selected Customer</h3>
          <p className="text-lg font-semibold text-gray-900">
            {selectedCustomer && customerService.getCustomerName(selectedCustomer)}
          </p>
          <p className="text-sm text-gray-600 mt-1">{selectedCustomer?.customerNumber}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Amount (₹) *
            </label>
            <input
              type="number"
              value={loanAmount}
              onChange={e => setLoanAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter loan amount"
            />
            {selectedProduct && (
              <p className="mt-1 text-xs text-gray-500">
                Range: ₹{selectedProduct.minLoanAmount?.toLocaleString()} - ₹
                {selectedProduct.maxLoanAmount?.toLocaleString()}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Term (months) *
            </label>
            <input
              type="number"
              value={loanTerm}
              onChange={e => setLoanTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter loan term"
            />
            {selectedProduct && (
              <p className="mt-1 text-xs text-gray-500">
                Range: {selectedProduct.minTermMonths} - {selectedProduct.maxTermMonths} months
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interest Rate (%) *
            </label>
            <input
              type="number"
              step="0.01"
              value={interestRate}
              onChange={e => setInterestRate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter interest rate"
            />
            {selectedProduct && (
              <p className="mt-1 text-xs text-gray-500">
                Range: {(selectedProduct.minInterestRate * 100).toFixed(2)}% -{' '}
                {(selectedProduct.maxInterestRate * 100).toFixed(2)}%
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Purpose *</label>
            <select
              value={loanPurpose}
              onChange={e => setLoanPurpose(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Enter any additional information about this application..."
          />
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            onClick={() => router.push('/dashboard/applications')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading && (
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
            )}
            {loading ? 'Creating...' : 'Create Application'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderProductSelection();
      case 2:
        return renderCustomerSelection();
      case 3:
        return renderApplicationForm();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary-600">New Loan Application</h1>
              <div className="hidden sm:flex items-center space-x-2">
                <span
                  className={`text-sm font-medium ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}
                >
                  1. Product
                </span>
                <span className="text-gray-400">→</span>
                <span
                  className={`text-sm font-medium ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}
                >
                  2. Customer
                </span>
                <span className="text-gray-400">→</span>
                <span
                  className={`text-sm font-medium ${step >= 3 ? 'text-primary-600' : 'text-gray-400'}`}
                >
                  3. Details
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-600 hover:text-primary-600 font-medium"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">{renderStep()}</main>
    </div>
  );
}
