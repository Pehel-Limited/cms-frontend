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
import { formatCurrency } from '@/lib/format';

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900 mb-4">{title}</h3>

        <form onSubmit={handleSubmit}>
          {type === 'approve' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Approved Amount *
                </label>
                <input
                  type="number"
                  value={formData.approvedAmount || ''}
                  onChange={e =>
                    setFormData({ ...formData, approvedAmount: parseFloat(e.target.value) })
                  }
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Approved Term (Months) *
                </label>
                <input
                  type="number"
                  value={formData.approvedTermMonths || ''}
                  onChange={e =>
                    setFormData({ ...formData, approvedTermMonths: parseInt(e.target.value) })
                  }
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Approval Notes
                </label>
                <textarea
                  value={formData.approvalNotes || ''}
                  onChange={e => setFormData({ ...formData, approvalNotes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
            </div>
          )}

          {type === 'reject' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason *
                </label>
                <select
                  value={formData.rejectionReason || ''}
                  onChange={e => setFormData({ ...formData, rejectionReason: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Details *
                </label>
                <textarea
                  value={formData.rejectionDetails || ''}
                  onChange={e => setFormData({ ...formData, rejectionDetails: e.target.value })}
                  rows={4}
                  required
                  placeholder="Provide detailed explanation for the rejection..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
            </div>
          )}

          {type === 'assign' && (
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign To Underwriter *
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  required
                  placeholder="Search underwriter by name..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                  autoComplete="off"
                />

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        Loading underwriters...
                      </div>
                    ) : underwriters.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        No underwriters found
                      </div>
                    ) : (
                      underwriters.map(user => (
                        <div
                          key={user.userId}
                          onClick={() => handleSelectUnderwriter(user)}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-slate-900">
                                {user.fullName ||
                                  `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                                  user.username}
                              </div>
                              <div className="text-sm text-slate-500">
                                {user.email} • {user.userType || 'Underwriter'}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400">{user.status || 'Active'}</div>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assignment Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add any notes about this assignment..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
            </div>
          )}

          {type === 'return' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Return Reason *
                </label>
                <textarea
                  value={formData.reason || ''}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  rows={4}
                  required
                  placeholder="Explain what needs to be corrected..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
            </div>
          )}

          {type === 'note' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Note Type</label>
                <select
                  value={formData.noteType || 'ADDITIONAL_INFO'}
                  onChange={e => setFormData({ ...formData, noteType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                >
                  <option value="ADDITIONAL_INFO">Additional Information</option>
                  <option value="CORRECTION">Correction/Update</option>
                  <option value="DOCUMENT_UPDATE">Document Update</option>
                  <option value="CUSTOMER_UPDATE">Customer Update</option>
                  <option value="URGENT">Urgent Note</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Note/Message *
                </label>
                <textarea
                  value={formData.noteContent || ''}
                  onChange={e => setFormData({ ...formData, noteContent: e.target.value })}
                  rows={5}
                  required
                  placeholder="Enter additional information or corrections for the reviewer..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
              <p className="text-sm text-slate-500">
                This note will be visible to the reviewer and added to the application history.
              </p>
            </div>
          )}

          {type === 'cancel' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Are you sure you want to cancel this draft application? This action cannot be
                undone.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Reason for Cancellation (optional)
                </label>
                <textarea
                  value={formData.reason || ''}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  placeholder="Provide a reason for cancellation..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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

// Helper to get effective status - status and lomsStatus are now unified
const getEffectiveStatus = (app: ApplicationResponse | null): string => {
  if (!app) return '';
  return app.status || 'DRAFT';
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
      DRAFT: 'bg-gray-100 text-slate-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      PENDING_KYC: 'bg-orange-100 text-orange-800',
      KYC_APPROVED: 'bg-teal-100 text-teal-800',
      KYC_REJECTED: 'bg-red-100 text-red-800',
      PENDING_DOCUMENTS: 'bg-orange-100 text-orange-800',
      DOCUMENTS_RECEIVED: 'bg-teal-100 text-teal-800',
      PENDING_CREDIT_CHECK: 'bg-purple-100 text-purple-800',
      CREDIT_APPROVED: 'bg-emerald-100 text-emerald-800',
      CREDIT_DECLINED: 'bg-red-100 text-red-800',
      PENDING_UNDERWRITING: 'bg-indigo-100 text-indigo-800',
      IN_UNDERWRITING: 'bg-indigo-100 text-indigo-800',
      UNDERWRITING_APPROVED: 'bg-emerald-100 text-emerald-800',
      UNDERWRITING_DECLINED: 'bg-red-100 text-red-800',
      REFERRED_TO_SENIOR: 'bg-yellow-100 text-yellow-800',
      REFERRED_TO_UNDERWRITER: 'bg-amber-100 text-amber-800',
      PENDING_DECISION: 'bg-purple-100 text-purple-800',
      APPROVED: 'bg-green-100 text-green-800',
      DECLINED: 'bg-red-100 text-red-800',
      OFFER_GENERATED: 'bg-indigo-100 text-indigo-800',
      OFFER_SENT: 'bg-indigo-100 text-indigo-800',
      OFFER_ACCEPTED: 'bg-green-100 text-green-800',
      OFFER_REJECTED: 'bg-red-100 text-red-800',
      OFFER_EXPIRED: 'bg-gray-100 text-slate-800',
      OFFER_COUNTERED: 'bg-amber-100 text-amber-800',
      PENDING_CONDITIONS: 'bg-amber-100 text-amber-800',
      CONDITIONS_MET: 'bg-teal-100 text-teal-800',
      PENDING_ESIGN: 'bg-cyan-100 text-cyan-800',
      ESIGN_IN_PROGRESS: 'bg-cyan-100 text-cyan-800',
      ESIGN_COMPLETED: 'bg-teal-100 text-teal-800',
      PENDING_BOOKING: 'bg-amber-100 text-amber-800',
      BOOKING_IN_PROGRESS: 'bg-amber-100 text-amber-800',
      BOOKED: 'bg-emerald-100 text-emerald-800',
      PENDING_DISBURSEMENT: 'bg-lime-100 text-lime-800',
      DISBURSEMENT_IN_PROGRESS: 'bg-lime-100 text-lime-800',
      DISBURSED: 'bg-emerald-100 text-emerald-800',
      RETURNED: 'bg-orange-100 text-orange-800',
      CANCELLED: 'bg-gray-100 text-slate-800',
      WITHDRAWN: 'bg-gray-100 text-slate-800',
      EXPIRED: 'bg-gray-100 text-slate-800',
      ACTIVE: 'bg-green-100 text-green-800',
      CLOSED: 'bg-gray-100 text-slate-800',
    };
    return colors[status] || 'bg-gray-100 text-slate-800';
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
    'PENDING_KYC',
    'PENDING_CREDIT_CHECK',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'PENDING_DECISION',
  ].includes(effectiveStatus);

  // Only assigned reviewer can approve
  const canApprove = isUnderReviewStatus && isAssignedReviewer;

  // Application creator (RM) can cancel DRAFT applications
  const canCancel = effectiveStatus === 'DRAFT' && isApplicationCreator;

  // Application creator (RM) can withdraw non-draft applications before final decision
  const isNotFinalStatus = ![
    'APPROVED',
    'DECLINED',
    'WITHDRAWN',
    'CANCELLED',
    'DISBURSED',
    'BOOKED',
    'EXPIRED',
    'KYC_REJECTED',
    'CREDIT_DECLINED',
    'UNDERWRITING_DECLINED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'CLOSED',
  ].includes(effectiveStatus);
  const canWithdraw = isNotFinalStatus && isApplicationCreator && effectiveStatus !== 'DRAFT';

  // Reviewer's reject (from review perspective)
  const canReviewerReject = isUnderReviewStatus && isAssignedReviewer;

  const canReturn =
    [
      'PENDING_KYC',
      'PENDING_CREDIT_CHECK',
      'REFERRED_TO_SENIOR',
      'PENDING_UNDERWRITING',
      'IN_UNDERWRITING',
      'PENDING_DECISION',
    ].includes(effectiveStatus) && isAssignedReviewer;

  // Application creator can add notes while under review (to send info to reviewer)
  const canAddNote = isUnderReviewStatus && isApplicationCreator;

  // Application creator can edit the application when in DRAFT, RETURNED, or even UNDER_REVIEW
  const canEdit =
    [
      'DRAFT',
      'RETURNED',
      'SUBMITTED',
      'PENDING_KYC',
      'PENDING_CREDIT_CHECK',
      'IN_UNDERWRITING',
    ].includes(effectiveStatus) && isApplicationCreator;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8 animate-pulse">
          <div className="h-5 bg-white/20 rounded-xl w-32 mb-3" />
          <div className="h-7 bg-white/20 rounded-xl w-64" />
          <div className="h-4 bg-white/10 rounded-xl w-48 mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3 animate-pulse"
              >
                <div className="h-5 bg-slate-200/70 rounded-xl w-40" />
                <div className="h-4 bg-slate-100 rounded-xl" />
                <div className="h-4 bg-slate-100 rounded-xl w-3/4" />
              </div>
            ))}
          </div>
          <div className="space-y-5">
            {[1, 2].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3 animate-pulse"
              >
                <div className="h-5 bg-slate-200/70 rounded-xl w-32" />
                <div className="h-4 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200/60 rounded-2xl p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-red-700 font-medium">{error || 'Application not found'}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="mt-4 text-[#7f2b7b] hover:text-[#6b2568] font-medium text-sm"
        >
          ← Back to Applications
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative">
          <button
            onClick={() => router.push('/dashboard/applications')}
            className="text-white/70 hover:text-white text-sm mb-3 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Applications
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Application {application.applicationNumber}
              </h1>
              <p className="text-white/60 mt-1">
                Created on {new Date(application.createdAt).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={effectiveStatus} />
          </div>
        </div>
      </div>

      {/* Info banner for RM when application is under review by someone else */}
      {isUnderReviewStatus && !isAssignedReviewer && application.assignedToUser && (
        <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-4">
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
      <div>
        <ApplicationWorkflowPanel
          applicationId={applicationId as string}
          applicationStatus={effectiveStatus}
          customerId={application.customerId}
          currentUserId={currentUser?.userId || ''}
          isApplicationCreator={isApplicationCreator}
          assignedToUserId={application.assignedToUserId}
          approvedAmount={application.approvedAmount || application.requestedAmount || 0}
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Actions</h2>
          <div className="flex gap-3 flex-wrap">
            {canEdit && (
              <button
                onClick={() => router.push(`/dashboard/applications/${applicationId}/edit`)}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Edit Application
              </button>
            )}

            {canSubmit && (
              <button
                onClick={handleSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Submit Application
              </button>
            )}

            {canAssign && (
              <button
                onClick={() => openModal('assign', 'Assign Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Assign to Underwriter
              </button>
            )}

            {canApprove && (
              <button
                onClick={() => openModal('approve', 'Approve Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Approve
              </button>
            )}

            {canReviewerReject && (
              <button
                onClick={() => openModal('reject', 'Reject Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Reject
              </button>
            )}

            {canWithdraw && (
              <button
                onClick={() => openModal('reject', 'Withdraw Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-600 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Withdraw
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => openModal('cancel', 'Cancel Application')}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Cancel Application
              </button>
            )}

            {canReturn && (
              <button
                onClick={() => openModal('return', 'Return for Corrections')}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Return for Corrections
              </button>
            )}

            {canAddNote && (
              <button
                onClick={() => openModal('note', 'Add Note for Reviewer')}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm font-medium transition-colors"
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Application Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Application Number</p>
                <p className="text-slate-900 font-medium">{application.applicationNumber}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="text-slate-900 font-medium">{formatStatus(effectiveStatus)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Channel</p>
                <p className="text-slate-900 font-medium">
                  {application.channel.replace(/_/g, ' ')}
                </p>
              </div>
              {application.currentStage && (
                <div>
                  <p className="text-sm text-slate-500">Current Stage</p>
                  <p className="text-slate-900 font-medium">
                    {application.currentStage.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Customer Details</h2>
              <Link
                href={`/dashboard/applications?customerId=${application.customerId}`}
                className="text-sm text-[#7f2b7b] hover:text-[#6b2568] font-medium"
              >
                View All Applications →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {application.customer ? (
                <>
                  <div>
                    <p className="text-sm text-slate-500">Customer Name</p>
                    <p className="text-slate-900 font-medium">
                      {application.customer.firstName} {application.customer.lastName}
                    </p>
                  </div>
                  {application.customer.businessName && (
                    <div>
                      <p className="text-sm text-slate-500">Business Name</p>
                      <p className="text-slate-900 font-medium">
                        {application.customer.businessName}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500">Customer Number</p>
                    <p className="text-slate-900 font-medium">
                      {application.customer.customerNumber || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="text-slate-900 font-medium">
                      {application.customer.email || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="text-slate-900 font-medium">
                      {application.customer.phoneNumber || '-'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Customer ID</p>
                  <p className="text-slate-900 font-medium">{application.customerId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Loan Request */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Loan Request</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Requested Amount</p>
                <p className="text-slate-900 font-medium text-lg">
                  {formatCurrency(application.requestedAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Requested Term</p>
                <p className="text-slate-900 font-medium">
                  {application.requestedTermMonths} months
                </p>
              </div>
              {application.requestedInterestRate && (
                <div>
                  <p className="text-sm text-slate-500">Interest Rate</p>
                  <p className="text-slate-900 font-medium">{application.requestedInterestRate}%</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500">Loan Purpose</p>
                <p className="text-slate-900 font-medium">
                  {application.loanPurpose.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Product</p>
                <p className="text-slate-900 font-medium">
                  {application.product?.productName || 'Home Loan'}
                </p>
              </div>
            </div>
            {application.loanPurposeDescription && (
              <div className="mt-4">
                <p className="text-sm text-slate-500">Purpose Description</p>
                <p className="text-slate-900">{application.loanPurposeDescription}</p>
              </div>
            )}
          </div>

          {/* Approval Details (if approved) */}
          {application.approvedAmount && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-emerald-900 mb-4">Approval Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-green-700">Approved Amount</p>
                  <p className="text-green-900 font-medium text-lg">
                    {formatCurrency(application.approvedAmount)}
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
            <div className="bg-red-50 border border-red-200/60 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-4">Rejection Details</h2>
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
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Information</h2>
              <div className="grid grid-cols-2 gap-4">
                {application.statedAnnualIncome && (
                  <div>
                    <p className="text-sm text-slate-500">Annual Income</p>
                    <p className="text-slate-900 font-medium">
                      {formatCurrency(application.statedAnnualIncome)}
                    </p>
                  </div>
                )}
                {application.statedMonthlyIncome && (
                  <div>
                    <p className="text-sm text-slate-500">Monthly Income</p>
                    <p className="text-slate-900 font-medium">
                      {formatCurrency(application.statedMonthlyIncome)}
                    </p>
                  </div>
                )}
                {application.statedMonthlyExpenses && (
                  <div>
                    <p className="text-sm text-slate-500">Monthly Expenses</p>
                    <p className="text-slate-900 font-medium">
                      {formatCurrency(application.statedMonthlyExpenses)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Employment Information */}
          {application.employmentStatus && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Employment Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Employment Status</p>
                  <p className="text-slate-900 font-medium">{application.employmentStatus}</p>
                </div>
                {application.employerName && (
                  <div>
                    <p className="text-sm text-slate-500">Employer</p>
                    <p className="text-slate-900 font-medium">{application.employerName}</p>
                  </div>
                )}
                {application.yearsWithEmployer !== undefined && (
                  <div>
                    <p className="text-sm text-slate-500">Years with Employer</p>
                    <p className="text-slate-900 font-medium">
                      {application.yearsWithEmployer} years
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Property Information */}
          {application.propertyAddress && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Property Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Address</p>
                  <p className="text-slate-900">
                    {application.propertyAddress}
                    {application.propertyCity && `, ${application.propertyCity}`}
                    {application.propertyState && `, ${application.propertyState}`}
                  </p>
                </div>
                {application.propertyValue && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-slate-500">Property Value</p>
                      <p className="text-slate-900 font-medium">
                        {formatCurrency(application.propertyValue)}
                      </p>
                    </div>
                    {application.downPaymentAmount && (
                      <div>
                        <p className="text-sm text-slate-500">Down Payment</p>
                        <p className="text-slate-900 font-medium">
                          {formatCurrency(application.downPaymentAmount)}
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Created</p>
                  <p className="text-xs text-slate-500">
                    {new Date(application.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {application.submittedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Submitted</p>
                    <p className="text-xs text-slate-500">
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
                      <p className="text-sm font-medium text-slate-900">Approved</p>
                      <p className="text-xs text-slate-500">
                        {new Date(application.decisionMadeAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

              {application.decisionMadeAt &&
                ['DECLINED', 'UNDERWRITING_DECLINED', 'CREDIT_DECLINED'].includes(
                  effectiveStatus
                ) && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-600 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Rejected</p>
                      <p className="text-xs text-slate-500">
                        {new Date(application.decisionMadeAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Assignment Info */}
          {application.assignedToUserId && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Assignment</h2>
              <div className="space-y-3">
                {/* If I'm the assigned reviewer, show who assigned me (Assigned By) */}
                {isAssignedReviewer ? (
                  <div>
                    <p className="text-sm text-slate-500">Assigned By</p>
                    {application.createdByUser ? (
                      <div>
                        <p className="text-slate-900 font-medium">
                          {application.createdByUser.firstName} {application.createdByUser.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {application.createdByUser.roles &&
                          application.createdByUser.roles.length > 0
                            ? formatRoleName(application.createdByUser.roles[0])
                            : application.createdByUser.userType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-900 font-medium">
                        User #{application.createdByUserId.slice(-8)}
                      </p>
                    )}
                  </div>
                ) : (
                  /* If I'm not the reviewer, show who it's assigned to */
                  <div>
                    <p className="text-sm text-slate-500">Assigned To</p>
                    {application.assignedToUser ? (
                      <div>
                        <p className="text-slate-900 font-medium">
                          {application.assignedToUser.firstName}{' '}
                          {application.assignedToUser.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {application.assignedToUser.roles &&
                          application.assignedToUser.roles.length > 0
                            ? formatRoleName(application.assignedToUser.roles[0])
                            : application.assignedToUser.userType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-900 font-medium">
                        User #{application.assignedToUserId.slice(-8)}
                      </p>
                    )}
                  </div>
                )}
                {application.assignedAt && (
                  <div>
                    <p className="text-sm text-slate-500">Assigned At</p>
                    <p className="text-slate-900">
                      {new Date(application.assignedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes from Application Creator */}
          {notes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.noteId} className="border-l-4 border-[#7f2b7b]/40 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-900">
                        {note.createdByUserName || `User #${note.createdByUserId.slice(-8)}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">{note.content}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {note.noteType.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk & Compliance */}
          {(application.riskScore !== undefined ||
            application.creditScoreAtApplication ||
            application.kycCompleted !== undefined) && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Risk & Compliance</h2>
              <div className="space-y-3">
                {application.riskScore !== undefined && (
                  <div>
                    <p className="text-sm text-slate-500">Risk Score</p>
                    <p className="text-slate-900 font-medium">{application.riskScore}</p>
                  </div>
                )}
                {application.creditScoreAtApplication && (
                  <div>
                    <p className="text-sm text-slate-500">Credit Score</p>
                    <p className="text-slate-900 font-medium">
                      {application.creditScoreAtApplication}
                    </p>
                  </div>
                )}
                {application.kycCompleted !== undefined && (
                  <div>
                    <p className="text-sm text-slate-500">KYC Status</p>
                    <p className="text-slate-900 font-medium">
                      {application.kycCompleted ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                )}
                {application.amlCheckCompleted !== undefined && (
                  <div>
                    <p className="text-sm text-slate-500">AML Check</p>
                    <p className="text-slate-900 font-medium">
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

/* ── StatusBadge ──────────────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  SUBMITTED: 'bg-blue-500',
  UNDER_REVIEW: 'bg-amber-500',
  CREDIT_CHECK: 'bg-violet-500',
  UNDERWRITING: 'bg-orange-500',
  MANAGER_APPROVAL: 'bg-orange-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
  DECLINED: 'bg-red-500',
  RETURNED_FOR_CORRECTIONS: 'bg-amber-500',
  DISBURSED: 'bg-emerald-600',
  PENDING_KYC: 'bg-orange-500',
  PENDING_CREDIT_CHECK: 'bg-violet-500',
  REFERRED_TO_SENIOR: 'bg-amber-500',
  PENDING_UNDERWRITING: 'bg-orange-500',
  REFERRED_TO_UNDERWRITER: 'bg-amber-500',
  OFFER_GENERATED: 'bg-blue-500',
  OFFER_SENT: 'bg-blue-500',
  PENDING_ESIGN: 'bg-cyan-500',
  ESIGN_IN_PROGRESS: 'bg-cyan-500',
  ESIGN_COMPLETED: 'bg-teal-500',
  PENDING_BOOKING: 'bg-amber-500',
  BOOKING_IN_PROGRESS: 'bg-amber-500',
  BOOKED: 'bg-emerald-600',
  CANCELLED: 'bg-slate-400',
  WITHDRAWN: 'bg-slate-400',
  EXPIRED: 'bg-slate-400',
};
const STATUS_BG_MAP: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700',
  CREDIT_CHECK: 'bg-violet-50 text-violet-700',
  UNDERWRITING: 'bg-orange-50 text-orange-700',
  MANAGER_APPROVAL: 'bg-orange-50 text-orange-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  DECLINED: 'bg-red-50 text-red-700',
  RETURNED_FOR_CORRECTIONS: 'bg-amber-50 text-amber-700',
  DISBURSED: 'bg-emerald-50 text-emerald-800',
  PENDING_KYC: 'bg-orange-50 text-orange-700',
  PENDING_CREDIT_CHECK: 'bg-violet-50 text-violet-700',
  REFERRED_TO_SENIOR: 'bg-amber-50 text-amber-700',
  PENDING_UNDERWRITING: 'bg-orange-50 text-orange-700',
  REFERRED_TO_UNDERWRITER: 'bg-amber-50 text-amber-700',
  OFFER_GENERATED: 'bg-blue-50 text-blue-700',
  OFFER_SENT: 'bg-blue-50 text-blue-700',
  PENDING_ESIGN: 'bg-cyan-50 text-cyan-700',
  ESIGN_IN_PROGRESS: 'bg-cyan-50 text-cyan-700',
  ESIGN_COMPLETED: 'bg-teal-50 text-teal-700',
  PENDING_BOOKING: 'bg-amber-50 text-amber-700',
  BOOKING_IN_PROGRESS: 'bg-amber-50 text-amber-700',
  BOOKED: 'bg-emerald-50 text-emerald-800',
  CANCELLED: 'bg-slate-50 text-slate-700',
  WITHDRAWN: 'bg-slate-50 text-slate-700',
  EXPIRED: 'bg-slate-50 text-slate-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${STATUS_BG_MAP[status] || 'bg-slate-50 text-slate-700'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || 'bg-slate-400'}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
