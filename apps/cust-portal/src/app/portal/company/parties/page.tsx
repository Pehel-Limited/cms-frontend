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
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/portal/company')}
            className="text-gray-400 hover:text-gray-600"
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
            <h2 className="text-2xl font-bold text-gray-900">People &amp; Roles</h2>
            <p className="text-sm text-gray-500">
              Manage directors, shareholders, UBOs and authorized signatories
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setModalMode('add');
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Party
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Validation Banner */}
      {validation && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            validation.isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`text-lg ${validation.isComplete ? 'text-green-600' : 'text-amber-500'}`}
            >
              {validation.isComplete ? '✓' : '⚠'}
            </span>
            <div className="flex-1">
              <h3
                className={`text-sm font-semibold ${validation.isComplete ? 'text-green-800' : 'text-amber-800'}`}
              >
                {validation.isComplete ? 'Party requirements met' : 'Action required'}
              </h3>
              {!validation.isComplete && validation.issues.length > 0 && (
                <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                  {validation.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
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
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-500">Filter by role:</label>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Roles</option>
          {AVAILABLE_ROLES.map(r => (
            <option key={r} value={r}>
              {PARTY_ROLE_LABELS[r] || r}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-400">
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Members Table */}
      {activeParties.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ownership</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Signatory</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">UBO</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeParties.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{m.customerName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{m.customerEmail || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {PARTY_ROLE_LABELS[m.role] || m.role}
                    </span>
                    {m.roleTitle && (
                      <div className="text-xs text-gray-400 mt-0.5">{m.roleTitle}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.ownershipPercentage != null ? `${m.ownershipPercentage}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.isAuthorizedSignatory ? (
                      <span className="text-green-600 font-medium">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.isBeneficialOwner ? (
                      <span className="text-green-600 font-medium">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingMember(m);
                          setModalMode('edit');
                        }}
                        className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(m.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
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
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-4xl mb-3">👥</div>
          <h3 className="text-gray-900 font-semibold">No active parties</h3>
          <p className="text-sm text-gray-500 mt-1">
            Add directors, shareholders and signatories to your company.
          </p>
        </div>
      )}

      {/* Inactive members */}
      {inactiveParties.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Inactive Members</h3>
          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
            {inactiveParties.map(m => (
              <div
                key={m.id}
                className="px-4 py-3 flex items-center justify-between text-sm text-gray-500"
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
          <h3 className="text-lg font-semibold text-gray-900">Confirm Removal</h3>
          <p className="mt-2 text-sm text-gray-600">
            Are you sure you want to remove this party member? This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Removing...' : 'Remove'}
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
      <h3 className="text-lg font-semibold text-gray-900">
        {mode === 'add' ? 'Add Party Member' : 'Edit Party Member'}
      </h3>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* Customer ID (add only) */}
        {mode === 'add' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.customerId}
              onChange={e => handleChange('customerId', e.target.value)}
              placeholder="UUID of existing customer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              The customer must already exist in the system
            </p>
          </div>
        )}

        {mode === 'edit' && member && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900">
              {member.customerName || 'Unknown'}
            </div>
            <div className="text-xs text-gray-500">{member.customerEmail || member.customerId}</div>
          </div>
        )}

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={form.role}
            onChange={e => handleChange('role', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Title / Position</label>
          <input
            type="text"
            value={form.roleTitle}
            onChange={e => handleChange('roleTitle', e.target.value)}
            placeholder="e.g. Managing Director, CFO"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Ownership */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ownership %</label>
            <input
              type="number"
              value={form.ownershipPercentage}
              onChange={e => handleChange('ownershipPercentage', e.target.value)}
              min={0}
              max={100}
              step={0.01}
              placeholder="e.g. 25.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date</label>
            <input
              type="date"
              value={form.appointmentDate}
              onChange={e => handleChange('appointmentDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAuthorizedSignatory}
              onChange={e => handleChange('isAuthorizedSignatory', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Authorized Signatory</span>
          </label>

          {form.isAuthorizedSignatory && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Signing Limit ({getCurrencySymbol()})
              </label>
              <input
                type="number"
                value={form.signingLimit}
                onChange={e => handleChange('signingLimit', e.target.value)}
                min={0}
                placeholder="e.g. 5000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isBeneficialOwner}
              onChange={e => handleChange('isBeneficialOwner', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Ultimate Beneficial Owner (UBO)</span>
          </label>
          {form.isBeneficialOwner && (
            <p className="ml-6 text-xs text-gray-500">
              Person who directly or indirectly owns &ge;25% of the entity or exercises significant
              control.
            </p>
          )}
        </div>

        {/* Status (edit only) */}
        {mode === 'edit' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => handleChange('isActive', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium shadow-sm"
        >
          {saving ? 'Saving...' : mode === 'add' ? 'Add Member' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Modal Shell ───────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
}
