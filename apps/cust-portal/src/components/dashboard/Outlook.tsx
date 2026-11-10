'use client';

import Link from 'next/link';
import { GlyphTile, glyphFor } from '@/components/ui/Glyph';
import { formatCurrency } from '@/lib/format';
import { formatMoney, relativeDay, type UpcomingItem } from '@/lib/dashboard-model';
import { Zone, ZoneHeader, ZoneSkeleton } from './Zone';

const MASK = '••••••';

export function ComingUp({
  items,
  loading,
  hidden,
  sample,
}: {
  items: UpcomingItem[];
  loading: boolean;
  hidden: boolean;
  sample: boolean;
}) {
  const shown = items.slice(0, 4);
  const predictedTotal = items
    .filter(i => i.basis === 'predicted' && i.amount != null)
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const ccy = items.find(i => i.currency)?.currency;

  return (
    <Zone labelledBy="zone-upcoming">
      <ZoneHeader
        id="zone-upcoming"
        title="Coming up"
        sub={
          loading
            ? 'Looking ahead 30 days…'
            : items.length === 0
              ? 'Nothing expected in the next 30 days.'
              : predictedTotal > 0 && ccy
                ? `About ${hidden ? MASK : formatMoney(predictedTotal, ccy)} in regular payments · next 30 days`
                : 'Next 30 days'
        }
      />
      {loading ? (
        <ZoneSkeleton rows={3} />
      ) : items.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] sm:px-6" style={{ color: 'var(--text-muted)' }}>
          Regular payments appear here once they have gone out at least three times on a steady schedule.
        </p>
      ) : (
        <ul className="pb-2">
          {shown.map(item => (
            <li key={item.id}>
              <Link href={item.href} className="sb-row">
                <GlyphTile name={glyphFor(item.glyph)} className="h-10 w-10 shrink-0 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  <span className="block truncate text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {relativeDay(item.date)} · {item.detail}
                  </span>
                </span>
                {item.amount != null && (
                  <span className="shrink-0 text-right">
                    <span className="num block text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {hidden
                        ? MASK
                        : item.currency
                          ? formatMoney(item.amount, item.currency)
                          : formatCurrency(item.amount)}
                    </span>
                    <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {item.basis === 'predicted' ? 'Expected' : 'Offer'}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!loading && items.some(i => i.basis === 'predicted') && (
        <p className="px-5 pb-4 text-[11px] leading-4 sm:px-6" style={{ color: 'var(--text-muted)' }}>
          Expected dates are worked out from your {sample ? 'sample ' : ''}payment history, not from scheduled
          instructions.
        </p>
      )}
    </Zone>
  );
}

