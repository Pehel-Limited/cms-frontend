'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { applicationService, CreateApplicationRequest } from '@/services/api/applicationService';

const LOAN_PURPOSES = [
  { value: 'HOME_PURCHASE', label: 'Home Purchase' },
  { value: 'HOME_CONSTRUCTION', label: 'Home Construction' },
  { value: 'HOME_RENOVATION', label: 'Home Renovation' },
  { value: 'VEHICLE_PURCHASE', label: 'Vehicle Purchase' },
  { value: 'BUSINESS_EXPANSION', label: 'Business Expansion' },
  { value: 'WORKING_CAPITAL', label: 'Working Capital' },
  { value: 'EQUIPMENT_PURCHASE', label: 'Equipment Purchase' },
  { value: 'DEBT_CONSOLIDATION', label: 'Debt Consolidation' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'PERSONAL_USE', label: 'Personal Use' },
  { value: 'OTHER', label: 'Other' },
];

const EMPLOYMENT_STATUSES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self Employed' },
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

export default function NewApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get bankId and userId from localStorage (should come from auth context in production)
  const bankId = typeof window !== 'undefined' ? localStorage.getItem('bankId') || '' : '';
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  // Form state
  const [formData, setFormData] = useState<Partial<CreateApplicationRequest>>({
    bankId,
    channel: 'RELATIONSHIP_MANAGER',
  });

  const updateFormData = (field: string, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!formData.customerId) {
        setError('Please select a customer');
        return;
      }
      if (!formData.productId) {
        setError('Please select a product');
        return;
      }
      if (!formData.requestedAmount || formData.requestedAmount <= 0) {
        setError('Please enter a valid loan amount');
        return;
      }
      if (!formData.requestedTermMonths || formData.requestedTermMonths <= 0) {
        setError('Please enter a valid loan term');
        return;
      }
      if (!formData.loanPurpose) {
        setError('Please select a loan purpose');
        return;
      }

      // Create application
      const response = await applicationService.createApplication(
        formData as CreateApplicationRequest
      );

      // Navigate to application detail page
      router.push(`/dashboard/applications/${response.applicationId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create application');
      console.error('Error creating application:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setStep(prev => Math.min(4, prev + 1));
  };

  const prevStep = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 mb-4">
          ← Back to Applications
        </button>
        <h1 className="text-3xl font-bold text-gray-900">New Loan Application</h1>
        <p className="text-gray-600 mt-1">Create a new loan application on behalf of customer</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1">
              <div className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {i}
                </div>
                {i < 4 && (
                  <div className={`flex-1 h-1 mx-2 ${step > i ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
              <div className="text-sm text-center mt-2">
                {i === 1 && 'Customer & Product'}
                {i === 2 && 'Loan Details'}
                {i === 3 && 'Financial Info'}
                {i === 4 && 'Review & Submit'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* Step 1: Customer & Product */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Customer & Product Selection</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer ID *</label>
              <input
                type="text"
                value={formData.customerId || ''}
                onChange={e => updateFormData('customerId', e.target.value)}
                placeholder="Enter customer UUID or search..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the customer's UUID. In production, this would be a searchable dropdown.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product ID *</label>
              <input
                type="text"
                value={formData.productId || ''}
                onChange={e => updateFormData('productId', e.target.value)}
                placeholder="Enter product UUID or select from list..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Select the loan product. In production, this would show available products.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Loan Details */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Loan Details</h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requested Amount *
                </label>
                <input
                  type="number"
                  value={formData.requestedAmount || ''}
                  onChange={e => updateFormData('requestedAmount', parseFloat(e.target.value))}
                  placeholder="50000"
                  min="0"
                  step="1000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term (Months) *
                </label>
                <input
                  type="number"
                  value={formData.requestedTermMonths || ''}
                  onChange={e => updateFormData('requestedTermMonths', parseInt(e.target.value))}
                  placeholder="60"
                  min="1"
                  max="360"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loan Purpose *</label>
              <select
                value={formData.loanPurpose || ''}
                onChange={e => updateFormData('loanPurpose', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select purpose...</option>
                {LOAN_PURPOSES.map(purpose => (
                  <option key={purpose.value} value={purpose.value}>
                    {purpose.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose Description
              </label>
              <textarea
                value={formData.loanPurposeDescription || ''}
                onChange={e => updateFormData('loanPurposeDescription', e.target.value)}
                placeholder="Additional details about the loan purpose..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Property Information (conditional) */}
            {(formData.loanPurpose === 'HOME_PURCHASE' ||
              formData.loanPurpose === 'HOME_CONSTRUCTION' ||
              formData.loanPurpose === 'HOME_RENOVATION') && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Property Information</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Address
                    </label>
                    <input
                      type="text"
                      value={formData.propertyAddress || ''}
                      onChange={e => updateFormData('propertyAddress', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={formData.propertyCity || ''}
                        onChange={e => updateFormData('propertyCity', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <input
                        type="text"
                        value={formData.propertyState || ''}
                        onChange={e => updateFormData('propertyState', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={formData.propertyPostalCode || ''}
                        onChange={e => updateFormData('propertyPostalCode', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Property Value
                      </label>
                      <input
                        type="number"
                        value={formData.propertyValue || ''}
                        onChange={e => updateFormData('propertyValue', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Down Payment
                      </label>
                      <input
                        type="number"
                        value={formData.downPaymentAmount || ''}
                        onChange={e =>
                          updateFormData('downPaymentAmount', parseFloat(e.target.value))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle Information (conditional) */}
            {formData.loanPurpose === 'VEHICLE_PURCHASE' && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Vehicle Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Make</label>
                    <input
                      type="text"
                      value={formData.vehicleMake || ''}
                      onChange={e => updateFormData('vehicleMake', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <input
                      type="text"
                      value={formData.vehicleModel || ''}
                      onChange={e => updateFormData('vehicleModel', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                    <input
                      type="number"
                      value={formData.vehicleYear || ''}
                      onChange={e => updateFormData('vehicleYear', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Condition
                    </label>
                    <select
                      value={formData.vehicleCondition || ''}
                      onChange={e => updateFormData('vehicleCondition', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="NEW">New</option>
                      <option value="USED">Used</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Financial Info */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Financial & Employment Information
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Income
                </label>
                <input
                  type="number"
                  value={formData.statedAnnualIncome || ''}
                  onChange={e => updateFormData('statedAnnualIncome', parseFloat(e.target.value))}
                  placeholder="80000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Income
                </label>
                <input
                  type="number"
                  value={formData.statedMonthlyIncome || ''}
                  onChange={e => updateFormData('statedMonthlyIncome', parseFloat(e.target.value))}
                  placeholder="6667"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Expenses
              </label>
              <input
                type="number"
                value={formData.statedMonthlyExpenses || ''}
                onChange={e => updateFormData('statedMonthlyExpenses', parseFloat(e.target.value))}
                placeholder="3000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Details</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employment Status
                </label>
                <select
                  value={formData.employmentStatus || ''}
                  onChange={e => updateFormData('employmentStatus', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select status...</option>
                  {EMPLOYMENT_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.employmentStatus &&
                formData.employmentStatus !== 'UNEMPLOYED' &&
                formData.employmentStatus !== 'RETIRED' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employer Name
                      </label>
                      <input
                        type="text"
                        value={formData.employerName || ''}
                        onChange={e => updateFormData('employerName', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Years with Employer
                      </label>
                      <input
                        type="number"
                        value={formData.yearsWithEmployer || ''}
                        onChange={e =>
                          updateFormData('yearsWithEmployer', parseInt(e.target.value))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Review & Submit</h2>

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Customer & Product</h3>
                <p className="text-gray-900">Customer ID: {formData.customerId}</p>
                <p className="text-gray-900">Product ID: {formData.productId}</p>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Loan Details</h3>
                <p className="text-gray-900">
                  Amount: ${formData.requestedAmount?.toLocaleString()}
                </p>
                <p className="text-gray-900">Term: {formData.requestedTermMonths} months</p>
                <p className="text-gray-900">Purpose: {formData.loanPurpose?.replace(/_/g, ' ')}</p>
              </div>

              {formData.statedMonthlyIncome && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Financial Info</h3>
                  <p className="text-gray-900">
                    Monthly Income: ${formData.statedMonthlyIncome?.toLocaleString()}
                  </p>
                  {formData.statedMonthlyExpenses && (
                    <p className="text-gray-900">
                      Monthly Expenses: ${formData.statedMonthlyExpenses?.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {formData.employmentStatus && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Employment</h3>
                  <p className="text-gray-900">Status: {formData.employmentStatus}</p>
                  {formData.employerName && (
                    <p className="text-gray-900">Employer: {formData.employerName}</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This application will be created as a DRAFT. You can review
                and make changes before submitting it for approval.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {step < 4 ? (
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? 'Creating...' : 'Create Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
