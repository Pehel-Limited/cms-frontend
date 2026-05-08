'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  kycService,
  type KycCase,
  type Party,
  type PartyRelationship,
  type KycDocument,
  type ScreeningResult,
  type RiskAssessment,
  type KycCaseEvent,
} from '@/services/api/kycService';

type Tab = 'overview' | 'documents' | 'screening' | 'risk' | 'timeline';

export default function KycCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [partyGraph, setPartyGraph] = useState<PartyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (caseId) {
      loadCaseDetails();
    }
  }, [caseId]);

  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      const caseData = await kycService.getCase(caseId, true);
      setKycCase(caseData);

      // Load party and party graph if party exists
      if (caseData.partyId) {
        try {
          const [partyData, graph] = await Promise.all([
            kycService.getParty(caseData.partyId),
            kycService.getPartyGraph(caseData.partyId),
          ]);
          setParty(partyData);
          setPartyGraph(graph);
        } catch (e) {
          console.error('Failed to load party data:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load KYC case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusAction = async (action: string, reason?: string) => {
    if (!kycCase) return;

    try {
      setActionLoading(true);
      switch (action) {
        case 'approve':
          await kycService.approveCase(kycCase.caseId, reason);
          break;
        case 'reject':
          if (!reason) {
            const inputReason = prompt('Please provide a reason for rejection:');
            if (!inputReason) return;
            reason = inputReason;
          }
          await kycService.rejectCase(kycCase.caseId, reason);
          break;
        case 'escalate':
          if (!reason) {
            const inputReason = prompt('Please provide a reason for escalation:');
            if (!inputReason) return;
            reason = inputReason;
          }
          await kycService.escalateCase(kycCase.caseId, reason);
          break;
        case 'submit':
          await kycService.submitForReview(kycCase.caseId);
          break;
      }
      await loadCaseDetails();
    } catch (error) {
      console.error(`Failed to ${action} case:`, error);
      alert(`Failed to ${action} case`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocumentVerify = async (documentId: string) => {
    try {
      await kycService.verifyDocument(documentId);
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to verify document:', error);
    }
  };

  const handleDocumentReject = async (documentId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    try {
      await kycService.rejectDocument(documentId, reason);
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to reject document:', error);
    }
  };

  const handleScreeningReview = async (screeningId: string, status: string, decision: string) => {
    const notes = prompt('Add any review notes (optional):');
    try {
      await kycService.reviewScreeningHit(screeningId, status, decision, notes || undefined);
      await loadCaseDetails();
    } catch (error) {
      console.error('Failed to review screening:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (!kycCase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Case not found</p>
          <Link
            href="/dashboard/kyc/cases"
            className="text-primary-600 hover:underline mt-4 inline-block"
          >
            Back to Cases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{kycCase.caseReference}</h1>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${kycService.getStatusColor(kycCase.status)}`}
                >
                  {kycCase.statusDisplay}
                </span>
                {kycCase.isOverdue && (
                  <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                    Overdue
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {party?.customerId ? (
                  <Link
                    href={`/dashboard/customers/${party.customerId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {kycCase.partyDisplayName}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-700">{kycCase.partyDisplayName}</span>
                )}
                {' | '}
                {formatSegment(kycCase.customerSegment)} | {formatCaseType(kycCase.caseType)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/kyc/cases"
                className="text-sm text-gray-600 hover:text-primary-600 font-medium"
              >
                Back to Cases
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Action Bar */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Status indicators */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Risk:</span>
                {kycCase.riskTier ? (
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${kycService.getRiskTierColor(kycCase.riskTier)}`}
                  >
                    {kycCase.riskTier.replace('_', ' ')} ({kycCase.riskScore})
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Not assessed</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Diligence:</span>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${kycService.getDiligenceColor(kycCase.requiredDiligence)}`}
                >
                  {kycService.getDiligenceLabel(kycCase.requiredDiligence)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Due:</span>
                <span
                  className={`text-sm ${kycCase.isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}
                >
                  {kycCase.dueDate ? new Date(kycCase.dueDate).toLocaleDateString() : 'No due date'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {kycCase.status === 'DRAFT' && (
                <button
                  onClick={() => handleStatusAction('submit')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  Submit for Review
                </button>
              )}
              {['UNDER_REVIEW', 'PENDING_APPROVAL'].includes(kycCase.status) && (
                <>
                  <button
                    onClick={() => handleStatusAction('approve')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusAction('reject')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleStatusAction('escalate')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
                  >
                    Escalate
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {(['overview', 'documents', 'screening', 'risk', 'timeline'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'documents' && kycCase.documents && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                      {kycCase.documents.length}
                    </span>
                  )}
                  {tab === 'screening' && kycCase.screeningResults && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                      {kycCase.screeningResults.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'overview' && <OverviewTab kycCase={kycCase} partyGraph={partyGraph} />}
          {activeTab === 'documents' && (
            <DocumentsTab
              documents={kycCase.documents || []}
              onVerify={handleDocumentVerify}
              onReject={handleDocumentReject}
            />
          )}
          {activeTab === 'screening' && (
            <ScreeningTab
              screenings={kycCase.screeningResults || []}
              onReview={handleScreeningReview}
            />
          )}
          {activeTab === 'risk' && <RiskTab assessment={kycCase.riskAssessment} />}
          {activeTab === 'timeline' && <TimelineTab events={kycCase.events || []} />}
        </div>
      </main>
    </div>
  );
}

// Tab Components
function OverviewTab({
  kycCase,
  partyGraph,
}: {
  kycCase: KycCase;
  partyGraph: PartyRelationship[];
}) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case Details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Case Details</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Case Reference</dt>
              <dd className="text-sm font-medium text-gray-900">{kycCase.caseReference}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Case Type</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatCaseType(kycCase.caseType)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Customer Segment</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatSegment(kycCase.customerSegment)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Required Diligence</dt>
              <dd
                className={`text-sm font-medium ${kycService.getDiligenceColor(kycCase.requiredDiligence)} px-2 py-0.5 rounded`}
              >
                {kycService.getDiligenceLabel(kycCase.requiredDiligence)}
              </dd>
            </div>
            {kycCase.triggerReason && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Trigger Reason</dt>
                <dd className="text-sm font-medium text-gray-900">{kycCase.triggerReason}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm font-medium text-gray-900">
                {new Date(kycCase.createdAt).toLocaleString()}
              </dd>
            </div>
            {kycCase.dueDate && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Due Date</dt>
                <dd
                  className={`text-sm font-medium ${kycCase.isOverdue ? 'text-red-600' : 'text-gray-900'}`}
                >
                  {new Date(kycCase.dueDate).toLocaleString()}
                </dd>
              </div>
            )}
            {kycCase.nextReviewDate && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Next Review</dt>
                <dd className="text-sm font-medium text-gray-900">{kycCase.nextReviewDate}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Decision Details */}
        {kycCase.decision && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Decision</dt>
                <dd
                  className={`text-sm font-medium ${kycCase.decision === 'APPROVE' ? 'text-green-600' : 'text-red-600'}`}
                >
                  {kycCase.decision}
                </dd>
              </div>
              {kycCase.decisionReason && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Reason</dt>
                  <dd className="text-sm font-medium text-gray-900">{kycCase.decisionReason}</dd>
                </div>
              )}
              {kycCase.decidedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Decision Date</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {new Date(kycCase.decidedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Party Graph */}
        {partyGraph.length > 0 && (
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Party Graph (Relationships)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      From
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Relationship
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      To
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Ownership %
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Verified
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {partyGraph.map(rel => (
                    <tr key={rel.relationshipId}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {rel.fromPartyDisplayName}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {rel.relationshipTypeDisplay}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{rel.toPartyDisplayName}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {rel.ownershipPercentage ? `${rel.ownershipPercentage}%` : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {rel.isVerified ? (
                          <span className="inline-flex items-center text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({
  documents,
  onVerify,
  onReject,
}: {
  documents: KycDocument[];
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
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
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Document
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Issuing Authority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Expiry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {documents.map(doc => (
              <tr
                key={doc.documentId}
                className={doc.isExpired ? 'bg-red-50' : doc.isExpiringSoon ? 'bg-yellow-50' : ''}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{doc.documentName}</div>
                  {doc.documentNumber && (
                    <div className="text-xs text-gray-500">#{doc.documentNumber}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{doc.documentTypeDisplay}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {doc.issuingAuthority || '-'}
                  {doc.issuingCountry && ` (${doc.issuingCountry})`}
                </td>
                <td className="px-4 py-3">
                  {doc.expiryDate ? (
                    <span
                      className={`text-sm ${doc.isExpired ? 'text-red-600 font-semibold' : doc.isExpiringSoon ? 'text-yellow-600' : 'text-gray-600'}`}
                    >
                      {new Date(doc.expiryDate).toLocaleDateString()}
                      {doc.isExpired && ' (Expired)'}
                      {doc.isExpiringSoon && !doc.isExpired && ' (Expiring)'}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">No expiry</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocumentStatusColor(doc.status)}`}
                  >
                    {doc.statusDisplay}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {doc.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onVerify(doc.documentId)}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => onReject(doc.documentId)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {doc.fileReference && (
                    <a
                      href={`/api/documents/${doc.fileReference}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      View
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScreeningTab({
  screenings,
  onReview,
}: {
  screenings: ScreeningResult[];
  onReview: (id: string, status: string, decision: string) => void;
}) {
  if (screenings.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        No screening results yet.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {screenings.map(screening => (
          <div
            key={screening.screeningId}
            className={`border rounded-lg p-4 ${screening.hasHits ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium text-gray-900">{screening.screeningTypeDisplay}</h4>
                <p className="text-sm text-gray-500">
                  Provider: {screening.provider} | Screened:{' '}
                  {new Date(screening.screenedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {screening.hasHits ? (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                    {screening.matchCount} Hit(s)
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Clear
                  </span>
                )}
                {screening.matchStatus && (
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMatchStatusColor(screening.matchStatus)}`}
                  >
                    {screening.matchStatusDisplay}
                  </span>
                )}
              </div>
            </div>

            {/* Matches */}
            {screening.matches && screening.matches.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Matches</h5>
                <div className="space-y-2">
                  {screening.matches.map((match, idx) => (
                    <div key={idx} className="bg-white border rounded p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{match.name}</div>
                          <div className="text-sm text-gray-500">
                            List: {match.listName} ({match.listCategory})
                          </div>
                          {match.pepDetails && (
                            <div className="text-sm text-gray-500">
                              PEP: {match.pepDetails.position} - {match.pepDetails.country}
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium ${match.matchScore >= 90 ? 'text-red-600' : match.matchScore >= 70 ? 'text-orange-600' : 'text-yellow-600'}`}
                        >
                          {match.matchScore}% match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {screening.hasHits && screening.matchStatus === 'PENDING_REVIEW' && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    onReview(screening.screeningId, 'FALSE_POSITIVE', 'No match confirmed')
                  }
                  className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700"
                >
                  False Positive
                </button>
                <button
                  onClick={() =>
                    onReview(screening.screeningId, 'TRUE_POSITIVE', 'Match confirmed')
                  }
                  className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700"
                >
                  True Positive
                </button>
                <button
                  onClick={() =>
                    onReview(screening.screeningId, 'POSSIBLE', 'Requires further investigation')
                  }
                  className="px-3 py-1.5 text-sm font-medium bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Possible Match
                </button>
              </div>
            )}

            {/* Review Info */}
            {screening.reviewedAt && (
              <div className="mt-4 p-3 bg-gray-100 rounded">
                <div className="text-sm text-gray-600">
                  <strong>Review Decision:</strong> {screening.reviewDecision}
                </div>
                {screening.reviewNotes && (
                  <div className="text-sm text-gray-600 mt-1">
                    <strong>Notes:</strong> {screening.reviewNotes}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Reviewed on {new Date(screening.reviewedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskTab({ assessment }: { assessment?: RiskAssessment }) {
  if (!assessment) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        Risk assessment not yet performed.
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Overall Risk */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Overall Risk Assessment</h3>
            <p className="text-sm text-gray-500">
              Assessed on {new Date(assessment.assessedAt).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div
              className={`inline-flex px-4 py-2 text-xl font-bold rounded-full ${kycService.getRiskTierColor(assessment.riskTier)}`}
            >
              {assessment.riskTier.replace('_', ' ')}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              Score: {assessment.overallRiskScore}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Components */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <RiskScoreCard label="Customer" score={assessment.customerRiskScore} />
        <RiskScoreCard label="Geography" score={assessment.geographyRiskScore} />
        <RiskScoreCard label="Product" score={assessment.productRiskScore} />
        <RiskScoreCard label="Channel" score={assessment.channelRiskScore} />
        <RiskScoreCard label="Transaction" score={assessment.transactionRiskScore} />
      </div>

      {/* Diligence & Approval */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Applied Diligence</h4>
          <span
            className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${kycService.getDiligenceColor(assessment.appliedDiligence)}`}
          >
            {assessment.appliedDiligenceDisplay}
          </span>
        </div>

        {assessment.isOverridden && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Risk Override Applied</h4>
            <p className="text-sm text-yellow-700">Original tier: {assessment.originalRiskTier}</p>
            <p className="text-sm text-yellow-700">Reason: {assessment.overrideReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskScoreCard({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 70) return 'text-red-600 bg-red-50 border-red-200';
    if (s >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (s >= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className={`border rounded-lg p-4 text-center ${getColor(score)}`}>
      <div className="text-2xl font-bold">{score}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
    </div>
  );
}

function TimelineTab({ events }: { events: KycCaseEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        No events recorded yet.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flow-root">
        <ul className="-mb-8">
          {events.map((event, idx) => (
            <li key={event.eventId}>
              <div className="relative pb-8">
                {idx !== events.length - 1 && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getEventIconBg(event.eventType)}`}
                    >
                      {getEventIcon(event.eventType)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-gray-900">{event.eventTypeDisplay}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(event.performedAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{event.eventDescription}</p>
                    {event.notes && (
                      <p className="mt-1 text-sm text-gray-500 italic">Note: {event.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Helper functions
function formatSegment(segment: string): string {
  const map: Record<string, string> = {
    INDIVIDUAL: 'Individual',
    SOLE_TRADER: 'Sole Trader',
    COMPANY: 'Company',
    PARTNERSHIP: 'Partnership',
    TRUST: 'Trust',
    CHARITY: 'Charity',
    CLUB_ASSOCIATION: 'Club/Association',
  };
  return map[segment] || segment;
}

function formatCaseType(type: string): string {
  const map: Record<string, string> = {
    ONBOARDING: 'Onboarding',
    PERIODIC_REVIEW: 'Periodic Review',
    EVENT_DRIVEN: 'Event Driven',
    REMEDIATION: 'Remediation',
  };
  return map[type] || type;
}

function getDocumentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    VERIFIED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function getMatchStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
    TRUE_POSITIVE: 'bg-red-100 text-red-800',
    FALSE_POSITIVE: 'bg-green-100 text-green-800',
    POSSIBLE: 'bg-orange-100 text-orange-800',
    CLEARED: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function getEventIconBg(eventType: string): string {
  if (eventType.includes('CREATED') || eventType.includes('APPROVED')) return 'bg-green-500';
  if (eventType.includes('REJECTED')) return 'bg-red-500';
  if (eventType.includes('ESCALATED')) return 'bg-orange-500';
  if (eventType.includes('SCREENING')) return 'bg-blue-500';
  if (eventType.includes('DOCUMENT')) return 'bg-purple-500';
  if (eventType.includes('RISK')) return 'bg-yellow-500';
  return 'bg-gray-500';
}

function getEventIcon(eventType: string): React.ReactNode {
  // Simple icon based on event type
  return (
    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}
