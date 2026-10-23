// components/workflow/WorkflowActions.tsx
'use client';

import React from 'react';
import { LomsApplicationStatus, STATUS_CONFIG, getProductLabel, isTerminalStatus } from '@/types/loms';
import { WorkflowIcon, type WorkflowIconName } from './icons';

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
  icon: WorkflowIconName;
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
  { label: string; description: string; icon: WorkflowIconName; variant: ActionConfig['variant'] }
> = {
  DRAFT: { label: 'Reopen as draft', description: 'Return to draft', icon: 'pen', variant: 'secondary' },
  SUBMITTED: { label: 'Resubmit application', description: 'Submit the corrected application', icon: 'upload', variant: 'primary' },
  PENDING_KYC: { label: 'Start KYC verification', description: 'Move the application into KYC', icon: 'search', variant: 'primary' },
  KYC_APPROVED: { label: 'Approve KYC', description: 'Record that KYC passed', icon: 'checkCircle', variant: 'success' },
  KYC_REJECTED: { label: 'Reject KYC', description: 'KYC verification failed', icon: 'xCircle', variant: 'danger' },
  PENDING_DOCUMENTS: { label: 'Request documents', description: 'Ask the customer for outstanding documents', icon: 'paperclip', variant: 'primary' },
  DOCUMENTS_RECEIVED: { label: 'Confirm documents received', description: 'Mark document collection complete', icon: 'inbox', variant: 'primary' },
  PENDING_CREDIT_CHECK: { label: 'Start credit check', description: 'Run the credit bureau assessment', icon: 'activity', variant: 'primary' },
  CREDIT_APPROVED: { label: 'Record credit approval', description: 'Credit check passed', icon: 'checkCircle', variant: 'success' },
  CREDIT_DECLINED: { label: 'Record credit decline', description: 'Credit check failed', icon: 'xCircle', variant: 'danger' },
  PENDING_UNDERWRITING: { label: 'Send to underwriting', description: 'Queue for underwriting review', icon: 'folder', variant: 'primary' },
  IN_UNDERWRITING: { label: 'Start underwriting', description: 'Begin the underwriting review', icon: 'search', variant: 'primary' },
  UNDERWRITING_APPROVED: { label: 'Approve underwriting', description: 'Underwriting signed off', icon: 'checkCircle', variant: 'success' },
  UNDERWRITING_DECLINED: { label: 'Decline underwriting', description: 'Underwriting declined the application', icon: 'xCircle', variant: 'danger' },
  REFERRED_TO_SENIOR: { label: 'Escalate to senior reviewer', description: 'Refer for senior review', icon: 'arrowUp', variant: 'warning' },
  REFERRED_TO_UNDERWRITER: { label: 'Refer to underwriter', description: 'Assign to an underwriter', icon: 'userPlus', variant: 'primary' },
  PENDING_DECISION: { label: 'Send for final decision', description: 'Await the credit decision', icon: 'scale', variant: 'primary' },
  APPROVED: { label: 'Approve application', description: 'Record approval', icon: 'checkCircle', variant: 'success' },
  DECLINED: { label: 'Decline application', description: 'Record decline', icon: 'xCircle', variant: 'danger' },
  OFFER_GENERATED: { label: 'Mark offer generated', description: 'Offer created', icon: 'file', variant: 'primary' },
  OFFER_SENT: { label: 'Mark offer sent', description: 'Offer sent to the customer', icon: 'send', variant: 'primary' },
  OFFER_ACCEPTED: { label: 'Record offer acceptance', description: 'Customer accepted', icon: 'check', variant: 'success' },
  OFFER_REJECTED: { label: 'Record offer rejection', description: 'Customer rejected', icon: 'xCircle', variant: 'danger' },
  OFFER_EXPIRED: { label: 'Expire offer', description: 'Offer validity lapsed', icon: 'clock', variant: 'danger' },
  OFFER_COUNTERED: { label: 'Record counter-offer', description: 'Customer requested changes', icon: 'message', variant: 'warning' },
  PENDING_CONDITIONS: { label: 'Track conditions', description: 'Move to conditions precedent', icon: 'clipboard', variant: 'primary' },
  CONDITIONS_MET: { label: 'Mark conditions met', description: 'All conditions satisfied', icon: 'checkCircle', variant: 'success' },
  PENDING_ESIGN: { label: 'Send for signature', description: 'Await electronic signature', icon: 'pen', variant: 'primary' },
  ESIGN_IN_PROGRESS: { label: 'Mark signing in progress', description: 'Documents being signed', icon: 'pen', variant: 'primary' },
  ESIGN_COMPLETED: { label: 'Confirm signatures complete', description: 'All signatures collected', icon: 'checkCircle', variant: 'success' },
  PENDING_BOOKING: { label: 'Send for booking', description: 'Ready for core banking', icon: 'book', variant: 'primary' },
  BOOKING_IN_PROGRESS: { label: 'Start booking', description: 'Booking into the core system', icon: 'activity', variant: 'primary' },
  BOOKED: { label: 'Confirm booking', description: 'Loan account created', icon: 'checkCircle', variant: 'success' },
  PENDING_DISBURSEMENT: { label: 'Queue disbursement', description: 'Awaiting payout', icon: 'banknote', variant: 'primary' },
  DISBURSEMENT_IN_PROGRESS: { label: 'Start disbursement', description: 'Payout processing', icon: 'arrowDown', variant: 'primary' },
  DISBURSED: { label: 'Confirm disbursement', description: 'Amount paid out', icon: 'checkCircle', variant: 'success' },
  RETURNED: { label: 'Return for corrections', description: 'Send back to the customer', icon: 'undo', variant: 'warning' },
  CANCELLED: { label: 'Cancel', description: 'Cancel the application', icon: 'ban', variant: 'danger' },
  WITHDRAWN: { label: 'Withdraw', description: 'Withdraw the application', icon: 'arrowLeft', variant: 'warning' },
  EXPIRED: { label: 'Expire application', description: 'Closed for inactivity', icon: 'clock', variant: 'danger' },
  ACTIVE: { label: 'Mark loan active', description: 'Loan is performing', icon: 'trendingUp', variant: 'success' },
  CLOSED: { label: 'Close application', description: 'Facility fully repaid', icon: 'flag', variant: 'secondary' },
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
      icon: 'shield',
      variant: 'primary',
    });
  }

  if (canAssign) {
    actions.push({
      action: 'ASSIGN',
      label: 'Assign to underwriter',
      description: 'Route to an underwriter for review',
      icon: 'userPlus',
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
        icon: 'upload',
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
          icon: 'check',
          variant: 'success',
          requiresReviewer: true,
          covers: ['APPROVED', 'UNDERWRITING_APPROVED'],
        });
        actions.push({
          action: 'DECLINE',
          label: 'Decline',
          description: 'Decline application',
          icon: 'x',
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
        icon: 'file',
        variant: 'primary',
        covers: ['OFFER_GENERATED'],
      });
      break;

    case 'OFFER_GENERATED':
      actions.push({
        action: 'VIEW_OFFER',
        label: 'View Offer',
        description: 'Review offer details',
        icon: 'eye',
        variant: 'secondary',
      });
      actions.push({
        action: 'ACCEPT_OFFER',
        label: 'Accept Offer',
        description: 'Accept and proceed',
        icon: 'check',
        variant: 'success',
        covers: ['OFFER_ACCEPTED'],
      });
      actions.push({
        action: 'SEND_FOR_SIGNATURE',
        label: 'Send for Signature',
        description: 'Send documents for e-sign',
        icon: 'pen',
        variant: 'primary',
        covers: ['PENDING_ESIGN'],
      });
      break;

    case 'PENDING_ESIGN':
      actions.push({
        action: 'CONFIRM_ESIGN',
        label: 'Confirm E-Signature',
        description: 'Manually confirm customer has signed',
        icon: 'checkCircle',
        variant: 'success',
        covers: ['ESIGN_COMPLETED'],
      });
      actions.push({
        action: 'VIEW_DOCUMENTS',
        label: 'View Documents',
        description: 'View signature status',
        icon: 'file',
        variant: 'secondary',
      });
      break;

    case 'ESIGN_COMPLETED':
    case 'PENDING_BOOKING':
      actions.push({
        action: 'INITIATE_BOOKING',
        label: status === 'ESIGN_COMPLETED' ? `Book ${label}` : 'Complete Booking',
        description: 'Configure disbursement accounts',
        icon: 'book',
        variant: status === 'ESIGN_COMPLETED' ? 'primary' : 'success',
        covers: ['BOOKED', 'PENDING_BOOKING'],
      });
      break;

    case 'BOOKED':
      actions.push({
        action: 'VIEW_AUDIT',
        label: 'View History',
        description: 'View complete audit trail',
        icon: 'history',
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
      icon: 'arrowLeft',
      variant: 'danger',
    });
  }
  if (canCancel) {
    supplementaryActions.push({
      action: 'CANCEL',
      label: 'Cancel',
      description: 'Cancel application',
      icon: 'ban',
      variant: 'danger',
    });
  }

  /* One solid action per band — the first constructive one, matching how the page's
     own Actions strip chooses — so the eye lands on a next step rather than scanning
     six equally loud fills. */
  const leadIndex = filteredActions.findIndex(action => action.variant !== 'danger');
  const toneClass = (action: ActionConfig, index: number) =>
    action.variant === 'danger'
      ? 'rm-btn rm-btn-danger'
      : index === leadIndex
        ? 'rm-btn rm-btn-solid'
        : 'rm-btn rm-btn-quiet';

  const renderButton = (action: ActionConfig, index: number) => (
    <button
      key={action.targetStatus ?? action.action}
      type="button"
      onClick={() => onAction(action.action, action.targetStatus)}
      disabled={loading}
      className={toneClass(action, index)}
      title={action.description}
    >
      <WorkflowIcon name={action.icon} />
      <span>{action.label}</span>
    </button>
  );

  const groupLabel = (text: string) => (
    <p
      className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: 'var(--rm-text-muted)' }}
    >
      {text}
    </p>
  );

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
    const isProcessing = ['PENDING_CREDIT_CHECK', 'PENDING_KYC', 'PENDING_BOOKING'].includes(
      currentStatus
    );
    const terminal = isTerminalStatus(currentStatus);

    const message =
      waitingMessage[currentStatus] ??
      (isReviewStage
        ? isAssignedReviewer
          ? 'Ready for your decision.'
          : isApplicationCreator
            ? 'You cannot review your own application — segregation of duties. Another reviewer must approve or decline.'
            : 'Awaiting underwriter decision — only the assigned reviewer can approve or decline.'
        : terminal
          ? `This application is ${statusConfig?.label.toLowerCase() ?? 'closed'} — no further actions.`
          : `Nothing to action here — ${statusConfig?.description ?? 'the application is waiting on another step'}.`);

    const noteIcon: WorkflowIconName = isProcessing
      ? 'activity'
      : isReviewStage && isAssignedReviewer
        ? 'checkCircle'
        : terminal
          ? 'flag'
          : 'clock';

    return (
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{
          backgroundColor: 'var(--rm-input)',
          border: '1px solid var(--rm-hairline)',
        }}
      >
        <span
          className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--rm-brand-soft)', color: 'var(--rm-brand-on-soft)' }}
        >
          <WorkflowIcon name={noteIcon} size={16} />
        </span>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
            {message}
          </p>
          {isProcessing && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full"
                style={{
                  border: '2px solid var(--rm-brand)',
                  borderTopColor: 'transparent',
                }}
              />
              <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                Processing...
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Primary actions */}
      {filteredActions.length > 0 && (
        <div>
          {groupLabel('Available actions')}
          <div className="flex flex-wrap gap-2.5">{filteredActions.map(renderButton)}</div>
        </div>
      )}

      {/* Supplementary actions (cancel/withdraw) */}
      {supplementaryActions.length > 0 && (
        <div
          className="pt-5"
          style={{ borderTop: '1px solid var(--rm-hairline)' }}
        >
          {groupLabel('Close application')}
          <div className="flex flex-wrap gap-2.5">{supplementaryActions.map(renderButton)}</div>
        </div>
      )}
    </div>
  );
}

export default WorkflowActions;
