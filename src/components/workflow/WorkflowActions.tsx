// components/workflow/WorkflowActions.tsx
'use client';

import React from 'react';
import { LomsApplicationStatus, STATUS_CONFIG, getProductLabel } from '@/types/loms';

interface WorkflowActionsProps {
  currentStatus: LomsApplicationStatus;
  validTransitions: LomsApplicationStatus[];
  isAssignedReviewer: boolean;
  isApplicationCreator: boolean;
  canCancel: boolean;
  canWithdraw: boolean;
  onAction: (action: WorkflowAction) => void;
  loading?: boolean;
  kycVerified?: boolean;
  productName?: string;
}

export type WorkflowAction =
  | 'SUBMIT'
  | 'SUBMIT_FOR_DECISIONING'
  | 'APPROVE'
  | 'DECLINE'
  | 'REFER_TO_UNDERWRITER'
  | 'GENERATE_OFFER'
  | 'ACCEPT_OFFER'
  | 'SEND_FOR_SIGNATURE'
  | 'INITIATE_BOOKING'
  | 'CANCEL'
  | 'WITHDRAW'
  | 'OVERRIDE_DECISION'
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
}

/**
 * Get available actions for current status
 */
function getAvailableActions(
  status: LomsApplicationStatus,
  validTransitions: LomsApplicationStatus[],
  isAssignedReviewer: boolean,
  isApplicationCreator: boolean,
  kycVerified: boolean = true,
  productName?: string
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

  switch (status) {
    case 'DRAFT':
      actions.push({
        action: 'SUBMIT',
        label: 'Submit Application',
        description: 'Submit for processing',
        icon: '📤',
        variant: 'primary',
        requiresCreator: true,
      });
      break;

    case 'SUBMITTED':
      if (validTransitions.includes('PENDING_CREDIT_CHECK')) {
        actions.push({
          action: 'SUBMIT_FOR_DECISIONING',
          label: 'Start Decisioning',
          description: 'Submit for credit decision',
          icon: '⚙️',
          variant: 'primary',
        });
      }
      break;

    case 'PENDING_KYC':
      // Waiting for KYC completion - show info only
      break;

    case 'PENDING_CREDIT_CHECK':
      // Automated decisioning in progress
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
        });
        actions.push({
          action: 'DECLINE',
          label: 'Decline',
          description: 'Decline application',
          icon: '❌',
          variant: 'danger',
          requiresReviewer: true,
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
      });
      actions.push({
        action: 'SEND_FOR_SIGNATURE',
        label: 'Send for Signature',
        description: 'Send documents for e-sign',
        icon: '✍️',
        variant: 'primary',
      });
      break;

    case 'PENDING_ESIGN':
      actions.push({
        action: 'CONFIRM_ESIGN',
        label: 'Confirm E-Signature',
        description: 'Manually confirm customer has signed',
        icon: '✅',
        variant: 'success',
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
      actions.push({
        action: 'INITIATE_BOOKING',
        label: `Book ${label}`,
        description: 'Book in core banking',
        icon: '📚',
        variant: 'primary',
      });
      break;

    case 'PENDING_BOOKING':
      actions.push({
        action: 'INITIATE_BOOKING',
        label: 'Complete Booking',
        description: 'Configure disbursement accounts',
        icon: '💰',
        variant: 'success',
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
    productName
  );

  // Filter actions based on user role
  const filteredActions = actions.filter(action => {
    if (action.requiresReviewer && !isAssignedReviewer) return false;
    if (action.requiresCreator && !isApplicationCreator) return false;
    return true;
  });

  // Add cancel/withdraw actions if available
  const supplementaryActions: ActionConfig[] = [];
  if (canWithdraw && isApplicationCreator) {
    supplementaryActions.push({
      action: 'WITHDRAW',
      label: 'Withdraw',
      description: 'Withdraw application',
      icon: '↩️',
      variant: 'warning',
    });
  }
  if (canCancel && isApplicationCreator) {
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
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusConfig.icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {currentStatus === 'PENDING_CREDIT_CHECK'
                ? 'Credit decisioning in progress...'
                : currentStatus === 'PENDING_KYC'
                  ? 'Waiting for KYC verification...'
                  : currentStatus === 'PENDING_BOOKING'
                    ? 'Booking in progress...'
                    : currentStatus === 'PENDING_ESIGN'
                      ? 'Waiting for customer signature...'
                      : currentStatus === 'REFERRED_TO_UNDERWRITER' ||
                          currentStatus === 'REFERRED_TO_SENIOR'
                        ? 'Awaiting underwriter decision — only the assigned reviewer can approve or decline.'
                        : 'No actions available at this stage'}
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
                key={action.action}
                onClick={() => onAction(action.action)}
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
                key={action.action}
                onClick={() => onAction(action.action)}
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
