'use client';

/* Latest recorded change per application.

   There is no portfolio-wide audit endpoint — the only audit route is per
   application — so this feed is built from the two real timestamps the worklist
   already carries: when an application was submitted and when it last changed.
   It is labelled accordingly rather than presented as a full audit trail. */

export interface ActivityItem {
  id: string;
  who: string;
  what: string;
  when: string;
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

const ICONS = [
  'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
];

export default function RecentActivity({
  items,
  loading,
}: {
  items: ActivityItem[];
  loading: boolean;
}) {
  return (
    <section className="rm-panel">
      <div className="rm-panel-head">
        <div>
          <h2 className="rm-title">Recent activity</h2>
          <p className="rm-sub">Last recorded change per application</p>
        </div>
      </div>

      <div className="rm-body">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: 'var(--rm-hairline)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--rm-hairline)' }} />
                  <div className="h-3 w-1/3 animate-pulse rounded" style={{ backgroundColor: 'var(--rm-hairline)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            No application activity recorded yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={item.id} className="flex items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
                  aria-hidden="true"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[i % ICONS.length]} />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--rm-text)' }}>
                      {item.who}
                    </span>{' '}
                    {item.what}
                  </p>
                </div>
                <span className="num shrink-0 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  {ago(item.when)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
