'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  partyService,
  PartyMember,
  PartyValidation,
  AddPartyPayload,
  UpdatePartyPayload,
  PARTY_ROLE_LABELS,
} from '@/services/api/party-service';
import { getCurrencySymbol } from '@/lib/format';

// ─── Types ─────────────────────────────────────────────────────

type ModalMode = null | 'add' | 'edit';

const AVAILABLE_ROLES = [
  'DIRECTOR',
  'SHAREHOLDER',
  'SECRETARY',
  'PARTNER',
  'BENEFICIAL_OWNER',
  'AUTHORIZED_SIGNATORY',
  'TRUSTEE',
  'MEMBER',
  'OTHER',
];

// ─── Page ──────────────────────────────────────────────────────

export default function PartiesPage() {
  const router = useRouter();
  const [parties, setParties] = useState<PartyMember[]>([]);
  const [validation, setValidation] = useState<PartyValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingMember, setEditingMember] = useState<PartyMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter
  const [roleFilter, setRoleFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [members, val] = await Promise.all([
        partyService.listParties(),
        partyService.validateParties(),
      ]);
      setParties(members);
      setValidation(val);
    } catch (err: any) {
      if (err.status === 403) {
        setError('You must be a business customer to manage company parties.');
      } else {
        setError(err.message || 'Failed to load parties');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function handleDelete(memberId: string) {
    try {
      setSaving(true);
      await partyService.removeParty(memberId);
      setDeleteConfirmId(null);
      showSuccess('Party member removed');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setSaving(false);
    }
  }

  const filtered = roleFilter ? parties.filter(p => p.role === roleFilter) : parties;

  const activeParties = filtered.filter(p => p.isActive);
  const inactiveParties = filtered.filter(p => !p.isActive);

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="spinner h-8 w-8"
          style={{ color: 'var(--brand)' }}
          role="status"
          aria-label="Loading people and roles"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/portal/company')}
            className="icon-btn"
            aria-label="Back to company profile"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h2
              className="text-xl font-bold tracking-tight sm:text-2xl"
              style={{ color: 'var(--text-primary)' }}
            >
              People &amp; roles
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Manage directors, shareholders, UBOs and authorized signatories
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setModalMode('add');
          }}
          className="btn btn-primary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add party
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success mb-4" role="status">
          {successMsg}
        </div>
      )}

      {/* Validation Banner */}
      {validation && (
        <div
          className={`alert mb-6 items-start ${validation.isComplete ? 'alert-success' : 'alert-warning'}`}
        >
          <span className="text-lg leading-none">{validation.isComplete ? '✓' : '⚠'}</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">
              {validation.isComplete ? 'Party requirements met' : 'Action required'}
            </h3>
            {!validation.isComplete && validation.issues.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-sm">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-xs opacity-80">
              <span>
                {validation.summary.directors} Director
                {validation.summary.directors !== 1 ? 's' : ''}
              </span>
              <span>
                {validation.summary.shareholders} Shareholder
                {validation.summary.shareholders !== 1 ? 's' : ''}
              </span>
              <span>
                {validation.summary.ubos} UBO{validation.summary.ubos !== 1 ? 's' : ''} (
                {validation.summary.totalUboOwnership}%)
              </span>
              <span>
                {validation.summary.signatories} Signator
                {validation.summary.signatories !== 1 ? 'ies' : 'y'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm" style={{ color: 'var(--text-muted)' }} htmlFor="role-filter">
          Filter by role
        </label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="select w-auto min-w-[10rem]"
        >
          <option value="">All roles</option>
          {AVAILABLE_ROLES.map(r => (
            <option key={r} value={r}>
              {PARTY_ROLE_LABELS[r] || r}
            </option>
          ))}
        </select>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Members Table */}
      {activeParties.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Ownership</th>
                  <th className="text-center">Signatory</th>
                  <th className="text-center">UBO</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeParties.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {m.customerName || 'Unknown'}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {m.customerEmail || ''}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {PARTY_ROLE_LABELS[m.role] || m.role}
                      </span>
                      {m.roleTitle && (
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {m.roleTitle}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {m.ownershipPercentage != null ? `${m.ownershipPercentage}%` : '—'}
                    </td>
                    <td className="text-center">
                      {m.isAuthorizedSignatory ? (
                        <span className="font-medium text-emerald-500">✓</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {m.isBeneficialOwner ? (
                        <span className="font-medium text-emerald-500">✓</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingMember(m);
                            setModalMode('edit');
                          }}
                          className="btn btn-ghost btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="btn btn-ghost btn-sm text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon text-2xl">👥</div>
          <h3 className="empty-state-title">No active parties</h3>
          <p className="empty-state-text">
            Add directors, shareholders and signatories to your company.
          </p>
        </div>
      )}

      {/* Inactive members */}
      {inactiveParties.length > 0 && (
        <div className="mt-6">
          <h3 className="section-title mb-2">Inactive members</h3>
          <div
            className="divide-token overflow-hidden rounded-xl border"
            style={{
              backgroundColor: 'var(--surface-input)',
              borderColor: 'var(--surface-border)',
            }}
          >
            {inactiveParties.map(m => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>
                  {m.customerName || 'Unknown'} — {PARTY_ROLE_LABELS[m.role] || m.role}
                </span>
                <span className="text-xs">Resigned {m.resignationDate || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <Modal onClose={() => setDeleteConfirmId(null)}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Confirm removal
          </h3>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to remove this party member? This action cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setDeleteConfirmId(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={saving}
              className="btn btn-danger"
            >
              {saving ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </Modal>
      )}

      {/* Add/Edit Modal */}
      {modalMode && (
        <PartyModal
          mode={modalMode}
          member={editingMember}
          onClose={() => {
            setModalMode(null);
            setEditingMember(null);
          }}
          onSaved={() => {
            setModalMode(null);
            setEditingMember(null);
            showSuccess(modalMode === 'add' ? 'Party member added' : 'Party member updated');
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ─── Add/Edit Modal ────────────────────────────────────────────

function PartyModal({
  mode,
  member,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  member: PartyMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerId: member?.customerId || '',
    role: member?.role || 'DIRECTOR',
    roleTitle: member?.roleTitle || '',
    ownershipPercentage: member?.ownershipPercentage?.toString() || '',
    isAuthorizedSignatory: member?.isAuthorizedSignatory || false,
    signingLimit: member?.signingLimit?.toString() || '',
    isBeneficialOwner: member?.isBeneficialOwner || false,
    appointmentDate: member?.appointmentDate || '',
    isActive: member?.isActive ?? true,
  });

  function handleChange(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError(null);

      if (mode === 'add') {
        if (!form.customerId.trim()) {
          setError('Customer ID is required');
          return;
        }
        const payload: AddPartyPayload = {
          customerId: form.customerId.trim(),
          role: form.role,
          roleTitle: form.roleTitle || undefined,
          ownershipPercentage: form.ownershipPercentage
            ? parseFloat(form.ownershipPercentage)
            : undefined,
          isAuthorizedSignatory: form.isAuthorizedSignatory || undefined,
          signingLimit: form.signingLimit ? parseFloat(form.signingLimit) : undefined,
          isBeneficialOwner: form.isBeneficialOwner || undefined,
          appointmentDate: form.appointmentDate || undefined,
        };
        await partyService.addParty(payload);
      } else if (member) {
        const payload: UpdatePartyPayload = {
          role: form.role,
          roleTitle: form.roleTitle || undefined,
          ownershipPercentage: form.ownershipPercentage
            ? parseFloat(form.ownershipPercentage)
            : undefined,
          isAuthorizedSignatory: form.isAuthorizedSignatory,
          signingLimit: form.signingLimit ? parseFloat(form.signingLimit) : undefined,
          isBeneficialOwner: form.isBeneficialOwner,
          appointmentDate: form.appointmentDate || undefined,
          isActive: form.isActive,
        };
        await partyService.updateParty(member.id, payload);
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {mode === 'add' ? 'Add party member' : 'Edit party member'}
      </h3>

      {error && (
        <div className="alert alert-error mt-3" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* Customer ID (add only) */}
        {mode === 'add' && (
          <div>
            <label className="field-label" htmlFor="party-customer-id">
              Customer ID <span className="text-red-500">*</span>
            </label>
            <input
              id="party-customer-id"
              type="text"
              value={form.customerId}
              onChange={e => handleChange('customerId', e.target.value)}
              placeholder="UUID of existing customer"
              className="input"
            />
            <p className="field-hint">The customer must already exist in the system</p>
          </div>
        )}

        {mode === 'edit' && member && (
          <div
            className="rounded-xl border p-3"
            style={{
              backgroundColor: 'var(--surface-input)',
              borderColor: 'var(--surface-border)',
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {member.customerName || 'Unknown'}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {member.customerEmail || member.customerId}
            </div>
          </div>
        )}

        {/* Role */}
        <div>
          <label className="field-label" htmlFor="party-role">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            id="party-role"
            value={form.role}
            onChange={e => handleChange('role', e.target.value)}
            className="select"
          >
            {AVAILABLE_ROLES.map(r => (
              <option key={r} value={r}>
                {PARTY_ROLE_LABELS[r] || r}
              </option>
            ))}
          </select>
        </div>

        {/* Role Title */}
        <div>
          <label className="field-label" htmlFor="party-role-title">
            Title / position
          </label>
          <input
            id="party-role-title"
            type="text"
            value={form.roleTitle}
            onChange={e => handleChange('roleTitle', e.target.value)}
            placeholder="e.g. Managing Director, CFO"
            className="input"
          />
        </div>

        {/* Ownership */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="party-ownership">
              Ownership %
            </label>
            <input
              id="party-ownership"
              type="number"
              value={form.ownershipPercentage}
              onChange={e => handleChange('ownershipPercentage', e.target.value)}
              min={0}
              max={100}
              step={0.01}
              placeholder="e.g. 25.5"
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="party-appointment-date">
              Appointment date
            </label>
            <input
              id="party-appointment-date"
              type="date"
              value={form.appointmentDate}
              onChange={e => handleChange('appointmentDate', e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.isAuthorizedSignatory}
              onChange={e => handleChange('isAuthorizedSignatory', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
              style={{ borderColor: 'var(--surface-border-strong)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Authorized signatory
            </span>
          </label>

          {form.isAuthorizedSignatory && (
            <div className="ml-6">
              <label className="field-label" htmlFor="party-signing-limit">
                Signing limit ({getCurrencySymbol()})
              </label>
              <input
                id="party-signing-limit"
                type="number"
                value={form.signingLimit}
                onChange={e => handleChange('signingLimit', e.target.value)}
                min={0}
                placeholder="e.g. 500000"
                className="input"
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.isBeneficialOwner}
              onChange={e => handleChange('isBeneficialOwner', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
              style={{ borderColor: 'var(--surface-border-strong)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Ultimate beneficial owner (UBO)
            </span>
          </label>
          {form.isBeneficialOwner && (
            <p className="ml-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              Person who directly or indirectly owns &ge;25% of the entity or exercises significant
              control.
            </p>
          )}
        </div>

        {/* Status (edit only) */}
        {mode === 'edit' && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => handleChange('isActive', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
              style={{ borderColor: 'var(--surface-border-strong)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Active
            </span>
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : mode === 'add' ? 'Add member' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Modal Shell ───────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--surface-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
