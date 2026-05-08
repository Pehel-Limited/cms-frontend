'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applicationService, CreateApplicationRequest } from '@/services/api/applicationService';
import { productService, type Product } from '@/services/api/productService';
import { customerService, type Customer } from '@/services/api/customerService';
import ProductFormFields, {
  type ProductFormData,
  type CustomerProfileSnapshot,
  INITIAL_FORM_DATA,
  getProductCategory,
  getFieldLabels,
} from './ProductFormFields';
import config from '@/config';

// Editable customer fields for verification step
interface CustomerEditData {
  firstName: string;
  middleName: string;
  lastName: string;
  businessName: string;
  businessLegalName: string;
  dateOfBirth: string;
  gender: string;
  primaryEmail: string;
  secondaryEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  mobilePhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  nationality: string;
  primaryIdentityType: string;
  primaryIdentityNumber: string;
  taxIdNumber: string;
  employmentStatus: string;
  employerName: string;
  occupation: string;
  annualIncome: string;
}

function customerToEditData(c: Customer): CustomerEditData {
  return {
    firstName: c.firstName || '',
    middleName: c.middleName || '',
    lastName: c.lastName || '',
    businessName: c.businessName || '',
    businessLegalName: c.businessLegalName || '',
    dateOfBirth: c.dateOfBirth || '',
    gender: c.gender || '',
    primaryEmail: c.primaryEmail || '',
    secondaryEmail: c.secondaryEmail || '',
    primaryPhone: c.primaryPhone || '',
    secondaryPhone: c.secondaryPhone || '',
    mobilePhone: c.mobilePhone || '',
    addressLine1: c.addressLine1 || '',
    addressLine2: c.addressLine2 || '',
    city: c.city || '',
    stateProvince: c.stateProvince || '',
    postalCode: c.postalCode || '',
    country: c.country || '',
    nationality: c.nationality || '',
    primaryIdentityType: c.primaryIdentityType || '',
    primaryIdentityNumber: c.primaryIdentityNumber || '',
    taxIdNumber: c.taxIdNumber || '',
    employmentStatus: c.employmentStatus || '',
    employerName: c.employerName || '',
    occupation: c.occupation || '',
    annualIncome: c.annualIncome?.toString() || '',
  };
}

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
  const [customerEditData, setCustomerEditData] = useState<CustomerEditData | null>(null);
  const [customerEdited, setCustomerEdited] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA);

  const updateField = (field: keyof ProductFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preselectedProductId && products.length > 0) {
      const product = products.find(p => p.productId === preselectedProductId);
      if (product) {
        setSelectedProduct(product);
        setFormData(prev => ({
          ...prev,
          loanAmount: product.defaultLoanAmount?.toString() || '',
          loanTerm: product.defaultTermMonths?.toString() || '',
          interestRate: product.defaultInterestRate?.toString() || '',
        }));
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
      setCustomerEditData(customerToEditData(customer));
      // Only move to step 3 (verify customer) if a product is already selected
      if (selectedProduct) {
        setStep(3);
      }
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

    const category = getProductCategory(selectedProduct.productType);
    const labels = getFieldLabels(category);
    const needsTerm = labels.termLabel !== '';

    if (
      !formData.loanAmount ||
      (needsTerm && !formData.loanTerm) ||
      !formData.interestRate ||
      !formData.loanPurpose
    ) {
      setError('Please fill in all required fields');
      return;
    }

    // Category-specific validation
    if (
      category === 'MORTGAGE' &&
      (!formData.propertyAddress ||
        !formData.propertyCity ||
        !formData.propertyType ||
        !formData.propertyValue)
    ) {
      setError('Please fill in all required property details');
      return;
    }
    if (
      category === 'VEHICLE_FINANCE' &&
      (!formData.vehicleMake ||
        !formData.vehicleModel ||
        !formData.vehicleYear ||
        !formData.vehicleCondition ||
        !formData.vehicleValue)
    ) {
      setError('Please fill in all required vehicle details');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert mortgage term from years to months
      // For revolving products (credit card, overdraft) with no term field, default to 12 months (annual review)
      const termMonths =
        category === 'MORTGAGE'
          ? parseInt(formData.loanTerm) * 12
          : needsTerm
            ? parseInt(formData.loanTerm)
            : 12;

      const request: CreateApplicationRequest = {
        bankId,
        productId: selectedProduct.productId,
        customerId: selectedCustomer.customerId,
        requestedAmount: parseFloat(formData.loanAmount),
        requestedTermMonths: termMonths,
        requestedInterestRate: parseFloat(formData.interestRate),
        loanPurpose: formData.loanPurpose,
        loanPurposeDescription: formData.notes || undefined,
        channel: 'RELATIONSHIP_MANAGER',
        // Employment & income (from customer profile)
        ...(customerEditData?.employmentStatus && {
          employmentStatus: customerEditData.employmentStatus,
        }),
        ...(customerEditData?.employerName && { employerName: customerEditData.employerName }),
        ...(customerEditData?.annualIncome && {
          statedAnnualIncome: parseFloat(customerEditData.annualIncome),
        }),
        // Property (mortgage)
        ...(formData.propertyAddress && { propertyAddress: formData.propertyAddress }),
        ...(formData.propertyCity && { propertyCity: formData.propertyCity }),
        ...(formData.propertyState && { propertyState: formData.propertyState }),
        ...(formData.propertyPostalCode && { propertyPostalCode: formData.propertyPostalCode }),
        ...(formData.propertyType && { propertyType: formData.propertyType }),
        ...(formData.propertyValue && { propertyValue: parseFloat(formData.propertyValue) }),
        ...(formData.downPaymentAmount && {
          downPaymentAmount: parseFloat(formData.downPaymentAmount),
        }),
        // Vehicle
        ...(formData.vehicleMake && { vehicleMake: formData.vehicleMake }),
        ...(formData.vehicleModel && { vehicleModel: formData.vehicleModel }),
        ...(formData.vehicleYear && { vehicleYear: parseInt(formData.vehicleYear) }),
        ...(formData.vehicleCondition && { vehicleCondition: formData.vehicleCondition }),
        ...(formData.vehicleValue && { vehicleValue: parseFloat(formData.vehicleValue) }),
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
              setFormData(prev => ({
                ...INITIAL_FORM_DATA,
                loanAmount: product.defaultLoanAmount?.toString() || '',
                loanTerm: product.defaultTermMonths?.toString() || '',
                interestRate: product.defaultInterestRate?.toString() || '',
              }));
              // If customer is already selected, go to verify step; otherwise go to customer selection
              setStep(selectedCustomer ? 3 : 2);
            }}
            className={`cursor-pointer border-2 rounded-lg p-6 transition-all hover:shadow-lg ${
              selectedProduct?.productId === product.productId
                ? 'border-primary-600 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{product.productName}</h3>
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
                  setCustomerEditData(customerToEditData(customer));
                  setCustomerEdited(false);
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

  const updateCustomerField = (field: keyof CustomerEditData, value: string) => {
    setCustomerEditData(prev => (prev ? { ...prev, [field]: value } : prev));
    setCustomerEdited(true);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || !customerEditData) return;
    try {
      setSavingCustomer(true);
      setError(null);
      const updatePayload: Partial<Customer> = {
        ...(customerEditData.firstName && { firstName: customerEditData.firstName }),
        ...(customerEditData.middleName && { middleName: customerEditData.middleName }),
        ...(customerEditData.lastName && { lastName: customerEditData.lastName }),
        ...(customerEditData.businessName && { businessName: customerEditData.businessName }),
        ...(customerEditData.businessLegalName && {
          businessLegalName: customerEditData.businessLegalName,
        }),
        ...(customerEditData.dateOfBirth && { dateOfBirth: customerEditData.dateOfBirth }),
        ...(customerEditData.gender && { gender: customerEditData.gender }),
        primaryEmail: customerEditData.primaryEmail,
        ...(customerEditData.secondaryEmail && { secondaryEmail: customerEditData.secondaryEmail }),
        primaryPhone: customerEditData.primaryPhone,
        ...(customerEditData.secondaryPhone && { secondaryPhone: customerEditData.secondaryPhone }),
        ...(customerEditData.mobilePhone && { mobilePhone: customerEditData.mobilePhone }),
        ...(customerEditData.addressLine1 && { addressLine1: customerEditData.addressLine1 }),
        ...(customerEditData.addressLine2 && { addressLine2: customerEditData.addressLine2 }),
        ...(customerEditData.city && { city: customerEditData.city }),
        ...(customerEditData.stateProvince && { stateProvince: customerEditData.stateProvince }),
        ...(customerEditData.postalCode && { postalCode: customerEditData.postalCode }),
        ...(customerEditData.country && { country: customerEditData.country }),
        ...(customerEditData.nationality && { nationality: customerEditData.nationality }),
        ...(customerEditData.primaryIdentityType && {
          primaryIdentityType: customerEditData.primaryIdentityType,
        }),
        ...(customerEditData.primaryIdentityNumber && {
          primaryIdentityNumber: customerEditData.primaryIdentityNumber,
        }),
        ...(customerEditData.taxIdNumber && { taxIdNumber: customerEditData.taxIdNumber }),
        ...(customerEditData.employmentStatus && {
          employmentStatus: customerEditData.employmentStatus,
        }),
        ...(customerEditData.employerName && { employerName: customerEditData.employerName }),
        ...(customerEditData.occupation && { occupation: customerEditData.occupation }),
        ...(customerEditData.annualIncome && {
          annualIncome: parseFloat(customerEditData.annualIncome),
        }),
      };
      const updated = await customerService.updateCustomer(
        selectedCustomer.customerId,
        updatePayload
      );
      setSelectedCustomer(updated);
      setCustomerEdited(false);
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      setError(err?.response?.data?.message || 'Failed to update customer details');
    } finally {
      setSavingCustomer(false);
    }
  };

  const renderCustomerVerification = () => {
    if (!selectedCustomer || !customerEditData) return null;
    const isIndividual = selectedCustomer.customerType === 'INDIVIDUAL';
    const editing = isEditingCustomer;

    const inputCls =
      'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all outline-none bg-white';

    const viewField = (label: string, value: string | undefined | null, required = false) => (
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
        <p className="text-sm text-slate-900 py-2">{value || '—'}</p>
      </div>
    );

    const sectionTitle = (title: string, icon: React.ReactNode) => (
      <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
    );

    const personIcon = (
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    );
    const contactIcon = (
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
    const addressIcon = (
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    );
    const idIcon = (
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
        />
      </svg>
    );
    const employmentIcon = (
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );

    const genderOptions = [
      { value: 'MALE', label: 'Male' },
      { value: 'FEMALE', label: 'Female' },
      { value: 'OTHER', label: 'Other' },
    ];
    const employmentOptions = [
      { value: 'EMPLOYED', label: 'Employed' },
      { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
      { value: 'BUSINESS_OWNER', label: 'Business Owner' },
      { value: 'RETIRED', label: 'Retired' },
      { value: 'STUDENT', label: 'Student' },
      { value: 'UNEMPLOYED', label: 'Unemployed' },
      { value: 'HOMEMAKER', label: 'Homemaker' },
    ];
    const idTypeOptions = [
      { value: 'PASSPORT', label: 'Passport' },
      { value: 'NATIONAL_ID', label: 'National ID' },
      { value: 'DRIVERS_LICENSE', label: "Driver's License" },
      { value: 'PPS_NUMBER', label: 'PPS Number' },
      { value: 'TAX_ID', label: 'Tax ID' },
    ];

    const getOptionLabel = (options: { value: string; label: string }[], val: string) =>
      options.find(o => o.value === val)?.label || val || '—';

    return (
      <div className="space-y-6">
        {/* Header with single Edit toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Verify Customer Details</h2>
            <p className="text-gray-600">
              {editing
                ? 'Make changes to customer information below. Save before continuing.'
                : 'Review customer information before proceeding.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (editing) {
                  // exit edit mode without saving (revert unsaved changes)
                  setCustomerEditData(customerToEditData(selectedCustomer));
                  setCustomerEdited(false);
                  setIsEditingCustomer(false);
                } else {
                  setIsEditingCustomer(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                editing
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              {editing ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit Details
                </>
              )}
            </button>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Change Customer
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="ml-3 text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Summary Banner */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">
                {isIndividual
                  ? customerEditData.firstName?.charAt(0) || '?'
                  : customerEditData.businessName?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {isIndividual
                  ? `${customerEditData.firstName} ${customerEditData.lastName}`.trim()
                  : customerEditData.businessName}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-slate-500">{selectedCustomer.customerNumber}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {selectedCustomer.customerType}
                </span>
                {selectedCustomer.customerStatus && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedCustomer.customerStatus === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedCustomer.customerStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-5">
          {/* ── Personal / Business Information ────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {sectionTitle(
              isIndividual ? 'Personal Information' : 'Business Information',
              personIcon
            )}
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isIndividual ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        First Name<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerEditData.firstName}
                        onChange={e => updateCustomerField('firstName', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Middle Name
                      </label>
                      <input
                        type="text"
                        value={customerEditData.middleName}
                        onChange={e => updateCustomerField('middleName', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Last Name<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerEditData.lastName}
                        onChange={e => updateCustomerField('lastName', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={customerEditData.dateOfBirth}
                        onChange={e => updateCustomerField('dateOfBirth', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Gender
                      </label>
                      <select
                        value={customerEditData.gender}
                        onChange={e => updateCustomerField('gender', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select...</option>
                        {genderOptions.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Nationality
                      </label>
                      <input
                        type="text"
                        value={customerEditData.nationality}
                        onChange={e => updateCustomerField('nationality', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Business Name<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerEditData.businessName}
                        onChange={e => updateCustomerField('businessName', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        Legal Name
                      </label>
                      <input
                        type="text"
                        value={customerEditData.businessLegalName}
                        onChange={e => updateCustomerField('businessLegalName', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div />
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isIndividual ? (
                  <>
                    {viewField('First Name', customerEditData.firstName, true)}
                    {viewField('Middle Name', customerEditData.middleName)}
                    {viewField('Last Name', customerEditData.lastName, true)}
                    {viewField('Date of Birth', customerEditData.dateOfBirth)}
                    {viewField('Gender', getOptionLabel(genderOptions, customerEditData.gender))}
                    {viewField('Nationality', customerEditData.nationality)}
                  </>
                ) : (
                  <>
                    {viewField('Business Name', customerEditData.businessName, true)}
                    {viewField('Legal Name', customerEditData.businessLegalName)}
                    <div />
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Contact Information ────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {sectionTitle('Contact Information', contactIcon)}
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Primary Email<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEditData.primaryEmail}
                    onChange={e => updateCustomerField('primaryEmail', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Secondary Email
                  </label>
                  <input
                    type="email"
                    value={customerEditData.secondaryEmail}
                    onChange={e => updateCustomerField('secondaryEmail', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Primary Phone<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerEditData.primaryPhone}
                    onChange={e => updateCustomerField('primaryPhone', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Secondary Phone
                  </label>
                  <input
                    type="tel"
                    value={customerEditData.secondaryPhone}
                    onChange={e => updateCustomerField('secondaryPhone', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={customerEditData.mobilePhone}
                    onChange={e => updateCustomerField('mobilePhone', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {viewField('Primary Email', customerEditData.primaryEmail, true)}
                {viewField('Secondary Email', customerEditData.secondaryEmail)}
                {viewField('Primary Phone', customerEditData.primaryPhone, true)}
                {viewField('Secondary Phone', customerEditData.secondaryPhone)}
                {viewField('Mobile Phone', customerEditData.mobilePhone)}
              </div>
            )}
          </div>

          {/* ── Address ────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {sectionTitle('Address', addressIcon)}
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={customerEditData.addressLine1}
                    onChange={e => updateCustomerField('addressLine1', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={customerEditData.addressLine2}
                    onChange={e => updateCustomerField('addressLine2', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">City</label>
                  <input
                    type="text"
                    value={customerEditData.city}
                    onChange={e => updateCustomerField('city', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    State / Province
                  </label>
                  <input
                    type="text"
                    value={customerEditData.stateProvince}
                    onChange={e => updateCustomerField('stateProvince', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={customerEditData.postalCode}
                    onChange={e => updateCustomerField('postalCode', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Country</label>
                  <input
                    type="text"
                    value={customerEditData.country}
                    onChange={e => updateCustomerField('country', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  {viewField('Address Line 1', customerEditData.addressLine1)}
                </div>
                <div className="md:col-span-2">
                  {viewField('Address Line 2', customerEditData.addressLine2)}
                </div>
                {viewField('City', customerEditData.city)}
                {viewField('State / Province', customerEditData.stateProvince)}
                {viewField('Postal Code', customerEditData.postalCode)}
                {viewField('Country', customerEditData.country)}
              </div>
            )}
          </div>

          {/* ── Identity Documents ─────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {sectionTitle('Identity Documents', idIcon)}
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ID Type</label>
                  <select
                    value={customerEditData.primaryIdentityType}
                    onChange={e => updateCustomerField('primaryIdentityType', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select...</option>
                    {idTypeOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    ID Number
                  </label>
                  <input
                    type="text"
                    value={customerEditData.primaryIdentityNumber}
                    onChange={e => updateCustomerField('primaryIdentityNumber', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Tax ID Number
                  </label>
                  <input
                    type="text"
                    value={customerEditData.taxIdNumber}
                    onChange={e => updateCustomerField('taxIdNumber', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {viewField(
                  'ID Type',
                  getOptionLabel(idTypeOptions, customerEditData.primaryIdentityType)
                )}
                {viewField('ID Number', customerEditData.primaryIdentityNumber)}
                {viewField('Tax ID Number', customerEditData.taxIdNumber)}
              </div>
            )}
          </div>

          {/* ── Employment & Income ────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {sectionTitle('Employment & Income', employmentIcon)}
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Employment Status
                  </label>
                  <select
                    value={customerEditData.employmentStatus}
                    onChange={e => updateCustomerField('employmentStatus', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select...</option>
                    {employmentOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Employer Name
                  </label>
                  <input
                    type="text"
                    value={customerEditData.employerName}
                    onChange={e => updateCustomerField('employerName', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={customerEditData.occupation}
                    onChange={e => updateCustomerField('occupation', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Annual Income (€)
                  </label>
                  <input
                    type="number"
                    value={customerEditData.annualIncome}
                    onChange={e => updateCustomerField('annualIncome', e.target.value)}
                    placeholder="Enter gross annual income"
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {viewField(
                  'Employment Status',
                  getOptionLabel(employmentOptions, customerEditData.employmentStatus)
                )}
                {viewField('Employer Name', customerEditData.employerName)}
                {viewField('Occupation', customerEditData.occupation)}
                {viewField(
                  'Annual Income (€)',
                  customerEditData.annualIncome
                    ? `€${Number(customerEditData.annualIncome).toLocaleString()}`
                    : ''
                )}
              </div>
            )}
          </div>
        </div>

        {/* KYC/AML Status (always read-only) */}
        {(selectedCustomer.kycStatus ||
          selectedCustomer.amlCheckStatus ||
          selectedCustomer.creditScore) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Compliance & Credit</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedCustomer.kycStatus && (
                <div>
                  <p className="text-sm text-slate-500">KYC Status</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mt-1 ${
                      selectedCustomer.kycStatus === 'COMPLETED' ||
                      selectedCustomer.kycStatus === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedCustomer.kycStatus}
                  </span>
                </div>
              )}
              {selectedCustomer.amlCheckStatus && (
                <div>
                  <p className="text-sm text-slate-500">AML Check</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mt-1 ${
                      selectedCustomer.amlCheckStatus === 'CLEAR' ||
                      selectedCustomer.amlCheckStatus === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedCustomer.amlCheckStatus}
                  </span>
                </div>
              )}
              {selectedCustomer.creditScore != null && (
                <div>
                  <p className="text-sm text-slate-500">Credit Score</p>
                  <p className="text-slate-900 font-semibold mt-1">
                    {selectedCustomer.creditScore}
                  </p>
                </div>
              )}
              {selectedCustomer.riskRating && (
                <div>
                  <p className="text-sm text-slate-500">Risk Rating</p>
                  <p className="text-slate-900 font-semibold mt-1">{selectedCustomer.riskRating}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setCustomerEditData(null);
              setCustomerEdited(false);
              setIsEditingCustomer(false);
              setStep(2);
            }}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Select Different Customer
          </button>
          <div className="flex items-center gap-3">
            {editing && customerEdited && (
              <button
                onClick={() => {
                  handleSaveCustomer().then(() => {
                    setIsEditingCustomer(false);
                  });
                }}
                disabled={savingCustomer}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {savingCustomer && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                Save Changes
              </button>
            )}
            <button
              onClick={() => setStep(4)}
              disabled={customerEdited}
              title={customerEdited ? 'Save your changes before continuing' : undefined}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm ${
                customerEdited
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              Continue to Application Details →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderApplicationForm = () => {
    if (!selectedProduct) return null;
    const category = getProductCategory(selectedProduct.productType);
    const categoryLabel: Record<string, string> = {
      TERM_LOAN: 'Loan',
      MORTGAGE: 'Mortgage',
      VEHICLE_FINANCE: 'Vehicle Finance',
      CREDIT_CARD: 'Credit Card',
      OVERDRAFT: 'Overdraft',
      BNPL: 'Buy Now Pay Later',
      INVOICE_ASSET_FINANCE: 'Finance Facility',
    };
    const label = categoryLabel[category] || 'Application';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{label} Application</h2>
            <p className="text-gray-600">
              Complete the {label.toLowerCase()} application for {selectedProduct.productName}
            </p>
          </div>
          <button onClick={() => setStep(3)} className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to Customer Verification
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
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-600">{selectedCustomer?.customerNumber}</p>
              {selectedCustomer?.primaryEmail && (
                <p className="text-sm text-gray-500">{selectedCustomer.primaryEmail}</p>
              )}
            </div>
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

          <ProductFormFields
            product={selectedProduct}
            formData={formData}
            onChange={updateField}
            customerProfile={
              customerEditData
                ? {
                    employmentStatus: customerEditData.employmentStatus,
                    employerName: customerEditData.employerName,
                    occupation: customerEditData.occupation,
                    annualIncome: customerEditData.annualIncome,
                  }
                : undefined
            }
          />

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
              {loading ? 'Creating...' : `Create ${label} Application`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderProductSelection();
      case 2:
        return renderCustomerSelection();
      case 3:
        return renderCustomerVerification();
      case 4:
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
              <h1 className="text-2xl font-bold text-primary-600">
                New {selectedProduct ? selectedProduct.productName : ''} Application
              </h1>
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
                  3. Verify
                </span>
                <span className="text-gray-400">→</span>
                <span
                  className={`text-sm font-medium ${step >= 4 ? 'text-primary-600' : 'text-gray-400'}`}
                >
                  4. Details
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
