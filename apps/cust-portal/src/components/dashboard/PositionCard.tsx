'use client';

import Link from 'next/link';
import { AccountPlastic } from '@/components/banking/AccountPlastic';
import { EyeToggle } from '@/components/ui/EyeToggle';
import Glyph, { CurrencyGlyph } from '@/components/ui/Glyph';
import type { BankAccount } from '@/lib/banking-data';
import { formatMoney, type FinancialPosition } from '@/lib/dashboard-model';
import type { AccountSource, SampleReason } from '@/services/api/account-service';

const MASK = '••••••';

type Action = { label: string; href: string; glyph: string } | { label: string; request: true };

/* The verbs. Destinations already in the bottom bar (Accounts, Payments, Applications) are not
   repeated; these are the things a customer opens the app to do. */
const ACTIONS: Action[] = [
  { label: 'Send', href: '/portal/payments', glyph: 'send' },
  { label: 'Request', request: true },
  { label: 'Pay bills', href: '/portal/payments', glyph: 'Bills' },
  { label: 'Cards', href: '/portal/cards', glyph: 'current' },
  { label: 'Borrow', href: '/portal/products', glyph: 'bank' },
  { label: 'Statements', href: '/portal/documents', glyph: 'doc' },
];

function asOfLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `Updated ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : `As of ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

export function PositionCard({
  position,
  accounts,
  source,
  sampleReason,
  loading,
  hidden,
  onToggleHidden,
  onRequest,
}: {
  position: FinancialPosition;
  accounts: BankAccount[];
  source: AccountSource;
  sampleReason: SampleReason | null;
  loading: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
  onRequest: () => void;
}) {
  const show = (v: string) => (hidden ? MASK : v);
  const stamp = asOfLabel(position.asOf);

  return (
    <section aria-labelledby="zone-position" className="space-y-4">
      <div className="sb-hero">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <h2 id="zone-position" className="text-[13px] font-medium text-white/75">
              Available across {position.depositCount} account{position.depositCount === 1 ? '' : 's'}
            </h2>
            <EyeToggle hidden={hidden} onToggle={onToggleHidden} className="sb-hero-btn -my-1" />
          </div>
          {loading ? (
            <div className="mt-1 h-10 w-48 animate-pulse rounded-xl bg-white/15" aria-label="Loading balances" />
          ) : (
            <p className="num sb-hero-amount">{show(formatMoney(position.available, position.currency))}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
            {source === 'SAMPLE' ? (
              <span className="sb-chip sb-chip-warn">
                Sample data ·{' '}
                {sampleReason === 'SERVICE_UNAVAILABLE'
                  ? 'live accounts are unavailable right now'
                  : 'no live accounts on this profile'}
              </span>
            ) : (
              <span className="sb-chip">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                Live{stamp ? ` · ${stamp}` : ''}
              </span>
            )}
            {!loading && position.balance !== position.available && (
              <span className="sb-chip">Balance {show(formatMoney(position.balance, position.currency))}</span>
            )}
            {!loading && position.owed != null && (
              <span className="sb-chip">
                Borrowing {show(formatMoney(position.owed, position.currency))} owed
              </span>
            )}
            {!loading && position.otherCurrencyCount > 0 && (
              <span className="sb-chip">
                +{position.otherCurrencyCount} in other currencies
              </span>
            )}
          </div>

          <nav aria-label="Quick actions" className="sb-actions mt-5">
            {ACTIONS.map(a => {
              const icon =
                'request' in a ? (
                  <CurrencyGlyph currency={position.currency} className="h-5 w-5" strokeWidth={1.8} />
                ) : (
                  <Glyph name={a.glyph} className="h-5 w-5" strokeWidth={1.8} />
                );
              const body = (
                <>
                  <span className="sb-action-icon">{icon}</span>
                  <span className="sb-action-label">{a.label}</span>
                </>
              );
              return 'request' in a ? (
                <button key={a.label} type="button" onClick={onRequest} aria-haspopup="dialog" className="sb-action">
                  {body}
                </button>
              ) : (
                <Link key={a.label} href={a.href} className="sb-action">
                  {body}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Your accounts
          </h3>
          <Link href="/portal/accounts" className="sb-link">
            Manage
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-hidden" aria-hidden="true">
            <div className="skeleton h-[150px] w-[260px] shrink-0" />
            <div className="skeleton h-[150px] w-[260px] shrink-0" />
          </div>
        ) : (
          <div className="acct-list" role="list" aria-label="Accounts — swipe for more">
            {accounts.map(acc => (
              <Link
                key={acc.id}
                role="listitem"
                href={`/portal/accounts/${acc.id}`}
                aria-label={`${acc.name}${hidden ? '' : `, balance ${formatMoney(acc.balance, acc.currency)}`}`}
              >
                <AccountPlastic acc={acc} hidden={hidden} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
