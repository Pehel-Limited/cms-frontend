'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TRANSACTIONS } from '@/lib/banking-data';

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
    <section className="glass-panel flex flex-col" aria-label="Repeat a previous transfer">
      <div className="glass-head">
        <div>
          <h3 className="glass-title">{mode === 'OUT' ? 'Pay again' : 'Request again'}</h3>
          <p className="glass-sub">One step, prefilled for review</p>
        </div>
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
        <div className="px-6 pb-6">
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
        <div className="px-6">
          <div className="rounded-2xl" style={{ border: '1px solid var(--hairline)' }}>
            {candidates.slice(0, 3).map(t => (
                <div key={t.id} className="glass-row !px-4">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: 'var(--tile-bg)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--hairline)',
                    }}
                  >
                    {t.merchant.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t.merchant}
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t.note || 'Previous transfer'}
                    </p>
                  </div>
                  <span
                    className="num shrink-0 text-base font-semibold tabular-nums"
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
            ))}
          </div>
        </div>
      )}

      <p className="glass-foot">
        {mode === 'OUT'
          ? 'Prefills the recipient, amount and reference for you to review. Nothing is sent.'
          : 'Prepares an editable request message to copy. Nothing is sent or collected.'}
      </p>
    </section>
  );
}
