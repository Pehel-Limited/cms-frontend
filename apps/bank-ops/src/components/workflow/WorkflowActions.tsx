// components/workflow/WorkflowActions.tsx
'use client';

import React from 'react';
import { LomsApplicationStatus, STATUS_CONFIG, getProductLabel, isTerminalStatus } from '@/types/loms';

interface WorkflowActionsProps {
  currentStatus: LomsApplicationStatus;
  validTransitions: LomsApplicationStatus[];
  isAssignedReviewer: boolean;
  isApplicationCreator: boolean;
  canAssign: boolean;
  canCancel: boolean;
  canWithdraw: boolean;
  onAction: (action: WorkflowAction, targetStatus?: LomsApplicationStatus) => void;
  loading?: boolean;
  kycVerified?: boolean;
  productName?: string;
}

export type WorkflowAction =
  | 'SUBMIT'
  | 'ASSIGN'
  | 'ADVANCE'
  | 'APPROVE'
  | 'DECLINE'
  | 'GENERATE_OFFER'
  | 'ACCEPT_OFFER'
  | 'SEND_FOR_SIGNATURE'
  | 'INITIATE_BOOKING'
  | 'CANCEL'
  | 'WITHDRAW'
  | 'VIEW_OFFER'
  | 'VIEW_DOCUMENTS'
  | 'VIEW_AUDIT'
  | 'COMPLETE_KYC'
  | 'CONFIRM_ESIGN';

interface ActionConfig {
  action: WorkflowAction;
  label: string;
  description: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  requiresReviewer?: boolean;
  requiresCreator?: boolean;
  /** Set on ADVANCE so the caller knows which status to move to. */
  targetStatus?: LomsApplicationStatus;
  /** Statuses this action already reaches, so no duplicate ADVANCE button is offered. */
  covers?: LomsApplicationStatus[];
}

/**
 * Labels for moving straight to a status via the generic workflow transition endpoint.
 * Keyed by *target* status, because the backend state machine — not this file — decides
 * which targets are reachable from where we are.
 */
const ADVANCE_PRESENTATION: Record<
  LomsApplicationStatus,
  { label: string; description: string; icon: string; variant: ActionConfig['variant'] }
> = {
  DRAFT: { label: 'Reopen as draft', description: 'Return to draft', icon: '📝', variant: 'secondary' },
  SUBMITTED: { label: 'Resubmit application', description: 'Submit the corrected application', icon: '📤', variant: 'primary' },
  PENDING_KYC: { label: 'Start KYC verification', description: 'Move the application into KYC', icon: '🔍', variant: 'primary' },
  KYC_APPROVED: { label: 'Approve KYC', description: 'Record that KYC passed', icon: '✅', variant: 'success' },
  KYC_REJECTED: { label: 'Reject KYC', description: 'KYC verification failed', icon: '❌', variant: 'danger' },
  PENDING_DOCUMENTS: { label: 'Request documents', description: 'Ask the customer for outstanding documents', icon: '📎', variant: 'primary' },
  DOCUMENTS_RECEIVED: { label: 'Confirm documents received', description: 'Mark document collection complete', icon: '📥', variant: 'primary' },
  PENDING_CREDIT_CHECK: { label: 'Start credit check', description: 'Run the credit bureau assessment', icon: '⚙️', variant: 'primary' },
  CREDIT_APPROVED: { label: 'Record credit approval', description: 'Credit check passed', icon: '✅', variant: 'success' },
  CREDIT_DECLINED: { label: 'Record credit decline', description: 'Credit check failed', icon: '❌', variant: 'danger' },
  PENDING_UNDERWRITING: { label: 'Send to underwriting', description: 'Queue for underwriting review', icon: '🗂️', variant: 'primary' },
  IN_UNDERWRITING: { label: 'Start underwriting', description: 'Begin the underwriting review', icon: '🔬', variant: 'primary' },
  UNDERWRITING_APPROVED: { label: 'Approve underwriting', description: 'Underwriting signed off', icon: '✅', variant: 'success' },
  UNDERWRITING_DECLINED: { label: 'Decline underwriting', description: 'Underwriting declined the application', icon: '❌', variant: 'danger' },
  REFERRED_TO_SENIOR: { label: 'Escalate to senior reviewer', description: 'Refer for senior review', icon: '👤', variant: 'warning' },
  REFERRED_TO_UNDERWRITER: { label: 'Refer to underwriter', description: 'Assign to an underwriter', icon: '🔎', variant: 'primary' },
  PENDING_DECISION: { label: 'Send for final decision', description: 'Await the credit decision', icon: '⚖️', variant: 'primary' },
  APPROVED: { label: 'Approve application', description: 'Record approval', icon: '✅', variant: 'success' },
  DECLINED: { label: 'Decline application', description: 'Record decline', icon: '❌', variant: 'danger' },
  OFFER_GENERATED: { label: 'Mark offer generated', description: 'Offer created', icon: '📋', variant: 'primary' },
  OFFER_SENT: { label: 'Mark offer sent', description: 'Offer sent to the customer', icon: '📩', variant: 'primary' },
  OFFER_ACCEPTED: { label: 'Record offer acceptance', description: 'Customer accepted', icon: '✓', variant: 'success' },
  OFFER_REJECTED: { label: 'Record offer rejection', description: 'Customer rejected', icon: '❌', variant: 'danger' },
  OFFER_EXPIRED: { label: 'Expire offer', description: 'Offer validity lapsed', icon: '⌛', variant: 'danger' },
  OFFER_COUNTERED: { label: 'Record counter-offer', description: 'Customer requested changes', icon: '💬', variant: 'warning' },
  PENDING_CONDITIONS: { label: 'Track conditions', description: 'Move to conditions precedent', icon: '📃', variant: 'primary' },
  CONDITIONS_MET: { label: 'Mark conditions met', description: 'All conditions satisfied', icon: '✅', variant: 'success' },
  PENDING_ESIGN: { label: 'Send for signature', description: 'Await electronic signature', icon: '✍️', variant: 'primary' },
  ESIGN_IN_PROGRESS: { label: 'Mark signing in progress', description: 'Documents being signed', icon: '✍️', variant: 'primary' },
  ESIGN_COMPLETED: { label: 'Confirm signatures complete', description: 'All signatures collected', icon: '✅', variant: 'success' },
  PENDING_BOOKING: { label: 'Send for booking', description: 'Ready for core banking', icon: '📚', variant: 'primary' },
  BOOKING_IN_PROGRESS: { label: 'Start booking', description: 'Booking into the core system', icon: '🏧', variant: 'primary' },
  BOOKED: { label: 'Confirm booking', description: 'Loan account created', icon: '✅', variant: 'success' },
  PENDING_DISBURSEMENT: { label: 'Queue disbursement', description: 'Awaiting payout', icon: '💰', variant: 'primary' },
  DISBURSEMENT_IN_PROGRESS: { label: 'Start disbursement', description: 'Payout processing', icon: '💸', variant: 'primary' },
  DISBURSED: { label: 'Confirm disbursement', description: 'Amount paid out', icon: '🎉', variant: 'success' },
  RETURNED: { label: 'Return for corrections', description: 'Send back to the customer', icon: '↩️', variant: 'warning' },
  CANCELLED: { label: 'Cancel', description: 'Cancel the application', icon: '🚫', variant: 'danger' },
  WITHDRAWN: { label: 'Withdraw', description: 'Withdraw the application', icon: '↩️', variant: 'warning' },
  EXPIRED: { label: 'Expire application', description: 'Closed for inactivity', icon: '⌛', variant: 'danger' },
  ACTIVE: { label: 'Mark loan active', description: 'Loan is performing', icon: '📈', variant: 'success' },
  CLOSED: { label: 'Close application', description: 'Facility fully repaid', icon: '🏁', variant: 'secondary' },
};

/** Handled by the dedicated Cancel / Withdraw buttons rather than a generic ADVANCE. */
const TERMINAL_EXIT_STATUSES: LomsApplicationStatus[] = ['CANCELLED', 'WITHDRAWN'];

/**
 * Get available actions for current status
 */
function getAvailableActions(
  status: LomsApplicationStatus,
  validTransitions: LomsApplicationStatus[],
  isAssignedReviewer: boolean,
  isApplicationCreator: boolean,
  kycVerified: boolean = true,
  productName?: string,
  canAssign: boolean = false
): ActionConfig[] {
  const label = getProductLabel(productName);
  const actions: ActionConfig[] = [];

  // Add KYC action if not verified and not in draft
  if (
    !kycVerified &&
    status !== 'DRAFT' &&
    status !== 'DECLINED' &&
    status !== 'CANCELLED' &&
    status !== 'WITHDRAWN'
  ) {
    actions.push({
      action: 'COMPLETE_KYC',
      label: 'Complete KYC',
      description: 'Mark KYC as verified',
      icon: '🛡️',
      variant: 'primary',
    });
  }

  if (canAssign) {
    actions.push({
      action: 'ASSIGN',
      label: 'Assign to underwriter',
      description: 'Route to an underwriter for review',
      icon: '👤',
      variant: 'primary',
      // Assignment is the backend's route into REFERRED_TO_UNDERWRITER (LoanApplication.assignTo).
      covers: ['REFERRED_TO_UNDERWRITER'],
    });
  }

  switch (status) {
    case 'DRAFT':
      actions.push({
        action: 'SUBMIT',
        label: 'Submit Application',
        description: 'Submit for processing',
        icon: '📤',
        variant: 'primary',
        requiresCreator: true,
        covers: ['SUBMITTED'],
      });
      break;

    case 'REFERRED_TO_SENIOR':
    case 'REFERRED_TO_UNDERWRITER':
      if (isAssignedReviewer) {
        actions.push({
          action: 'APPROVE',
          label: 'Approve',
          description: 'Approve application after underwriting review',
          icon: '✅',
          variant: 'success',
          requiresReviewer: true,
          covers: ['APPROVED', 'UNDERWRITING_APPROVED'],
        });
        actions.push({
          action: 'DECLINE',
          label: 'Decline',
          description: 'Decline application',
          icon: '❌',
          variant: 'danger',
          requiresReviewer: true,
          covers: ['DECLINED', 'UNDERWRITING_DECLINED'],
        });
      }
      break;

    case 'APPROVED':
      actions.push({
        action: 'GENERATE_OFFER',
        label: 'Generate Offer',
        description: `Create ${label.toLowerCase()} offer`,
        icon: '📋',
        variant: 'primary',
        covers: ['OFFER_GENERATED'],
      });
      break;

    case 'OFFER_GENERATED':
      actions.push({
        action: 'VIEW_OFFER',
        label: 'View Offer',
        description: 'Review offer details',
        icon: '👁️',
        variant: 'secondary',
      });
      actions.push({
        action: 'ACCEPT_OFFER',
        label: 'Accept Offer',
        description: 'Accept and proceed',
        icon: '✓',
        variant: 'success',
        covers: ['OFFER_ACCEPTED'],
      });
      actions.push({
        action: 'SEND_FOR_SIGNATURE',
        label: 'Send for Signature',
        description: 'Send documents for e-sign',
        icon: '✍️',
        variant: 'primary',
        covers: ['PENDING_ESIGN'],
      });
      break;

    case 'PENDING_ESIGN':
      actions.push({
        action: 'CONFIRM_ESIGN',
        label: 'Confirm E-Signature',
        description: 'Manually confirm customer has signed',
        icon: '✅',
        variant: 'success',
        covers: ['ESIGN_COMPLETED'],
      });
      actions.push({
        action: 'VIEW_DOCUMENTS',
        label: 'View Documents',
        description: 'View signature status',
        icon: '📄',
        variant: 'secondary',
      });
      break;

    case 'ESIGN_COMPLETED':
    case 'PENDING_BOOKING':
      actions.push({
        action: 'INITIATE_BOOKING',
        label: status === 'ESIGN_COMPLETED' ? `Book ${label}` : 'Complete Booking',
        description: 'Configure disbursement accounts',
        icon: '📚',
        variant: status === 'ESIGN_COMPLETED' ? 'primary' : 'success',
        covers: ['BOOKED', 'PENDING_BOOKING'],
      });
      break;

    case 'BOOKED':
      actions.push({
        action: 'VIEW_AUDIT',
        label: 'View History',
        description: 'View complete audit trail',
        icon: '📜',
        variant: 'secondary',
      });
      break;
  }

  // Everything the backend state machine legally allows from here, and that no action
  // above already performs, becomes a button. This keeps the panel in step with the
  // server's transition map instead of a hand-maintained copy of it.
  const coveredTargets = new Set(actions.flatMap(action => action.covers ?? []));
  for (const target of validTransitions) {
    if (TERMINAL_EXIT_STATUSES.includes(target) || coveredTargets.has(target)) continue;
    const presentation = ADVANCE_PRESENTATION[target];
    if (!presentation) continue;
    actions.push({
      action: 'ADVANCE',
      targetStatus: target,
      ...presentation,
    });
  }

  return actions;
}

/**
 * Workflow Actions Component
 * Displays available actions based on current status and user role
 */
export function WorkflowActions({
  currentStatus,
  validTransitions,
  isAssignedReviewer,
  isApplicationCreator,
  canAssign,
  canCancel,
  canWithdraw,
  onAction,
  loading = false,
  kycVerified = true,
  productName,
}: WorkflowActionsProps) {
  const actions = getAvailableActions(
    currentStatus,
    validTransitions,
    isAssignedReviewer,
    isApplicationCreator,
    kycVerified,
    productName,
    canAssign
  );

  // Filter actions based on user role
  const filteredActions = actions.filter(action => {
    if (action.requiresReviewer && !isAssignedReviewer) return false;
    if (action.requiresCreator && !isApplicationCreator) return false;
    return true;
  });

  // Add cancel/withdraw actions if available. Legality is the backend's call via
  // canCancel/canWithdraw — gating these on the creator left customer-originated
  // applications with no bank-side exit path.
  const supplementaryActions: ActionConfig[] = [];
  if (canWithdraw) {
    supplementaryActions.push({
      action: 'WITHDRAW',
      label: 'Withdraw',
      description: 'Withdraw application',
      icon: '↩️',
      variant: 'warning',
    });
  }
  if (canCancel) {
    supplementaryActions.push({
      action: 'CANCEL',
      label: 'Cancel',
      description: 'Cancel application',
      icon: '🚫',
      variant: 'danger',
    });
  }

  const getButtonClasses = (variant: ActionConfig['variant']) => {
    const base =
      'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed';
    switch (variant) {
      case 'primary':
        return `${base} bg-blue-600 text-white hover:bg-blue-700`;
      case 'secondary':
        return `${base} bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300`;
      case 'success':
        return `${base} bg-green-600 text-white hover:bg-green-700`;
      case 'danger':
        return `${base} bg-red-600 text-white hover:bg-red-700`;
      case 'warning':
        return `${base} bg-amber-500 text-white hover:bg-amber-600`;
      default:
        return base;
    }
  };

  const statusConfig = STATUS_CONFIG[currentStatus];

  if (filteredActions.length === 0 && supplementaryActions.length === 0) {
    const waitingMessage: Partial<Record<LomsApplicationStatus, string>> = {
      PENDING_CREDIT_CHECK: 'Credit decisioning in progress...',
      PENDING_KYC: 'Waiting for KYC verification...',
      PENDING_BOOKING: 'Booking in progress...',
      PENDING_ESIGN: 'Waiting for customer signature...',
    };
    const isReviewStage =
      currentStatus === 'REFERRED_TO_UNDERWRITER' || currentStatus === 'REFERRED_TO_SENIOR';

    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusConfig?.icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {waitingMessage[currentStatus] ??
                (isReviewStage
                  ? isAssignedReviewer
                    ? 'Ready for your decision.'
                    : isApplicationCreator
                      ? 'You cannot review your own application — segregation of duties. Another reviewer must approve or decline.'
                      : 'Awaiting underwriter decision — only the assigned reviewer can approve or decline.'
                  : isTerminalStatus(currentStatus)
                    ? `This application is ${statusConfig?.label.toLowerCase() ?? 'closed'} — no further actions.`
                    : `Nothing to action here — ${statusConfig?.description ?? 'the application is waiting on another step'}.`)}
            </p>
            {['PENDING_CREDIT_CHECK', 'PENDING_KYC', 'PENDING_BOOKING'].includes(currentStatus) && (
              <div className="flex items-center gap-2 mt-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                <span className="text-xs text-gray-500">Processing...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary actions */}
      {filteredActions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Actions</h4>
          <div className="flex flex-wrap gap-3">
            {filteredActions.map(action => (
              <button
                key={action.targetStatus ?? action.action}
                onClick={() => onAction(action.action, action.targetStatus)}
                disabled={loading}
                className={getButtonClasses(action.variant)}
                title={action.description}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Supplementary actions (cancel/withdraw) */}
      {supplementaryActions.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-3">
            {supplementaryActions.map(action => (
              <button
                key={action.targetStatus ?? action.action}
                onClick={() => onAction(action.action, action.targetStatus)}
                disabled={loading}
                className={getButtonClasses(action.variant)}
                title={action.description}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowActions;
