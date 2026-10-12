'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { useAppSelector } from '@/store';
import config from '@/config';
import {
  aiKnowledgeService,
  type KnowledgeSource,
  type IngestionJob,
} from '@/services/api/aiKnowledgeService';

/* ── Single source of truth for labels + colours used by this page ── */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy',
  PROCEDURE: 'Procedure',
  PRODUCT_GUIDE: 'Product guide',
  REGULATION: 'Regulation',
  FAQ: 'FAQ',
  OTHER: 'Other',
};

const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS);

/* Shared by knowledge sources and ingestion jobs. */
const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#64748b' },
  ACTIVE: { label: 'Active', color: '#10b981' },
  ARCHIVED: { label: 'Archived', color: '#94a3b8' },
  FAILED: { label: 'Failed', color: '#ef4444' },
  PENDING: { label: 'Pending', color: '#f59e0b' },
  RUNNING: { label: 'Running', color: '#0ea5e9' },
  PROCESSING: { label: 'Processing', color: '#0ea5e9' },
  PARTIAL: { label: 'Partially completed', color: '#f59e0b' },
  COMPLETED: { label: 'Completed', color: '#10b981' },
};

const ANSWER_STATUS_LABELS: Record<string, string> = {
  ANSWERED: 'Answered from the registered sources',
  NOT_FOUND: 'No active source covers this',
  INSUFFICIENT_EVIDENCE: 'Not covered by the registered policy',
  FAILED: 'Could not answer',
};

function humanise(value?: string): string {
  if (!value) return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

function statusMeta(status?: string): { label: string; color: string } {
  if (!status) return { label: 'Unknown', color: '#94a3b8' };
  return STATUS_META[status] || { label: humanise(status), color: '#94a3b8' };
}

function sourceTypeLabel(type?: string): string {
  if (!type) return '—';
  return SOURCE_TYPE_LABELS[type] || humanise(type);
}

function answerStatusLabel(status: string): string {
  return ANSWER_STATUS_LABELS[status] || humanise(status);
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusPill({ status }: { status?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

/* ── Accessible modal: labelled, escape-to-close, focus contained + restored ── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Modal({
  titleId,
  title,
  description,
  onClose,
  initialFocusRef,
  children,
}: {
  titleId: string;
  title: string;
  description?: string;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const target =
      initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [onClose, initialFocusRef]);

  const handleTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? `${titleId}-description` : undefined}
        onKeyDown={handleTab}
        onClick={event => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 sm:p-7"
        style={{ backgroundColor: 'var(--rm-card)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              {title}
            </h2>
            {description && (
              <p
                id={`${titleId}-description`}
                className="mt-1.5 text-sm"
                style={{ color: 'var(--rm-text-muted)' }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-full p-2 transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

  /* Wire the hint/error into the control so screen readers announce them with the field. */
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium"
        style={{ color: 'var(--rm-text-secondary)' }}
      >
        {label}
        {required && (
          <>
            <span aria-hidden="true" style={{ color: '#dc2626' }}>
              {' '}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mb-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      )}
      {control}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: '#dc2626' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = 'w-full rounded-xl px-4 py-2.5 text-base transition-opacity';
const inputStyle: CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
};

export default function AiKnowledgePage() {
  const { user } = useAppSelector(state => state.auth);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    sourceType: 'POLICY',
    title: '',
    description: '',
    jurisdiction: '',
    classification: '',
    version: '',
  });
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [ingestSource, setIngestSource] = useState<KnowledgeSource | null>(null);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [lastJob, setLastJob] = useState<IngestionJob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  /* Kept as one object so the status can never render against another query's answer. */
  const [answer, setAnswer] = useState<{
    status: string;
    text?: string | null;
    model?: string | null;
    sourcesUsed?: number;
    latencyMs?: number | null;
    errorMessage?: string | null;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const getBankId = useCallback((): string => {
    if (user?.bankId) return user.bankId;
    if (typeof window !== 'undefined') {
      const userDataStr = localStorage.getItem(config.auth.userKey);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          return userData.bankId || config.bank.defaultBankId;
        } catch {
          return config.bank.defaultBankId;
        }
      }
    }
    return config.bank.defaultBankId;
  }, [user?.bankId]);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiKnowledgeService.listSources(getBankId());
      setSources(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load knowledge sources:', err);
      setError('Knowledge sources could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [getBankId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const activeCount = useMemo(() => sources.filter(s => s.status === 'ACTIVE').length, [sources]);
  const draftCount = useMemo(() => sources.filter(s => s.status === 'DRAFT').length, [sources]);

  const closeRegisterModal = useCallback(() => {
    setShowRegisterModal(false);
    setRegisterError(null);
    setTitleError(null);
  }, []);

  const closeIngestModal = useCallback(() => {
    setIngestSource(null);
    setIngestFile(null);
    setIngestError(null);
    setLastJob(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setRegisterError(null);
    if (!registerForm.title.trim()) {
      setTitleError('Enter a title so this source can be identified in search results.');
      titleRef.current?.focus();
      return;
    }
    setTitleError(null);
    try {
      setRegistering(true);
      const created = await aiKnowledgeService.registerSource({
        bankId: getBankId(),
        sourceType: registerForm.sourceType,
        title: registerForm.title.trim(),
        description: registerForm.description || undefined,
        jurisdiction: registerForm.jurisdiction || undefined,
        classification: registerForm.classification || undefined,
        version: registerForm.version || undefined,
      });
      setNotice(`“${created?.title ?? registerForm.title.trim()}” registered as a draft source.`);
      setRegisterForm({
        sourceType: 'POLICY',
        title: '',
        description: '',
        jurisdiction: '',
        classification: '',
        version: '',
      });
      closeRegisterModal();
      await loadSources();
    } catch (err) {
      console.error('Failed to register source:', err);
      /* Scoped to the dialog — typed values are kept so nothing is lost. */
      setRegisterError('The source could not be registered. Check the details and try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleIngestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIngestError(null);
    if (!ingestSource) return;
    if (!ingestFile) {
      setIngestError('Choose a .txt, .md or .pdf file to ingest.');
      fileRef.current?.focus();
      return;
    }
    try {
      setIngesting(true);
      const job = await aiKnowledgeService.ingest(ingestSource.id, getBankId(), ingestFile);
      setLastJob(job);
      if (job.status === 'FAILED') {
        setIngestError(`Ingestion failed: ${job.errorSummary || 'no details returned'}.`);
      } else {
        setNotice(
          `Ingestion ${statusMeta(job.status).label.toLowerCase()} for “${ingestSource.title}”: ${job.chunksCreated} chunks, ${job.embeddingsCreated} embeddings.`
        );
        setIngestFile(null);
        if (fileRef.current) fileRef.current.value = '';
        await loadSources();
      }
    } catch (err) {
      console.error('Failed to ingest document:', err);
      setIngestError('The document could not be ingested. Try again or choose another file.');
    } finally {
      setIngesting(false);
    }
  };

  const handleActivate = async (source: KnowledgeSource) => {
    setActionLoading(source.id);
    setActionError(null);
    setNotice(null);
    try {
      await aiKnowledgeService.activate(source.id, getBankId());
      setNotice(`“${source.title}” is now active and used for cited search.`);
      await loadSources();
    } catch (err) {
      console.error('Failed to activate source:', err);
      setActionError({ id: source.id, message: 'Activation failed. The source was left unchanged.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (source: KnowledgeSource) => {
    setActionLoading(source.id);
    setActionError(null);
    setNotice(null);
    try {
      await aiKnowledgeService.archive(source.id, getBankId());
      setConfirmArchive(null);
      setNotice(`“${source.title}” was archived and is no longer used for search.`);
      await loadSources();
    } catch (err) {
      console.error('Failed to archive source:', err);
      setActionError({ id: source.id, message: 'Archiving failed. The source was left unchanged.' });
    } finally {
      setActionLoading(null);
    }
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Enter a question to search the active knowledge sources.');
      return;
    }
    setSearchError(null);
    setSearching(true);
    setAnswer(null);
    try {
      const response = await aiKnowledgeService.search(getBankId(), query);
      setAnswer({
        status: response.answerStatus,
        text: response.answer,
        model: response.answerModel,
        sourcesUsed: response.sourcesUsed,
        latencyMs: response.latencyMs,
        errorMessage: response.errorMessage,
      });
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError('Search failed. Your question was kept so you can try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  const tiles = [
    { label: 'Sources registered', value: String(sources.length) },
    { label: 'Active in search', value: String(activeCount) },
    { label: 'Drafts', value: String(draftCount) },
  ];

  return (
    <div className="space-y-8" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">AI knowledge base</h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Register policy documents, ingest their content, and test the cited answers built from
            them. RM copilot answers do not read this knowledge base yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setShowRegisterModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--rm-accent)' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Register source
        </button>
      </header>

      {/* ══ Counts ══ */}
      <section aria-label="Knowledge base counts" className="grid gap-4 md:grid-cols-3">
        {tiles.map(tile => (
          <div key={tile.label} className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
            <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {tile.label}
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
              {loading && sources.length === 0 ? '—' : tile.value}
            </p>
          </div>
        ))}
      </section>

      {notice && (
        <p
          role="status"
          className="rounded-2xl px-5 py-4 text-sm"
          style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#059669' }}
        >
          {notice}
        </p>
      )}

      {/* ══ Sources ══ */}
      <section className="space-y-5" aria-labelledby="knowledge-sources-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="knowledge-sources-heading"
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            Knowledge sources
          </h2>
          <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
            {loading ? 'Loading sources…' : `${sources.length} registered`}
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }}>
          {error ? (
            <div className="px-6 py-12 text-center sm:px-7">
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                Sources could not be loaded
              </p>
              <p role="alert" className="mx-auto mt-1.5 max-w-md text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={loadSources}
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                Try again
              </button>
            </div>
          ) : loading && sources.length === 0 ? (
            <div className="px-5 py-5" aria-hidden="true">
              <div className="space-y-4">
                {[0, 1, 2].map(row => (
                  <div key={row} className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-3.5 w-52 rounded-full animate-pulse"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                      />
                      <div
                        className="h-3 w-72 max-w-full rounded-full animate-pulse"
                        style={{ backgroundColor: 'var(--rm-input)' }}
                      />
                    </div>
                    <div
                      className="h-7 w-20 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--rm-input)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : sources.length === 0 ? (
            <div className="px-6 py-16 text-center sm:px-7">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--rm-accent-muted)' }}
              >
                <svg className="h-7 w-7" style={{ color: 'var(--rm-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                No knowledge sources yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Register a policy, procedure or product guide, then ingest its document so it can be
                cited in answers.
              </p>
            </div>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Knowledge sources, scrollable horizontally"
              tabIndex={0}
            >
              <table className="w-full" aria-label="Registered knowledge sources">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <th scope="col" className="px-5 py-3.5 text-left text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                      Title
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-left text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                      Type
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-left text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                      Version
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-left text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-left text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                      Updated
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(source => {
                    const busy = actionLoading === source.id;
                    const rowError = actionError?.id === source.id ? actionError.message : null;
                    return (
                      <tr
                        key={source.id}
                        className="align-top hover:bg-slate-50"
                        style={{ borderBottom: '1px solid var(--rm-border)' }}
                      >
                        <td className="px-5 py-4">
                          <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {source.title}
                          </p>
                          {source.description && (
                            <p className="mt-1 max-w-md text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              {source.description}
                            </p>
                          )}
                          {source.jurisdiction && (
                            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                              {source.jurisdiction}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                            {sourceTypeLabel(source.sourceType)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-secondary)' }}>
                            {source.version || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill status={source.status} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                            {formatDate(source.updatedAt)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {confirmArchive === source.id ? (
                            <div
                              className="flex flex-wrap items-center justify-end gap-2"
                              role="group"
                              aria-label={`Confirm archiving ${source.title}`}
                            >
                              <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                                Archive “{source.title}”? It will stop being used for search.
                              </span>
                              <button
                                type="button"
                                onClick={() => handleArchive(source)}
                                disabled={busy}
                                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ backgroundColor: '#ef4444' }}
                              >
                                {busy ? 'Archiving…' : 'Confirm archive'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmArchive(null)}
                                disabled={busy}
                                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--rm-input)',
                                  color: 'var(--rm-text-secondary)',
                                  border: '1px solid var(--rm-border)',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNotice(null);
                                  closeIngestModal();
                                  setIngestSource(source);
                                }}
                                disabled={busy}
                                aria-label={`Ingest a document for ${source.title}`}
                                className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--rm-input)',
                                  color: 'var(--rm-text)',
                                  border: '1px solid var(--rm-border)',
                                }}
                              >
                                Ingest document
                              </button>
                              {source.status !== 'ACTIVE' && (
                                <button
                                  type="button"
                                  onClick={() => handleActivate(source)}
                                  disabled={busy}
                                  aria-label={`Activate ${source.title}`}
                                  className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{ backgroundColor: 'rgba(16,185,129,0.14)', color: '#059669' }}
                                >
                                  {busy ? 'Working…' : 'Activate'}
                                </button>
                              )}
                              {source.status !== 'ARCHIVED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null);
                                    setConfirmArchive(source.id);
                                  }}
                                  disabled={busy}
                                  aria-label={`Archive ${source.title}`}
                                  className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#dc2626' }}
                                >
                                  Archive
                                </button>
                              )}
                            </div>
                          )}
                          {rowError && (
                            <p role="alert" className="mt-2 text-right text-sm" style={{ color: '#dc2626' }}>
                              {rowError}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ══ Test search ══ */}
      <section
        className="rounded-3xl p-6 sm:p-7"
        style={{ backgroundColor: 'var(--rm-card)' }}
        aria-labelledby="knowledge-search-heading"
      >
        <h2
          id="knowledge-search-heading"
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--rm-text)' }}
        >
          Test retrieval and answer
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Searches active sources, then answers from those passages only — it never answers from the
          model&rsquo;s own knowledge of banking.
        </p>

        <form onSubmit={handleSearchSubmit} className="mt-5 flex flex-wrap items-end gap-3" noValidate>
          <div className="min-w-[260px] flex-1">
            <label
              htmlFor="knowledge-search"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--rm-text-secondary)' }}
            >
              Question
            </label>
            <input
              id="knowledge-search"
              type="search"
              value={searchQuery}
              onChange={event => {
                setSearchQuery(event.target.value);
                if (searchError) setSearchError(null);
              }}
              aria-describedby="knowledge-search-hint"
              aria-invalid={searchError ? true : undefined}
              placeholder="What are the collateral rules for SME term loans?"
              className={inputClass}
              style={inputStyle}
            />
            <p id="knowledge-search-hint" className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              The answer is written only from passages retrieved from active sources.
            </p>
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--rm-input)',
              color: 'var(--rm-text)',
              border: '1px solid var(--rm-border)',
            }}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
          >
            <p className="text-sm" style={{ color: '#dc2626' }}>
              {searchError}
            </p>
            <button
              type="button"
              onClick={runSearch}
              className="ml-auto rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(239,68,68,0.14)', color: '#dc2626' }}
            >
              Try again
            </button>
          </div>
        )}

        <div aria-live="polite" aria-busy={searching}>
          {searching && (
            <p className="mt-5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Searching active sources and writing the answer… This can take up to a minute.
            </p>
          )}

          {!searching && answer && (
            <div className="mt-6 space-y-4">
              <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                {answerStatusLabel(answer.status)}
              </p>

              {answer.status === 'ANSWERED' && answer.text && (
                <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--rm-accent-muted)' }}>
                  <h3 className="sr-only">Answer</h3>
                  <p
                    className="whitespace-pre-wrap text-base"
                    style={{ color: 'var(--rm-text)' }}
                  >
                    {answer.text}
                  </p>
                  <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Grounded in {answer.sourcesUsed}{' '}
                    {answer.sourcesUsed === 1 ? 'passage' : 'passages'} from the active sources
                    {answer.model ? ` · ${answer.model}` : ''}
                    {answer.latencyMs ? ` · ${(answer.latencyMs / 1000).toFixed(1)}s` : ''}. Check the
                    source document before relying on this.
                  </p>
                </div>
              )}

              {answer.status === 'INSUFFICIENT_EVIDENCE' && (
                <p className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  Related passages were found, but they do not answer this question, so no answer was
                  generated.
                </p>
              )}

              {answer.status === 'FAILED' && (
                <p
                  className="text-sm font-medium"
                  role="alert"
                  style={{ color: 'var(--rm-text-secondary)' }}
                >
                  {answer.errorMessage || 'The AI service could not answer this question.'}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══ Register dialog ══ */}
      {showRegisterModal && (
        <Modal
          titleId="register-source-title"
          title="Register a knowledge source"
          description="Creates the source record. Ingest a document afterwards to make it searchable."
          onClose={closeRegisterModal}
          initialFocusRef={titleRef}
        >
          <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
            {registerError && (
              <p
                role="alert"
                className="rounded-2xl px-4 py-3 text-sm"
                style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#dc2626' }}
              >
                {registerError}
              </p>
            )}

            <Field id="register-title" label="Title" required error={titleError}>
              <input
                id="register-title"
                ref={titleRef}
                type="text"
                required
                aria-required="true"
                value={registerForm.title}
                onChange={event => {
                  setRegisterForm({ ...registerForm, title: event.target.value });
                  if (titleError) setTitleError(null);
                }}
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <Field id="register-source-type" label="Source type" required>
              <select
                id="register-source-type"
                aria-required="true"
                value={registerForm.sourceType}
                onChange={event => setRegisterForm({ ...registerForm, sourceType: event.target.value })}
                className={inputClass}
                style={inputStyle}
              >
                {SOURCE_TYPES.map(type => (
                  <option key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="register-description" label="Description">
              <textarea
                id="register-description"
                rows={3}
                value={registerForm.description}
                onChange={event => setRegisterForm({ ...registerForm, description: event.target.value })}
                className={`${inputClass} resize-y`}
                style={inputStyle}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="register-jurisdiction" label="Jurisdiction">
                <input
                  id="register-jurisdiction"
                  type="text"
                  value={registerForm.jurisdiction}
                  onChange={event => setRegisterForm({ ...registerForm, jurisdiction: event.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
              <Field id="register-version" label="Version">
                <input
                  id="register-version"
                  type="text"
                  value={registerForm.version}
                  onChange={event => setRegisterForm({ ...registerForm, version: event.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field
              id="register-classification"
              label="Classification"
              hint="For example Internal, Confidential or Public."
            >
              <input
                id="register-classification"
                type="text"
                value={registerForm.classification}
                onChange={event => setRegisterForm({ ...registerForm, classification: event.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeRegisterModal}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--rm-input)',
                  color: 'var(--rm-text-secondary)',
                  border: '1px solid var(--rm-border)',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={registering}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {registering ? 'Registering…' : 'Register source'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ Ingest dialog ══ */}
      {ingestSource && (
        <Modal
          titleId="ingest-document-title"
          title={`Ingest a document for “${ingestSource.title}”`}
          description="Supported formats: .txt, .md and .pdf. Re-ingesting deactivates the previous chunks for this source."
          onClose={closeIngestModal}
          initialFocusRef={fileRef}
        >
          <form onSubmit={handleIngestSubmit} className="space-y-4" noValidate>
            <Field
              id="ingest-file"
              label="Document"
              required
              error={ingestError}
              hint={ingestFile ? `Selected: ${ingestFile.name}` : undefined}
            >
              <input
                id="ingest-file"
                ref={fileRef}
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                required
                aria-required="true"
                onChange={event => {
                  setIngestFile(event.target.files?.[0] || null);
                  if (ingestError) setIngestError(null);
                }}
                className="w-full rounded-xl px-4 py-2.5 text-sm"
                style={inputStyle}
              />
            </Field>

            {lastJob && (
              <dl
                role="status"
                className="space-y-2 rounded-2xl px-5 py-4 text-sm"
                style={{ backgroundColor: 'var(--rm-input)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <dt style={{ color: 'var(--rm-text-muted)' }}>Job status</dt>
                  <dd>
                    <StatusPill status={lastJob.status} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt style={{ color: 'var(--rm-text-muted)' }}>Pages processed</dt>
                  <dd className="tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {lastJob.pagesProcessed}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt style={{ color: 'var(--rm-text-muted)' }}>Chunks created</dt>
                  <dd className="tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {lastJob.chunksCreated}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt style={{ color: 'var(--rm-text-muted)' }}>Embeddings created</dt>
                  <dd className="tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {lastJob.embeddingsCreated}
                  </dd>
                </div>
                {lastJob.errorSummary && (
                  <div className="pt-1">
                    <dt className="sr-only">Error summary</dt>
                    <dd role="alert" style={{ color: '#dc2626' }}>
                      {lastJob.errorSummary}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeIngestModal}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--rm-input)',
                  color: 'var(--rm-text-secondary)',
                  border: '1px solid var(--rm-border)',
                }}
              >
                Close
              </button>
              <button
                type="submit"
                disabled={ingesting}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {ingesting ? 'Ingesting…' : 'Ingest document'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
