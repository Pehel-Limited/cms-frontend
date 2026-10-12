'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { esignService } from '@/services/api/esign-service';

type SigningStage = 'review' | 'signing' | 'done' | 'error';

/* Plain, factual step position for the signing flow — derived from the stage
   the customer is actually in, never from a score or reward. */
const SIGNING_STEPS = ['Review', 'Signing', 'Complete'];

function stageIndex(stage: SigningStage): number {
  if (stage === 'review') return 0;
  if (stage === 'done') return 2;
  return 1; // 'signing' and 'error' both sit on the signing step
}

export default function SigningPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const applicationId = params.id as string;
  const envelopeId = searchParams.get('envelopeId') ?? '';
  const returnUrl = searchParams.get('returnUrl') ?? `/portal/applications/${applicationId}`;

  const [step, setStep] = useState<SigningStage>('review');
  const [error, setError] = useState<string | null>(null);

  const currentStep = stageIndex(step);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  async function handleSign() {
    setStep('signing');
    setError(null);
    try {
      await esignService.simulateComplete(applicationId, envelopeId);
      setStep('done');
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(returnUrl || `/portal/applications/${applicationId}`);
      }, 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Signing failed');
      setStep('error');
    }
  }

  function handleDecline() {
    router.push(returnUrl || `/portal/applications/${applicationId}`);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: 'var(--surface-bg)' }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--surface-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex flex-wrap items-center gap-3"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          <svg aria-hidden="true" className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <h1 className="serif text-xl font-medium text-white">Secure document signing</h1>
          <span className="ml-auto text-sm text-white/80">Simulation mode</span>
        </div>

        <div className="p-6 space-y-6">
          {/* Step position — quiet, factual, derived from the current stage */}
          <nav aria-label="Signing progress">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Step {currentStep + 1} of {SIGNING_STEPS.length} · {SIGNING_STEPS[currentStep]}
            </p>
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={SIGNING_STEPS.length}
              aria-valuenow={currentStep + 1}
              aria-valuetext={`Step ${currentStep + 1} of ${SIGNING_STEPS.length}: ${SIGNING_STEPS[currentStep]}`}
              style={{ backgroundColor: 'var(--surface-input)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${((currentStep + 1) / SIGNING_STEPS.length) * 100}%`,
                  backgroundColor: 'var(--brand)',
                }}
              />
            </div>
            <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {SIGNING_STEPS.map((label, i) => (
                <li
                  key={label}
                  aria-current={i === currentStep ? 'step' : undefined}
                  className="flex items-center gap-2"
                >
                  {i > 0 && (
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                      ·
                    </span>
                  )}
                  <span
                    style={{
                      color: i === currentStep ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: i === currentStep ? 600 : 400,
                    }}
                  >
                    {label}
                    {i < currentStep && <span className="sr-only"> (completed)</span>}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          {/* Document preview */}
          <div
            className="border rounded-xl p-5 space-y-3"
            style={{
              borderColor: 'var(--surface-border)',
              backgroundColor: 'var(--surface-input)',
            }}
          >
            <div
              className="flex items-center gap-2 text-base font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                style={{ color: 'var(--brand)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Loan agreement
            </div>
            <div
              className="text-sm leading-relaxed space-y-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <p>
                This document constitutes the binding loan agreement between you and the bank for
                the loan referenced in your application{' '}
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {applicationId.slice(0, 8)}…
                </span>
                .
              </p>
              <p>
                By signing, you confirm that you have read and understood the terms and conditions,
                including the interest rate, repayment schedule, fees, and covenants applicable to
                this loan.
              </p>
              <p>
                This is a <strong>simulated signing session</strong>. In production, you would be
                redirected to DocuSign to complete the signing ceremony.
              </p>
            </div>
          </div>

          {/* Envelope reference — only shown when the signing session actually has one */}
          {envelopeId && (
            <div
              className="flex flex-wrap items-center gap-2 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                />
              </svg>
              Envelope reference:{' '}
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                {envelopeId}
              </span>
            </div>
          )}

          {/* Actions */}
          <div aria-live="polite">
            {step === 'review' && (
              <div className="space-y-3">
                <button onClick={handleSign} className="btn btn-primary w-full py-3" type="button">
                  <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Sign document
                </button>
                <button onClick={handleDecline} className="btn btn-outline w-full" type="button">
                  Decline and go back
                </button>
              </div>
            )}

            {step === 'signing' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <span
                  className="spinner h-8 w-8"
                  style={{ color: 'var(--brand)' }}
                  role="status"
                  aria-label="Processing signature"
                />
                <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Processing signature…
                </p>
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center gap-3 py-4" role="status">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/15 rounded-full flex items-center justify-center">
                  <svg
                    aria-hidden="true"
                    className="w-8 h-8 text-emerald-600 dark:text-emerald-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-emerald-700 dark:text-emerald-300 font-semibold text-lg">
                  Document signed
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Taking you back to your application…
                </p>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4" role="alert">
                <div className="w-14 h-14 bg-red-100 dark:bg-red-500/15 rounded-full flex items-center justify-center">
                  <svg
                    aria-hidden="true"
                    className="w-8 h-8 text-red-600 dark:text-red-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <p className="text-red-700 dark:text-red-300 font-semibold text-base">
                  Signing failed
                </p>
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  {error}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setError(null);
                      setStep('review');
                    }}
                    className="btn btn-primary btn-sm"
                    type="button"
                  >
                    Try again
                  </button>
                  <button onClick={handleDecline} className="btn btn-ghost btn-sm" type="button">
                    Back to application
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
