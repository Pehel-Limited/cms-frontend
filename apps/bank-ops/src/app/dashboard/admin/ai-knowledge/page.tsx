'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAppSelector } from '@/store';
import config from '@/config';
import {
  aiKnowledgeService,
  type KnowledgeSource,
  type IngestionJob,
  type Citation,
} from '@/services/api/aiKnowledgeService';

const SOURCE_TYPES = ['POLICY', 'PROCEDURE', 'PRODUCT_GUIDE', 'REGULATION', 'FAQ', 'OTHER'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#94a3b8' },
  ACTIVE: { label: 'Active', color: '#10b981' },
  ARCHIVED: { label: 'Archived', color: '#64748b' },
  FAILED: { label: 'Failed', color: '#ef4444' },
};

function statusMeta(status: string) {
  return STATUS_META[status] || { label: status || 'Unknown', color: '#94a3b8' };
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
    >
      {children}
    </div>
  );
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiKnowledgePage() {
  const { user } = useAppSelector(state => state.auth);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const [ingestSourceId, setIngestSourceId] = useState<string | null>(null);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [lastJob, setLastJob] = useState<IngestionJob | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Citation[] | null>(null);
  const [answerStatus, setAnswerStatus] = useState<string | null>(null);

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
    try {
      setLoading(true);
      setError(null);
      const data = await aiKnowledgeService.listSources(getBankId());
      setSources(data);
    } catch (err) {
      console.error('Failed to load knowledge sources:', err);
      setError('Failed to load knowledge sources. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [getBankId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const activeCount = useMemo(() => sources.filter(s => s.status === 'ACTIVE').length, [sources]);
  const draftCount = useMemo(() => sources.filter(s => s.status === 'DRAFT').length, [sources]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      setRegistering(true);
      await aiKnowledgeService.registerSource({
        bankId: getBankId(),
        sourceType: registerForm.sourceType,
        title: registerForm.title,
        description: registerForm.description || undefined,
        jurisdiction: registerForm.jurisdiction || undefined,
        classification: registerForm.classification || undefined,
        version: registerForm.version || undefined,
      });
      toast.success('Knowledge source registered');
      setShowRegisterModal(false);
      setRegisterForm({ sourceType: 'POLICY', title: '', description: '', jurisdiction: '', classification: '', version: '' });
      await loadSources();
    } catch (err) {
      console.error('Failed to register source:', err);
      toast.error('Failed to register knowledge source');
    } finally {
      setRegistering(false);
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestSourceId || !ingestFile) {
      toast.error('Select a file to ingest');
      return;
    }
    try {
      setIngesting(true);
      const job = await aiKnowledgeService.ingest(ingestSourceId, getBankId(), ingestFile);
      setLastJob(job);
      if (job.status === 'FAILED') {
        toast.error(`Ingestion failed: ${job.errorSummary || 'Unknown error'}`);
      } else {
        toast.success(`Ingestion ${job.status.toLowerCase()} — ${job.chunksCreated} chunk(s), ${job.embeddingsCreated} embedding(s)`);
      }
      setIngestSourceId(null);
      setIngestFile(null);
      await loadSources();
    } catch (err) {
      console.error('Failed to ingest document:', err);
      toast.error('Failed to ingest document');
    } finally {
      setIngesting(false);
    }
  };

  const handleActivate = async (source: KnowledgeSource) => {
    try {
      setActionLoading(source.id);
      await aiKnowledgeService.activate(source.id, getBankId());
      toast.success(`"${source.title}" activated`);
      await loadSources();
    } catch (err) {
      console.error('Failed to activate source:', err);
      toast.error('Failed to activate source');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (source: KnowledgeSource) => {
    if (!confirm(`Archive "${source.title}"? It will no longer be used for search.`)) return;
    try {
      setActionLoading(source.id);
      await aiKnowledgeService.archive(source.id, getBankId());
      toast.success(`"${source.title}" archived`);
      await loadSources();
    } catch (err) {
      console.error('Failed to archive source:', err);
      toast.error('Failed to archive source');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      setSearchResults(null);
      setAnswerStatus(null);
      const response = await aiKnowledgeService.search(getBankId(), searchQuery);
      setAnswerStatus(response.answerStatus);
      setSearchResults(response.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>AI Knowledge Base</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
            Manage policy documents used for cited RAG search and RM copilot answers.
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0ea5e9' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Register Source
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>Total Sources</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--rm-text)' }}>{sources.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>Active</p>
          <p className="text-2xl font-bold mt-0.5 text-emerald-400">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>Draft</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--rm-text)' }}>{draftCount}</p>
        </Card>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sources table */}
      <Card>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--rm-border)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--rm-text)' }}>Knowledge Sources</h2>
        </div>
        {sources.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            No knowledge sources yet. Register one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rm-border)' }}>
                  {['Title', 'Type', 'Version', 'Status', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--rm-border)' }}>
                    <td className="px-5 py-3">
                      <p className="font-medium" style={{ color: 'var(--rm-text)' }}>{s.title}</p>
                      {s.description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>{s.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--rm-text-secondary)' }}>{s.sourceType}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--rm-text-secondary)' }}>{s.version || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--rm-text-muted)' }}>{formatDate(s.updatedAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => { setIngestSourceId(s.id); setLastJob(null); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
                        >
                          Ingest
                        </button>
                        {s.status !== 'ACTIVE' && (
                          <button
                            disabled={actionLoading === s.id}
                            onClick={() => handleActivate(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 disabled:opacity-50"
                            style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}
                          >
                            {actionLoading === s.id ? '...' : 'Activate'}
                          </button>
                        )}
                        {s.status !== 'ARCHIVED' && (
                          <button
                            disabled={actionLoading === s.id}
                            onClick={() => handleArchive(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 disabled:opacity-50"
                            style={{ backgroundColor: 'rgba(148,163,184,0.12)' }}
                          >
                            {actionLoading === s.id ? '...' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Test search panel */}
      <Card className="p-5">
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Test Hybrid Search</h2>
        <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Ask a question about your active policy documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[280px] px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {answerStatus && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--rm-text-muted)' }}>
              Status: <span style={{ color: answerStatus === 'FOUND' ? '#10b981' : '#f59e0b' }}>{answerStatus}</span>
            </p>
            {searchResults && searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map(r => (
                  <div key={r.chunkId} className="rounded-xl p-4" style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                        {r.sourceTitle} {r.sourceVersion ? `(v${r.sourceVersion})` : ''}
                      </p>
                      <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        score {r.combinedScore.toFixed(3)}
                      </span>
                    </div>
                    {r.headingPath && (
                      <p className="text-xs mb-2" style={{ color: 'var(--rm-text-muted)' }}>{r.headingPath}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--rm-text-secondary)' }}>
                      {r.snippet.length > 400 ? `${r.snippet.slice(0, 400)}…` : r.snippet}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>No matching citations found.</p>
            )}
          </div>
        )}
      </Card>

      {/* Register modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowRegisterModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--rm-text)' }}>Register Knowledge Source</h2>
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--rm-text-muted)' }}>Source Type</label>
                <select
                  value={registerForm.sourceType}
                  onChange={e => setRegisterForm({ ...registerForm, sourceType: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
                >
                  {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--rm-text-muted)' }}>Title *</label>
                <input
                  type="text"
                  required
                  value={registerForm.title}
                  onChange={e => setRegisterForm({ ...registerForm, title: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--rm-text-muted)' }}>Description</label>
                <textarea
                  value={registerForm.description}
                  onChange={e => setRegisterForm({ ...registerForm, description: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'var(--rm-text-muted)' }}>Jurisdiction</label>
                  <input
                    type="text"
                    value={registerForm.jurisdiction}
                    onChange={e => setRegisterForm({ ...registerForm, jurisdiction: e.target.value })}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                    style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'var(--rm-text-muted)' }}>Version</label>
                  <input
                    type="text"
                    value={registerForm.version}
                    onChange={e => setRegisterForm({ ...registerForm, version: e.target.value })}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                    style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text)' }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  {registering ? 'Registering…' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ingest modal */}
      {ingestSourceId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIngestSourceId(null)}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          >
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--rm-text)' }}>Ingest Document</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--rm-text-muted)' }}>
              Supported formats: .txt, .md, .pdf. Re-ingesting deactivates previous chunks for this source.
            </p>
            <form onSubmit={handleIngestSubmit} className="space-y-3">
              <input
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                onChange={e => setIngestFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
                style={{ color: 'var(--rm-text)' }}
              />
              {lastJob && (
                <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)', color: 'var(--rm-text-secondary)' }}>
                  <p>Job status: <StatusBadge status={lastJob.status} /></p>
                  <p className="mt-1">Pages: {lastJob.pagesProcessed} · Chunks: {lastJob.chunksCreated} · Embeddings: {lastJob.embeddingsCreated}</p>
                  {lastJob.errorSummary && <p className="mt-1 text-red-400">{lastJob.errorSummary}</p>}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIngestSourceId(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)', border: '1px solid var(--rm-border)' }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={ingesting || !ingestFile}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  {ingesting ? 'Ingesting…' : 'Ingest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
