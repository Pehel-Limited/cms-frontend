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
import { PageHero } from '@/components/ui/PageHero';

// ─── Types ─────────────────────────────────────────────────────

type ModalMode = null | 'add' | 'edit';

/** ISO date → readable locale date, falling back to the raw value. */
function formatDay(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

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
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="skeleton h-9 w-64" />
        <div className="skeleton h-5 w-96 max-w-full" />
        <div className="card p-0">
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        </div>
        <p className="sr-only" role="status">
          Loading people and roles
        </p>
      </div>
    );
  }

  /* A failed load must never read as "no people" — offer a retry instead. */
  if (error && parties.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero title="People and roles" />
        <div className="alert alert-error" role="alert">
          <div className="flex-1">
            <p className="text-base font-semibold">Could not load people and roles</p>
            <p className="mt-1 text-sm opacity-80">{error}</p>
          </div>
          <button onClick={loadData} className="btn btn-sm btn-outline shrink-0">
            Try again
          </button>
        </div>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h1
              className="serif text-[26px] font-medium leading-tight tracking-tight sm:text-[30px]"
              style={{ color: 'var(--text-primary)' }}
            >
              People and roles
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Manage directors, shareholders, beneficial owners and authorized signatories
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add person
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
          role="status"
        >
          <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={
                validation.isComplete
                  ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
              }
            />
          </svg>
          <div className="flex-1">
            <p className="text-base font-semibold">
              {validation.isComplete ? 'Company requirements met' : 'Action required'}
            </p>
            {!validation.isComplete && validation.issues.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-sm">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            <ul className="mt-3 flex flex-wrap gap-2">
              <li className="chip">
                {validation.summary.directors} director{validation.summary.directors !== 1 ? 's' : ''}
              </li>
              <li className="chip">
                {validation.summary.shareholders} shareholder
                {validation.summary.shareholders !== 1 ? 's' : ''}
              </li>
              <li className="chip">
                {validation.summary.ubos} beneficial owner{validation.summary.ubos !== 1 ? 's' : ''} ·{' '}
                <span className="tabular-nums">{validation.summary.totalUboOwnership}%</span> ownership
              </li>
              <li className="chip">
                {validation.summary.signatories} authorized signator
                {validation.summary.signatories !== 1 ? 'ies' : 'y'}
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
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
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Active people and roles, scrollable"
            tabIndex={0}
          >
            <table className="data-table min-w-full" aria-label="Active people and roles">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Ownership</th>
                  <th scope="col" className="text-center">Signatory</th>
                  <th scope="col" className="text-center">Beneficial owner</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeParties.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                        {m.customerName || 'Unknown'}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {m.customerEmail || ''}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {PARTY_ROLE_LABELS[m.role] || m.role}
                      </span>
                      {m.roleTitle && (
                        <div className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                          {m.roleTitle}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {m.ownershipPercentage != null ? `${m.ownershipPercentage}%` : '—'}
                    </td>
                    <td className="text-center">
                      {m.isAuthorizedSignatory ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No</span>
                      )}
                    </td>
                    <td className="text-center">
                      {m.isBeneficialOwner ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No</span>
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
                          Edit<span className="sr-only"> {m.customerName || 'member'}</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="btn btn-ghost btn-sm text-red-500 hover:text-red-600"
                        >
                          Remove<span className="sr-only"> {m.customerName || 'member'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : roleFilter ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="empty-state-title">No one has this role</p>
          <p className="empty-state-text">
            No active members match the selected role filter.
          </p>
          <button onClick={() => setRoleFilter('')} className="btn btn-secondary btn-sm mt-4">
            Clear filter
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a4 4 0 11-3-3.87" />
            </svg>
          </div>
          <p className="empty-state-title">No active people</p>
          <p className="empty-state-text">
            Add the directors, shareholders and signatories associated with your company.
          </p>
          <button
            onClick={() => {
              setEditingMember(null);
              setModalMode('add');
            }}
            className="btn btn-primary btn-sm mt-4"
          >
            Add person
          </button>
        </div>
      )}

      {/* Inactive members */}
      {inactiveParties.length > 0 && (
        <div className="mt-6">
          <h2 className="section-title mb-3">Inactive members</h2>
          <ul
            className="divide-token overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: 'var(--surface-input)',
              borderColor: 'var(--surface-border)',
            }}
          >
            {inactiveParties.map(m => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
              >
                <span className="text-base" style={{ color: 'var(--text-secondary)' }}>
                  {m.customerName || 'Unknown'} — {PARTY_ROLE_LABELS[m.role] || m.role}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {m.resignationDate ? `Resigned ${formatDay(m.resignationDate)}` : 'Resignation date not recorded'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <Modal onClose={() => setDeleteConfirmId(null)} labelledBy="confirm-remove-title">
          <h2
            id="confirm-remove-title"
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Confirm removal
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to remove this person? This action cannot be undone.
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
    <Modal onClose={onClose} labelledBy="party-modal-title">
      <h2
        id="party-modal-title"
        className="text-lg font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {mode === 'add' ? 'Add person' : 'Edit person'}
      </h2>

      {error && (
        <div className="alert alert-error mt-3" role="alert" id="party-modal-error">
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
              aria-describedby={`party-customer-id-hint${error ? ' party-modal-error' : ''}`}
              aria-invalid={error ? true : undefined}
            />
            <p className="field-hint" id="party-customer-id-hint">
              The customer must already exist in the system
            </p>
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
          <label className="flex cursor-pointer items-center gap-2" htmlFor="party-signatory">
            <input
              id="party-signatory"
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

          <label className="flex cursor-pointer items-center gap-2" htmlFor="party-ubo">
            <input
              id="party-ubo"
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
          <label className="flex cursor-pointer items-center gap-2" htmlFor="party-active">
            <input
              id="party-active"
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
          {saving ? 'Saving…' : mode === 'add' ? 'Add person' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Modal Shell ───────────────────────────────────────────────

function Modal({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  /* Escape closes the dialog, matching the rest of the portal's overlays */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
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
