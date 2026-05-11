'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { esignService } from '@/services/api/esign-service';

export default function SigningPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const applicationId = params.id as string;
  const envelopeId = searchParams.get('envelopeId') ?? '';
  const returnUrl = searchParams.get('returnUrl') ?? `/portal/applications/${applicationId}`;

  const [step, setStep] = useState<'review' | 'signing' | 'done' | 'error'>('review');
  const [error, setError] = useState<string | null>(null);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  async function handleSign() {
    setStep('signing');
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <h1 className="text-white font-semibold text-lg">Secure Document Signing</h1>
          <span className="ml-auto text-indigo-200 text-xs">Simulation Mode</span>
        </div>

        <div className="p-6 space-y-6">
          {/* Document preview */}
          <div className="border border-gray-200 rounded-xl bg-gray-50 p-5 space-y-3">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <svg
                className="w-5 h-5 text-indigo-500"
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
              Loan Agreement
            </div>
            <div className="text-sm text-gray-500 leading-relaxed space-y-2">
              <p>
                This document constitutes the binding loan agreement between you and the bank for
                the facility referenced in your application{' '}
                <span className="font-mono text-xs text-gray-700">
                  {applicationId.slice(0, 8)}…
                </span>
                .
              </p>
              <p>
                By signing, you confirm that you have read and understood the terms and conditions,
                including the interest rate, repayment schedule, fees, and covenants applicable to
                this facility.
              </p>
              <p>
                This is a <strong>simulated signing session</strong>. In production, you would be
                redirected to DocuSign to complete the signing ceremony.
              </p>
            </div>
          </div>

          {/* Envelope reference */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
            Envelope ID: <span className="font-mono text-gray-600">{envelopeId}</span>
          </div>

          {/* Actions */}
          {step === 'review' && (
            <div className="space-y-3">
              <button
                onClick={handleSign}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Sign Document
              </button>
              <button
                onClick={handleDecline}
                className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Decline &amp; Go Back
              </button>
            </div>
          )}

          {step === 'signing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-gray-600 font-medium">Processing signature…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
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
              <p className="text-green-700 font-semibold text-lg">Document Signed Successfully</p>
              <p className="text-gray-500 text-sm">Redirecting you back…</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
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
              <p className="text-red-700 font-semibold">Signing Failed</p>
              <p className="text-gray-500 text-sm">{error}</p>
              <button
                onClick={() => setStep('review')}
                className="mt-2 text-indigo-600 hover:underline text-sm"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
