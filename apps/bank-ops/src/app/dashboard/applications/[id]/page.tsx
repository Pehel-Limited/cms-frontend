'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAppSelector } from '@/store';
import {
  applicationService,
  ApplicationResponse,
  ApplicationNote,
} from '@/services/api/applicationService';
import { userService, User } from '@/services/api/userService';
import { ApplicationWorkflowPanel } from '@/components/workflow';
import { SolicitorTab } from '@/components/solicitor/SolicitorTab';
import { ApplicationAiSummaryTab } from '@/components/ai/ApplicationAiSummaryTab';
import { CreditMemoTab } from '@/components/ai/CreditMemoTab';
import { STATUS_CONFIG, type LomsApplicationStatus } from '@/types/loms';
import { formatCurrency } from '@/lib/format';

/* ── Shared status wording ──────────────────────────────────────────────
   Labels come from the shared LOMS status configuration so this page words
   a status exactly like the rest of the portal. Only the translucent tint is
   resolved locally (the shared config carries light-mode utility classes). */
const statusLabel = (status?: string): string => {
  if (!status) return 'Unknown';
  return STATUS_CONFIG[status as LomsApplicationStatus]?.label ?? status.replace(/_/g, ' ');
};

type Tone = { bg: string; fg: string; dot: string };
const TONES: Record<
  'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'offer' | 'booking',
  Tone
> = {
  neutral: { bg: 'rgba(127,127,127,0.14)', fg: 'var(--rm-text-secondary)', dot: '#94a3b8' },
  info: { bg: 'rgba(14,165,233,0.14)', fg: '#0284c7', dot: '#0ea5e9' },
  warning: { bg: 'rgba(245,158,11,0.15)', fg: '#b45309', dot: '#f59e0b' },
  success: { bg: 'rgba(16,185,129,0.14)', fg: '#047857', dot: '#10b981' },
  danger: { bg: 'rgba(239,68,68,0.13)', fg: '#b91c1c', dot: '#ef4444' },
  offer: { bg: 'rgba(139,92,246,0.15)', fg: '#6d28d9', dot: '#8b5cf6' },
  booking: { bg: 'rgba(99,102,241,0.15)', fg: '#4338ca', dot: '#6366f1' },
};

function statusTone(status?: string): Tone {
  const s = (status || '').toUpperCase();
  if (/DECLIN|REJECT|CANCEL|WITHDRAWN|EXPIRED|RETURNED/.test(s)) return TONES.danger;
  if (/BOOK|DISBURS/.test(s)) return TONES.booking;
  if (/OFFER|ESIGN/.test(s)) return TONES.offer;
  if (/APPROV|COMPLETED|RECEIVED|CONDITIONS_MET|^ACTIVE$|^CLOSED$/.test(s)) return TONES.success;
  if (/SUBMITTED/.test(s)) return TONES.info;
  if (/PENDING|UNDERWRIT|REFERRED|CREDIT_CHECK/.test(s)) return TONES.warning;
  return TONES.neutral;
}

const formatRoleName = (role: string): string =>
  role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

const formatDateTime = (value?: string): string =>
  value ? new Date(value).toLocaleString() : '—';

/* ── Form field styling ─────────────────────────────────────────────── */
const fieldCls = 'w-full rounded-xl px-4 py-2.5 text-base transition-colors';
const fieldStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  color: 'var(--rm-text)',
  border: '1px solid var(--rm-border)',
};
const fieldErrorStyle: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  color: 'var(--rm-text)',
  border: '1px solid rgba(239,68,68,0.55)',
};

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" style={{ color: '#dc2626' }}>
        {' '}
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm" style={{ color: '#b91c1c' }}>
      {message}
    </p>
  );
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
      {children}
      {required && <RequiredMark />}
    </label>
  );
}

interface BaseFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

function TextField({
  id,
  label,
  required,
  error,
  hint,
  ...rest
}: BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={fieldCls}
        style={error ? fieldErrorStyle : fieldStyle}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  required,
  error,
  hint,
  ...rest
}: BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${fieldCls} resize-y`}
        style={error ? fieldErrorStyle : fieldStyle}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function SelectField({
  id,
  label,
  required,
  error,
  hint,
  children,
  ...rest
}: BaseFieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <select
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={fieldCls}
        style={error ? fieldErrorStyle : fieldStyle}
        {...rest}
      >
        {children}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/* ── Action dialog ──────────────────────────────────────────────────── */
type ModalType = 'approve' | 'reject' | 'assign' | 'return' | 'note' | 'cancel';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: Record<string, unknown>) => void;
  title: string;
  type: ModalType;
  loading: boolean;
  submitError: string | null;
  application?: ApplicationResponse | null;
}

function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  type,
  loading,
  submitError,
  application,
}: ActionModalProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [underwriters, setUnderwriters] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `action-modal-title-${type}`;
  const listboxId = 'assign-underwriter-options';

  // Initialize form data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    if (type === 'approve' && application) {
      setFormData({
        approvedAmount: application.requestedAmount || '',
        approvedTermMonths: application.requestedTermMonths || '',
        approvedInterestRate: application.requestedInterestRate ?? '',
        approvalNotes: '',
      });
    } else if (type === 'assign') {
      loadUnderwriters();
      setSearchQuery('');
      setFormData({});
    } else {
      setFormData({});
    }
    // Move focus into the dialog once it is on screen.
    const t = window.setTimeout(() => {
      const node = dialogRef.current;
      if (!node) return;
      const first = node.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea'
      );
      (first ?? node).focus();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type, application]);

  // Debounced search effect
  useEffect(() => {
    if (type !== 'assign' || !isOpen) return;
    const timeoutId = setTimeout(() => {
      if (searchQuery || showDropdown) {
        loadUnderwriters(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, type, showDropdown, isOpen]);

  const loadUnderwriters = async (search?: string) => {
    try {
      setSearchLoading(true);
      setSearchError(null);
      const users = await userService.getUnderwriters(search);
      // Segregation of duties: exclude the application creator from the underwriter list
      const creatorId = application?.createdByUserId;
      setUnderwriters(creatorId ? users.filter(u => u.userId !== creatorId) : users);
    } catch (error) {
      console.error('Failed to load underwriters:', error);
      setUnderwriters([]);
      // Scoped: the dialog stays usable and the reviewer can retry the lookup.
      setSearchError('We could not load the underwriter list.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(true);
    setActiveOption(-1);
    if (formData.assignToUserId) {
      setFormData(prev => ({ ...prev, assignToUserId: undefined }));
      setFieldErrors(prev => ({ ...prev, assignToUserId: 'Select an underwriter from the list.' }));
    }
  };

  const handleSelectUnderwriter = (selected: User) => {
    setFormData(prev => ({ ...prev, assignToUserId: selected.userId }));
    setSearchQuery(
      selected.fullName || `${selected.firstName || ''} ${selected.lastName || ''}`.trim() || selected.username
    );
    setShowDropdown(false);
    setActiveOption(-1);
    setFieldErrors(prev => ({ ...prev, assignToUserId: '' }));
  };

  const handleComboboxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowDropdown(true);
      setActiveOption(i => Math.min(i + 1, Math.max(underwriters.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveOption(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const option = underwriters[activeOption];
      if (showDropdown && option) {
        e.preventDefault();
        handleSelectUnderwriter(option);
      }
    } else if (e.key === 'Escape') {
      if (showDropdown) {
        // Close the list, not the dialog.
        e.stopPropagation();
        setShowDropdown(false);
        setActiveOption(-1);
      }
    }
  };

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (type === 'approve') {
      const amount = Number(formData.approvedAmount);
      const term = Number(formData.approvedTermMonths);
      const rate = Number(formData.approvedInterestRate);
      if (!formData.approvedAmount || Number.isNaN(amount) || amount <= 0)
        errors.approvedAmount = 'Enter an approved amount greater than zero.';
      if (!formData.approvedTermMonths || Number.isNaN(term) || term <= 0)
        errors.approvedTermMonths = 'Enter the approved term in months.';
      if (formData.approvedInterestRate === '' || Number.isNaN(rate) || rate < 0)
        errors.approvedInterestRate = 'Enter the interest rate as a percentage.';
    }
    if (type === 'reject') {
      if (!formData.rejectionReason) errors.rejectionReason = 'Choose a rejection reason.';
      if (!String(formData.rejectionDetails || '').trim())
        errors.rejectionDetails = 'Explain the decision for the audit trail.';
    }
    if (type === 'assign' && !formData.assignToUserId) {
      errors.assignToUserId = 'Select an underwriter from the list.';
    }
    if (type === 'return' && !String(formData.reason || '').trim()) {
      errors.reason = 'Describe what needs to be corrected.';
    }
    if (type === 'note' && !String(formData.noteContent || '').trim()) {
      errors.noteContent = 'Write the note before saving.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onConfirm(formData);
  };

  const set = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const destructive = type === 'reject' || type === 'return' || type === 'cancel';
  const confirmLabel: Record<ModalType, string> = {
    approve: 'Approve application',
    reject: 'Reject application',
    assign: 'Assign application',
    return: 'Return for corrections',
    note: 'Save note',
    cancel: 'Cancel application',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.55)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape' && !loading) {
            e.preventDefault();
            onClose();
            return;
          }
          // Keep keyboard focus inside the dialog while it is open.
          if (e.key === 'Tab' && dialogRef.current) {
            const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        className="w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-xl"
        style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text)' }}
      >
        <h2 id={titleId} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>

        {submitError && (
          <p
            role="alert"
            className="mt-4 rounded-2xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}
          >
            {submitError} Your entries were kept — correct anything needed and try again.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {type === 'approve' && (
            <>
              <TextField
                id="approve-amount"
                label="Approved amount"
                required
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={String(formData.approvedAmount ?? '')}
                onChange={e => set('approvedAmount', e.target.value)}
                error={fieldErrors.approvedAmount}
              />
              <TextField
                id="approve-term"
                label="Approved term (months)"
                required
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                value={String(formData.approvedTermMonths ?? '')}
                onChange={e => set('approvedTermMonths', e.target.value)}
                error={fieldErrors.approvedTermMonths}
              />
              <TextField
                id="approve-rate"
                label="Interest rate (%)"
                required
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={String(formData.approvedInterestRate ?? '')}
                onChange={e => set('approvedInterestRate', e.target.value)}
                error={fieldErrors.approvedInterestRate}
              />
              <TextAreaField
                id="approve-notes"
                label="Approval notes"
                rows={3}
                value={String(formData.approvalNotes ?? '')}
                onChange={e => set('approvalNotes', e.target.value)}
                hint="Optional. Stored with the decision on the audit trail."
              />
            </>
          )}

          {type === 'reject' && (
            <>
              <SelectField
                id="reject-reason"
                label="Rejection reason"
                required
                value={String(formData.rejectionReason ?? '')}
                onChange={e => set('rejectionReason', e.target.value)}
                error={fieldErrors.rejectionReason}
              >
                <option value="">Select a reason</option>
                <option value="INSUFFICIENT_INCOME">Insufficient income</option>
                <option value="POOR_CREDIT_HISTORY">Poor credit history</option>
                <option value="INCOMPLETE_DOCUMENTATION">Incomplete documentation</option>
                <option value="PROPERTY_VALUATION_ISSUE">Property valuation issue</option>
                <option value="POLICY_VIOLATION">Policy violation</option>
                <option value="OTHER">Other</option>
              </SelectField>
              <TextAreaField
                id="reject-details"
                label="Rejection details"
                required
                rows={4}
                value={String(formData.rejectionDetails ?? '')}
                onChange={e => set('rejectionDetails', e.target.value)}
                error={fieldErrors.rejectionDetails}
                placeholder="Provide a detailed explanation for the rejection"
              />
            </>
          )}

          {type === 'assign' && (
            <>
              <div>
                <FieldLabel htmlFor="assign-underwriter" required>
                  Assign to underwriter
                </FieldLabel>
                <div className="relative">
                  <input
                    id="assign-underwriter"
                    type="text"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeOption >= 0 && underwriters[activeOption]
                        ? `${listboxId}-${activeOption}`
                        : undefined
                    }
                    aria-required="true"
                    aria-invalid={fieldErrors.assignToUserId ? true : undefined}
                    aria-describedby={
                      [
                        fieldErrors.assignToUserId ? 'assign-underwriter-error' : '',
                        'assign-underwriter-hint',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    autoComplete="off"
                    placeholder="Search underwriters by name"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setShowDropdown(false)}
                    onKeyDown={handleComboboxKeyDown}
                    className={fieldCls}
                    style={fieldErrors.assignToUserId ? fieldErrorStyle : fieldStyle}
                  />

                  {showDropdown && (searchLoading || searchError || underwriters.length === 0) && (
                    <div
                      className="absolute z-10 mt-1 w-full rounded-2xl px-4 py-3 shadow-lg"
                      style={{
                        backgroundColor: 'var(--rm-card)',
                        border: '1px solid var(--rm-border)',
                      }}
                    >
                      {searchLoading ? (
                        <p className="text-sm" role="status" style={{ color: 'var(--rm-text-muted)' }}>
                          Loading underwriters…
                        </p>
                      ) : searchError ? (
                        <div>
                          <p role="alert" className="text-sm" style={{ color: '#b91c1c' }}>
                            {searchError}
                          </p>
                          <button
                            type="button"
                            onClick={() => loadUnderwriters(searchQuery)}
                            className="mt-2 text-sm font-medium hover:underline"
                            style={{ color: 'var(--rm-accent)' }}
                          >
                            Try again
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          No underwriters found
                        </p>
                      )}
                    </div>
                  )}

                  {showDropdown && !searchLoading && !searchError && underwriters.length > 0 && (
                    <ul
                      id={listboxId}
                      role="listbox"
                      aria-label="Available underwriters"
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl py-1 shadow-lg"
                      style={{
                        backgroundColor: 'var(--rm-card)',
                        border: '1px solid var(--rm-border)',
                      }}
                    >
                      {underwriters.map((u, i) => {
                        const name =
                          u.fullName ||
                          `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
                          u.username;
                        const selected = formData.assignToUserId === u.userId;
                        return (
                          <li
                            key={u.userId}
                            id={`${listboxId}-${i}`}
                            role="option"
                            aria-selected={selected}
                            onMouseDown={e => {
                              e.preventDefault();
                              handleSelectUnderwriter(u);
                            }}
                            onMouseEnter={() => setActiveOption(i)}
                            className="cursor-pointer px-4 py-3"
                            style={{
                              backgroundColor:
                                activeOption === i ? 'var(--rm-input)' : 'transparent',
                            }}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span
                                  className="block truncate text-base font-medium"
                                  style={{ color: 'var(--rm-text)' }}
                                >
                                  {name}
                                </span>
                                <span className="block truncate text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                  {u.email}
                                  {u.userType ? ` · ${u.userType}` : ''}
                                </span>
                              </span>
                              {selected && (
                                <span
                                  className="shrink-0 text-sm font-medium"
                                  style={{ color: 'var(--rm-accent)' }}
                                >
                                  Selected
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <p id="assign-underwriter-hint" className="mt-1.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  {formData.assignToUserId
                    ? 'Underwriter selected.'
                    : 'Type to search, then use the arrow keys and Enter to choose.'}
                </p>
                <FieldError id="assign-underwriter-error" message={fieldErrors.assignToUserId} />
              </div>

              <TextAreaField
                id="assign-notes"
                label="Assignment notes"
                rows={3}
                value={String(formData.notes ?? '')}
                onChange={e => set('notes', e.target.value)}
                placeholder="Add any context about this assignment"
              />
            </>
          )}

          {type === 'return' && (
            <TextAreaField
              id="return-reason"
              label="Return reason"
              required
              rows={4}
              value={String(formData.reason ?? '')}
              onChange={e => set('reason', e.target.value)}
              error={fieldErrors.reason}
              placeholder="Explain what needs to be corrected"
            />
          )}

          {type === 'note' && (
            <>
              <SelectField
                id="note-type"
                label="Note type"
                value={String(formData.noteType ?? 'ADDITIONAL_INFO')}
                onChange={e => set('noteType', e.target.value)}
              >
                <option value="ADDITIONAL_INFO">Additional information</option>
                <option value="CORRECTION">Correction or update</option>
                <option value="DOCUMENT_UPDATE">Document update</option>
                <option value="CUSTOMER_UPDATE">Customer update</option>
                <option value="URGENT">Urgent note</option>
              </SelectField>
              <TextAreaField
                id="note-content"
                label="Note"
                required
                rows={5}
                value={String(formData.noteContent ?? '')}
                onChange={e => set('noteContent', e.target.value)}
                error={fieldErrors.noteContent}
                hint="Visible to the reviewer and stored in the application history."
                placeholder="Enter additional information or corrections for the reviewer"
              />
            </>
          )}

          {type === 'cancel' && (
            <>
              <p className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                Cancelling closes this draft application permanently. This cannot be undone.
              </p>
              <TextAreaField
                id="cancel-reason"
                label="Reason for cancellation"
                rows={3}
                value={String(formData.reason ?? '')}
                onChange={e => set('reason', e.target.value)}
                hint="Optional, but it is recorded on the audit trail."
                placeholder="Provide a reason for cancellation"
              />
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--rm-input)',
                color: 'var(--rm-text-secondary)',
              }}
            >
              Keep editing
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: destructive ? '#dc2626' : 'var(--rm-accent)',
              }}
            >
              {loading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {loading ? 'Working…' : confirmLabel[type]}
            </button>
          </div>
          {loading && (
            <p className="sr-only" role="status">
              Saving, please wait
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

/* ── Tabs ───────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'workflow', label: 'Loan workflow' },
  { id: 'solicitor', label: 'Solicitor and legal' },
  { id: 'ai-summary', label: 'AI summary' },
  { id: 'credit-memo', label: 'Credit memo' },
] as const;

type MainTab = (typeof TABS)[number]['id'];

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const { user: currentUser } = useAppSelector(state => state.auth);

  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [notesUnavailable, setNotesUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('workflow');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: ModalType | null;
    title: string;
  }>({ isOpen: false, type: null, title: '' });

  useEffect(() => {
    fetchApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await applicationService.getApplication(applicationId);
      setApplication(data);

      // Notes are secondary — a failure must not blank the page.
      try {
        const notesData = await applicationService.getNotes(applicationId);
        setNotes(notesData);
        setNotesUnavailable(false);
      } catch (noteErr) {
        console.error('Failed to fetch notes:', noteErr);
        setNotes([]);
        setNotesUnavailable(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
      console.error('Error fetching application:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!application) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await applicationService.submitApplication(applicationId);
      await fetchApplication();
      toast.success('Application submitted');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit application';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (type: ModalType, title: string) => {
    setModalError(null);
    setModalState({ isOpen: true, type, title });
  };

  const closeModal = () => {
    setModalError(null);
    setModalState({ isOpen: false, type: null, title: '' });
  };

  const handleModalConfirm = async (data: Record<string, unknown>) => {
    if (!application || !modalState.type) return;

    try {
      setActionLoading(true);
      setModalError(null);

      switch (modalState.type) {
        case 'approve':
          await applicationService.approveApplication(applicationId, {
            approvedAmount: Number(data.approvedAmount),
            approvedTermMonths: Number(data.approvedTermMonths),
            approvedInterestRate: Number(data.approvedInterestRate),
            notes: data.approvalNotes ? String(data.approvalNotes) : undefined,
          });
          toast.success('Application approved');
          break;
        case 'reject':
          await applicationService.rejectApplication(applicationId, {
            rejectionReason: String(data.rejectionReason),
            notes: String(data.rejectionDetails || ''),
          });
          toast.info('Application rejected');
          break;
        case 'assign':
          await applicationService.assignApplication(applicationId, {
            assignToUserId: String(data.assignToUserId),
          });
          if (data.notes && String(data.notes).trim()) {
            await applicationService.addNote(applicationId, {
              noteType: 'ASSIGNMENT_NOTE',
              content: String(data.notes),
            });
          }
          toast.success('Application assigned');
          break;
        case 'return':
          await applicationService.returnForCorrections(applicationId, String(data.reason));
          toast.warning('Application returned for corrections');
          break;
        case 'note':
          await applicationService.addNote(applicationId, {
            noteType: String(data.noteType || 'ADDITIONAL_INFO'),
            content: String(data.noteContent),
          });
          toast.success('Note added');
          break;
        case 'cancel':
          await applicationService.cancelApplication(
            applicationId,
            data.reason ? String(data.reason) : 'Cancelled by user'
          );
          toast.info('Application cancelled');
          break;
      }

      closeModal();
      await fetchApplication();
    } catch (err: unknown) {
      // Scoped to the dialog: typed input is preserved and the page stays put.
      setModalError(err instanceof Error ? err.message : 'That action could not be completed');
    } finally {
      setActionLoading(false);
    }
  };

  // Check if current user is the creator of the application
  const isApplicationCreator = currentUser?.userId === application?.createdByUserId;

  // A customer-originated application (ONLINE_PORTAL / MOBILE_APP) has no bank creator, so
  // gating bank-side progression on isApplicationCreator left staff with a read-only page.
  // Segregation of duties is preserved separately: isAssignedReviewer below, and the
  // underwriter picker still excludes the creator.
  const isBankStaff = !!currentUser && currentUser.userType !== 'CUSTOMER';
  const canActOnBehalfOfBank = isApplicationCreator || isBankStaff;

  // Get the effective status (lomsStatus takes precedence)
  const effectiveStatus = application?.status || 'DRAFT';

  // Can submit: DRAFT status only (initial submission)
  const canSubmit = effectiveStatus === 'DRAFT' && isApplicationCreator;

  // Can assign: SUBMITTED status or RETURNED status (to reassign for review after corrections)
  const canAssign =
    (effectiveStatus === 'SUBMITTED' || effectiveStatus === 'RETURNED') &&
    canActOnBehalfOfBank;

  // Segregation of duties: even if assigned, the creator cannot review their own application
  const isAssignedReviewer = !!(
    application?.assignedToUserId &&
    currentUser?.userId === application.assignedToUserId &&
    !isApplicationCreator
  );

  const isUnderReviewStatus = [
    'PENDING_KYC',
    'PENDING_CREDIT_CHECK',
    'REFERRED_TO_SENIOR',
    'REFERRED_TO_UNDERWRITER',
    'PENDING_UNDERWRITING',
    'IN_UNDERWRITING',
    'PENDING_DECISION',
  ].includes(effectiveStatus);

  const canApprove = isUnderReviewStatus && isAssignedReviewer;

  const isNotFinalStatus = ![
    'APPROVED',
    'DECLINED',
    'WITHDRAWN',
    'CANCELLED',
    'DISBURSED',
    'BOOKED',
    'EXPIRED',
    'KYC_REJECTED',
    'CREDIT_DECLINED',
    'UNDERWRITING_DECLINED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'CLOSED',
  ].includes(effectiveStatus);

  // Mirrors the backend rule (ApplicationStateMachine.canCancel): any non-terminal state.
  const canCancel = isNotFinalStatus && canActOnBehalfOfBank;
  const canWithdraw = isNotFinalStatus && canActOnBehalfOfBank && effectiveStatus !== 'DRAFT';

  const canReviewerReject = isUnderReviewStatus && isAssignedReviewer;

  const canReturn =
    [
      'PENDING_KYC',
      'PENDING_CREDIT_CHECK',
      'REFERRED_TO_SENIOR',
      'PENDING_UNDERWRITING',
      'IN_UNDERWRITING',
      'PENDING_DECISION',
    ].includes(effectiveStatus) && isAssignedReviewer;

  const canAddNote = isUnderReviewStatus && isApplicationCreator;

  const canEdit =
    [
      'DRAFT',
      'RETURNED',
      'SUBMITTED',
      'PENDING_KYC',
      'PENDING_CREDIT_CHECK',
      'IN_UNDERWRITING',
    ].includes(effectiveStatus) && isApplicationCreator;

  /* One primary action per page — the first constructive action wins;
     destructive actions are always rendered as secondary. */
  const availableActions: {
    key: string;
    label: string;
    destructive?: boolean;
    run: () => void;
  }[] = [
    { key: 'approve', label: 'Approve', run: () => openModal('approve', 'Approve application') },
    { key: 'submit', label: 'Submit application', run: handleSubmit },
    { key: 'assign', label: 'Assign to underwriter', run: () => openModal('assign', 'Assign application') },
    { key: 'return', label: 'Return for corrections', run: () => openModal('return', 'Return for corrections') },
    { key: 'edit', label: 'Edit application', run: () => router.push(`/dashboard/applications/${applicationId}/edit`) },
    { key: 'note', label: 'Add note', run: () => openModal('note', 'Add note for reviewer') },
    {
      key: 'reject',
      label: 'Reject',
      destructive: true,
      run: () => openModal('reject', 'Reject application'),
    },
    {
      key: 'withdraw',
      label: 'Withdraw',
      destructive: true,
      run: () => openModal('reject', 'Withdraw application'),
    },
    {
      key: 'cancel',
      label: 'Cancel application',
      destructive: true,
      run: () => openModal('cancel', 'Cancel application'),
    },
  ];
  const permitted: Record<string, boolean> = {
    approve: !!canApprove,
    submit: !!canSubmit,
    assign: !!canAssign,
    return: !!canReturn,
    edit: !!canEdit,
    note: !!canAddNote,
    reject: !!canReviewerReject,
    withdraw: !!canWithdraw,
    cancel: !!canCancel,
  };
  const visibleActions = availableActions.filter(a => permitted[a.key]);
  const primaryAction = visibleActions.find(a => !a.destructive);
  const secondaryActions = visibleActions.filter(a => a !== primaryAction);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = (next: number) => {
      e.preventDefault();
      const target = (next + TABS.length) % TABS.length;
      setMainTab(TABS[target].id);
      tabRefs.current[target]?.focus();
    };
    if (e.key === 'ArrowRight') move(index + 1);
    else if (e.key === 'ArrowLeft') move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(TABS.length - 1);
  };

  const customerName = application
    ? application.customer?.businessName ||
      `${application.customer?.firstName || ''} ${application.customer?.lastName || ''}`.trim() ||
      'Customer record unavailable'
    : '';

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <div className="h-4 w-40 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
          <div className="mt-4 h-8 w-72 max-w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
          <div className="mt-3 h-4 w-56 max-w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
                <div className="h-6 w-44 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="mt-5 space-y-3">
                  <div className="h-4 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                  <div className="h-4 w-3/4 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {[0, 1].map(i => (
              <div key={i} className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
                <div className="h-6 w-32 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
                <div className="mt-5 h-4 rounded-full animate-pulse" style={{ backgroundColor: 'var(--rm-input)' }} />
              </div>
            ))}
          </div>
        </div>
        <p className="sr-only" role="status">
          Loading application
        </p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div
          role="alert"
          className="rounded-3xl p-6 sm:p-7 text-center"
          style={{ backgroundColor: 'var(--rm-card)' }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(239,68,68,0.13)' }}
          >
            <svg className="w-7 h-7" style={{ color: '#dc2626' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            We could not open this application
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {error || 'Application not found'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={fetchApplication}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              Try again
            </button>
            <Link
              href="/dashboard/applications"
              className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            >
              Back to applications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <header className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to applications
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
              Application {application.applicationNumber}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              {customerName}
              {application.product?.productName ? ` · ${application.product.productName}` : ''} ·
              Created {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={effectiveStatus} />
        </div>
      </header>

      {/* Info banner for RM when application is under review by someone else */}
      {isUnderReviewStatus && !isAssignedReviewer && application.assignedToUser && (
        <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-accent-muted)' }}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--rm-accent)' }} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              This application is being reviewed by{' '}
              <span className="font-semibold" style={{ color: 'var(--rm-text)' }}>
                {application.assignedToUser.firstName} {application.assignedToUser.lastName}
              </span>
              {application.assignedToUser.roles && application.assignedToUser.roles.length > 0 && (
                <span> ({formatRoleName(application.assignedToUser.roles[0])})</span>
              )}
              . Approval waits on that review, and you can still withdraw if you need to.
            </p>
          </div>
        </div>
      )}

      {/* ── Section tabs ── */}
      <div
        role="tablist"
        aria-label="Application sections"
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1"
        style={{ backgroundColor: 'var(--rm-input)' }}
      >
        {TABS.map((tab, i) => {
          const selected = mainTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={el => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setMainTab(tab.id)}
              onKeyDown={e => onTabKeyDown(e, i)}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: selected ? 'var(--rm-card)' : 'transparent',
                color: selected ? 'var(--rm-text)' : 'var(--rm-text-muted)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {mainTab === 'workflow' && (
        <div role="tabpanel" id="panel-workflow" aria-labelledby="tab-workflow">
          <ApplicationWorkflowPanel
            applicationId={applicationId as string}
            applicationStatus={effectiveStatus}
            customerId={application.customerId}
            currentUserId={currentUser?.userId || ''}
            isApplicationCreator={isApplicationCreator}
            canAssign={canAssign}
            assignedToUserId={application.assignedToUserId}
            approvedAmount={application.approvedAmount || application.requestedAmount || 0}
            kycVerified={application.kycCompleted}
            productName={application.product?.productName}
            onStatusChange={fetchApplication}
            onRequestAssign={() => openModal('assign', 'Assign application')}
          />
        </div>
      )}

      {mainTab === 'solicitor' && (
        <div role="tabpanel" id="panel-solicitor" aria-labelledby="tab-solicitor">
          <SolicitorTab applicationId={applicationId} applicationStatus={effectiveStatus} />
        </div>
      )}

      {mainTab === 'ai-summary' && (
        <div role="tabpanel" id="panel-ai-summary" aria-labelledby="tab-ai-summary">
          <ApplicationAiSummaryTab applicationId={applicationId} bankId={application.bankId} />
        </div>
      )}

      {mainTab === 'credit-memo' && (
        <div role="tabpanel" id="panel-credit-memo" aria-labelledby="tab-credit-memo">
          <CreditMemoTab applicationId={applicationId} bankId={application.bankId} />
        </div>
      )}

      {/* ── Actions ── */}
      {visibleActions.length > 0 && (
        <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            Actions
          </h2>
          {actionError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}
            >
              {actionError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.run}
                disabled={actionLoading}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {primaryAction.label}
              </button>
            )}
            {secondaryActions.map(a => (
              <button
                key={a.key}
                type="button"
                onClick={a.run}
                disabled={actionLoading}
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={
                  a.destructive
                    ? { backgroundColor: 'rgba(239,68,68,0.12)', color: '#b91c1c' }
                    : { backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }
                }
              >
                {a.label}
              </button>
            ))}
          </div>
          {actionLoading && (
            <p className="sr-only" role="status">
              Working, please wait
            </p>
          )}
        </section>
      )}

      {/* ── Content grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Application information */}
          <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
              Application information
            </h2>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Application number
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {application.applicationNumber}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Status
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {statusLabel(effectiveStatus)}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Channel
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {application.channel ? application.channel.replace(/_/g, ' ') : '—'}
                </dd>
              </div>
              {application.currentStage && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Current stage
                  </dt>
                  <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    {application.currentStage.replace(/_/g, ' ')}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Customer & financial profile */}
          <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
                Customer and financial profile
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/applications?customerId=${application.customerId}`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-text-muted)' }}
                >
                  All applications
                </Link>
                <Link
                  href={`/dashboard/customers/${application.customerId}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                >
                  View full profile
                  <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {application.customer ? (
                <>
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Customer name
                    </dt>
                    <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {customerName}
                    </dd>
                  </div>
                  {application.customer.businessName && (
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Business name
                      </dt>
                      <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {application.customer.businessName}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Customer number
                    </dt>
                    <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {application.customer.customerNumber || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Email
                    </dt>
                    <dd className="mt-1 text-base font-medium break-words" style={{ color: 'var(--rm-text)' }}>
                      {application.customer.email || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Phone
                    </dt>
                    <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {application.customer.phoneNumber || '—'}
                    </dd>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Customer ID
                  </dt>
                  <dd className="mt-1 text-base font-medium break-all" style={{ color: 'var(--rm-text)' }}>
                    {application.customerId}
                  </dd>
                </div>
              )}
            </dl>

            {(application.statedAnnualIncome ||
              application.statedMonthlyIncome ||
              application.employmentStatus) && (
              <dl
                className="mt-6 grid grid-cols-2 gap-5 rounded-2xl p-5 md:grid-cols-4"
                style={{ backgroundColor: 'var(--rm-input)' }}
              >
                {application.statedAnnualIncome ? (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Annual income
                    </dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {formatCurrency(application.statedAnnualIncome)}
                    </dd>
                  </div>
                ) : null}
                {application.statedMonthlyIncome ? (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Monthly income
                    </dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {formatCurrency(application.statedMonthlyIncome)}
                    </dd>
                  </div>
                ) : null}
                {application.statedMonthlyExpenses ? (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Monthly expenses
                    </dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {formatCurrency(application.statedMonthlyExpenses)}
                    </dd>
                  </div>
                ) : null}
                {application.employmentStatus ? (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Employment
                    </dt>
                    <dd className="mt-1 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                      {application.employmentStatus.replace(/_/g, ' ')}
                    </dd>
                  </div>
                ) : null}
                {application.employerName ? (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Employer
                    </dt>
                    <dd className="mt-1 text-base font-semibold" style={{ color: 'var(--rm-text)' }}>
                      {application.employerName}
                    </dd>
                  </div>
                ) : null}
                {application.yearsWithEmployer !== undefined && application.yearsWithEmployer > 0 && (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Tenure
                    </dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {application.yearsWithEmployer} years
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </section>

          {/* Loan request */}
          <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
              Loan request
            </h2>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Requested amount
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {formatCurrency(application.requestedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Requested term
                </dt>
                <dd className="mt-1 text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                  {application.requestedTermMonths} months
                </dd>
              </div>
              {application.requestedInterestRate != null && (
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Interest rate
                  </dt>
                  <dd className="mt-1 text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {application.requestedInterestRate}%
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Loan purpose
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {application.loanPurpose ? application.loanPurpose.replace(/_/g, ' ') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Product
                </dt>
                <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                  {application.product?.productName || '—'}
                </dd>
              </div>
            </dl>
            {application.loanPurposeDescription && (
              <div className="mt-5">
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Purpose description
                </p>
                <p className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                  {application.loanPurposeDescription}
                </p>
              </div>
            )}
          </section>

          {/* Approval details */}
          {application.approvedAmount != null && (
            <section
              className="rounded-3xl p-6 sm:p-7"
              style={{ backgroundColor: TONES.success.bg }}
            >
              <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: TONES.success.fg }}>
                Approval details
              </h2>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm" style={{ color: TONES.success.fg }}>
                    Approved amount
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {formatCurrency(application.approvedAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm" style={{ color: TONES.success.fg }}>
                    Approved term
                  </dt>
                  <dd className="mt-1 text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {application.approvedTermMonths ?? '—'} months
                  </dd>
                </div>
                <div>
                  <dt className="text-sm" style={{ color: TONES.success.fg }}>
                    Interest rate
                  </dt>
                  <dd className="mt-1 text-base font-medium tabular-nums" style={{ color: 'var(--rm-text)' }}>
                    {application.approvedInterestRate != null ? `${application.approvedInterestRate}%` : '—'}
                  </dd>
                </div>
              </dl>
              {application.decisionNotes && (
                <div className="mt-5">
                  <p className="text-sm" style={{ color: TONES.success.fg }}>
                    Decision notes
                  </p>
                  <p className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                    {application.decisionNotes}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Rejection details */}
          {application.rejectionReason && (
            <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: TONES.danger.bg }}>
              <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: TONES.danger.fg }}>
                Rejection details
              </h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm" style={{ color: TONES.danger.fg }}>
                    Reason
                  </dt>
                  <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    {application.rejectionReason.replace(/_/g, ' ')}
                  </dd>
                </div>
                {application.decisionNotes && (
                  <div>
                    <dt className="text-sm" style={{ color: TONES.danger.fg }}>
                      Details
                    </dt>
                    <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                      {application.decisionNotes}
                    </dd>
                  </div>
                )}
                {application.rejectionCategory && (
                  <div>
                    <dt className="text-sm" style={{ color: TONES.danger.fg }}>
                      Category
                    </dt>
                    <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {application.rejectionCategory.replace(/_/g, ' ')}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Property information */}
          {application.propertyAddress && (
            <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
              <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
                Property information
              </h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Address
                  </dt>
                  <dd className="mt-1 text-base" style={{ color: 'var(--rm-text)' }}>
                    {application.propertyAddress}
                    {application.propertyCity && `, ${application.propertyCity}`}
                    {application.propertyState && `, ${application.propertyState}`}
                  </dd>
                </div>
                {application.propertyValue != null && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        Property value
                      </dt>
                      <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                        {formatCurrency(application.propertyValue)}
                      </dd>
                    </div>
                    {application.downPaymentAmount != null && (
                      <div>
                        <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          Down payment
                        </dt>
                        <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                          {formatCurrency(application.downPaymentAmount)}
                        </dd>
                      </div>
                    )}
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          {/* Timeline */}
          <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
              Timeline
            </h2>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONES.info.dot }} aria-hidden="true" />
                <div>
                  <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    Created
                  </p>
                  <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                    {formatDateTime(application.createdAt)}
                  </p>
                </div>
              </li>

              {application.submittedAt && (
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONES.info.dot }} aria-hidden="true" />
                  <div>
                    <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      Submitted
                    </p>
                    <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                      {formatDateTime(application.submittedAt)}
                    </p>
                  </div>
                </li>
              )}

              {application.decisionMadeAt &&
                [
                  'APPROVED',
                  'OFFER_GENERATED',
                  'OFFER_SENT',
                  'PENDING_ESIGN',
                  'ESIGN_IN_PROGRESS',
                  'ESIGN_COMPLETED',
                  'PENDING_BOOKING',
                  'BOOKING_IN_PROGRESS',
                  'BOOKED',
                ].includes(effectiveStatus) && (
                  <li className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONES.success.dot }} aria-hidden="true" />
                    <div>
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        Approved
                      </p>
                      <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                        {formatDateTime(application.decisionMadeAt)}
                      </p>
                    </div>
                  </li>
                )}

              {application.decisionMadeAt &&
                ['DECLINED', 'UNDERWRITING_DECLINED', 'CREDIT_DECLINED'].includes(effectiveStatus) && (
                  <li className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONES.danger.dot }} aria-hidden="true" />
                    <div>
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        Rejected
                      </p>
                      <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                        {formatDateTime(application.decisionMadeAt)}
                      </p>
                    </div>
                  </li>
                )}
            </ol>
          </section>

          {/* Assignment */}
          {application.assignedToUserId && (
            <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
              <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
                Assignment
              </h2>
              <dl className="space-y-4">
                {isAssignedReviewer ? (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Assigned by
                    </dt>
                    <dd className="mt-1">
                      {application.createdByUser ? (
                        <>
                          <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {application.createdByUser.firstName} {application.createdByUser.lastName}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {application.createdByUser.roles && application.createdByUser.roles.length > 0
                              ? formatRoleName(application.createdByUser.roles[0])
                              : application.createdByUser.userType?.replace(/_/g, ' ')}
                          </p>
                        </>
                      ) : (
                        <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                          User #{application.createdByUserId.slice(-8)}
                        </p>
                      )}
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Assigned to
                    </dt>
                    <dd className="mt-1">
                      {application.assignedToUser ? (
                        <>
                          <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                            {application.assignedToUser.firstName} {application.assignedToUser.lastName}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {application.assignedToUser.roles && application.assignedToUser.roles.length > 0
                              ? formatRoleName(application.assignedToUser.roles[0])
                              : application.assignedToUser.userType?.replace(/_/g, ' ')}
                          </p>
                        </>
                      ) : (
                        <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                          User #{application.assignedToUserId.slice(-8)}
                        </p>
                      )}
                    </dd>
                  </div>
                )}
                {application.assignedAt && (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Assigned at
                    </dt>
                    <dd className="mt-1 text-base tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {formatDateTime(application.assignedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Notes */}
          <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
            <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
              Notes
            </h2>
            {notesUnavailable ? (
              <div>
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  Notes could not be loaded.
                </p>
                <button
                  type="button"
                  onClick={fetchApplication}
                  className="mt-3 text-sm font-medium hover:underline"
                  style={{ color: 'var(--rm-accent)' }}
                >
                  Try again
                </button>
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                No notes on this application yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {notes.map(note => (
                  <li
                    key={note.noteId}
                    className="py-1 pl-4"
                    style={{ borderLeft: '3px solid var(--rm-accent)' }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {note.createdByUserName || `User #${note.createdByUserId.slice(-8)}`}
                      </p>
                      <p className="text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                        {formatDateTime(note.createdAt)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {note.content}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      {note.noteType.replace(/_/g, ' ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Risk & compliance */}
          {(application.riskScore !== undefined ||
            application.creditScoreAtApplication ||
            application.kycCompleted !== undefined) && (
            <section className="rounded-3xl p-6" style={{ backgroundColor: 'var(--rm-card)' }}>
              <h2 className="text-xl font-semibold tracking-tight mb-5" style={{ color: 'var(--rm-text)' }}>
                Risk and compliance
              </h2>
              <dl className="space-y-4">
                {application.riskScore !== undefined && (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Risk score
                    </dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {application.riskScore}
                    </dd>
                  </div>
                )}
                {application.creditScoreAtApplication != null && (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      Credit score
                    </dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--rm-text)' }}>
                      {application.creditScoreAtApplication}
                    </dd>
                  </div>
                )}
                {application.kycCompleted !== undefined && (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      KYC status
                    </dt>
                    <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {application.kycCompleted ? 'Completed' : 'Pending'}
                    </dd>
                  </div>
                )}
                {application.amlCheckCompleted !== undefined && (
                  <div>
                    <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      AML check
                    </dt>
                    <dd className="mt-1 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      {application.amlCheckCompleted ? 'Completed' : 'Pending'}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>

      {/* Action dialog */}
      {modalState.type && (
        <ActionModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          onConfirm={handleModalConfirm}
          title={modalState.title}
          type={modalState.type}
          loading={actionLoading}
          submitError={modalError}
          application={application}
        />
      )}
    </div>
  );
}

/* ── StatusBadge ──────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.dot }} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
