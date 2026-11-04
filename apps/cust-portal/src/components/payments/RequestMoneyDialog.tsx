'use client';

import { useEffect, useState } from 'react';
import Glyph, { CurrencyGlyph } from '@/components/ui/Glyph';
import { BENEFICIARIES } from '@/lib/banking-data';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);

export interface CreatedRequest {
  name: string;
  amount: number;
  note: string;
  reference: string;
}

interface CreatedState extends CreatedRequest {
  message: string;
}

export function RequestMoneyDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional: screens with an activity feed append the new request there. */
  onCreate?: (request: CreatedRequest) => void;
}) {
  const [fromId, setFromId] = useState('');
  const [otherName, setOtherName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [created, setCreated] = useState<CreatedState | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!open) return;
    setFromId('');
    setOtherName('');
    setAmount('');
    setNote('');
    setCreated(null);
    setCopied('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const selected = BENEFICIARIES.find(b => b.id === fromId);
  const requestName = fromId === 'other' ? otherName.trim() : selected?.name ?? '';
  const numericAmount = Number(amount);
  const valid = Boolean(requestName) && Number.isFinite(numericAmount) && numericAmount > 0;

  function createRequest() {
    if (!valid) return;
    const reference = `REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const trimmedNote = note.trim();
    const message = `Hi ${requestName}, could you send me ${fmt(numericAmount)}${
      trimmedNote ? ` for ${trimmedNote}` : ''
    }? You can pay me from your banking app. Ref ${reference}.`;

    onCreate?.({ name: requestName, amount: numericAmount, note: trimmedNote, reference });
    setCreated({ name: requestName, amount: numericAmount, note: trimmedNote, reference, message });
  }

  async function copyRequest() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.message);
      setCopied('Request copied. Share it with your recipient using your preferred app.');
    } catch {
      setCopied('Clipboard unavailable. You can select and copy the request below.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-title"
      aria-describedby="request-desc"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[28px] border"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--hairline)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--brand-on-soft)' }}
            >
              Get paid from any phone
            </p>
            <h2 id="request-title" className="serif mt-1 text-[24px] font-medium">
              Request money
            </h2>
            <p id="request-desc" className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Create a request and share it with the person paying you.
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close request">
            <Glyph name="x" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 py-5">
          {!created ? (
            <div className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                  htmlFor="request-from"
                >
                  Request from
                </label>
                <select
                  id="request-from"
                  value={fromId}
                  onChange={event => setFromId(event.target.value)}
                  className="select"
                >
                  <option value="">Choose someone you pay…</option>
                  {BENEFICIARIES.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.handle})
                    </option>
                  ))}
                  <option value="other">Someone else…</option>
                </select>
                {fromId === 'other' && (
                  <input
                    value={otherName}
                    onChange={event => setOtherName(event.target.value)}
                    placeholder="Their name or mobile number"
                    aria-label="Their name or mobile number"
                    className="input mt-2"
                  />
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                  htmlFor="request-amount"
                >
                  Amount
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    €
                  </span>
                  <input
                    id="request-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="input num pl-9 text-lg"
                  />
                </div>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                  htmlFor="request-note"
                >
                  What is it for?{' '}
                  <span className="font-normal normal-case tracking-normal opacity-70">(optional)</span>
                </label>
                <input
                  id="request-note"
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  maxLength={140}
                  placeholder="e.g. Dinner split"
                  className="input"
                />
              </div>

              {requestName && numericAmount > 0 && (
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--hairline)',
                    backgroundColor: 'var(--surface-input)',
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Preview
                  </p>
                  <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    Hi {requestName}, could you send me {fmt(numericAmount)}
                    {note.trim() ? ` for ${note.trim()}` : ''}? You can pay me from your banking
                    app.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={createRequest}
                disabled={!valid}
                className="btn btn-primary w-full"
              >
                <CurrencyGlyph currency="EUR" className="h-4 w-4" strokeWidth={2} />
                Create request
              </button>
              <p className="text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                Demo only — this prepares a shareable request message and reference. No payment
                link is created and no money moves.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(14,155,108,.12)', color: 'var(--up)' }}
                  aria-hidden="true"
                >
                  <Glyph name="check" className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Request ready
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Share it with {created.name}. They can pay you from their banking app.
                  </p>
                </div>
              </div>

              <div
                className="rounded-2xl border p-4 text-sm leading-6"
                style={{
                  borderColor: 'var(--hairline)',
                  backgroundColor: 'var(--surface-input)',
                  color: 'var(--text-secondary)',
                }}
              >
                {created.message}
                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {created.reference} · {fmt(created.amount)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyRequest} className="btn btn-primary btn-sm">
                  <Glyph name="doc" className="h-3.5 w-3.5" strokeWidth={2} />
                  Copy request
                </button>
                <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                  Done
                </button>
              </div>
              {copied && (
                <p role="status" className="text-sm" style={{ color: 'var(--brand-on-soft)' }}>
                  {copied}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
