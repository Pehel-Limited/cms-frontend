// components/workflow/ApplicationWorkflowPanel.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  LomsApplicationStatus,
  StatusInfo,
  WorkflowTask,
  Offer,
  OfferCondition,
  AuditEvent,
  LoanBooking,
  getProductLabel,
} from '@/types/loms';
import { lomsService } from '@/services/api/lomsService';
import { applicationService } from '@/services/api/applicationService';
import { WorkflowStepper } from './WorkflowStepper';
import { WorkflowActions, WorkflowAction } from './WorkflowActions';
import { OfferCard } from './OfferCard';
import { AuditTimeline } from './AuditTimeline';
import { BookingModal } from './BookingModal';

interface ApplicationWorkflowPanelProps {
  applicationId: string;
  applicationStatus: string;
  customerId: string;
  currentUserId: string;
  isApplicationCreator: boolean;
  assignedToUserId?: string;
  approvedAmount?: number;
  currency?: string;
  kycVerified?: boolean;
  productName?: string;
  onStatusChange?: () => void;
}

/**
 * Application Workflow Panel
 * Complete LOMS workflow integration component
 */
export function ApplicationWorkflowPanel({
  applicationId,
  applicationStatus,
  customerId,
  currentUserId,
  isApplicationCreator,
  assignedToUserId,
  approvedAmount = 0,
  currency = 'EUR',
  kycVerified = false,
  productName,
  onStatusChange,
}: ApplicationWorkflowPanelProps) {
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [conditions, setConditions] = useState<OfferCondition[]>([]);
  const [booking, setBooking] = useState<LoanBooking | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'tasks' | 'offer' | 'history'>(
    'workflow'
  );

  const [showDecisionModal, setShowDecisionModal] = useState<'approve' | 'decline' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  const isAssignedReviewer = currentUserId === assignedToUserId;

  // Use the LOMS status directly - we now receive the effective status from the parent
  const lomsStatus = statusInfo?.status || applicationStatus;

  // Load workflow data
  useEffect(() => {
    loadWorkflowData();
  }, [applicationId, applicationStatus]);

  async function loadWorkflowData() {
    try {
      setLoading(true);

      // Load status info - backend will read actual status from database
      const status = await lomsService.getApplicationStatus(applicationId, lomsStatus);
      setStatusInfo(status);

      // Load tasks (if any)
      try {
        const taskList = await lomsService.getApplicationTasks(applicationId);
        setTasks(taskList);
      } catch {
        // Tasks may not exist yet
      }

      // Load offer if in offer phase
      if (
        [
          'APPROVED',
          'OFFER_GENERATED',
          'OFFER_SENT',
          'OFFER_ACCEPTED',
          'PENDING_ESIGN',
          'ESIGN_IN_PROGRESS',
          'ESIGN_COMPLETED',
          'PENDING_BOOKING',
          'BOOKING_IN_PROGRESS',
          'BOOKED',
        ].includes(lomsStatus)
      ) {
        try {
          const latestOffer = await lomsService.getLatestOffer(applicationId);
          if (latestOffer) {
            setOffer(latestOffer);
            const conds = await lomsService.getOfferConditions(latestOffer.id);
            setConditions(conds);
          }
        } catch {
          // Offer may not exist yet
        }
      }

      // Load booking status if applicable
      if (['PENDING_BOOKING', 'BOOKING_IN_PROGRESS', 'BOOKED'].includes(lomsStatus)) {
        try {
          const bookingStatus = await lomsService.getBooking(applicationId);
          setBooking(bookingStatus);
        } catch {
          // Booking may not exist yet
        }
      }

      // Load audit events
      try {
        const events = await lomsService.getAuditTrail(applicationId);
        setAuditEvents(events);
      } catch {
        // Audit may not be available
      }
    } catch (error) {
      console.error('Failed to load workflow data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Handle workflow actions
  async function handleAction(action: WorkflowAction) {
    try {
      setLoading(true);

      switch (action) {
        case 'SUBMIT':
          await lomsService.transitionStatus(applicationId, {
            currentStatus: 'DRAFT',
            targetStatus: 'SUBMITTED',
            actorId: currentUserId,
            reason: 'Application submitted',
          });
          toast.success('Application submitted successfully');
          break;

        case 'SUBMIT_FOR_DECISIONING':
          await lomsService.submitForDecisioning(applicationId, currentUserId);
          toast.success('Application submitted for credit decisioning');
          break;

        case 'APPROVE':
          setShowDecisionModal('approve');
          setDecisionNotes('');
          return; // Don't reload data yet - wait for modal confirmation

        case 'DECLINE':
          setShowDecisionModal('decline');
          setDecisionNotes('');
          return; // Don't reload data yet - wait for modal confirmation

        case 'GENERATE_OFFER':
          await lomsService.generateOffer(applicationId, currentUserId);
          toast.success('Offer generation initiated');
          break;

        case 'ACCEPT_OFFER':
          if (offer) {
            await lomsService.acceptOffer(applicationId, offer.id);
            toast.success('Offer accepted');
          }
          break;

        case 'SEND_FOR_SIGNATURE':
          await lomsService.sendForSignature(applicationId, currentUserId);
          toast.success('Documents sent for e-signature');
          break;

        case 'CONFIRM_ESIGN':
          await lomsService.transitionStatus(applicationId, {
            currentStatus: 'PENDING_ESIGN',
            targetStatus: 'ESIGN_COMPLETED',
            actorId: currentUserId,
            reason: 'E-signature manually confirmed',
          });
          toast.success('E-signature confirmed — ready for booking');
          break;

        case 'INITIATE_BOOKING':
          // Open the booking modal to configure disbursement
          setShowBookingModal(true);
          return; // Don't reload data yet - wait for modal confirmation

        case 'CANCEL':
          // Use backend status for API call
          await lomsService.cancelApplication(
            applicationId,
            lomsStatus,
            currentUserId,
            'User cancelled'
          );
          toast.success('Application cancelled');
          break;

        case 'WITHDRAW':
          // Use backend status for API call
          await lomsService.cancelApplication(
            applicationId,
            lomsStatus,
            currentUserId,
            'Application withdrawn'
          );
          toast.success('Application withdrawn');
          break;

        case 'VIEW_OFFER':
          setActiveTab('offer');
          break;

        case 'VIEW_AUDIT':
          setActiveTab('history');
          break;

        case 'COMPLETE_KYC':
          await applicationService.completeKyc(applicationId);
          toast.success('KYC Completed Successfully');
          break;

        default:
          toast.info(`Action ${action} not yet implemented`);
      }

      // Reload workflow data
      await loadWorkflowData();
      onStatusChange?.();
    } catch (error: any) {
      toast.error(error.message || `Failed to perform action: ${action}`);
    } finally {
      setLoading(false);
    }
  }

  // Handle task actions
  async function handleClaimTask(taskId: string) {
    try {
      setLoading(true);
      await lomsService.claimTask(taskId, { assigneeId: currentUserId });
      toast.success('Task claimed');
      await loadWorkflowData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim task');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteTask(taskId: string, decision: string, notes: string) {
    try {
      setLoading(true);
      await lomsService.completeTask(taskId, {
        completedBy: currentUserId,
        decision,
        notes,
      });
      toast.success('Task completed');
      await loadWorkflowData();
      onStatusChange?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Workflow Stepper */}
      <WorkflowStepper
        currentStatus={lomsStatus as LomsApplicationStatus}
        productName={productName}
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'workflow', label: 'Workflow Actions', icon: '⚡' },
              {
                id: 'tasks',
                label: 'Tasks',
                icon: '📋',
                count: tasks.filter(t => t.status !== 'DONE').length,
              },
              { id: 'offer', label: 'Offer', icon: '💰' },
              { id: 'history', label: 'History', icon: '📜', count: auditEvents.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Workflow Actions Tab */}
          {activeTab === 'workflow' && statusInfo && (
            <WorkflowActions
              currentStatus={lomsStatus as LomsApplicationStatus}
              validTransitions={statusInfo.validTransitions || []}
              isAssignedReviewer={isAssignedReviewer}
              isApplicationCreator={isApplicationCreator}
              canCancel={statusInfo.canCancel}
              canWithdraw={statusInfo.canWithdraw}
              onAction={handleAction}
              loading={loading}
              kycVerified={kycVerified}
              productName={productName}
            />
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div>
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl">📋</span>
                  <p className="text-gray-500 mt-2">No pending tasks</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-4 rounded-lg border ${
                        task.status === 'DONE'
                          ? 'bg-green-50 border-green-200'
                          : task.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {task.taskType.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Queue: {task.queue} • Priority: {task.priority}
                          </p>
                          {task.assignedTo && (
                            <p className="text-sm text-gray-500">
                              Assigned to: {task.assigneeName || task.assignedTo}
                            </p>
                          )}
                          {task.notes && <p className="text-sm text-gray-600 mt-2">{task.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              task.status === 'DONE'
                                ? 'bg-green-100 text-green-800'
                                : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                      </div>

                      {/* Task actions */}
                      {task.status !== 'DONE' && (
                        <div className="mt-4 flex gap-2">
                          {!task.assignedTo && (
                            <button
                              onClick={() => handleClaimTask(task.id)}
                              disabled={loading}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Claim Task
                            </button>
                          )}
                          {task.assignedTo === currentUserId && (
                            <>
                              <button
                                onClick={() => handleCompleteTask(task.id, 'APPROVE', '')}
                                disabled={loading}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleCompleteTask(task.id, 'DECLINE', '')}
                                disabled={loading}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Offer Tab */}
          {activeTab === 'offer' && (
            <div>
              {offer ? (
                <OfferCard
                  offer={offer}
                  conditions={conditions}
                  onAccept={() => handleAction('ACCEPT_OFFER')}
                  loading={loading}
                  productName={productName}
                />
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl">💰</span>
                  <p className="text-gray-500 mt-2">
                    {lomsStatus === 'APPROVED'
                      ? 'Ready to generate offer'
                      : 'No offer available yet'}
                  </p>
                  {lomsStatus === 'APPROVED' && (
                    <button
                      onClick={() => handleAction('GENERATE_OFFER')}
                      disabled={loading}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Generate Offer
                    </button>
                  )}
                </div>
              )}

              {/* Booking Status */}
              {booking && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Booking Status</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium">{booking.bookingStatus}</p>
                    </div>
                    {booking.temenosArrangementId && (
                      <div>
                        <p className="text-gray-500">Temenos Arrangement ID</p>
                        <p className="font-medium font-mono">{booking.temenosArrangementId}</p>
                      </div>
                    )}
                    {booking.errorMessage && (
                      <div className="col-span-2">
                        <p className="text-gray-500">Error</p>
                        <p className="text-red-600">{booking.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && <AuditTimeline events={auditEvents} maxItems={15} />}
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={handleBookingConfirm}
        applicationId={applicationId}
        customerId={customerId}
        approvedAmount={offer?.amount || approvedAmount}
        currency={offer?.currency || currency}
        loading={loading}
        productName={productName}
      />

      {/* Underwriting Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div
              className={`px-6 py-4 ${showDecisionModal === 'approve' ? 'bg-green-50 border-b border-green-200' : 'bg-red-50 border-b border-red-200'}`}
            >
              <h3
                className={`text-lg font-semibold ${showDecisionModal === 'approve' ? 'text-green-900' : 'text-red-900'}`}
              >
                {showDecisionModal === 'approve'
                  ? '✅ Approve Application'
                  : '❌ Decline Application'}
              </h3>
              <p
                className={`text-sm mt-1 ${showDecisionModal === 'approve' ? 'text-green-700' : 'text-red-700'}`}
              >
                {showDecisionModal === 'approve'
                  ? 'This will approve the application and move it to the offer stage.'
                  : 'This will decline the application. This action cannot be undone.'}
              </p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {showDecisionModal === 'approve' ? 'Approval Notes' : 'Reason for Decline'}{' '}
                {showDecisionModal === 'decline' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={decisionNotes}
                onChange={e => setDecisionNotes(e.target.value)}
                placeholder={
                  showDecisionModal === 'approve'
                    ? 'Optional notes for approval...'
                    : 'Provide reason for declining...'
                }
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowDecisionModal(null)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecisionConfirm(showDecisionModal)}
                disabled={loading || (showDecisionModal === 'decline' && !decisionNotes.trim())}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2 ${
                  showDecisionModal === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading && (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {showDecisionModal === 'approve' ? 'Confirm Approval' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Handle underwriting decision (approve/decline)
  async function handleDecisionConfirm(decision: 'approve' | 'decline') {
    try {
      setLoading(true);

      const targetStatus = decision === 'approve' ? 'APPROVED' : 'UNDERWRITING_DECLINED';

      await lomsService.transitionStatus(applicationId, {
        currentStatus: lomsStatus,
        targetStatus,
        actorId: currentUserId,
        reason:
          decisionNotes ||
          (decision === 'approve'
            ? 'Application approved by underwriter'
            : 'Application declined by underwriter'),
      });

      toast.success(
        decision === 'approve'
          ? 'Application approved — ready for offer generation'
          : 'Application has been declined'
      );

      setShowDecisionModal(null);
      setDecisionNotes('');

      // Reload workflow data
      await loadWorkflowData();
      onStatusChange?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${decision} application`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Handle booking confirmation with disbursement details
  async function handleBookingConfirm(
    disbursements: Array<{
      id: string;
      accountNumber: string;
      accountName: string;
      bankName: string;
      iban?: string;
      bic?: string;
      isExternal: boolean;
      amount: number;
      percentage: number;
    }>
  ) {
    try {
      setLoading(true);

      // Book the loan with disbursement details
      await lomsService.bookLoanWithDisbursements(applicationId, currentUserId, disbursements);

      const label = getProductLabel(productName);
      toast.success(`${label} booked successfully! Disbursement initiated.`);
      setShowBookingModal(false);

      // Reload workflow data
      await loadWorkflowData();
      onStatusChange?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to book ${getProductLabel(productName).toLowerCase()}`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }
}

export default ApplicationWorkflowPanel;
