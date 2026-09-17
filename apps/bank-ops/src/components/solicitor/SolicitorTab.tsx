'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { solicitorIntegrationService } from '@/services/api/solicitorIntegrationService';
import type {
  SolicitorSummary,
  SolicitorFirm,
  LegalCaseChecklistItem,
  LegalCaseUndertaking,
  CertificateOfTitle,
  DrawdownRequest,
  CreateSolicitorCaseRequest,
  LegalQueryThread,
} from '@/types/solicitor';

interface SolicitorTabProps {
  applicationId: string;
  applicationStatus?: string;
}

// ── Helper components ────────────────────────────────────────────────────────

function StatusPill({ status, label }: { status: string; label?: string }) {
  const colors: Record<string, string> = {
    READY: 'bg-green-100 text-green-800 border-green-200',
    READY_WITH_CONDITIONS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    NOT_READY: 'bg-red-100 text-red-800 border-red-200',
    NOT_ASSESSED: 'bg-slate-100 text-slate-600 border-slate-200',
    BLOCKED: 'bg-red-100 text-red-800 border-red-200',
    CLEAR: 'bg-green-100 text-green-800 border-green-200',
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    ACCEPTED: 'bg-green-100 text-green-800 border-green-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200',
    WAIVED: 'bg-purple-100 text-purple-800 border-purple-200',
    SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
    PENDING_SOLICITOR: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    FUNDS_RELEASED: 'bg-teal-100 text-teal-800 border-teal-200',
    ISSUED_TO_SOLICITOR: 'bg-blue-100 text-blue-800 border-blue-200',
    ACCEPTED_BY_SOLICITOR: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
    CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
    LEGAL_REVIEW: 'bg-purple-100 text-purple-800 border-purple-200',
    READY_FOR_DRAWDOWN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };
  const displayLabel = label ?? status.replace(/_/g, ' ');
  const colorClass = colors[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}
    >
      {displayLabel}
    </span>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SolicitorTab({ applicationId, applicationStatus }: SolicitorTabProps) {
  const [summary, setSummary] = useState<SolicitorSummary | null>(null);
  const [firms, setFirms] = useState<SolicitorFirm[]>([]);
  const [checklist, setChecklist] = useState<LegalCaseChecklistItem[]>([]);
  const [undertaking, setUndertaking] = useState<LegalCaseUndertaking | null>(null);
  const [certificate, setCertificate] = useState<CertificateOfTitle | null>(null);
  const [drawdownHistory, setDrawdownHistory] = useState<DrawdownRequest[]>([]);
  const [queries, setQueries] = useState<LegalQueryThread[]>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);
  const [newQuerySubject, setNewQuerySubject] = useState('');
  const [newQueryMessage, setNewQueryMessage] = useState('');
  const [showNewQueryForm, setShowNewQueryForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'overview' | 'checklist' | 'undertaking' | 'certificate' | 'drawdown' | 'queries'
  >('overview');

  // Create case form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSolicitorCaseRequest>({});

  // Assign firm modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedFirmId, setSelectedFirmId] = useState('');

  // Reject/waive note state
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const data = await solicitorIntegrationService.getSolicitorSummary(applicationId);
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load solicitor summary', err);
    }
  }, [applicationId]);

  const loadChecklist = useCallback(
    async (caseId: string) => {
      try {
        const data = await solicitorIntegrationService.getChecklist(applicationId, caseId);
        setChecklist(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Failed to load checklist', err);
      }
    },
    [applicationId]
  );

  const loadUndertaking = useCallback(
    async (caseId: string) => {
      try {
        const data = await solicitorIntegrationService.getUndertaking(applicationId, caseId);
        setUndertaking(data ?? null);
      } catch {
        setUndertaking(null);
      }
    },
    [applicationId]
  );

  const loadQueries = useCallback(
    async (caseId: string) => {
      setQueriesLoading(true);
      try {
        const data = await solicitorIntegrationService.getQueries(applicationId, caseId);
        setQueries(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Failed to load queries', err);
      } finally {
        setQueriesLoading(false);
      }
    },
    [applicationId]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadSummary();
      try {
        const firmList = await solicitorIntegrationService.listFirms();
        setFirms(Array.isArray(firmList) ? firmList : []);
      } catch {
        setFirms([]);
      }
      setLoading(false);
    })();
  }, [applicationId, loadSummary]);

  // Load detailed data when sections are opened
  useEffect(() => {
    if (!summary?.solicitorCaseId) return;
    if (activeSection === 'checklist') {
      loadChecklist(summary.solicitorCaseId);
    } else if (activeSection === 'undertaking') {
      loadUndertaking(summary.solicitorCaseId);
    } else if (activeSection === 'queries') {
      loadQueries(summary.solicitorCaseId);
    }
  }, [activeSection, summary?.solicitorCaseId, loadChecklist, loadUndertaking, loadQueries]);

  const handleCreateCase = async () => {
    try {
      setActionLoading(true);
      await solicitorIntegrationService.createSolicitorCase(applicationId, createForm);
      toast.success('Solicitor case created');
      setShowCreateForm(false);
      setCreateForm({});
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create solicitor case');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignFirm = async () => {
    if (!summary?.solicitorCaseId || !selectedFirmId) return;
    try {
      setActionLoading(true);
      await solicitorIntegrationService.assignFirm(applicationId, summary.solicitorCaseId, {
        firmId: selectedFirmId,
      });
      toast.success('Firm assigned and instruction sent');
      setShowAssignModal(false);
      setSelectedFirmId('');
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to assign firm');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptChecklist = async (item: LegalCaseChecklistItem) => {
    if (!summary?.solicitorCaseId) return;
    try {
      setActionLoading(true);
      await solicitorIntegrationService.acceptChecklistItem(item.id, summary.solicitorCaseId);
      toast.success('Checklist item accepted');
      await loadChecklist(summary.solicitorCaseId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to accept item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectChecklist = async (item: LegalCaseChecklistItem) => {
    if (!summary?.solicitorCaseId) return;
    const note = rejectNote[item.id] ?? '';
    if (!note.trim()) {
      toast.warn('Please enter a rejection reason');
      return;
    }
    try {
      setActionLoading(true);
      await solicitorIntegrationService.rejectChecklistItem(item.id, summary.solicitorCaseId, note);
      toast.success('Checklist item rejected');
      setRejectNote(prev => {
        const n = { ...prev };
        delete n[item.id];
        return n;
      });
      await loadChecklist(summary.solicitorCaseId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaiveChecklist = async (item: LegalCaseChecklistItem) => {
    if (!summary?.solicitorCaseId) return;
    const note = rejectNote[item.id] ?? '';
    try {
      setActionLoading(true);
      await solicitorIntegrationService.waiveChecklistItem(
        item.id,
        summary.solicitorCaseId,
        note || 'Waived by Bank Legal'
      );
      toast.success('Checklist item waived');
      setRejectNote(prev => {
        const n = { ...prev };
        delete n[item.id];
        return n;
      });
      await loadChecklist(summary.solicitorCaseId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to waive item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptUndertaking = async () => {
    if (!summary?.solicitorCaseId) return;
    try {
      setActionLoading(true);
      await solicitorIntegrationService.acceptUndertaking(summary.solicitorCaseId);
      toast.success('Undertaking accepted');
      await loadSummary();
      await loadUndertaking(summary.solicitorCaseId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to accept undertaking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectUndertaking = async () => {
    if (!summary?.solicitorCaseId || !rejectReason.trim()) {
      toast.warn('Please enter a rejection reason');
      return;
    }
    try {
      setActionLoading(true);
      await solicitorIntegrationService.rejectUndertaking(summary.solicitorCaseId, rejectReason);
      toast.success('Undertaking rejected');
      setRejectReason('');
      await loadSummary();
      await loadUndertaking(summary.solicitorCaseId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject undertaking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptCertificate = async () => {
    if (!summary?.solicitorCaseId) return;
    try {
      setActionLoading(true);
      await solicitorIntegrationService.acceptCertificate(summary.solicitorCaseId);
      toast.success('Certificate of Title accepted');
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to accept certificate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectCertificate = async () => {
    if (!summary?.solicitorCaseId || !rejectReason.trim()) {
      toast.warn('Please enter a rejection reason');
      return;
    }
    try {
      setActionLoading(true);
      await solicitorIntegrationService.rejectCertificate(summary.solicitorCaseId, rejectReason);
      toast.success('Certificate of Title rejected');
      setRejectReason('');
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject certificate');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    );
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'undertaking', label: 'Undertaking' },
    { key: 'certificate', label: 'Certificate of Title' },
    { key: 'drawdown', label: 'Drawdown' },
    { key: 'queries', label: `Queries${queries.length > 0 ? ` (${queries.length})` : ''}` },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Section navigation tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === tab.key
                ? 'bg-white text-[#7f2b7b] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Status summary */}
          <SectionCard title="Solicitor Case Status">
            {!summary?.solicitorCaseId ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200/60">
                  <svg
                    className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
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
                  <div>
                    <p className="text-sm font-medium text-amber-800">No Solicitor Case</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      {summary?.requirementReason ??
                        'Create a solicitor case to begin the legal process.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl text-sm font-medium hover:bg-[#6b2568] transition-colors"
                >
                  + Create Solicitor Case
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Case Status</p>
                    <StatusPill status={summary.solicitorCaseStatus ?? ''} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Legal Readiness</p>
                    <StatusPill status={summary.legalReadinessStatus} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Drawdown</p>
                    <StatusPill status={summary.drawdownReadinessStatus} />
                  </div>
                  {summary.assignedFirmName && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Assigned Firm</p>
                      <p className="text-sm font-medium text-slate-900">
                        {summary.assignedFirmName}
                      </p>
                    </div>
                  )}
                  {summary.caseReference && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Case Reference</p>
                      <p className="text-sm font-mono text-slate-700">{summary.caseReference}</p>
                    </div>
                  )}
                </div>

                {/* Blockers */}
                {summary.blockers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      Active Blockers
                    </p>
                    {summary.blockers.map(b => (
                      <div
                        key={b.code}
                        className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100"
                      >
                        <svg
                          className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-xs text-red-700">{b.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ready banner */}
                {summary.legalReadyForDrawdown && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <svg
                      className="w-4 h-4 text-green-600 flex-shrink-0"
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
                    <p className="text-sm font-medium text-green-800">
                      Legal requirements satisfied — ready for drawdown
                    </p>
                  </div>
                )}

                {/* Available actions */}
                {summary.availableActions.includes('ASSIGN_FIRM') && !summary.assignedFirmId && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl text-sm font-medium hover:bg-[#6b2568] transition-colors"
                  >
                    Assign Solicitor Firm
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          {/* Legal progress summary */}
          {summary?.solicitorCaseId && (
            <SectionCard title="Legal Progress">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Undertaking',
                    status: summary.checklist.undertakingAccepted ? 'ACCEPTED' : 'PENDING',
                    icon: summary.checklist.undertakingAccepted ? '✓' : '○',
                  },
                  {
                    label: 'Certificate of Title',
                    status: summary.checklist.certificateAccepted ? 'ACCEPTED' : 'PENDING',
                    icon: summary.checklist.certificateAccepted ? '✓' : '○',
                  },
                  {
                    label: 'Checklist',
                    status: summary.checklist.mandatoryChecklistComplete ? 'ACCEPTED' : 'PENDING',
                    icon: summary.checklist.mandatoryChecklistComplete ? '✓' : '○',
                  },
                  {
                    label: 'Drawdown',
                    status: summary.checklist.drawdownEligible ? 'ACCEPTED' : 'PENDING',
                    icon: summary.checklist.drawdownEligible ? '✓' : '○',
                  },
                ].map(step => (
                  <div
                    key={step.label}
                    className={`rounded-xl p-3 border ${step.status === 'ACCEPTED' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <p
                      className="text-lg font-bold mb-0.5"
                      style={{ color: step.status === 'ACCEPTED' ? '#16a34a' : '#64748b' }}
                    >
                      {step.icon}
                    </p>
                    <p className="text-xs font-medium text-slate-700">{step.label}</p>
                    <StatusPill status={step.status} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── CHECKLIST ───────────────────────────────────────────────────────── */}
      {activeSection === 'checklist' && (
        <SectionCard title="Solicitor Checklist">
          {checklist.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-slate-500">No checklist items found</p>
              {summary?.solicitorCaseId && (
                <button
                  onClick={async () => {
                    try {
                      setActionLoading(true);
                      const items = await solicitorIntegrationService.seedChecklist(
                        applicationId,
                        summary.solicitorCaseId!
                      );
                      setChecklist(Array.isArray(items) ? items : []);
                      toast.success('Default checklist initialized');
                    } catch (err: any) {
                      toast.error(err.message ?? 'Failed to initialize checklist');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#7f2b7b] text-white rounded-lg text-sm font-medium hover:bg-[#6b2568] disabled:opacity-50"
                >
                  Initialize Default Checklist
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {checklist.map(item => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        {item.mandatory && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                            Required
                          </span>
                        )}
                        <StatusPill status={item.status} />
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                      )}
                      {item.reviewNote && (
                        <p className="text-xs text-slate-600 mt-1 italic">
                          Note: {item.reviewNote}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Action buttons for submitted / pending items */}
                  {(item.status === 'SUBMITTED' || item.status === 'PENDING_SOLICITOR') && (
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <input
                        type="text"
                        placeholder="Rejection reason (required for reject/waive)"
                        value={rejectNote[item.id] ?? ''}
                        onChange={e =>
                          setRejectNote(prev => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-full text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptChecklist(item)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectChecklist(item)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleWaiveChecklist(item)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                        >
                          Waive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── UNDERTAKING ─────────────────────────────────────────────────────── */}
      {activeSection === 'undertaking' && (
        <SectionCard title="Solicitor Undertaking">
          {!summary?.solicitorCaseId ? (
            <p className="text-sm text-slate-500">No solicitor case exists yet</p>
          ) : (
            (() => {
              const uStatus = (undertaking?.status ?? 'NOT_ISSUED') as string;
              const statusLabels: Record<string, string> = {
                NOT_ISSUED: 'Not Issued',
                ISSUED: 'Issued to Solicitor',
                VIEWED: 'Viewed by Solicitor',
                SUBMITTED: 'Submitted — Awaiting Bank Review',
                ACCEPTED: 'Accepted',
                REJECTED: 'Rejected',
              };
              const statusColors: Record<string, string> = {
                NOT_ISSUED: 'bg-slate-100 text-slate-600 border-slate-200',
                ISSUED: 'bg-blue-100 text-blue-700 border-blue-200',
                VIEWED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                SUBMITTED: 'bg-amber-100 text-amber-700 border-amber-200',
                ACCEPTED: 'bg-green-100 text-green-700 border-green-200',
                REJECTED: 'bg-red-100 text-red-700 border-red-200',
              };
              return (
                <div className="space-y-4">
                  {/* Status badge + dates */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[uStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                    >
                      {statusLabels[uStatus] ?? uStatus}
                    </span>
                    {undertaking?.issuedAt && (
                      <span className="text-xs text-slate-400">
                        Issued: {new Date(undertaking.issuedAt).toLocaleDateString()}
                      </span>
                    )}
                    {undertaking?.signedAt && (
                      <span className="text-xs text-slate-400">
                        Submitted: {new Date(undertaking.signedAt).toLocaleDateString()}
                      </span>
                    )}
                    {undertaking?.acceptedAt && (
                      <span className="text-xs text-slate-400">
                        Accepted: {new Date(undertaking.acceptedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Undertaking content snapshot */}
                  {undertaking?.contentSnapshot && (
                    <details className="border border-slate-200 rounded-xl">
                      <summary className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
                        View Undertaking Text
                      </summary>
                      <pre className="px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap border-t border-slate-100 bg-slate-50 max-h-48 overflow-y-auto">
                        {undertaking.contentSnapshot}
                      </pre>
                    </details>
                  )}

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    {/* Bank: Issue undertaking when not yet issued */}
                    {uStatus === 'NOT_ISSUED' && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">
                          Issue the formal undertaking template to the assigned solicitor firm. The
                          solicitor will then review and submit it back.
                        </p>
                        {!summary.assignedFirmId ? (
                          <p className="text-xs text-amber-600 font-medium">
                            ⚠ Assign a solicitor firm before issuing the undertaking
                          </p>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                setActionLoading(true);
                                const result = await solicitorIntegrationService.issueUndertaking(
                                  applicationId,
                                  summary.solicitorCaseId!
                                );
                                setUndertaking(result);
                                toast.success('Undertaking issued to solicitor');
                              } catch (err: any) {
                                toast.error(err.message ?? 'Failed to issue undertaking');
                              } finally {
                                setActionLoading(false);
                              }
                            }}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            Issue Undertaking to Solicitor
                          </button>
                        )}
                      </div>
                    )}

                    {/* Bank: awaiting solicitor */}
                    {(uStatus === 'ISSUED' || uStatus === 'VIEWED') && (
                      <p className="text-sm text-slate-500 italic">
                        Waiting for the solicitor to review and submit the undertaking.
                      </p>
                    )}

                    {/* Bank: review after solicitor submits */}
                    {uStatus === 'SUBMITTED' && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">
                          Review Submitted Undertaking
                        </p>
                        <div className="flex gap-3 flex-wrap">
                          <button
                            onClick={handleAcceptUndertaking}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <div className="flex gap-2 flex-1 min-w-[200px]">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              placeholder="Rejection reason (required)..."
                              className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                            />
                            <button
                              onClick={handleRejectUndertaking}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Accepted */}
                    {uStatus === 'ACCEPTED' && (
                      <p className="text-sm text-green-700 font-medium">
                        ✓ Undertaking accepted by Bank Legal
                      </p>
                    )}

                    {/* Rejected — allow re-issue */}
                    {uStatus === 'REJECTED' && (
                      <div className="space-y-2">
                        <p className="text-sm text-red-600 font-medium">
                          Undertaking was rejected.
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              setActionLoading(true);
                              const result = await solicitorIntegrationService.issueUndertaking(
                                applicationId,
                                summary.solicitorCaseId!
                              );
                              setUndertaking(result);
                              toast.success('New undertaking issued');
                            } catch (err: any) {
                              toast.error(err.message ?? 'Failed');
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          Re-issue Undertaking
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </SectionCard>
      )}

      {/* ── CERTIFICATE OF TITLE ────────────────────────────────────────────── */}
      {activeSection === 'certificate' && (
        <SectionCard title="Certificate of Title">
          {!summary?.solicitorCaseId ? (
            <p className="text-sm text-slate-500">No solicitor case exists yet</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusPill
                  status={summary.checklist.certificateAccepted ? 'ACCEPTED' : 'PENDING'}
                />
                <p className="text-sm text-slate-600">
                  {summary.checklist.certificateAccepted
                    ? 'Certificate of Title accepted by Bank Legal'
                    : 'Awaiting solicitor submission or bank review'}
                </p>
              </div>
              {!summary.checklist.certificateAccepted && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-700">Review Certificate</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleAcceptCertificate}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      Accept Certificate
                    </button>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Rejection reason..."
                        className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                      />
                      <button
                        onClick={handleRejectCertificate}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── DRAWDOWN ────────────────────────────────────────────────────────── */}
      {activeSection === 'drawdown' && (
        <SectionCard title="Drawdown Requests">
          {drawdownHistory.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No drawdown requests yet</p>
          ) : (
            <div className="space-y-3">
              {drawdownHistory.map(req => (
                <div key={req.id} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {new Intl.NumberFormat('en-IE', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(req.requestedAmount)}
                    </p>
                    <StatusPill status={req.status} />
                  </div>
                  {req.purpose && <p className="text-xs text-slate-500">Purpose: {req.purpose}</p>}
                  {req.createdAt && (
                    <p className="text-xs text-slate-400 mt-1">
                      Requested: {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  )}
                  {req.status === 'PENDING_BANK_APPROVAL' && summary?.solicitorCaseId && (
                    <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={async () => {
                          try {
                            setActionLoading(true);
                            await solicitorIntegrationService.acceptDrawdownRequest(
                              summary.solicitorCaseId!,
                              req.id
                            );
                            toast.success('Drawdown approved');
                            setDrawdownHistory(prev =>
                              prev.map(r => (r.id === req.id ? { ...r, status: 'APPROVED' } : r))
                            );
                          } catch (err: any) {
                            toast.error(err.message ?? 'Failed');
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          const reason = window.prompt('Rejection reason:');
                          if (!reason) return;
                          try {
                            setActionLoading(true);
                            await solicitorIntegrationService.rejectDrawdownRequest(
                              summary.solicitorCaseId!,
                              req.id,
                              reason
                            );
                            toast.success('Drawdown rejected');
                            setDrawdownHistory(prev =>
                              prev.map(r => (r.id === req.id ? { ...r, status: 'REJECTED' } : r))
                            );
                          } catch (err: any) {
                            toast.error(err.message ?? 'Failed');
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── QUERIES ─────────────────────────────────────────────────────────── */}
      {activeSection === 'queries' && (
        <SectionCard
          title="Solicitor Queries"
          action={
            summary?.solicitorCaseId ? (
              <button
                onClick={() => setShowNewQueryForm(v => !v)}
                className="px-3 py-1.5 text-xs bg-[#7f2b7b] text-white rounded-lg hover:bg-[#6b2568] font-medium"
              >
                + New Query
              </button>
            ) : undefined
          }
        >
          {!summary?.solicitorCaseId ? (
            <p className="text-sm text-slate-500">No solicitor case exists yet</p>
          ) : queriesLoading ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading queries…</p>
          ) : (
            <div className="space-y-4">
              {/* New query form */}
              {showNewQueryForm && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-medium text-slate-800">New Query</p>
                  <input
                    type="text"
                    placeholder="Subject"
                    value={newQuerySubject}
                    onChange={e => setNewQuerySubject(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                  />
                  <textarea
                    placeholder="Message"
                    value={newQueryMessage}
                    onChange={e => setNewQueryMessage(e.target.value)}
                    rows={3}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!newQuerySubject.trim() || !newQueryMessage.trim()) {
                          toast.warn('Subject and message are required');
                          return;
                        }
                        try {
                          setActionLoading(true);
                          await solicitorIntegrationService.createQuery(
                            applicationId,
                            summary.solicitorCaseId!,
                            newQuerySubject,
                            newQueryMessage
                          );
                          toast.success('Query sent to solicitor');
                          setShowNewQueryForm(false);
                          setNewQuerySubject('');
                          setNewQueryMessage('');
                          await loadQueries(summary.solicitorCaseId!);
                        } catch (err: any) {
                          toast.error(err.message ?? 'Failed to create query');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-[#7f2b7b] text-white rounded-lg text-sm font-medium hover:bg-[#6b2568] disabled:opacity-50"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => setShowNewQueryForm(false)}
                      className="px-4 py-2 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {queries.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No queries raised yet</p>
              ) : (
                queries.map(thread => {
                  const isOpen = expandedQueryId === thread.id;
                  const statusColor: Record<string, string> = {
                    OPEN: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                    AWAITING_SOLICITOR: 'bg-blue-100 text-blue-700 border-blue-200',
                    AWAITING_BANK: 'bg-purple-100 text-purple-700 border-purple-200',
                    CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
                    IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
                  };
                  const pillClass =
                    statusColor[thread.status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
                  return (
                    <div
                      key={thread.id}
                      className="border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedQueryId(isOpen ? null : thread.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {thread.subject}
                          </span>
                          <span
                            className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${pillClass}`}
                          >
                            {thread.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                          <p className="text-xs text-slate-400 pt-2">
                            {thread.queryType && (
                              <span className="mr-2 font-medium">
                                {thread.queryType.replace(/_/g, ' ')}
                              </span>
                            )}
                            {thread.createdAt && new Date(thread.createdAt).toLocaleString()}
                          </p>
                          {(thread.messages ?? []).length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No messages yet</p>
                          ) : (
                            <div className="space-y-2">
                              {(thread.messages ?? []).map(msg => (
                                <div
                                  key={msg.id}
                                  className={`rounded-lg p-3 text-sm ${
                                    msg.senderType === 'BANK_USER'
                                      ? 'bg-[#7f2b7b]/10 ml-4'
                                      : 'bg-slate-50 mr-4'
                                  }`}
                                >
                                  <p className="text-xs font-medium text-slate-600 mb-1">
                                    {msg.senderType === 'BANK_USER' ? 'Bank' : 'Solicitor'}
                                    {msg.createdAt && (
                                      <span className="ml-1 font-normal text-slate-400">
                                        · {new Date(msg.createdAt).toLocaleString()}
                                      </span>
                                    )}
                                    {msg.internalOnly && (
                                      <span className="ml-2 text-purple-600">(Internal)</span>
                                    )}
                                  </p>
                                  <p className="text-slate-800">{msg.messageBody}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── CREATE CASE MODAL ─────────────────────────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Create Solicitor Case</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-slate-400 hover:text-slate-600"
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
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Security Type
                </label>
                <select
                  value={createForm.securityType ?? ''}
                  onChange={e => setCreateForm(prev => ({ ...prev, securityType: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                >
                  <option value="">Select...</option>
                  <option value="RESIDENTIAL_PROPERTY">Residential Property</option>
                  <option value="COMMERCIAL_PROPERTY">Commercial Property</option>
                  <option value="LAND">Land</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  value={createForm.propertyAddress ?? ''}
                  onChange={e =>
                    setCreateForm(prev => ({ ...prev, propertyAddress: e.target.value }))
                  }
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                  placeholder="e.g. 14 Main Street, Dublin 2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Notes</label>
                <textarea
                  value={createForm.notes ?? ''}
                  onChange={e => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                  placeholder="Optional instructions..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl text-sm font-medium hover:bg-[#6b2568] disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN FIRM MODAL ─────────────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Assign Solicitor Firm</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600"
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
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Select Firm</label>
              <select
                value={selectedFirmId}
                onChange={e => setSelectedFirmId(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
              >
                <option value="">Select a firm...</option>
                {firms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.firmName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignFirm}
                disabled={actionLoading || !selectedFirmId}
                className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl text-sm font-medium hover:bg-[#6b2568] disabled:opacity-50"
              >
                {actionLoading ? 'Assigning...' : 'Assign & Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
