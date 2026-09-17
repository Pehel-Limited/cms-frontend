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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div
          className="spinner h-10 w-10"
          style={{ color: 'var(--brand)' }}
          role="status"
          aria-label="Loading team"
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="alert alert-error" role="alert">
          <div className="flex-1">
            <p className="font-semibold">Unable to load team</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 opacity-80">
              This feature is only available for business customers.
            </p>
            <Link href="/portal/company" className="btn btn-secondary btn-sm mt-4">
              ← Back to company
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const canManage = data.canManageTeam;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div
            className="mb-1 flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <Link href="/portal/company" className="transition-colors hover:underline">
              Company
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: 'var(--text-primary)' }}>Team management</span>
          </div>
          <h1
            className="text-xl font-bold tracking-tight sm:text-2xl"
            style={{ color: 'var(--text-primary)' }}
          >
            {data.entityName || 'Company'} — Team
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {data.totalMembers} member{data.totalMembers !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Invite member
          </button>
        )}
      </div>

      {/* Success banner */}
      {inviteSuccess && (
        <div className="alert alert-success mb-4" role="status">
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="alert alert-error mb-4" role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Role legend */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(ROLE_LABELS) as PortalRole[]).map(role => (
          <div key={role} className="card p-3">
            <span className={`badge ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
        ))}
      </div>

      {/* Team members table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Entity role</th>
                <th>Portal role</th>
                <th>Attributes</th>
                {canManage && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.members.map(member => (
                <tr
                  key={member.id}
                  style={
                    member.isCurrentUser ? { backgroundColor: 'var(--brand-soft)' } : undefined
                  }
                >
                  {/* Name / email */}
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: 'var(--brand-soft)',
                          color: 'var(--brand-on-soft)',
                        }}
                      >
                        {(member.name || member.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {member.name || '—'}
                          {member.isCurrentUser && (
                            <span
                              className="ml-2 text-xs font-normal"
                              style={{ color: 'var(--brand-on-soft)' }}
                            >
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {member.email || '—'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Entity role */}
                  <td className="capitalize">{member.entityRole?.toLowerCase() || '—'}</td>

                  {/* Portal role */}
                  <td>
                    {editingMemberId === member.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as PortalRole)}
                          className="select w-auto py-1.5 text-xs"
                          aria-label="Portal role"
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
                          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMemberId(null)}
                          className="text-xs hover:underline"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className={`badge ${ROLE_COLORS[member.portalRole]}`}>
                        {ROLE_LABELS[member.portalRole] || member.portalRole}
                      </span>
                    )}
                  </td>

                  {/* Attributes */}
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {member.isAuthorizedSignatory && (
                        <span className="badge badge-warning">Signatory</span>
                      )}
                      {member.isBeneficialOwner && (
                        <span className="badge badge-info">Beneficial owner</span>
                      )}
                      {member.ownershipPercentage != null && member.ownershipPercentage > 0 && (
                        <span className="badge badge-neutral">
                          {member.ownershipPercentage}% ownership
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="text-right">
                      {member.isCurrentUser ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          —
                        </span>
                      ) : confirmRemoveId === member.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-500">Remove?</span>
                          <button
                            onClick={() => handleRemove(member.id)}
                            disabled={removing}
                            className="text-xs font-medium text-red-500 hover:underline"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-xs hover:underline"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => {
                              setEditingMemberId(member.id);
                              setEditRole(member.portalRole);
                            }}
                            className="text-xs font-medium hover:underline"
                            style={{ color: 'var(--brand-on-soft)' }}
                          >
                            Change role
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(member.id)}
                            className="text-xs font-medium text-red-500 hover:underline"
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
                    className="py-8 text-center text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    No team members found. Add members via the Company &gt; Parties page first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Your role badge */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Your portal role:{' '}
        <span className={`badge ${ROLE_COLORS[data.currentUserRole]}`}>
          {ROLE_LABELS[data.currentUserRole]}
        </span>
      </div>

      {/* ─── Invite Modal ──────────────────────────────────────── */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Invite team member"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border"
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
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Invite team member
              </h3>
              <button
                onClick={() => setShowInvite(false)}
                className="icon-btn"
                aria-label="Close"
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
              <div>
                <label className="field-label" htmlFor="invite-email">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="input"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="invite-name">
                  Full name
                </label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="John Smith"
                  className="input"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="invite-role">
                  Portal role <span className="text-red-500">*</span>
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as PortalRole)}
                  className="select"
                >
                  {(Object.keys(ROLE_LABELS) as PortalRole[]).map(r => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div
              className="flex justify-end gap-2 px-6 py-4"
              style={{ borderTop: '1px solid var(--surface-border)' }}
            >
              <button onClick={() => setShowInvite(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="btn btn-primary"
              >
                {inviting ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
