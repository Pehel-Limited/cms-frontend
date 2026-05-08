'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  documentService,
  type ApplicationDocument,
  type DocumentCategory,
  type UploadDocumentPayload,
  CATEGORY_LABELS,
  UPLOAD_STATUS_LABELS,
  UPLOAD_STATUS_COLORS,
  formatFileSize,
  getCategoryIcon,
} from '@/services/api/document-service';
import { applicationService, type LoanApplication } from '@/services/api/application-service';

type ViewMode = 'all' | 'by-application';

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

/* ─── Category SVG icons (replace emojis) ───────────────────── */
const CATEGORY_SVG: Record<string, React.ReactNode> = {
  IDENTITY: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"
      />
    </svg>
  ),
  ADDRESS_PROOF: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  INCOME_PROOF: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  DEFAULT: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
};

function getCategorySvg(cat: string) {
  return CATEGORY_SVG[cat] || CATEGORY_SVG.DEFAULT;
}

/* ─── Status badge with dot ─────────────────────────────────── */
const DOC_STATUS_DOT: Record<string, string> = {
  UPLOADED: 'bg-blue-500',
  VERIFIED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
  PENDING: 'bg-amber-500',
  UNDER_REVIEW: 'bg-violet-500',
};

const DOC_STATUS_BG: Record<string, string> = {
  UPLOADED: 'bg-blue-50 text-blue-700',
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  PENDING: 'bg-amber-50 text-amber-700',
  UNDER_REVIEW: 'bg-violet-50 text-violet-700',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, apps] = await Promise.all([
        documentService.listMyDocuments(),
        applicationService.list().catch(() => [] as LoanApplication[]),
      ]);
      setDocuments(docs);
      setApplications(apps);
    } catch (err: unknown) {
      console.error('Failed to load documents', err);
      setError('Unable to load your documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (applicationId: string, payload: UploadDocumentPayload) => {
    setUploading(true);
    setUploadError(null);
    try {
      await documentService.uploadDocument(applicationId, payload);
      setShowUpload(false);
      await fetchData();
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const grouped = documents.reduce<Record<string, ApplicationDocument[]>>((acc, doc) => {
    const key = doc.applicationId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* ── Hero header ────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Documents</h1>
            <p className="mt-1 text-sm text-white/70">
              Upload and manage documents for your loan applications.
            </p>
          </div>
          {applications.length > 0 && (
            <button
              onClick={() => {
                setShowUpload(true);
                setUploadError(null);
              }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/25 transition-all border border-white/20 shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Upload Document
            </button>
          )}
        </div>

        {/* View mode pills */}
        <div className="relative mt-6 flex gap-2">
          {(['all', 'by-application'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-white text-[#7f2b7b] shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
              }`}
            >
              {mode === 'all' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              )}
              {mode === 'all' ? 'All Documents' : 'By Application'}
              <span
                className={`text-xs tabular-nums ${viewMode === mode ? 'text-[#7f2b7b]/60' : 'text-white/50'}`}
              >
                {mode === 'all' ? documents.length : Object.keys(grouped).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-80" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200/60 rounded-2xl p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-red-500"
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
          </div>
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 text-sm font-medium text-red-700 hover:text-red-800 underline decoration-red-300 underline-offset-4 hover:decoration-red-500"
          >
            Try again
          </button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          hasApps={applications.length > 0}
          onUpload={() => {
            setShowUpload(true);
            setUploadError(null);
          }}
        />
      ) : viewMode === 'all' ? (
        <DocumentList documents={documents} />
      ) : (
        <GroupedView grouped={grouped} applications={applications} />
      )}

      {/* ── Upload modal ───────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          applications={applications}
          uploading={uploading}
          uploadError={uploadError}
          onUpload={handleUpload}
          onClose={() => {
            setShowUpload(false);
            setUploadError(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Document list ──────────────────────────────────────────── */

function DocumentList({ documents }: { documents: ApplicationDocument[] }) {
  return (
    <div className="space-y-3">
      {documents.map(doc => (
        <DocumentCard key={doc.id} doc={doc} />
      ))}
    </div>
  );
}

function DocumentCard({ doc }: { doc: ApplicationDocument }) {
  const statusLabel = UPLOAD_STATUS_LABELS[doc.uploadStatus] || doc.uploadStatus;
  const dot = DOC_STATUS_DOT[doc.uploadStatus] || 'bg-slate-400';
  const bg = DOC_STATUS_BG[doc.uploadStatus] || 'bg-slate-50 text-slate-600';
  const catLabel = CATEGORY_LABELS[doc.category] || doc.category;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-[#7f2b7b]/20 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center text-[#7f2b7b]">
          {getCategorySvg(doc.category)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#7f2b7b] transition-colors">
              {doc.fileName}
            </h4>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              {statusLabel}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              {catLabel}
            </span>
            {doc.fileSizeBytes && <span>{formatFileSize(doc.fileSizeBytes)}</span>}
            <span>
              {new Date(doc.createdAt).toLocaleDateString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {doc.applicationId && (
              <Link
                href={`/portal/applications/${doc.applicationId}`}
                className="text-[#7f2b7b] hover:text-[#6b2568] font-medium"
              >
                View Application →
              </Link>
            )}
          </div>
          {doc.rejectionReason && (
            <p className="mt-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg inline-block">
              Reason: {doc.rejectionReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Grouped by application ─────────────────────────────────── */

function GroupedView({
  grouped,
  applications,
}: {
  grouped: Record<string, ApplicationDocument[]>;
  applications: LoanApplication[];
}) {
  const appMap = new Map(applications.map(a => [a.applicationId, a]));

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([appId, docs]) => {
        const app = appMap.get(appId);
        return (
          <div key={appId}>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-slate-500"
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
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  {app?.applicationNumber || appId}
                </h3>
                <span className="text-xs text-slate-400">
                  {docs.length} document{docs.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Link
                href={`/portal/applications/${appId}`}
                className="ml-auto text-xs text-[#7f2b7b] hover:text-[#6b2568] font-medium"
              >
                View Application →
              </Link>
            </div>
            <div className="space-y-2">
              {docs.map(doc => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Upload modal ───────────────────────────────────────────── */

const CATEGORIES: DocumentCategory[] = [
  'IDENTITY',
  'ADDRESS_PROOF',
  'INCOME_PROOF',
  'BANK_STATEMENT',
  'TAX_RETURN',
  'EMPLOYMENT_LETTER',
  'BUSINESS_REGISTRATION',
  'FINANCIAL_STATEMENT',
  'COLLATERAL',
  'INSURANCE',
  'LEGAL',
  'SIGNED_AGREEMENT',
  'OTHER',
];

function UploadModal({
  applications,
  uploading,
  uploadError,
  onUpload,
  onClose,
}: {
  applications: LoanApplication[];
  uploading: boolean;
  uploadError: string | null;
  onUpload: (applicationId: string, payload: UploadDocumentPayload) => void;
  onClose: () => void;
}) {
  const [selectedApp, setSelectedApp] = useState(applications[0]?.applicationId || '');
  const [category, setCategory] = useState<DocumentCategory>('IDENTITY');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');

  const canSubmit = selectedApp && category && fileName.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Upload Document</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {uploadError && (
            <div className="bg-red-50 border border-red-200/60 rounded-xl px-4 py-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Application</label>
            <select
              value={selectedApp}
              onChange={e => setSelectedApp(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#7f2b7b] focus:ring-1 focus:ring-[#7f2b7b] bg-white"
            >
              {applications.map(app => (
                <option key={app.applicationId} value={app.applicationId}>
                  {app.applicationNumber || app.applicationId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as DocumentCategory)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#7f2b7b] focus:ring-1 focus:ring-[#7f2b7b] bg-white"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Name</label>
            <input
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              placeholder="e.g. Passport_Front.pdf"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#7f2b7b] focus:ring-1 focus:ring-[#7f2b7b]"
            />
            <p className="mt-1 text-xs text-slate-400">
              File upload is metadata-only until ECM integration is ready.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#7f2b7b] focus:ring-1 focus:ring-[#7f2b7b]"
              placeholder="Any additional information…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!canSubmit) return;
              onUpload(selectedApp, {
                category,
                fileName: fileName.trim(),
                notes: notes.trim() || undefined,
              });
            }}
            disabled={!canSubmit || uploading}
            className="px-5 py-2.5 rounded-xl bg-[#7f2b7b] text-sm font-medium text-white shadow-sm hover:bg-[#6b2568] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading…
              </span>
            ) : (
              'Upload'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────── */

function EmptyState({ hasApps, onUpload }: { hasApps: boolean; onUpload: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-[#7f2b7b]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">No documents uploaded yet</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
        {hasApps
          ? 'Upload documents for your loan applications to get started.'
          : 'Create a loan application first, then upload the required documents.'}
      </p>
      {hasApps && (
        <button
          onClick={onUpload}
          className="mt-5 bg-[#7f2b7b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#6b2568] transition-colors shadow-sm"
        >
          Upload Document
        </button>
      )}
    </div>
  );
}
