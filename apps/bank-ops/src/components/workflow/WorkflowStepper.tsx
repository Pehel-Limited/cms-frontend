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
  getProductLabel,
} from '@/types/loms';
import { statusTone } from '@/lib/statusTone';
import { WorkflowIcon, type WorkflowIconName } from './icons';

interface WorkflowStepperProps {
  currentStatus: LomsApplicationStatus;
  className?: string;
  productName?: string;
}

/**
 * Visual workflow stepper showing application progress through LOMS phases
 */
export function WorkflowStepper({
  currentStatus,
  className = '',
  productName,
}: WorkflowStepperProps) {
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
  const tone = statusTone(currentStatus);

  const barColor = isDeclined
    ? 'var(--rm-down)'
    : isCancelled
      ? 'var(--rm-text-muted)'
      : 'var(--rm-brand)';

  /** One note surface for every status message; the icon carries the kind. */
  const notes: Partial<Record<LomsApplicationStatus, { icon: WorkflowIconName; title: string; body: string }>> = {
    PENDING_KYC: {
      icon: 'shield',
      title: 'KYC verification required',
      body: 'Customer KYC/AML verification must be completed before proceeding to credit decisioning.',
    },
    REFERRED_TO_SENIOR: {
      icon: 'user',
      title: 'Manual review required',
      body: 'This application has been referred for manual underwriting review. An underwriter will review and make a decision.',
    },
    PENDING_ESIGN: {
      icon: 'pen',
      title: 'Awaiting customer signature',
      body: 'Documents have been sent to the customer for e-signature. Waiting for completion.',
    },
    PENDING_BOOKING: {
      icon: 'clock',
      title: `${getProductLabel(productName)} booking in progress`,
      body: `The ${getProductLabel(productName).toLowerCase()} is being booked in the core banking system. This may take a few minutes.`,
    },
    BOOKED: {
      icon: 'checkCircle',
      title: `${getProductLabel(productName)} successfully booked`,
      body: `The ${getProductLabel(productName).toLowerCase()} has been successfully booked. Disbursement will be processed according to the terms.`,
    },
    DECLINED: {
      icon: 'xCircle',
      title: 'Application declined',
      body: 'This application has been declined. Please review the decision details for more information.',
    },
  };
  const note = notes[currentStatus];

  return (
    <div
      className={`rounded-3xl p-6 sm:p-7 ${className}`}
      style={{
        backgroundColor: 'var(--rm-card)',
        border: '1px solid var(--rm-hairline)',
      }}
    >
      {/* Header with current status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>
            {statusConfig.label}
          </h3>
          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {statusConfig.description}
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: tone.bg, color: tone.text }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tone.dot }}
              aria-hidden="true"
            />
            {statusConfig.label}
          </span>
          {!isTerminal && (
            <p className="mt-1 text-xs num" style={{ color: 'var(--rm-text-muted)' }}>
              {progress}% complete
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--rm-input)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Phase stepper */}
      <div className="flex items-center justify-between">
        {WORKFLOW_PHASES.map((phase, index) => {
          const isComplete =
            index < currentPhaseIndex || (isTerminal && !isDeclined && !isCancelled);
          const isCurrent = index === currentPhaseIndex;
          const isSkipped = (isDeclined || isCancelled) && index > currentPhaseIndex;

          // Check if status is in this phase
          const statusInPhase = phase.statuses.includes(currentStatus);
          const isLive = isCurrent && statusInPhase;

          const circleStyle: React.CSSProperties = isComplete
            ? { backgroundColor: 'var(--rm-brand)', borderColor: 'var(--rm-brand)', color: '#fff' }
            : isLive && isDeclined
              ? {
                  backgroundColor: 'var(--rm-danger-soft)',
                  borderColor: 'var(--rm-down)',
                  color: 'var(--rm-down)',
                }
              : isLive
                ? {
                    backgroundColor: 'var(--rm-brand-soft)',
                    borderColor: 'var(--rm-brand)',
                    color: 'var(--rm-brand-on-soft)',
                  }
                : {
                    backgroundColor: 'transparent',
                    borderColor: 'var(--rm-hairline-strong)',
                    color: 'var(--rm-text-muted)',
                  };

          return (
            <React.Fragment key={phase.phase}>
              {/* Phase circle */}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors"
                  style={circleStyle}
                >
                  {isComplete ? (
                    <WorkflowIcon name="check" size={15} />
                  ) : isLive && isDeclined ? (
                    <WorkflowIcon name="x" size={15} />
                  ) : (
                    <span className="text-[13px] font-semibold num">{index + 1}</span>
                  )}
                </div>
                <span
                  className="mt-2 text-xs font-medium"
                  style={{
                    color:
                      isComplete || isLive ? 'var(--rm-text-secondary)' : 'var(--rm-text-muted)',
                  }}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector line */}
              {index < WORKFLOW_PHASES.length - 1 && (
                <div
                  className="mx-2 h-0.5 flex-1"
                  style={{
                    backgroundColor: isComplete && !isSkipped
                      ? 'var(--rm-brand)'
                      : 'var(--rm-hairline-strong)',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Status-specific messages */}
      {note && (
        <div
          className="mt-6 flex items-start gap-3 rounded-2xl p-4"
          style={{
            backgroundColor: 'var(--rm-input)',
            border: '1px solid var(--rm-hairline)',
          }}
        >
          <span
            className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full"
            style={{ backgroundColor: tone.bg, color: tone.text }}
          >
            <WorkflowIcon name={note.icon} size={16} />
          </span>
          <div>
            <h4 className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
              {note.title}
            </h4>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {note.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowStepper;
