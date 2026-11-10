'use client';

import Link from 'next/link';
import { useState } from 'react';
import Glyph from '@/components/ui/Glyph';
import type { AttentionItem } from '@/lib/dashboard-model';
import { RetryNote, Zone, ZoneHeader, ZoneSkeleton } from './Zone';

const VISIBLE = 4;

const TONE: Record<AttentionItem['tone'], { dot: string; label: string }> = {
  critical: { dot: 'var(--down)', label: 'Action needed' },
  warning: { dot: '#f59e0b', label: 'Soon' },
  info: { dot: 'var(--text-muted)', label: 'For your information' },
};

export function AttentionCentre({
  items,
  loading,
  partialFailure,
  onRetry,
}: {
  items: AttentionItem[];
  loading: boolean;
  partialFailure: boolean;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const urgent = items.filter(i => i.tone === 'critical').length;

  // Nothing to act on and nothing failed to load: don't take up space.
  if (!loading && items.length === 0 && !partialFailure) return null;

  return (
    <Zone labelledBy="zone-attention">
      <ZoneHeader
        id="zone-attention"
        title="Needs your attention"
        sub={
          loading
            ? 'Checking your applications, tasks and messages…'
            : items.length === 0
              ? 'Nothing found so far.'
              : `${items.length} item${items.length === 1 ? '' : 's'}${urgent ? ` · ${urgent} urgent` : ''}`
        }
        aside={
          items.length > VISIBLE ? (
            <button type="button" className="sb-link" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Show less' : `Show all ${items.length}`}
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <ZoneSkeleton rows={2} />
      ) : items.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] sm:px-6" style={{ color: 'var(--text-muted)' }}>
          We couldn&apos;t check everything just now. Try again in a moment.
        </p>
      ) : (
        <ul className="pb-2">
          {shown.map(item => (
            <li key={item.id}>
              <Link href={item.href} className="sb-row group">
                <span className="sb-row-icon" aria-hidden="true">
                  <Glyph name={item.glyph} className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  <span className="sb-row-dot" style={{ background: TONE[item.tone].dot }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">{TONE[item.tone].label}: </span>
                  <span className="block truncate text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  <span className="block truncate text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {item.detail}
                  </span>
                </span>
                <span className={`sb-cta ${item.tone === 'critical' ? 'sb-cta-strong' : ''}`}>{item.cta}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && partialFailure && (
        <RetryNote
          text={
            items.length === 0
              ? "We couldn't check everything, so there may be items we can't show yet."
              : "Some items couldn't be checked."
          }
          onRetry={onRetry}
        />
      )}
    </Zone>
  );
}
