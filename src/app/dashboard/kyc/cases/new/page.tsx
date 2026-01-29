'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { kycService, type CreateKycCaseRequest, type DiligenceLevel } from '@/services/api/kycService';
import { customerService, type Customer } from '@/services/api/customerService';

const SEGMENT_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual', description: 'Natural person opening personal account' },
  { value: 'SOLE_TRADER', label: 'Sole Trader', description: 'Self-employed individual trading under own name' },
  { value: 'COMPANY', label: 'Company (Ltd/PLC)', description: 'Private or public limited company' },
  { value: 'PARTNERSHIP', label: 'Partnership', description: 'General or limited partnership' },
  { value: 'TRUST', label: 'Trust', description: 'Express trust or similar legal arrangement' },
  { value: 'CHARITY', label: 'Charity/Non-Profit', description: 'Registered charity or non-profit organization' },
  { value: 'CLUB_ASSOCIATION', label: 'Club/Association', description: 'Unincorporated association or club' },
];

const CASE_TYPE_OPTIONS = [
  { value: 'ONBOARDING', label: 'Onboarding', description: 'New customer KYC during account opening' },
  { value: 'PERIODIC_REVIEW', label: 'Periodic Review', description: 'Scheduled review based on risk tier' },
  { value: 'EVENT_DRIVEN', label: 'Event Driven', description: 'Triggered by suspicious activity or changes' },
  { value: 'REMEDIATION', label: 'Remediation', description: 'Fixing incomplete or outdated KYC records' },
];

const DILIGENCE_OPTIONS: { value: DiligenceLevel; label: string; description: string }[] = [
  { value: 'SDD', label: 'Simplified Due Diligence', description: 'Low-risk customers with minimal verification' },
  { value: 'CDD', label: 'Standard Customer Due Diligence', description: 'Standard verification for most customers' },
  { value: 'EDD', label: 'Enhanced Due Diligence', description: 'High-risk customers requiring additional checks' },
];

export default function NewKycCasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState<CreateKycCaseRequest>({
    customerSegment: 'INDIVIDUAL',
    caseType: 'ONBOARDING',
    requiredDiligence: undefined,
    triggerReason: '',
  });

  useEffect(() => {
    if (customerSearch.length >= 2) {
      searchCustomers();
    }
  }, [customerSearch]);

  const searchCustomers = async () => {
    try {
      const results = await customerService.searchCustomers({ searchTerm: customerSearch });
      setCustomers(results);
    } catch (error) {
      console.error('Failed to search customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }

    try {
      setLoading(true);
      const request: CreateKycCaseRequest = {
        ...formData,
        customerId: selectedCustomer.customerId,
      };

      const kycCase = await kycService.createCase(request);
      router.push(`/dashboard/kyc/cases/${kycCase.caseId}`);
    } catch (error) {
      console.error('Failed to create KYC case:', error);
      alert('Failed to create KYC case');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateKycCaseRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value || undefined }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Create KYC Case</h1>
              <p className="text-sm text-gray-500">Initiate KYC/AML review for a customer</p>
            </div>
            <Link
              href="/dashboard/kyc/cases"
              className="text-sm text-gray-600 hover:text-primary-600 font-medium"
            >
              Cancel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Customer</h2>

            {selectedCustomer ? (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {customerService.getCustomerName(selectedCustomer)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedCustomer.customerNumber} | {selectedCustomer.primaryEmail}
                    </div>
                    <div className="text-sm text-gray-500">
                      Type: {selectedCustomer.customerType}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, email, or customer number..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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

                {customers.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.customerId}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomers([]);
                          setCustomerSearch('');
                          // Auto-set segment based on customer type
                          if (customer.customerType === 'INDIVIDUAL') {
                            handleChange('customerSegment', 'INDIVIDUAL');
                          } else if (customer.customerType === 'BUSINESS') {
                            handleChange('customerSegment', 'COMPANY');
                          }
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">
                          {customerService.getCustomerName(customer)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {customer.customerNumber} | {customer.primaryEmail}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customer Segment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Segment</h2>
            <p className="text-sm text-gray-500 mb-4">
              Select the customer segment to determine the appropriate KYC requirements per EU/Irish AML regulations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SEGMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer rounded-lg border p-4 hover:border-primary-500 ${
                    formData.customerSegment === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="customerSegment"
                    value={option.value}
                    checked={formData.customerSegment === option.value}
                    onChange={(e) => handleChange('customerSegment', e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                  </div>
                  {formData.customerSegment === option.value && (
                    <svg className="h-5 w-5 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Case Type */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Type</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CASE_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer rounded-lg border p-4 hover:border-primary-500 ${
                    formData.caseType === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="caseType"
                    value={option.value}
                    checked={formData.caseType === option.value}
                    onChange={(e) => handleChange('caseType', e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                  </div>
                  {formData.caseType === option.value && (
                    <svg className="h-5 w-5 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Required Diligence (Optional Override) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Due Diligence Level</h2>
            <p className="text-sm text-gray-500 mb-4">
              Leave as &quot;Auto-determine&quot; to let the system calculate based on risk assessment.
              Override only if you have specific regulatory requirements.
            </p>

            <div className="space-y-3">
              <label
                className={`relative flex cursor-pointer rounded-lg border p-4 hover:border-primary-500 ${
                  !formData.requiredDiligence
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="requiredDiligence"
                  value=""
                  checked={!formData.requiredDiligence}
                  onChange={() => handleChange('requiredDiligence', '')}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Auto-determine</div>
                  <div className="text-sm text-gray-500">
                    System will determine appropriate level based on customer segment and risk factors
                  </div>
                </div>
                {!formData.requiredDiligence && (
                  <svg className="h-5 w-5 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </label>

              {DILIGENCE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer rounded-lg border p-4 hover:border-primary-500 ${
                    formData.requiredDiligence === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="requiredDiligence"
                    value={option.value}
                    checked={formData.requiredDiligence === option.value}
                    onChange={(e) => handleChange('requiredDiligence', e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${kycService.getDiligenceColor(option.value)}`}>
                        {option.value}
                      </span>
                      <span className="font-medium text-gray-900">{option.label}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{option.description}</div>
                  </div>
                  {formData.requiredDiligence === option.value && (
                    <svg className="h-5 w-5 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Trigger Reason (for non-onboarding) */}
          {formData.caseType !== 'ONBOARDING' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Trigger Reason</h2>
              <textarea
                value={formData.triggerReason || ''}
                onChange={(e) => handleChange('triggerReason', e.target.value)}
                placeholder="Describe the reason for initiating this KYC review..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link
              href="/dashboard/kyc/cases"
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !selectedCustomer}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create KYC Case'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
