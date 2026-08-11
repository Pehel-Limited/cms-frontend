'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { caseService } from '@/services/api/case-service';
import { useAppSelector } from '@/store/hooks';

// Tab components (defined below)
import ChecklistPanel from './panels/ChecklistPanel';
import DocumentsPanel from './panels/DocumentsPanel';
import UndertakingPanel from './panels/UndertakingPanel';
import CertificatePanel from './panels/CertificatePanel';
import DrawdownPanel from './panels/DrawdownPanel';
import QueriesPanel from './panels/QueriesPanel';
import AuditPanel from './panels/AuditPanel';
import OfferPanel from './panels/OfferPanel';

const TABS = [
  { key: 'offer', label: 'Offer Preview' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'documents', label: 'Documents' },
  { key: 'undertaking', label: 'Undertaking' },
  { key: 'certificate', label: 'Certificate' },
  { key: 'drawdown', label: 'Drawdown' },
  { key: 'queries', label: 'Queries' },
  { key: 'audit', label: 'Audit Trail' },
];

const statusColor: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  ISSUED_TO_SOLICITOR: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  ON_HOLD: 'bg-red-100 text-red-800',
};

export default function CaseWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector(s => s.auth.user);
  const isBankUser = user?.userType === 'BANK_USER';

  const [caseData, setCaseData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('offer');

  useEffect(() => {
    loadCase();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCase = async () => {
    try {
      const res = await caseService.getCase(id);
      setCaseData(res as unknown as Record<string, unknown>);
    } catch {
      toast.error('Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading case…</div>;
  }

  if (!caseData) {
    return <div className="text-red-600 p-6">Case not found or access denied.</div>;
  }

  const status = caseData.status as string;

  return (
    <div className="space-y-4">
      {/* Case Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {String(caseData.caseReference ?? '')}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {status?.replace(/_/g, ' ')}
              </span>
              {!!caseData.slaBreach && (
                <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 font-bold">
                  SLA BREACH
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{String(caseData.propertyAddress ?? '')}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>
              Borrower: <strong>{String(caseData.borrowerName ?? '—')}</strong>
            </p>
            <p>
              Loan:{' '}
              <strong>
                {caseData.loanAmount != null
                  ? `€${(caseData.loanAmount as number).toLocaleString()}`
                  : '—'}
              </strong>
            </p>
            <p>
              Assigned to: <strong>{String(caseData.assignedFirmName ?? 'Not assigned')}</strong>
            </p>
          </div>
        </div>

        {/* Readiness Flags */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <ReadinessFlag label="Checklist" ok={caseData.mandatoryChecklistComplete as boolean} />
          <ReadinessFlag label="Undertaking" ok={caseData.undertakingAccepted as boolean} />
          <ReadinessFlag label="Certificate" ok={caseData.certificateAccepted as boolean} />
          <ReadinessFlag label="Drawdown Eligible" ok={caseData.drawdownEligible as boolean} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'offer' && <OfferPanel caseData={caseData} />}
          {activeTab === 'checklist' && <ChecklistPanel caseId={id} isBankUser={isBankUser} />}
          {activeTab === 'documents' && <DocumentsPanel caseId={id} isBankUser={isBankUser} />}
          {activeTab === 'undertaking' && (
            <UndertakingPanel caseId={id} isBankUser={isBankUser} onRefresh={loadCase} />
          )}
          {activeTab === 'certificate' && (
            <CertificatePanel caseId={id} isBankUser={isBankUser} onRefresh={loadCase} />
          )}
          {activeTab === 'drawdown' && (
            <DrawdownPanel caseId={id} isBankUser={isBankUser} eligibilityData={caseData} />
          )}
          {activeTab === 'queries' && <QueriesPanel caseId={id} isSolicitor={!isBankUser} />}
          {activeTab === 'audit' && <AuditPanel caseId={id} />}
        </div>
      </div>
    </div>
  );
}

function ReadinessFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
    >
      <span>{ok ? '✓' : '○'}</span>
      {label}
    </span>
  );
}
