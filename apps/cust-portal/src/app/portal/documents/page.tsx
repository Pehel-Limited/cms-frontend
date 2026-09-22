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
import {
  applicationService,
  STATUS_LABELS,
  type LoanApplication,
} from '@/services/api/application-service';

type ViewMode = 'all' | 'by-application';

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Category SVG icons (replace emojis) ───────────────────── */
const CATEGORY_SVG: Record<string, React.ReactNode> = {
  IDENTITY: (
    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"
      />
    </svg>
  ),
  ADDRESS_PROOF: (
    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  DEFAULT: (
    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

/* ─── Status colours come from document-service (UPLOAD_STATUS_COLORS) ─── */

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

  const applicationCount = Object.keys(grouped).length;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mesh-hero relative overflow-hidden rounded-3xl p-6 shadow-float sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Documents</h1>
            <p className="mt-1.5 text-sm text-white/75">
              {loading
                ? 'Loading your documents…'
                : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'} across ${applicationCount} ${applicationCount === 1 ? 'application' : 'applications'}`}
            </p>
          </div>
          {applications.length > 0 && (
            <button
              onClick={() => {
                setShowUpload(true);
                setUploadError(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Upload document
            </button>
          )}
        </div>
      </div>

      {/* View mode filter */}
      <div className="segmented" role="group" aria-label="Choose how documents are grouped">
        {(['all', 'by-application'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            data-active={viewMode === mode ? 'true' : undefined}
            onClick={() => setViewMode(mode)}
            className="segmented-item"
          >
            {mode === 'all' ? (
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            ) : (
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            )}
            {mode === 'all' ? 'All documents' : 'By application'}
            <span className="ml-0.5 text-xs tabular-nums opacity-70">
              {mode === 'all' ? documents.length : applicationCount}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">Loading your documents…</p>
          {[1, 2, 3].map(i => (
            <div key={i} className="panel px-5 py-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3.5 w-80" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">We couldn&apos;t load your documents</p>
            <p className="mt-0.5 text-sm opacity-80">{error}</p>
          </div>
          <button onClick={fetchData} className="btn btn-sm btn-outline shrink-0">
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
    <ul className="stagger space-y-3">
      {documents.map(doc => (
        <DocumentCard key={doc.id} doc={doc} />
      ))}
    </ul>
  );
}

function DocumentCard({ doc }: { doc: ApplicationDocument }) {
  const statusLabel = UPLOAD_STATUS_LABELS[doc.uploadStatus] || doc.uploadStatus;
  const statusColor = UPLOAD_STATUS_COLORS[doc.uploadStatus] || 'badge-neutral';
  const catLabel = CATEGORY_LABELS[doc.category] || doc.category;

  return (
    <li className="panel px-5 py-4">
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
        >
          {getCategorySvg(doc.category)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {doc.fileName}
            </h3>
            <span className={`badge ${statusColor}`}>{statusLabel}</span>
          </div>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              {catLabel}
            </span>
            {doc.fileSizeBytes != null && <span className="tabular-nums">{formatFileSize(doc.fileSizeBytes)}</span>}
            <span>
              Uploaded{' '}
              {new Date(doc.createdAt).toLocaleDateString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {doc.applicationId && (
              <Link href={`/portal/applications/${doc.applicationId}`} className="link-arrow">
                View application <span data-arrow aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          {doc.rejectionReason && (
            <p className="mt-2.5 text-sm text-red-600 dark:text-red-300">
              <span className="font-semibold">Not accepted:</span> {doc.rejectionReason}
            </p>
          )}
        </div>
      </div>
    </li>
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
          <section key={appId} aria-label={`Documents for ${app?.applicationNumber || appId}`}>
            <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-secondary)' }}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="section-title">{app?.applicationNumber || appId}</h2>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {docs.length} {docs.length === 1 ? 'document' : 'documents'}
                  {app ? ` · ${STATUS_LABELS[app.status] || app.status}` : ''}
                </p>
              </div>
              <Link href={`/portal/applications/${appId}`} className="link-arrow ml-auto">
                View application <span data-arrow aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="space-y-3">
              {docs.map(doc => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </ul>
          </section>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-doc-title"
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--surface-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--surface-border)' }}
        >
          <h2 id="upload-doc-title" className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Upload document
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close upload dialog">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {uploadError && (
            <div className="alert alert-error" role="alert">
              {uploadError} Your entries have been kept — try uploading again.
            </div>
          )}

          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Fields marked <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
            <span className="sr-only">with an asterisk</span> are required.
          </p>

          <div>
            <label className="field-label" htmlFor="upload-application">
              Application{' '}
              <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <select
              id="upload-application"
              value={selectedApp}
              onChange={e => setSelectedApp(e.target.value)}
              className="select"
              required
              aria-required="true"
            >
              {applications.map(app => (
                <option key={app.applicationId} value={app.applicationId}>
                  {app.applicationNumber || app.applicationId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="upload-category">
              Category{' '}
              <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <select
              id="upload-category"
              value={category}
              onChange={e => setCategory(e.target.value as DocumentCategory)}
              className="select"
              required
              aria-required="true"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="upload-name">
              Document name{' '}
              <span className="text-red-500 dark:text-red-300" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="upload-name"
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              placeholder="e.g. Passport_Front.pdf"
              className="input"
              required
              aria-required="true"
            />
            <p className="field-hint">
              File upload is metadata-only until ECM integration is ready.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="upload-notes">
              Notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              id="upload-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="input"
              placeholder="Any additional information…"
            />
          </div>
        </div>

        <div
          className="flex justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <button onClick={onClose} className="btn btn-secondary" type="button">
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
            className="btn btn-primary"
            type="button"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Uploading…
              </span>
            ) : (
              'Upload document'
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
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg aria-hidden="true" className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="empty-state-title">No documents uploaded yet</h2>
      <p className="empty-state-text">
        {hasApps
          ? 'Upload the documents your loan applications need and we&apos;ll keep them here.'
          : 'Create a loan application first, then upload the documents it asks for.'}
      </p>
      {hasApps && (
        <button onClick={onUpload} className="btn btn-primary mt-5" type="button">
          Upload document
        </button>
      )}
    </div>
  );
}
