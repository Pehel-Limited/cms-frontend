'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { esignService } from '@/services/api/esign-service';
import Glyph from '@/components/ui/Glyph';

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
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.push(returnUrl || `/portal/applications/${applicationId}`)}
          className="btn btn-ghost btn-sm"
          type="button"
        >
          <Glyph name="chevron" className="h-4 w-4 rotate-90" strokeWidth={2} />
          Back to application
        </button>
        <span className="chip !py-1 !text-xs">Simulation mode</span>
      </div>

      <div className="glass-panel-solid overflow-hidden">
        {/* Header */}
        <header className="mesh-hero relative overflow-hidden px-6 py-6 text-white sm:px-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,.13), transparent 65%)' }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Secure signing
              </p>
              <h1 className="serif mt-2 text-[27px] font-medium leading-tight sm:text-[31px]">
                Sign your loan agreement
              </h1>
              <p className="mt-1 text-xs tabular-nums text-white/60">
                Application {applicationId.slice(0, 8)}…
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
              <Glyph name="shield" className="h-3.5 w-3.5" strokeWidth={1.8} />
              Encrypted session
            </span>
          </div>

          {/* Step position — quiet, factual, derived from the current stage */}
          <nav aria-label="Signing progress" className="relative mt-7">
            <ol className="flex items-center">
              {SIGNING_STEPS.map((label, i) => {
                const isPast = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                  <li key={label} className="flex flex-1 items-center" aria-current={isCurrent ? 'step' : undefined}>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                        style={{
                          borderColor: isCurrent || isPast ? '#ffffff' : 'rgba(255,255,255,.3)',
                          backgroundColor: isCurrent ? '#ffffff' : isPast ? 'rgba(255,255,255,.2)' : 'transparent',
                          color: isCurrent ? '#5e1f5b' : '#ffffff',
                        }}
                        aria-hidden="true"
                      >
                        {isPast ? <Glyph name="check" className="h-3 w-3" strokeWidth={2.8} /> : i + 1}
                      </span>
                      <span
                        className="whitespace-nowrap text-xs font-medium"
                        style={{ color: isCurrent ? '#ffffff' : 'rgba(255,255,255,.6)' }}
                      >
                        {label}
                      </span>
                    </div>
                    {i < SIGNING_STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="mx-3 h-px flex-1"
                        style={{ backgroundColor: isPast ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.2)' }}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </header>

        <div className="space-y-6 p-6 sm:p-8">
          {/* Document preview */}
          <section aria-labelledby="agreement-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="agreement-title" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Glyph name="doc" className="h-4 w-4" strokeWidth={1.8} />
                Loan agreement
              </h2>
              <span className="chip !py-1 !text-xs">Preview</span>
            </div>

            <div
              className="rounded-[24px] border p-4 sm:p-5"
              style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--surface-input)' }}
            >
              <div
                className="rounded-2xl border p-5 sm:p-6"
                style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--surface-card)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
                  <p className="serif text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                    Loan agreement
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                    The bank
                  </p>
                </div>

                <div className="mt-5 space-y-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                  <p>
                    This document constitutes the binding loan agreement between you and the bank
                    for the loan referenced in your application{' '}
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {applicationId.slice(0, 8)}…
                    </span>
                    .
                  </p>
                  <p>
                    By signing, you confirm that you have read and understood the terms and
                    conditions, including the interest rate, repayment schedule, fees, and
                    covenants applicable to this loan.
                  </p>
                  <p>
                    This is a <strong>simulated signing session</strong>. In production, you would
                    be redirected to DocuSign to complete the signing ceremony.
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-8 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
                  <div>
                    <div className="h-8 border-b" style={{ borderColor: 'var(--hairline-strong)' }} />
                    <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Your signature
                    </p>
                  </div>
                  <div>
                    <div className="h-8 border-b" style={{ borderColor: 'var(--hairline-strong)' }} />
                    <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Date
                    </p>
                  </div>
                </div>
              </div>

              {/* Envelope reference — only shown when the signing session actually has one */}
              {envelopeId && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-2 px-1 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Glyph name="shield" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Envelope reference:
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {envelopeId}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Actions */}
          <div aria-live="polite">
            {step === 'review' && (
              <div className="space-y-3">
                <button onClick={handleSign} className="btn btn-primary w-full py-3" type="button">
                  <Glyph name="sign" className="h-5 w-5" strokeWidth={1.8} />
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
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(14,155,108,.12)', color: 'var(--up)' }}
                >
                  <Glyph name="check" className="h-7 w-7" strokeWidth={2.4} />
                </div>
                <p className="text-lg font-semibold" style={{ color: 'var(--up)' }}>
                  Document signed
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Taking you back to your application…
                </p>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4" role="alert">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(207,67,105,.1)', color: 'var(--down)' }}
                >
                  <Glyph name="alert" className="h-7 w-7" strokeWidth={2.2} />
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--down)' }}>
                  Signing failed
                </p>
                <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
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
