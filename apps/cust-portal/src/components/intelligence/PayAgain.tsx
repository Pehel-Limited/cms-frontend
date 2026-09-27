'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BENEFICIARIES, TRANSACTIONS } from '@/lib/banking-data';

/**
 * Previous transfers the customer can repeat in one step. Nothing here moves
 * money — each row links into the payments screen with the form prefilled for
 * review. Renders an empty state when the sample history holds no transfers.
 */
export function PayAgain({ mask }: { mask: (value: string) => string }) {
  const [mode, setMode] = useState<'OUT' | 'IN'>('OUT');

  const candidates = TRANSACTIONS.filter(
    t => t.category === 'Transfers' && t.status === 'COMPLETED' && t.direction === mode
  ).filter((t, i, all) => all.findIndex(other => other.merchant === t.merchant) === i);

  const euro = (value: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);

  return (
    <div className="dash-card dash-accent flex flex-col">
      <div className="dash-card-head">
        <h3 className="dash-card-title">{mode === 'OUT' ? 'Pay again' : 'Request again'}</h3>
        <div className="segmented" role="group" aria-label="Repeat action type">
          {(['OUT', 'IN'] as const).map(value => (
            <button
              key={value}
              type="button"
              data-active={mode === value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className="segmented-item"
            >
              {value === 'OUT' ? 'Pay' : 'Request'}
            </button>
          ))}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="p-6">
          <div className="empty-state">
            <p className="empty-state-title">
              {mode === 'OUT' ? 'No previous payments' : 'No money received'}
            </p>
            <p className="empty-state-text">
              {mode === 'OUT'
                ? 'Transfers you have made will appear here so you can repeat them in one step.'
                : 'Transfers you have received will appear here so you can prepare a request.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-token">
          {candidates.slice(0, 3).map(t => {
            const person = BENEFICIARIES.find(b => b.name === t.merchant);
            return (
              <div key={t.id} className="dash-row">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
                >
                  {person?.glyph || t.merchant.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t.merchant}
                  </p>
                  <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t.note || 'Previous transfer'}
                  </p>
                </div>
                <span
                  className="shrink-0 text-base font-semibold tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {mask(euro(t.amount))}
                </span>
                <Link
                  href={`/portal/payments?repeat=${encodeURIComponent(t.id)}&action=${mode === 'OUT' ? 'pay' : 'request'}`}
                  className="link-arrow shrink-0"
                  aria-label={`${mode === 'OUT' ? 'Repeat payment to' : 'Prepare a request from'} ${t.merchant}`}
                >
                  <span data-arrow aria-hidden="true">→</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <p className="dash-card-foot">
        {mode === 'OUT'
          ? 'Prefills the recipient, amount and reference for you to review. Nothing is sent.'
          : 'Prepares an editable request message to copy. Nothing is sent or collected.'}
      </p>
    </div>
  );
}
