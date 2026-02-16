'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAppSelector } from '@/store';
import {
  applicationService,
  ApplicationResponse,
  ApplicationNote,
} from '@/services/api/applicationService';
import { userService, User } from '@/services/api/userService';
import { ApplicationWorkflowPanel } from '@/components/workflow';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  title: string;
  type: 'approve' | 'reject' | 'assign' | 'return' | 'note' | 'cancel';
  loading: boolean;
  application?: ApplicationResponse | null;
}

function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  type,
  loading,
  application,
}: ActionModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [underwriters, setUnderwriters] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (type === 'approve' && application) {
        // Pre-populate with application data
        setFormData({
          approvedAmount: application.requestedAmount || '',
          approvedTermMonths: application.requestedTermMonths || '',
          interestRate: '',
          notes: '',
        });
      } else if (type === 'assign') {
        loadUnderwriters();
        setSearchQuery('');
        setFormData({});
      } else {
        setFormData({});
      }
    }
  }, [isOpen, type, application]);

  // Debounced search effect
  useEffect(() => {
    if (type !== 'assign') return;

    const timeoutId = setTimeout(() => {
      if (searchQuery || showDropdown) {
        loadUnderwriters(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, type, showDropdown]);

  const loadUnderwriters = async (search?: string) => {
    try {
      setSearchLoading(true);
      const users = await userService.getUnderwriters(search);
      // Segregation of duties: exclude the application creator from the underwriter list
      const creatorId = application?.createdByUserId;
      const filtered = creatorId ? users.filter(u => u.userId !== creatorId) : users;
      setUnderwriters(filtered);
    } catch (error) {
      console.error('Failed to load underwriters:', error);
      setUnderwriters([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(true);
    // Clear selection if user is typing
    if (formData.assignToUserId) {
      setFormData({ ...formData, assignToUserId: undefined });
    }
  };

  const handleSelectUnderwriter = (user: User) => {
    setFormData({ ...formData, assignToUserId: user.userId });
    setSearchQuery(user.fullName || '');
    setShowDropdown(false);
  };

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
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign To Underwriter *
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  required
                  placeholder="Search underwriter by name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        Loading underwriters...
                      </div>
                    ) : underwriters.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No underwriters found
                      </div>
                    ) : (
                      underwriters.map(user => (
                        <div
                          key={user.userId}
                          onClick={() => handleSelectUnderwriter(user)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">
                                {user.fullName ||
                                  `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                                  user.username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {user.email} • {user.userType || 'Underwriter'}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">{user.status || 'Active'}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {formData.assignToUserId && !showDropdown && (
                  <p className="text-sm text-green-600 mt-1">✓ Underwriter selected</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add any notes about this assignment..."
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

          {type === 'note' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Type</label>
                <select
                  value={formData.noteType || 'ADDITIONAL_INFO'}
                  onChange={e => setFormData({ ...formData, noteType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ADDITIONAL_INFO">Additional Information</option>
                  <option value="CORRECTION">Correction/Update</option>
                  <option value="DOCUMENT_UPDATE">Document Update</option>
                  <option value="CUSTOMER_UPDATE">Customer Update</option>
                  <option value="URGENT">Urgent Note</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note/Message *
                </label>
                <textarea
                  value={formData.noteContent || ''}
                  onChange={e => setFormData({ ...formData, noteContent: e.target.value })}
                  rows={5}
                  required
                  placeholder="Enter additional information or corrections for the reviewer..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-sm text-gray-500">
                This note will be visible to the reviewer and added to the application history.
              </p>
            </div>
          )}

          {type === 'cancel' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to cancel this draft application? This action cannot be
                undone.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Cancellation (optional)
                </label>
                <textarea
                  value={formData.reason || ''}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  placeholder="Provide a reason for cancellation..."
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
                type === 'reject' || type === 'return' || type === 'cancel'
                  ? 'bg-red-600 hover:bg-red-700'
                  : type === 'note'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
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

// Helper to format role name for display
const formatRoleName = (role: string): string => {
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Helper to get effective status - always prefer lomsStatus over legacy status
const getEffectiveStatus = (app: ApplicationResponse | null): string => {
  if (!app) return '';
  return app.lomsStatus || app.status || 'DRAFT';
};

// Helper to format status for display
const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ');
};

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const { user: currentUser } = useAppSelector(state => state.auth);

  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'assign' | 'return' | 'note' | 'cancel' | null;
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

      // Fetch notes for this application
      try {
        const notesData = await applicationService.getNotes(applicationId);
        setNotes(notesData);
      } catch (noteErr) {
        console.error('Failed to fetch notes:', noteErr);
        setNotes([]);
      }
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
      toast.success('Application submitted successfully!');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (
    type: 'approve' | 'reject' | 'assign' | 'return' | 'note' | 'cancel',
    title: string
  ) => {
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
          toast.success('Application approved successfully!');
          break;
        case 'reject':
          await applicationService.rejectApplication(applicationId, data);
          toast.info('Application rejected.');
          break;
        case 'assign':
          await applicationService.assignApplication(applicationId, {
            assignToUserId: data.assignToUserId,
          });
          // If notes were provided with the assignment, add them as a note
          if (data.notes && data.notes.trim()) {
            await applicationService.addNote(applicationId, {
              noteType: 'ASSIGNMENT_NOTE',
              content: data.notes,
            });
          }
          toast.success('Application assigned successfully!');
          break;
        case 'return':
          await applicationService.returnForCorrections(applicationId, data.reason);
          toast.warning('Application returned for corrections.');
          break;
        case 'note':
          await applicationService.addNote(applicationId, {
            noteType: data.noteType || 'ADDITIONAL_INFO',
            content: data.noteContent,
          });
          toast.success('Note added successfully!');
          break;
        case 'cancel':
          await applicationService.cancelApplication(
            applicationId,
            data.reason || 'Cancelled by user'
          );
          toast.info('Application cancelled successfully.');
          break;
      }

      closeModal();
      await fetchApplication();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      // Legacy statuses
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
      // LOMS statuses
      PENDING_KYC: 'bg-orange-100 text-orange-800',
      PENDING_CREDIT_CHECK: 'bg-purple-100 text-purple-800',
      REFERRED_TO_SENIOR: 'bg-yellow-100 text-yellow-800',
      PENDING_UNDERWRITING: 'bg-indigo-100 text-indigo-800',
      REFERRED_TO_UNDERWRITER: 'bg-amber-100 text-amber-800',
      DECLINED: 'bg-red-100 text-red-800',
      OFFER_GENERATED: 'bg-indigo-100 text-indigo-800',
      OFFER_SENT: 'bg-indigo-100 text-indigo-800',
      PENDING_ESIGN: 'bg-cyan-100 text-cyan-800',
      ESIGN_IN_PROGRESS: 'bg-cyan-100 text-cyan-800',
      ESIGN_COMPLETED: 'bg-teal-100 text-teal-800',
      PENDING_BOOKING: 'bg-amber-100 text-amber-800',
      BOOKING_IN_PROGRESS: 'bg-amber-100 text-amber-800',
      BOOKED: 'bg-emerald-100 text-emerald-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
      WITHDRAWN: 'bg-gray-100 text-gray-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Check if current user is the creator of the application
  const isApplicationCreator = currentUser?.userId === application?.createdByUserId;

  // Get the effective status (lomsStatus takes precedence)
  const effectiveStatus = getEffectiveStatus(application);

  // Can submit: DRAFT status only (initial submission)
  const canSubmit = effectiveStatus === 'DRAFT' && isApplicationCreator;

  // Can assign: SUBMITTED status or RETURNED status (to reassign for review after corrections)
  const canAssign =
    (effectiveStatus === 'SUBMITTED' || effectiveStatus === 'RETURNED') && isApplicationCreator;

  // Check if current user is the assigned reviewer
  // Segregation of duties: even if assigned, the creator cannot review their own application
  const isAssignedReviewer =
    application?.assignedToUserId &&
    currentUser?.userId === application.assignedToUserId &&
    !isApplicationCreator;

  // Only the assigned reviewer can approve/reject/return when under review
  // Include both legacy and LOMS statuses for review states
  const isUnderReviewStatus = [
    'UNDER_REVIEW',
    'CREDIT_CHECK',
    'UNDERWRITING',
    'MANAGER_APPROVAL',
    // LOMS statuses that indicate review in progress
    'PENDING_KYC',
    'PENDING_CREDIT_CHECK',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_UNDERWRITING',
  ].includes(effectiveStatus);

  // Only assigned reviewer can approve
  const canApprove = isUnderReviewStatus && isAssignedReviewer;

  // Application creator (RM) can cancel DRAFT applications
  const canCancel = effectiveStatus === 'DRAFT' && isApplicationCreator;

  // Application creator (RM) can withdraw non-draft applications before final decision
  const isNotFinalStatus = ![
    'APPROVED',
    'REJECTED',
    'DECLINED',
    'WITHDRAWN',
    'CANCELLED',
    'DISBURSED',
    'BOOKED',
    'EXPIRED',
  ].includes(effectiveStatus);
  const canWithdraw = isNotFinalStatus && isApplicationCreator && effectiveStatus !== 'DRAFT';

  // Reviewer's reject (from review perspective)
  const canReviewerReject = isUnderReviewStatus && isAssignedReviewer;

  const canReturn =
    [
      'UNDER_REVIEW',
      'CREDIT_CHECK',
      'UNDERWRITING',
      'REFERRED_TO_SENIOR',
      'PENDING_UNDERWRITING',
      'PENDING_KYC',
    ].includes(effectiveStatus) && isAssignedReviewer;

  // Application creator can add notes while under review (to send info to reviewer)
  const canAddNote = isUnderReviewStatus && isApplicationCreator;

  // Application creator can edit the application when in DRAFT, RETURNED, or even UNDER_REVIEW
  const canEdit =
    [
      'DRAFT',
      'RETURNED',
      'UNDER_REVIEW',
      'CREDIT_CHECK',
      'UNDERWRITING',
      'SUBMITTED',
      'PENDING_KYC',
    ].includes(effectiveStatus) && isApplicationCreator;

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
              className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(effectiveStatus)}`}
            >
              {formatStatus(effectiveStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* Info banner for RM when application is under review by someone else */}
      {isUnderReviewStatus && !isAssignedReviewer && application.assignedToUser && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-blue-800">
              This application is currently being reviewed by{' '}
              <span className="font-semibold">
                {application.assignedToUser.firstName} {application.assignedToUser.lastName}
              </span>
              {application.assignedToUser.roles && application.assignedToUser.roles.length > 0 && (
                <span> ({formatRoleName(application.assignedToUser.roles[0])})</span>
              )}
              . Approval is pending review completion, but you can still withdraw if needed.
            </p>
          </div>
        </div>
      )}

      {/* LOMS Workflow Panel - Loan Origination Workflow */}
      <div className="mb-6">
        <ApplicationWorkflowPanel
          applicationId={applicationId as string}
          applicationStatus={effectiveStatus}
          customerId={application.customerId}
          currentUserId={currentUser?.userId || ''}
          isApplicationCreator={isApplicationCreator}
          assignedToUserId={application.assignedToUserId}
          approvedAmount={application.approvedAmount || application.requestedAmount || 0}
          currency="EUR"
          kycVerified={application.kycCompleted}
          productName={application.product?.productName}
          onStatusChange={fetchApplication}
        />
      </div>

      {/* Legacy Actions */}
      {(canSubmit ||
        canAssign ||
        canApprove ||
        canReviewerReject ||
        canWithdraw ||
        canCancel ||
        canReturn ||
        canAddNote ||
        canEdit) && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
          <div className="flex gap-3 flex-wrap">
            {canEdit && (
              <button
                onClick={() => router.push(`/dashboard/applications/${applicationId}/edit`)}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Edit Application
              </button>
            )}

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

            {canApprove && (
              <button
                onClick={() => openModal('approve', 'Approve Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            )}

            {canReviewerReject && (
              <button
                onClick={() => openModal('reject', 'Reject Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}

            {canWithdraw && (
              <button
                onClick={() => openModal('reject', 'Withdraw Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                Withdraw
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => openModal('cancel', 'Cancel Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Cancel Application
              </button>
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

            {canAddNote && (
              <button
                onClick={() => openModal('note', 'Add Note for Reviewer')}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Note
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
                <p className="text-sm text-gray-500">Application Number</p>
                <p className="text-gray-900 font-medium">{application.applicationNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-gray-900 font-medium">{formatStatus(effectiveStatus)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Channel</p>
                <p className="text-gray-900 font-medium">
                  {application.channel.replace(/_/g, ' ')}
                </p>
              </div>
              {application.currentStage && (
                <div>
                  <p className="text-sm text-gray-500">Current Stage</p>
                  <p className="text-gray-900 font-medium">
                    {application.currentStage.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
              <Link
                href={`/dashboard/applications?customerId=${application.customerId}`}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All Applications →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {application.customer ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Customer Name</p>
                    <p className="text-gray-900 font-medium">
                      {application.customer.firstName} {application.customer.lastName}
                    </p>
                  </div>
                  {application.customer.businessName && (
                    <div>
                      <p className="text-sm text-gray-500">Business Name</p>
                      <p className="text-gray-900 font-medium">
                        {application.customer.businessName}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Customer Number</p>
                    <p className="text-gray-900 font-medium">
                      {application.customer.customerNumber || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900 font-medium">{application.customer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-900 font-medium">
                      {application.customer.phoneNumber || '-'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Customer ID</p>
                  <p className="text-gray-900 font-medium">{application.customerId}</p>
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
              {application.requestedInterestRate && (
                <div>
                  <p className="text-sm text-gray-500">Interest Rate</p>
                  <p className="text-gray-900 font-medium">{application.requestedInterestRate}%</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Loan Purpose</p>
                <p className="text-gray-900 font-medium">
                  {application.loanPurpose.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Product</p>
                <p className="text-gray-900 font-medium">
                  {application.product?.productName || 'Home Loan'}
                </p>
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

              {application.decisionMadeAt &&
                [
                  'APPROVED',
                  'OFFER_GENERATED',
                  'OFFER_SENT',
                  'PENDING_ESIGN',
                  'ESIGN_IN_PROGRESS',
                  'ESIGN_COMPLETED',
                  'PENDING_BOOKING',
                  'BOOKING_IN_PROGRESS',
                  'BOOKED',
                ].includes(effectiveStatus) && (
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

              {application.decisionMadeAt && ['REJECTED', 'DECLINED'].includes(effectiveStatus) && (
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
                {/* If I'm the assigned reviewer, show who assigned me (Assigned By) */}
                {isAssignedReviewer ? (
                  <div>
                    <p className="text-sm text-gray-500">Assigned By</p>
                    {application.createdByUser ? (
                      <div>
                        <p className="text-gray-900 font-medium">
                          {application.createdByUser.firstName} {application.createdByUser.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {application.createdByUser.roles &&
                          application.createdByUser.roles.length > 0
                            ? formatRoleName(application.createdByUser.roles[0])
                            : application.createdByUser.userType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-900 font-medium">
                        User #{application.createdByUserId.slice(-8)}
                      </p>
                    )}
                  </div>
                ) : (
                  /* If I'm not the reviewer, show who it's assigned to */
                  <div>
                    <p className="text-sm text-gray-500">Assigned To</p>
                    {application.assignedToUser ? (
                      <div>
                        <p className="text-gray-900 font-medium">
                          {application.assignedToUser.firstName}{' '}
                          {application.assignedToUser.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {application.assignedToUser.roles &&
                          application.assignedToUser.roles.length > 0
                            ? formatRoleName(application.assignedToUser.roles[0])
                            : application.assignedToUser.userType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-900 font-medium">
                        User #{application.assignedToUserId.slice(-8)}
                      </p>
                    )}
                  </div>
                )}
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

          {/* Notes from Application Creator */}
          {notes.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.noteId} className="border-l-4 border-indigo-500 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">
                        {note.createdByUserName || `User #${note.createdByUserId.slice(-8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{note.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{note.noteType.replace(/_/g, ' ')}</p>
                  </div>
                ))}
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
          application={application}
        />
      )}
    </div>
  );
}
