'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'react-toastify';
import { aiApplicationService, ApplicationSummary } from '@/services/api/aiApplicationService';

interface ApplicationAiSummaryTabProps {
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

export function ApplicationAiSummaryTab({
  applicationId,
  bankId,
}: ApplicationAiSummaryTabProps) {
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setInitialLoading(true);
        const result = await aiApplicationService.getLatestSummary(applicationId, bankId);
        if (cancelled) return;
        if (result.status !== 'NOT_GENERATED') {
          setSummary(result);
        }
      } catch (err) {
        // Silently fall back to the empty "not generated yet" state — the
        // user can still explicitly generate a summary.
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
      const result = await aiApplicationService.generateSummary(applicationId, bankId);
      setSummary(result);
      if (result.status !== 'COMPLETED') {
        toast.warning('AI summary generated with warnings — please review.');
      } else {
        toast.success('AI summary generated.');
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Application not found or not accessible for AI summary generation.');
      } else {
        setError(err?.message || 'Failed to generate AI summary.');
      }
      toast.error('Failed to generate AI summary.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard title="AI Application Summary">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {summary
              ? 'This is the last generated summary. Regenerate it if the application details have changed.'
              : 'Generates a narrative summary from live application, applicant, and workflow data.'}
            {' '}This is an AI-assisted draft and always requires human review — it never represents
            an approval, decline, or pricing decision.
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading || initialLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7f2b7b] text-white text-sm font-medium hover:bg-[#6b2568] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
            )}
            {loading
              ? 'Generating summary…'
              : summary
                ? 'Regenerate AI Summary'
                : 'Generate AI Summary'}
          </button>

          {initialLoading && (
            <p className="text-xs text-slate-400">Checking for an existing summary…</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </SectionCard>

      {summary && (
        <>
          {summary.humanReviewRequired && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Human review required.</span> This is an
                AI-generated summary and must be reviewed by an authorised bank colleague before
                being relied upon for any decision.
              </p>
            </div>
          )}

          {summary.warnings.length > 0 && (
            <div className="bg-orange-50 border border-orange-200/60 rounded-2xl p-4">
              <p className="text-sm font-semibold text-orange-800 mb-1">Data Completeness</p>
              <ul className="list-disc list-inside text-sm text-orange-700 space-y-0.5">
                {summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <SectionCard title="Summary">
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium">
                {summary.status}
              </span>
              <span>Model: {summary.model}</span>
              <span>Generated: {new Date(summary.generatedAt).toLocaleString()}</span>
              <span>Data as of: {new Date(summary.dataFreshness).toLocaleString()}</span>
            </div>

            {summary.content ? (
              <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-headings:font-semibold prose-p:text-slate-700 prose-li:text-slate-700">
                <ReactMarkdown>{summary.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No summary content was generated. See warnings above for details.
              </p>
            )}
          </SectionCard>

          {summary.citations.length > 0 && (
            <SectionCard title="Citations">
              <div className="space-y-3">
                {summary.citations.map(c => (
                  <div
                    key={c.chunkId}
                    className="border border-slate-200 rounded-xl p-3 text-sm text-slate-700"
                  >
                    <p className="font-medium text-slate-900">{c.sourceTitle}</p>
                    {c.headingPath && <p className="text-xs text-slate-500">{c.headingPath}</p>}
                    <p className="mt-1 text-slate-600 line-clamp-3">{c.snippet}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
