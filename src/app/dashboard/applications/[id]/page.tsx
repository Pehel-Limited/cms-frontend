'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  title: string;
  type: 'approve' | 'reject' | 'assign' | 'return';
  loading: boolean;
}

function ActionModal({ isOpen, onClose, onConfirm, title, type, loading }: ActionModalProps) {
  const [formData, setFormData] = useState<any>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">{title}</h3>

        <form onSubmit={handleSubmit}>
          {type === 'approve' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approved Amount *
                </label>
                <input
                  type="number"
                  value={formData.approvedAmount || ''}
                  onChange={e =>
                    setFormData({ ...formData, approvedAmount: parseFloat(e.target.value) })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approved Term (Months) *
                </label>
                <input
                  type="number"
                  value={formData.approvedTermMonths || ''}
                  onChange={e =>
                    setFormData({ ...formData, approvedTermMonths: parseInt(e.target.value) })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.approvedInterestRate || ''}
                  onChange={e =>
                    setFormData({ ...formData, approvedInterestRate: parseFloat(e.target.value) })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approval Notes
                </label>
                <textarea
                  value={formData.approvalNotes || ''}
                  onChange={e => setFormData({ ...formData, approvalNotes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {type === 'reject' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <select
                  value={formData.rejectionReason || ''}
                  onChange={e => setFormData({ ...formData, rejectionReason: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason...</option>
                  <option value="INSUFFICIENT_INCOME">Insufficient Income</option>
                  <option value="POOR_CREDIT_HISTORY">Poor Credit History</option>
                  <option value="INCOMPLETE_DOCUMENTATION">Incomplete Documentation</option>
                  <option value="PROPERTY_VALUATION_ISSUE">Property Valuation Issue</option>
                  <option value="POLICY_VIOLATION">Policy Violation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Details *
                </label>
                <textarea
                  value={formData.rejectionDetails || ''}
                  onChange={e => setFormData({ ...formData, rejectionDetails: e.target.value })}
                  rows={4}
                  required
                  placeholder="Provide detailed explanation for the rejection..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {type === 'assign' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign To User ID *
                </label>
                <input
                  type="text"
                  value={formData.assignedToUserId || ''}
                  onChange={e => setFormData({ ...formData, assignedToUserId: e.target.value })}
                  required
                  placeholder="Enter user UUID..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  In production, this would be a searchable dropdown of available underwriters.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {type === 'return' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Reason *
                </label>
                <textarea
                  value={formData.reason || ''}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  rows={4}
                  required
                  placeholder="Explain what needs to be corrected..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50 flex items-center justify-center gap-2 ${
                type === 'reject' || type === 'return'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'assign' | 'return' | null;
    title: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
  });

  useEffect(() => {
    fetchApplication();
  }, [applicationId]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await applicationService.getApplication(applicationId);
      setApplication(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load application');
      console.error('Error fetching application:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!application) return;

    try {
      setActionLoading(true);
      await applicationService.submitApplication(applicationId);
      await fetchApplication();
      alert('Application submitted successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (type: 'approve' | 'reject' | 'assign' | 'return', title: string) => {
    setModalState({ isOpen: true, type, title });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null, title: '' });
  };

  const handleModalConfirm = async (data: any) => {
    if (!application || !modalState.type) return;

    try {
      setActionLoading(true);

      switch (modalState.type) {
        case 'approve':
          await applicationService.approveApplication(applicationId, data);
          alert('Application approved successfully!');
          break;
        case 'reject':
          await applicationService.rejectApplication(applicationId, data);
          alert('Application rejected.');
          break;
        case 'assign':
          await applicationService.assignApplication(applicationId, data);
          alert('Application assigned successfully!');
          break;
        case 'return':
          await applicationService.returnForCorrections(applicationId, data.reason);
          alert('Application returned for corrections.');
          break;
      }

      closeModal();
      await fetchApplication();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
      CREDIT_CHECK: 'bg-purple-100 text-purple-800',
      UNDERWRITING: 'bg-indigo-100 text-indigo-800',
      MANAGER_APPROVAL: 'bg-orange-100 text-orange-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      RETURNED_FOR_CORRECTIONS: 'bg-amber-100 text-amber-800',
      DISBURSED: 'bg-emerald-100 text-emerald-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const canSubmit = application?.status === 'DRAFT';
  const canAssign = application?.status === 'SUBMITTED';
  const canApproveReject = [
    'UNDER_REVIEW',
    'CREDIT_CHECK',
    'UNDERWRITING',
    'MANAGER_APPROVAL',
  ].includes(application?.status || '');
  const canReturn = ['UNDER_REVIEW', 'CREDIT_CHECK', 'UNDERWRITING'].includes(
    application?.status || ''
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error || 'Application not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Applications
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Applications
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Application {application.applicationNumber}
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(application.status)}`}
            >
              {application.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {(canSubmit || canAssign || canApproveReject || canReturn) && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
          <div className="flex gap-3 flex-wrap">
            {canSubmit && (
              <button
                onClick={handleSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Submit Application
              </button>
            )}

            {canAssign && (
              <button
                onClick={() => openModal('assign', 'Assign Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Assign to Underwriter
              </button>
            )}

            {canApproveReject && (
              <>
                <button
                  onClick={() => openModal('approve', 'Approve Application')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => openModal('reject', 'Reject Application')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}

            {canReturn && (
              <button
                onClick={() => openModal('return', 'Return for Corrections')}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                Return for Corrections
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Application ID</p>
                <p className="text-gray-900 font-medium">{application.applicationId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Application Number</p>
                <p className="text-gray-900 font-medium">{application.applicationNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Channel</p>
                <p className="text-gray-900 font-medium">
                  {application.channel.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-gray-900 font-medium">{application.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Customer ID</p>
                <p className="text-gray-900 font-medium">{application.customerId}</p>
              </div>
              {application.customer && (
                <div>
                  <p className="text-sm text-gray-500">Customer Name</p>
                  <p className="text-gray-900 font-medium">
                    {application.customer.firstName} {application.customer.lastName}
                    {application.customer.businessName && ` (${application.customer.businessName})`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Loan Request */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Loan Request</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Requested Amount</p>
                <p className="text-gray-900 font-medium text-lg">
                  ${application.requestedAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requested Term</p>
                <p className="text-gray-900 font-medium">
                  {application.requestedTermMonths} months
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Loan Purpose</p>
                <p className="text-gray-900 font-medium">
                  {application.loanPurpose.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Product ID</p>
                <p className="text-gray-900 font-medium">{application.productId}</p>
              </div>
            </div>
            {application.loanPurposeDescription && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">Purpose Description</p>
                <p className="text-gray-900">{application.loanPurposeDescription}</p>
              </div>
            )}
          </div>

          {/* Approval Details (if approved) */}
          {application.approvedAmount && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-900 mb-4">Approval Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-green-700">Approved Amount</p>
                  <p className="text-green-900 font-medium text-lg">
                    ${application.approvedAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Approved Term</p>
                  <p className="text-green-900 font-medium">
                    {application.approvedTermMonths} months
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Interest Rate</p>
                  <p className="text-green-900 font-medium">{application.approvedInterestRate}%</p>
                </div>
              </div>
              {application.decisionNotes && (
                <div className="mt-4">
                  <p className="text-sm text-green-700">Decision Notes</p>
                  <p className="text-green-900">{application.decisionNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Rejection Details (if rejected) */}
          {application.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-900 mb-4">Rejection Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-red-700">Reason</p>
                  <p className="text-red-900 font-medium">{application.rejectionReason}</p>
                </div>
                {application.decisionNotes && (
                  <div>
                    <p className="text-sm text-red-700">Details</p>
                    <p className="text-red-900">{application.decisionNotes}</p>
                  </div>
                )}
                {application.rejectionCategory && (
                  <div>
                    <p className="text-sm text-red-700">Category</p>
                    <p className="text-red-900 font-medium">{application.rejectionCategory}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Financial Information */}
          {(application.statedMonthlyIncome || application.statedAnnualIncome) && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Information</h2>
              <div className="grid grid-cols-2 gap-4">
                {application.statedAnnualIncome && (
                  <div>
                    <p className="text-sm text-gray-500">Annual Income</p>
                    <p className="text-gray-900 font-medium">
                      ${application.statedAnnualIncome.toLocaleString()}
                    </p>
                  </div>
                )}
                {application.statedMonthlyIncome && (
                  <div>
                    <p className="text-sm text-gray-500">Monthly Income</p>
                    <p className="text-gray-900 font-medium">
                      ${application.statedMonthlyIncome.toLocaleString()}
                    </p>
                  </div>
                )}
                {application.statedMonthlyExpenses && (
                  <div>
                    <p className="text-sm text-gray-500">Monthly Expenses</p>
                    <p className="text-gray-900 font-medium">
                      ${application.statedMonthlyExpenses.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Employment Information */}
          {application.employmentStatus && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Employment Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Employment Status</p>
                  <p className="text-gray-900 font-medium">{application.employmentStatus}</p>
                </div>
                {application.employerName && (
                  <div>
                    <p className="text-sm text-gray-500">Employer</p>
                    <p className="text-gray-900 font-medium">{application.employerName}</p>
                  </div>
                )}
                {application.yearsWithEmployer !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">Years with Employer</p>
                    <p className="text-gray-900 font-medium">
                      {application.yearsWithEmployer} years
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Property Information */}
          {application.propertyAddress && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="text-gray-900">
                    {application.propertyAddress}
                    {application.propertyCity && `, ${application.propertyCity}`}
                    {application.propertyState && `, ${application.propertyState}`}
                  </p>
                </div>
                {application.propertyValue && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-gray-500">Property Value</p>
                      <p className="text-gray-900 font-medium">
                        ${application.propertyValue.toLocaleString()}
                      </p>
                    </div>
                    {application.downPaymentAmount && (
                      <div>
                        <p className="text-sm text-gray-500">Down Payment</p>
                        <p className="text-gray-900 font-medium">
                          ${application.downPaymentAmount.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Information - Not in ApplicationResponse, would need to be added */}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Created</p>
                  <p className="text-xs text-gray-500">
                    {new Date(application.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {application.submittedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Submitted</p>
                    <p className="text-xs text-gray-500">
                      {new Date(application.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {application.decisionMadeAt && application.status === 'APPROVED' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Approved</p>
                    <p className="text-xs text-gray-500">
                      {new Date(application.decisionMadeAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {application.decisionMadeAt && application.status === 'REJECTED' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-600 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Rejected</p>
                    <p className="text-xs text-gray-500">
                      {new Date(application.decisionMadeAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment Info */}
          {application.assignedToUserId && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Assignment</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="text-gray-900 font-medium">{application.assignedToUserId}</p>
                </div>
                {application.assignedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Assigned At</p>
                    <p className="text-gray-900">
                      {new Date(application.assignedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk & Compliance */}
          {(application.riskScore !== undefined ||
            application.creditScoreAtApplication ||
            application.kycCompleted !== undefined) && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Risk & Compliance</h2>
              <div className="space-y-3">
                {application.riskScore !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">Risk Score</p>
                    <p className="text-gray-900 font-medium">{application.riskScore}</p>
                  </div>
                )}
                {application.creditScoreAtApplication && (
                  <div>
                    <p className="text-sm text-gray-500">Credit Score</p>
                    <p className="text-gray-900 font-medium">
                      {application.creditScoreAtApplication}
                    </p>
                  </div>
                )}
                {application.kycCompleted !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">KYC Status</p>
                    <p className="text-gray-900 font-medium">
                      {application.kycCompleted ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                )}
                {application.amlCheckCompleted !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">AML Check</p>
                    <p className="text-gray-900 font-medium">
                      {application.amlCheckCompleted ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {modalState.type && (
        <ActionModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          onConfirm={handleModalConfirm}
          title={modalState.title}
          type={modalState.type}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
