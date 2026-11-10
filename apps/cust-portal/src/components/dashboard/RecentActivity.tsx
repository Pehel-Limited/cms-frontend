'use client';

import { GlyphTile, glyphFor } from '@/components/ui/Glyph';
import { groupTransactionsByDay, type Transaction } from '@/lib/banking-data';
import { formatMoney, type MonthFlow } from '@/lib/dashboard-model';
import { Zone, ZoneHeader, ZoneSkeleton } from './Zone';

const MASK = '••••••';

function caption(t: Transaction): string {
  if (t.status === 'PENDING') return 'Pending';
  if (t.status === 'DECLINED') return 'Declined';
  if (t.status === 'REVERSED') return 'Reversed';
  return t.direction === 'IN' ? 'Income' : 'Spending';
}

export function RecentActivity({
  transactions,
  flow,
  loading,
  hidden,
  sample,
  limit = 5,
}: {
  transactions: Transaction[];
  flow: MonthFlow;
  loading: boolean;
  hidden: boolean;
  sample: boolean;
  limit?: number;
}) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
  const groups = groupTransactionsByDay(recent);
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
  const net = flow.moneyIn - flow.moneyOut;
  const show = (v: number) => (hidden ? MASK : formatMoney(v, flow.currency));
  const comparable = flow.lastIn != null && flow.lastOut != null;

  return (
    <Zone labelledBy="zone-activity">
      <ZoneHeader
        id="zone-activity"
        title="Recent activity"
        sub={
          sample
            ? 'Sample activity — not your real transactions'
            : `${monthName} so far · ${flow.currency}`
        }
        href="/portal/transactions"
      />
      {loading ? (
        <ZoneSkeleton rows={4} />
      ) : (
        <>
          <div className="px-5 pb-4 sm:px-6">
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Net this month
            </p>
            <p
              className="num text-[26px] font-semibold leading-tight tracking-tight"
              style={{ color: net > 0 ? 'var(--up)' : 'var(--text-primary)' }}
            >
              {hidden ? MASK : formatMoney(net, flow.currency, true)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--hairline)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Money in
                </p>
                <p className="num text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {show(flow.moneyIn)}
                </p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--hairline)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Money out
                </p>
                <p className="num text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {show(flow.moneyOut)}
                </p>
              </div>
            </div>
            {comparable && (
              <p className="mt-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Same days last month: {show(flow.lastIn ?? 0)} in · {show(flow.lastOut ?? 0)} out
              </p>
            )}
          </div>

          {groups.length === 0 ? (
            <p
              className="border-t px-5 py-5 text-[13px] sm:px-6"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--hairline)' }}
            >
              Nothing has moved through your accounts yet. Transactions appear here as soon as they do.
            </p>
          ) : (
            <div className="border-t pb-2" style={{ borderColor: 'var(--hairline)' }}>
              {groups.map(group => (
                <div key={group.label}>
                  <p className="px-5 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wider sm:px-6" style={{ color: 'var(--text-muted)' }}>
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map(t => {
                      const incoming = t.direction === 'IN';
                      const struck = t.status === 'DECLINED' || t.status === 'REVERSED';
                      return (
                        <li key={t.id} className="sb-row !cursor-default">
                          <GlyphTile name={glyphFor(t.category)} className="h-10 w-10 shrink-0 rounded-full" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                              {t.merchant}
                            </span>
                            <span className="block truncate text-[13px]" style={{ color: 'var(--text-muted)' }}>
                              {t.category} ·{' '}
                              {new Date(t.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span
                              className={`num block text-[15px] font-semibold ${struck ? 'line-through opacity-60' : ''}`}
                              style={{ color: incoming ? 'var(--up)' : 'var(--text-primary)' }}
                            >
                              {hidden ? MASK : formatMoney(incoming ? t.amount : -t.amount, t.currency, true)}
                            </span>
                            <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {caption(t)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Zone>
  );
}
