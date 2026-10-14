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
import { WorkflowIcon, type WorkflowIconName } from './icons';

interface ApplicationWorkflowPanelProps {
  applicationId: string;
  applicationStatus: string;
  customerId: string;
  currentUserId: string;
  isApplicationCreator: boolean;
  canAssign?: boolean;
  assignedToUserId?: string;
  approvedAmount?: number;
  currency?: string;
  kycVerified?: boolean;
  productName?: string;
  onStatusChange?: () => void;
  onRequestAssign?: () => void;
}

/** Task state, read from the pill rather than the card fill: one tinted chip per row. */
function taskStatusStyle(status: string): React.CSSProperties {
  const fg =
    status === 'DONE'
      ? 'var(--rm-up)'
      : status === 'IN_PROGRESS'
        ? 'var(--rm-brand)'
        : 'var(--rm-text-muted)';
  return {
    backgroundColor: `color-mix(in srgb, ${fg} 14%, transparent)`,
    color: fg,
  };
}

function TabEmpty({ icon, text }: { icon: WorkflowIconName; text: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-muted)' }}
      >
        <WorkflowIcon name={icon} size={19} />
      </span>
      <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {text}
      </p>
    </div>
  );
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
  canAssign = false,
  assignedToUserId,
  approvedAmount = 0,
  currency = 'EUR',
  kycVerified = false,
  productName,
  onStatusChange,
  onRequestAssign,
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

  // Segregation of duties: creator cannot review their own application
  const isAssignedReviewer = currentUserId === assignedToUserId && !isApplicationCreator;

  // Use the LOMS status directly - we now receive the effective status from the parent
  const lomsStatus = statusInfo?.currentStatus || applicationStatus;

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
  async function handleAction(action: WorkflowAction, targetStatus?: LomsApplicationStatus) {
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

        case 'ADVANCE':
          if (!targetStatus) {
            toast.error('This action is missing its target status.');
            return;
          }
          await lomsService.transitionStatus(applicationId, {
            currentStatus: lomsStatus,
            targetStatus,
            actorId: currentUserId,
            reason: `Advanced to ${targetStatus}`,
          });
          toast.success(`Application moved to ${targetStatus.replace(/_/g, ' ').toLowerCase()}`);
          break;

        case 'ASSIGN':
          // The underwriter picker and its segregation-of-duties filtering live on the page.
          onRequestAssign?.();
          return;

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
          // cancelApplication hard-codes CANCELLED — withdraw to its own terminal state.
          await lomsService.transitionStatus(applicationId, {
            currentStatus: lomsStatus,
            targetStatus: 'WITHDRAWN',
            actorId: currentUserId,
            reason: 'Application withdrawn',
          });
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
      <div
        className="overflow-hidden rounded-3xl"
        style={{
          backgroundColor: 'var(--rm-card)',
          border: '1px solid var(--rm-hairline)',
        }}
      >
        <div style={{ borderBottom: '1px solid var(--rm-hairline)' }}>
          <nav className="flex overflow-x-auto" aria-label="Application workflow">
            {[
              { id: 'workflow', label: 'Workflow Actions', icon: 'bolt' },
              {
                id: 'tasks',
                label: 'Tasks',
                icon: 'clipboard',
                count: tasks.filter(t => t.status !== 'DONE').length,
              },
              { id: 'offer', label: 'Offer', icon: 'banknote' },
              { id: 'history', label: 'History', icon: 'history', count: auditEvents.length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                aria-current={activeTab === tab.id ? 'true' : undefined}
                className="inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  borderColor: activeTab === tab.id ? 'var(--rm-brand)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--rm-brand-on-soft)' : 'var(--rm-text-muted)',
                }}
              >
                <WorkflowIcon name={tab.icon as WorkflowIconName} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{
                      backgroundColor: 'var(--rm-input)',
                      color: 'var(--rm-text-secondary)',
                    }}
                  >
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
              canAssign={canAssign}
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
                <TabEmpty icon="clipboard" text="No pending tasks" />
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="rounded-2xl p-4"
                      style={{
                        backgroundColor: 'var(--rm-input)',
                        border: '1px solid var(--rm-hairline)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4
                            className="font-medium capitalize"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {task.taskType.toLowerCase().replace(/_/g, ' ')}
                          </h4>
                          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            Queue: {task.queue} • Priority: {task.priority}
                          </p>
                          {task.assignedTo && (
                            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              Assigned to: {task.assigneeName || task.assignedTo}
                            </p>
                          )}
                          {task.notes && (
                            <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                              {task.notes}
                            </p>
                          )}
                        </div>
                        <span
                          className="flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]"
                          style={taskStatusStyle(task.status)}
                        >
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Task actions */}
                      {task.status !== 'DONE' && (
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          {!task.assignedTo && (
                            <button
                              type="button"
                              onClick={() => handleClaimTask(task.id)}
                              disabled={loading}
                              className="rm-btn rm-btn-quiet"
                            >
                              <WorkflowIcon name="userPlus" />
                              Claim task
                            </button>
                          )}
                          {task.assignedTo === currentUserId && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCompleteTask(task.id, 'APPROVE', '')}
                                disabled={loading}
                                className="rm-btn rm-btn-solid"
                              >
                                <WorkflowIcon name="check" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCompleteTask(task.id, 'DECLINE', '')}
                                disabled={loading}
                                className="rm-btn rm-btn-danger"
                              >
                                <WorkflowIcon name="x" />
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
                <div className="flex flex-col items-center">
                  <TabEmpty
                    icon="banknote"
                    text={
                      lomsStatus === 'APPROVED'
                        ? 'Ready to generate offer'
                        : 'No offer available yet'
                    }
                  />
                  {lomsStatus === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => handleAction('GENERATE_OFFER')}
                      disabled={loading}
                      className="rm-btn rm-btn-solid mt-1"
                    >
                      <WorkflowIcon name="file" />
                      Generate offer
                    </button>
                  )}
                </div>
              )}

              {/* Booking Status */}
              {booking && (
                <div
                  className="mt-6 rounded-2xl p-4"
                  style={{
                    backgroundColor: 'var(--rm-input)',
                    border: '1px solid var(--rm-hairline)',
                  }}
                >
                  <h4 className="mb-2 font-medium" style={{ color: 'var(--rm-text)' }}>
                    Booking Status
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p style={{ color: 'var(--rm-text-muted)' }}>Status</p>
                      <p className="font-medium" style={{ color: 'var(--rm-text)' }}>
                        {booking.bookingStatus}
                      </p>
                    </div>
                    {booking.temenosArrangementId && (
                      <div>
                        <p style={{ color: 'var(--rm-text-muted)' }}>Temenos Arrangement ID</p>
                        <p className="font-mono font-medium" style={{ color: 'var(--rm-text)' }}>
                          {booking.temenosArrangementId}
                        </p>
                      </div>
                    )}
                    {booking.errorMessage && (
                      <div className="col-span-2">
                        <p style={{ color: 'var(--rm-text-muted)' }}>Error</p>
                        <p style={{ color: 'var(--rm-down)' }}>{booking.errorMessage}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="mx-4 w-full max-w-md overflow-hidden rounded-3xl"
            style={{
              backgroundColor: 'var(--rm-card)',
              border: '1px solid var(--rm-hairline)',
              boxShadow: 'var(--rm-shadow-glass)',
            }}
          >
            <div className="px-6 pt-6">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      showDecisionModal === 'approve'
                        ? 'color-mix(in srgb, var(--rm-up) 14%, transparent)'
                        : 'var(--rm-danger-soft)',
                    color: showDecisionModal === 'approve' ? 'var(--rm-up)' : 'var(--rm-down)',
                  }}
                >
                  <WorkflowIcon name={showDecisionModal === 'approve' ? 'check' : 'x'} size={17} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
                    {showDecisionModal === 'approve' ? 'Approve application' : 'Decline application'}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {showDecisionModal === 'approve'
                      ? 'This will approve the application and move it to the offer stage.'
                      : 'This will decline the application. This action cannot be undone.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                {showDecisionModal === 'approve' ? 'Approval Notes' : 'Reason for Decline'}{' '}
                {showDecisionModal === 'decline' && (
                  <span style={{ color: 'var(--rm-down)' }}>*</span>
                )}
              </label>
              <textarea
                value={decisionNotes}
                onChange={e => setDecisionNotes(e.target.value)}
                placeholder={
                  showDecisionModal === 'approve'
                    ? 'Optional notes for approval...'
                    : 'Provide reason for declining...'
                }
                className="w-full rounded-2xl p-3 text-sm input-brand"
                style={{
                  backgroundColor: 'var(--rm-input)',
                  border: '1px solid var(--rm-hairline-strong)',
                  color: 'var(--rm-text)',
                }}
                rows={4}
              />
            </div>
            <div
              className="flex justify-end gap-2.5 px-6 py-4"
              style={{ borderTop: '1px solid var(--rm-hairline)', backgroundColor: 'var(--rm-bg)' }}
            >
              <button
                type="button"
                onClick={() => setShowDecisionModal(null)}
                disabled={loading}
                className="rm-btn rm-btn-quiet"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDecisionConfirm(showDecisionModal)}
                disabled={loading || (showDecisionModal === 'decline' && !decisionNotes.trim())}
                className={`rm-btn ${
                  showDecisionModal === 'approve' ? 'rm-btn-solid' : 'rm-btn-danger'
                }`}
              >
                {loading && (
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full"
                    style={{
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      opacity: 0.7,
                    }}
                  />
                )}
                {showDecisionModal === 'approve' ? 'Confirm approval' : 'Confirm decline'}
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
