// components/workflow/WorkflowStepper.tsx
'use client';

import React from 'react';
import {
  LomsApplicationStatus,
  STATUS_CONFIG,
  WORKFLOW_PHASES,
  calculateProgress,
  getPhaseForStatus,
  isTerminalStatus,
} from '@/types/loms';

interface WorkflowStepperProps {
  currentStatus: LomsApplicationStatus;
  className?: string;
}

/**
 * Visual workflow stepper showing application progress through LOMS phases
 */
export function WorkflowStepper({ currentStatus, className = '' }: WorkflowStepperProps) {
  const currentPhase = getPhaseForStatus(currentStatus);
  const progress = calculateProgress(currentStatus);
  const statusConfig = STATUS_CONFIG[currentStatus] || {
    label: currentStatus,
    description: 'Status: ' + currentStatus,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '📋',
  };
  const isTerminal = isTerminalStatus(currentStatus);
  const isDeclined = currentStatus === 'DECLINED';
  const isCancelled = currentStatus === 'CANCELLED';

  // Get phase index
  const currentPhaseIndex = WORKFLOW_PHASES.findIndex(p => p.phase === currentPhase);

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Header with current status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusConfig.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{statusConfig.label}</h3>
            <p className="text-sm text-gray-500">{statusConfig.description}</p>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
          >
            {statusConfig.label}
          </span>
          {!isTerminal && <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isDeclined ? 'bg-red-500' : isCancelled ? 'bg-gray-400' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase stepper */}
      <div className="flex items-center justify-between">
        {WORKFLOW_PHASES.map((phase, index) => {
          const isComplete =
            index < currentPhaseIndex || (isTerminal && !isDeclined && !isCancelled);
          const isCurrent = index === currentPhaseIndex;
          const isPending = index > currentPhaseIndex;
          const isSkipped = (isDeclined || isCancelled) && index > currentPhaseIndex;

          // Check if status is in this phase
          const statusInPhase = phase.statuses.includes(currentStatus);

          return (
            <React.Fragment key={phase.phase}>
              {/* Phase circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isComplete
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent && statusInPhase
                        ? isDeclined
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-blue-500 border-blue-500 text-white'
                        : isSkipped
                          ? 'bg-gray-200 border-gray-300 text-gray-400'
                          : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : isCurrent && isDeclined ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isComplete || (isCurrent && statusInPhase) ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector line */}
              {index < WORKFLOW_PHASES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentPhaseIndex
                      ? 'bg-green-500'
                      : isSkipped
                        ? 'bg-gray-200'
                        : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Status-specific messages */}
      {currentStatus === 'KYC_PENDING' && (
        <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start gap-3">
            <span className="text-orange-500 text-xl">⚠️</span>
            <div>
              <h4 className="text-sm font-medium text-orange-800">KYC Verification Required</h4>
              <p className="text-sm text-orange-700 mt-1">
                Customer KYC/AML verification must be completed before proceeding to credit
                decisioning.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'REFERRED_TO_UNDERWRITER' && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-3">
            <span className="text-yellow-500 text-xl">👤</span>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Manual Review Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                This application has been referred for manual underwriting review. An underwriter
                will review and make a decision.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'AWAITING_SIGNATURE' && (
        <div className="mt-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <div className="flex items-start gap-3">
            <span className="text-cyan-500 text-xl">✍️</span>
            <div>
              <h4 className="text-sm font-medium text-cyan-800">Awaiting Customer Signature</h4>
              <p className="text-sm text-cyan-700 mt-1">
                Documents have been sent to the customer for e-signature. Waiting for completion.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'BOOKING_PENDING' && (
        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-xl">⏳</span>
            <div>
              <h4 className="text-sm font-medium text-amber-800">Loan Booking in Progress</h4>
              <p className="text-sm text-amber-700 mt-1">
                The loan is being booked in the core banking system. This may take a few minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'BOOKED' && (
        <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="flex items-start gap-3">
            <span className="text-emerald-500 text-xl">🎉</span>
            <div>
              <h4 className="text-sm font-medium text-emerald-800">Loan Successfully Booked</h4>
              <p className="text-sm text-emerald-700 mt-1">
                The loan has been successfully booked. Disbursement will be processed according to
                the loan terms.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'DECLINED' && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl">❌</span>
            <div>
              <h4 className="text-sm font-medium text-red-800">Application Declined</h4>
              <p className="text-sm text-red-700 mt-1">
                This application has been declined. Please review the decision details for more
                information.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowStepper;
