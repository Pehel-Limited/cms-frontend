'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'react-toastify';
import { aiCreditMemoService, CreditMemo } from '@/services/api/aiCreditMemoService';

interface CreditMemoTabProps {
  applicationId: string;
  bankId: string;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function CreditMemoTab({ applicationId, bankId }: CreditMemoTabProps) {
  const [memo, setMemo] = useState<CreditMemo | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setInitialLoading(true);
        const result = await aiCreditMemoService.getLatestCreditMemo(applicationId, bankId);
        if (cancelled) return;
        if (result.status !== 'NOT_GENERATED') {
          setMemo(result);
        }
      } catch (err) {
        // Silently fall back to the empty "not generated yet" state.
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, bankId]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await aiCreditMemoService.generateCreditMemo(applicationId, bankId);
      setMemo(result);
      if (result.status !== 'DRAFT') {
        toast.error('Credit memo generation failed — see details below.');
      } else if (!result.reviewReady) {
        toast.warning('Draft generated with unsupported claims — review before relying on it.');
      } else {
        toast.success('Credit memo draft generated.');
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Application not found or not accessible for credit memo generation.');
      } else {
        setError(err?.message || 'Failed to generate credit memo.');
      }
      toast.error('Failed to generate credit memo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Credit Memo Draft">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {memo
              ? 'This is the last generated draft. Regenerate it if the application details have changed.'
              : 'Drafts a structured credit memo from live, deterministic application facts only.'}
            {' '}This is always a DRAFT — it never represents an approval, decline, or pricing decision,
            and must be reviewed by an authorised underwriter/RM before being relied upon.
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading || initialLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7f2b7b] text-white text-sm font-medium hover:bg-[#6b2568] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? 'Drafting memo…' : memo ? 'Regenerate Credit Memo' : 'Generate Credit Memo'}
          </button>

          {initialLoading && <p className="text-xs text-slate-400">Checking for an existing draft…</p>}

          {error && (
            <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 text-sm text-red-700">{error}</div>
          )}
        </div>
      </SectionCard>

      {memo && (
        <>
          <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Human review required.</span> This is an AI-drafted credit
              memo and must be reviewed by an authorised underwriter/RM before being relied upon for any
              lending decision.
            </p>
          </div>

          {!memo.reviewReady && memo.unsupportedClaims.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">
                Not review-ready — unsupported claims found
              </p>
              <p className="text-xs text-red-700 mb-2">
                The model flagged these statements as not fully grounded in the application data. Verify
                each one manually before using this draft.
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                {memo.unsupportedClaims.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {memo.warnings.length > 0 && (
            <div className="bg-orange-50 border border-orange-200/60 rounded-2xl p-4">
              <p className="text-sm font-semibold text-orange-800 mb-1">Data Completeness</p>
              <ul className="list-disc list-inside text-sm text-orange-700 space-y-0.5">
                {memo.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <SectionCard title="Draft">
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-4 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium">{memo.status}</span>
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${memo.reviewReady ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
              >
                {memo.reviewReady ? 'Review-ready' : 'Not review-ready'}
              </span>
              {memo.model && <span>Model: {memo.model}</span>}
              {memo.generatedAt && <span>Generated: {new Date(memo.generatedAt).toLocaleString()}</span>}
              {memo.dataFreshness && <span>Data as of: {new Date(memo.dataFreshness).toLocaleString()}</span>}
            </div>

            {memo.sections.length > 0 ? (
              <div className="space-y-6">
                {memo.sections.map((s, i) => (
                  <div key={i}>
                    <h4 className="text-sm font-semibold text-slate-900 mb-1.5">{s.title}</h4>
                    <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700">
                      <ReactMarkdown>{s.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No memo content was generated. See warnings above for details.</p>
            )}
          </SectionCard>

          {memo.citations.length > 0 && (
            <SectionCard title="Citations">
              <div className="flex flex-wrap gap-2">
                {memo.citations.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-mono text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
