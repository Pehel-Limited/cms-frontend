'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  teamService,
  type TeamMember,
  type TeamListResponse,
  type PortalRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_COLORS,
} from '@/services/api/team-service';

// ─── Component ──────────────────────────────────────────────────────

export default function TeamPage() {
  const [data, setData] = useState<TeamListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<PortalRole>('VIEWER');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Role edit
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<PortalRole>('VIEWER');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Remove
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    try {
      setLoading(true);
      setError(null);
      const res = await teamService.listTeam();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load team';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      await teamService.invite({
        email: inviteEmail,
        role: inviteRole,
        name: inviteName || undefined,
      });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('VIEWER');
      setTimeout(() => setInviteSuccess(null), 4000);
      setShowInvite(false);
      loadTeam();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invite';
      setError(msg);
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateRole(memberId: string) {
    try {
      setUpdatingRole(true);
      await teamService.updateRole(memberId, editRole);
      setEditingMemberId(null);
      loadTeam();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update role';
      setError(msg);
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handleRemove(memberId: string) {
    try {
      setRemoving(true);
      await teamService.removeMember(memberId);
      setConfirmRemoveId(null);
      loadTeam();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member';
      setError(msg);
    } finally {
      setRemoving(false);
    }
  }

  // ─── Loading / Error / Not business ────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium mb-2">Unable to load team</p>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-gray-500 text-sm mt-3">
            This feature is only available for business customers.
          </p>
          <Link
            href="/portal/company"
            className="inline-block mt-4 text-blue-600 hover:underline text-sm"
          >
            ← Back to Company
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const canManage = data.canManageTeam;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/portal/company" className="hover:text-blue-600">
              Company
            </Link>
            <span>/</span>
            <span className="text-gray-900">Team Management</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data.entityName || 'Company'} — Team
          </h1>
          <p className="text-gray-500 mt-1">
            {data.totalMembers} member{data.totalMembers !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Success banner */}
      {inviteSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {inviteSuccess}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Role legend */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(ROLE_LABELS) as PortalRole[]).map(role => (
          <div key={role} className="p-3 bg-white border border-gray-200 rounded-lg">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role]}`}
            >
              {ROLE_LABELS[role]}
            </span>
            <p className="text-xs text-gray-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {/* Team members table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Portal Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attributes
              </th>
              {canManage && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.members.map(member => (
              <tr key={member.id} className={member.isCurrentUser ? 'bg-blue-50/50' : ''}>
                {/* Name / email */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                      {(member.name || member.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.name || '—'}
                        {member.isCurrentUser && (
                          <span className="ml-2 text-xs text-blue-600 font-normal">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{member.email || '—'}</p>
                    </div>
                  </div>
                </td>

                {/* Entity role */}
                <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                  {member.entityRole?.toLowerCase() || '—'}
                </td>

                {/* Portal role */}
                <td className="px-4 py-3">
                  {editingMemberId === member.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as PortalRole)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        {(Object.keys(ROLE_LABELS) as PortalRole[]).map(r => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleUpdateRole(member.id)}
                        disabled={updatingRole}
                        className="text-xs text-green-600 hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMemberId(null)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.portalRole]}`}
                    >
                      {ROLE_LABELS[member.portalRole] || member.portalRole}
                    </span>
                  )}
                </td>

                {/* Attributes */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {member.isAuthorizedSignatory && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        Signatory
                      </span>
                    )}
                    {member.isBeneficialOwner && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                        Beneficial Owner
                      </span>
                    )}
                    {member.ownershipPercentage != null && member.ownershipPercentage > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {member.ownershipPercentage}% ownership
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    {member.isCurrentUser ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-red-600">Remove?</span>
                        <button
                          onClick={() => handleRemove(member.id)}
                          disabled={removing}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => {
                            setEditingMemberId(member.id);
                            setEditRole(member.portalRole);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(member.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {data.members.length === 0 && (
              <tr>
                <td
                  colSpan={canManage ? 5 : 4}
                  className="px-4 py-8 text-center text-gray-500 text-sm"
                >
                  No team members found. Add members via the Company &gt; Parties page first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Your role badge */}
      <div className="mt-4 text-sm text-gray-500">
        Your portal role:{' '}
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[data.currentUserRole]}`}
        >
          {ROLE_LABELS[data.currentUserRole]}
        </span>
      </div>

      {/* ─── Invite Modal ──────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
              <button
                onClick={() => setShowInvite(false)}
                className="text-gray-400 hover:text-gray-600"
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
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portal Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as PortalRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {(Object.keys(ROLE_LABELS) as PortalRole[]).map(r => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
