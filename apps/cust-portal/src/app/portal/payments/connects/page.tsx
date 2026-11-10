'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import Glyph from '@/components/ui/Glyph';
import { MoneySheet, PersonBadge, type MoneySheetMode } from '@/components/retail/MoneySheet';
import { useRetailEligibility } from '@/hooks/useRetailEligibility';
import { retailService, type Connect } from '@/services/api/retail-service';

const SOURCE_LABEL: Record<string, string> = {
  REGISTERED_PAYEE: 'Saved payee',
  PAST_TRANSFER: 'Paid before',
};

export default function ConnectsPage() {
  const eligible = useRetailEligibility();
  const [connects, setConnects] = useState<Connect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<{ mode: MoneySheetMode; connect: Connect | null } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await retailService.connects();
      setConnects(result.connects);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'We couldn’t load your Connects.');
    }
  }, []);

  useEffect(() => {
    if (eligible === true) void load();
  }, [eligible, load]);

  const filtered = useMemo(() => {
    if (!connects) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return connects;
    return connects.filter(c =>
      [c.displayName, c.nickname, c.verifiedName].some(v => v?.toLowerCase().includes(needle))
    );
  }, [connects, query]);

  if (eligible === false) {
    return (
      <div className="space-y-5">
        <PageHero
          title="Connects"
          subtitle="Connects is available to personal customers."
        />
        <div className="glass-panel p-6" data-testid="not-eligible">
          <p style={{ color: 'var(--text-secondary)' }}>
            This feature isn’t available for your type of account.
          </p>
          <Link href="/portal/payments" className="pill-btn mt-4 inline-flex">
            Back to payments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="Connects"
        subtitle="People you already pay. Send or request in seconds, by voice or by typing."
        actions={
          <>
            <button type="button" className="pill-btn" onClick={() => setSheet({ mode: 'request', connect: null })}>
              Request
            </button>
            <button type="button" className="pill-btn pill-btn-solid" onClick={() => setSheet({ mode: 'send', connect: null })}>
              Send
              <Glyph name="send" className="h-4 w-4" />
            </button>
          </>
        }
        meta={connects ? <span className="chip num">{connects.length} connects</span> : undefined}
      />

      <section className="glass-panel" aria-label="Your Connects">
        <div className="glass-head">
          <div>
            <h2 className="glass-title">Your people</h2>
            <p className="glass-sub">Built from your saved payees and past transfers.</p>
          </div>
        </div>
        <div className="px-5 pb-2">
          <label htmlFor="connect-search" className="sr-only">
            Search Connects
          </label>
          <input
            id="connect-search"
            type="search"
            className="input w-full"
            placeholder="Search by name"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>

        {error && (
          <div className="px-5 py-4" role="alert">
            <p className="text-sm">{error}</p>
            <button type="button" className="pill-btn mt-3" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {!error && connects === null && (
          <ul className="space-y-3 px-5 py-4" aria-busy="true" aria-label="Loading">
            {[0, 1, 2].map(i => (
              <li key={i} className="h-16 rounded-2xl motion-safe:animate-pulse" style={{ backgroundColor: 'var(--tile-bg)' }} />
            ))}
          </ul>
        )}

        {connects && filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }} data-testid="connects-empty">
            {connects.length === 0 ? 'No Connects yet. Pay someone and they’ll appear here.' : 'No one matches that search.'}
          </p>
        )}

        {connects && filtered.length > 0 && (
          <ul className="divide-y" style={{ borderColor: 'var(--hairline)' }} data-testid="connect-list">
            {filtered.map(connect => (
              <li key={connect.connectId} className="px-5 py-4" data-testid="connect-row">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PersonBadge
                    name={connect.displayName}
                    subtitle={[
                      connect.maskedIban && `Account ${connect.maskedIban}`,
                      connect.maskedPhone && `Phone ${connect.maskedPhone}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="pill-btn"
                      disabled={!connect.canRequest}
                      onClick={() => setSheet({ mode: 'request', connect })}
                      aria-label={`Request from ${connect.displayName}`}
                    >
                      Request
                    </button>
                    <button
                      type="button"
                      className="pill-btn pill-btn-solid"
                      disabled={!connect.canSend}
                      onClick={() => setSheet({ mode: 'send', connect })}
                      aria-label={`Send to ${connect.displayName}`}
                    >
                      Send
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {connect.sources.map(source => (
                    <span key={source} className="chip text-[11px]">
                      {SOURCE_LABEL[source] ?? source}
                    </span>
                  ))}
                  {connect.verifiedName && <span className="chip text-[11px]">Superbank customer</span>}
                </div>
                {(connect.sendBlockedReason || connect.requestBlockedReason) && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {connect.sendBlockedReason ?? connect.requestBlockedReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <MoneySheet
        open={sheet !== null}
        mode={sheet?.mode ?? 'send'}
        presetConnect={sheet?.connect ?? null}
        onClose={() => setSheet(null)}
        onCompleted={() => void load()}
      />
    </div>
  );
}
