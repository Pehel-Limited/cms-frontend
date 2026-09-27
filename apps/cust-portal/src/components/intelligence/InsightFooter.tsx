'use client';

import type { SpendCategory } from '@/lib/banking-data';
import { CORRECTABLE_CATEGORIES } from '@/lib/insight-feedback';
import type { EvidenceLine } from '@/lib/spending-insights';

/**
 * The "show your working" layer under an insight: the transactions the number
 * was built from, the customer's chance to correct the categorisation, and
 * their chance to dismiss it. Nothing here recalculates anything — it only
 * exposes what the deterministic calculation already used.
 */

export interface InsightCorrection {
  merchant: string;
  category: SpendCategory;
  corrected: boolean;
  onChange: (category: SpendCategory) => void;
  onReset: () => void;
}

interface InsightFooterProps {
  basis: string;
  lines: EvidenceLine[];
  onDismiss: () => void;
  correction?: InsightCorrection;
}

export function InsightFooter({ basis, lines, onDismiss, correction }: InsightFooterProps) {
  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--surface-border)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <details className="min-w-0 flex-1">
          <summary
            className="cursor-pointer list-none text-sm font-medium"
            style={{ color: 'var(--brand-on-soft)' }}
          >
            How this was worked out
            <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>
              ({lines.length} transaction{lines.length === 1 ? '' : 's'})
            </span>
          </summary>
          <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: 'var(--surface-input)' }}>
            <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {basis}
            </p>
            {lines.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {lines.map(line => (
                  <li
                    key={line.transactionId}
                    className="font-mono text-sm tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {line.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-sm font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          Dismiss
        </button>
      </div>

      {correction && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
            htmlFor={`correct-${correction.merchant}`}
          >
            Categorise {correction.merchant} as
          </label>
          <select
            id={`correct-${correction.merchant}`}
            className="select w-auto py-1.5 text-sm"
            value={correction.category}
            onChange={event => correction.onChange(event.target.value as SpendCategory)}
          >
            {CORRECTABLE_CATEGORIES.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {correction.corrected && (
            <button
              type="button"
              onClick={correction.onReset}
              className="text-sm font-medium"
              style={{ color: 'var(--brand-on-soft)' }}
            >
              Reset to detected
            </button>
          )}
        </div>
      )}
    </div>
  );
}
