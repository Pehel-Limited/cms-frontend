'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  accountService,
  type AccountResponse,
  type AccountPartyRoleRequest,
  type AccountIdentifierRequest,
  type AccountLimitRequest,
  accountCategoryLabels,
  accountTypeLabels,
  accountStatusLabels,
  partyRoleTypeLabels,
  identifierTypeLabels,
  limitTypeLabels,
  formatCurrency,
  type AccountPartyRoleType,
  type AccountIdentifierType,
  type LimitType,
} from '@/services/api/accountService';

// ============================================================================
// Tones — every chip carries its text label; backgrounds use rgba() so both
// themes stay readable.
// ============================================================================

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

const TONE_BG: Record<Tone, string> = {
  neutral: 'rgba(127,127,127,0.12)',
  positive: 'rgba(16,185,129,0.14)',
  warning: 'rgba(245,158,11,0.16)',
  negative: 'rgba(239,68,68,0.14)',
  accent: 'var(--rm-accent-muted)',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'var(--rm-text-muted)',
  positive: '#10b981',
  warning: '#f59e0b',
  negative: '#ef4444',
  accent: 'var(--rm-accent)',
};

const statusTone = (s: string): Tone => {
  switch ((s || '').toUpperCase()) {
    case 'ACTIVE':
      return 'positive';
    case 'PENDING':
    case 'DORMANT':
      return 'warning';
    case 'FROZEN':
      return 'accent';
    case 'CLOSED':
    case 'BLOCKED':
      return 'negative';
    default:
      return 'neutral';
  }
};

const categoryTone = (c: string): Tone => {
  switch ((c || '').toUpperCase()) {
    case 'DEPOSIT':
      return 'positive';
    case 'CREDIT':
      return 'accent';
    default:
      return 'neutral';
  }
};

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
};

const INPUT_CLASS = 'w-full rounded-xl px-4 py-2.5 text-sm';

function errorInputStyle(hasError: boolean): React.CSSProperties {
  return {
    ...INPUT_STYLE,
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.6)' : 'var(--rm-border)'}`,
  };
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================================
// Page
// ============================================================================

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Action feedback is kept separate from the load error so a failed
     secondary action never replaces the page with an error screen. */
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeError, setFreezeError] = useState<string | null>(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showAddIdentifierModal, setShowAddIdentifierModal] = useState(false);
  const [showAddLimitModal, setShowAddLimitModal] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAccount(await accountService.getAccountById(accountId));
    } catch (err) {
      console.error('Failed to load account:', err);
      setLoadError('We could not load this account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) loadAccount();
  }, [accountId, loadAccount]);

  const runAction = async (key: string, fn: () => Promise<AccountResponse>, successText: string) => {
    setActionLoading(key);
    setActionMessage(null);
    try {
      setAccount(await fn());
      setActionMessage({ tone: 'success', text: successText });
    } catch (err) {
      console.error(`Account action "${key}" failed:`, err);
      setActionMessage({ tone: 'error', text: `We could not ${key} this account. Please try again.` });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFreeze = async () => {
    if (!freezeReason.trim()) {
      setFreezeError('A reason is required before the account can be frozen.');
      return;
    }
    setFreezeError(null);
    setActionLoading('freeze');
    try {
      setAccount(await accountService.freezeAccount(accountId, freezeReason.trim()));
      setShowFreezeModal(false);
      setFreezeReason('');
      setActionMessage({ tone: 'success', text: 'The account has been frozen.' });
    } catch (err) {
      console.error('Failed to freeze account:', err);
      setFreezeError('We could not freeze this account. Your reason has been kept — please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // ------------------------------------------------------------------ loading
  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <p role="status" className="sr-only">
          Loading account
        </p>
        <div className="h-36 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- error
  if (loadError || !account) {
    return (
      <div className="rounded-3xl p-7 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          Account unavailable
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }} role="alert">
          {loadError || 'We could not find this account.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={loadAccount}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            Try again
          </button>
          <Link
            href="/dashboard/accounts"
            className="rounded-full px-5 py-2.5 text-sm font-medium"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  const tone = statusTone(account.status);
  const primaryAction =
    account.status === 'PENDING'
      ? { key: 'activate', label: 'Activate account', run: () => runAction('activate', () => accountService.activateAccount(accountId), 'The account is now active.') }
      : account.status === 'FROZEN'
        ? { key: 'unfreeze', label: 'Unfreeze account', run: () => runAction('unfreeze', () => accountService.unfreezeAccount(accountId), 'The account has been unfrozen.') }
        : account.status === 'ACTIVE'
          ? { key: 'freeze-open', label: 'Freeze account', run: () => { setFreezeError(null); setShowFreezeModal(true); } }
          : null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/accounts"
        className="inline-flex items-center gap-1.5 text-sm font-medium w-fit rounded-lg"
        style={{ color: 'var(--rm-text-muted)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Back to accounts
      </Link>

      {/* Header */}
      <header className="rounded-3xl p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <span
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
              aria-hidden="true"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1
                className="text-2xl font-semibold tracking-tight break-words"
                style={{ color: 'var(--rm-text)' }}
              >
                {account.accountName}
              </h1>
              <p className="mt-1.5 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                {account.accountNumber}
              </p>
              <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                <Pill tone={tone}>{accountStatusLabels[account.status]}</Pill>
                <Pill tone={categoryTone(account.accountCategory)}>
                  {accountCategoryLabels[account.accountCategory]}
                </Pill>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SecondaryButton onClick={() => router.push(`/dashboard/accounts/${accountId}/edit`)}>
              Edit details
            </SecondaryButton>
            {['ACTIVE', 'DORMANT'].includes(account.status) && (
              <button
                type="button"
                onClick={() => setShowCloseModal(true)}
                disabled={actionLoading !== null}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
              >
                Close account
              </button>
            )}
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.run}
                disabled={actionLoading !== null}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--rm-accent)' }}
              >
                {actionLoading ? 'Working…' : primaryAction.label}
              </button>
            )}
          </div>
        </div>

        {actionMessage && (
          <p
            role={actionMessage.tone === 'error' ? 'alert' : 'status'}
            className="mt-5 rounded-2xl px-5 py-4 text-sm"
            style={{
              backgroundColor:
                actionMessage.tone === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.14)',
              color: 'var(--rm-text)',
            }}
          >
            {actionMessage.text}
          </p>
        )}

        <dl
          className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-6 sm:grid-cols-4"
          style={{ borderColor: 'var(--rm-border)' }}
        >
          <Fact label="Type" value={accountTypeLabels[account.accountType]} />
          <Fact label="Currency" value={account.currency} />
          <Fact
            label="Interest rate"
            value={account.interestRate != null ? `${account.interestRate}%` : '—'}
          />
          <Fact label="Opened" value={account.openedAt ? formatDate(account.openedAt) : 'Not yet opened'} />
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2 min-w-0">
          {account.balance ? (
            <Panel title="Balances">
              <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                <Fact
                  label="Available"
                  value={formatCurrency(account.balance.availableBalance ?? 0, account.currency)}
                  amount
                />
                <Fact
                  label="Current"
                  value={formatCurrency(account.balance.currentBalance ?? 0, account.currency)}
                  amount
                />
                <Fact
                  label="On hold"
                  value={formatCurrency(account.balance.holdsAmount ?? 0, account.currency)}
                  amount
                />
                <Fact
                  label="Accrued interest"
                  value={formatCurrency(account.balance.accruedInterest ?? 0, account.currency)}
                  amount
                />
              </dl>
              <p className="mt-4 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
                Balances are as at {formatDate(account.balance.asOf)}.
              </p>
            </Panel>
          ) : (
            <Panel title="Balances">
              <EmptyRow>No balance has been posted to this account yet.</EmptyRow>
            </Panel>
          )}

          <Panel
            title="Holders and roles"
            action={
              <PanelAction onClick={() => setShowAddPartyModal(true)}>Add holder</PanelAction>
            }
          >
            {account.partyRoles.length === 0 ? (
              <EmptyRow>No holders or roles have been assigned.</EmptyRow>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {account.partyRoles.map(role => (
                  <li
                    key={role.id}
                    className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 flex-wrap"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-base font-medium truncate" style={{ color: 'var(--rm-text)' }}>
                        {role.partyName || role.partyId}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
                        {partyRoleTypeLabels[role.role]}
                        {role.ownershipPercentage != null && ` · ${role.ownershipPercentage}% ownership`}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {role.isPrimary && <Tag tone="accent">Primary holder</Tag>}
                      {role.canTransact && <Tag tone="positive">Can transact</Tag>}
                      {role.canView && <Tag tone="neutral">Can view</Tag>}
                      {role.canManage && <Tag tone="neutral">Can manage</Tag>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Identifiers"
            action={
              <PanelAction onClick={() => setShowAddIdentifierModal(true)}>
                Add identifier
              </PanelAction>
            }
          >
            {account.identifiers.length === 0 ? (
              <EmptyRow>No identifiers have been registered.</EmptyRow>
            ) : (
              <dl className="mt-4 space-y-2.5">
                {account.identifiers.map(identifier => (
                  <div
                    key={identifier.id}
                    className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 flex-wrap"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  >
                    <div className="min-w-0">
                      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                        {identifierTypeLabels[identifier.identifierType]}
                      </dt>
                      <dd
                        className="text-base font-medium truncate tabular-nums"
                        style={{ color: 'var(--rm-text)' }}
                      >
                        {identifier.identifierValue}
                      </dd>
                    </div>
                    {identifier.isPrimary && <Tag tone="accent">Primary</Tag>}
                  </div>
                ))}
              </dl>
            )}
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 min-w-0">
          <Panel title="Key dates">
            <dl className="mt-1 space-y-4">
              <Row label="Opened" value={account.openedAt ? formatDate(account.openedAt) : 'Not yet opened'} />
              {account.maturityDate && <Row label="Matures" value={formatDate(account.maturityDate)} />}
              {account.closedAt && <Row label="Closed" value={formatDate(account.closedAt)} />}
              {account.termMonths != null && (
                <Row label="Term" value={`${account.termMonths} months`} />
              )}
              <Row label="Auto-renew" value={account.autoRenew ? 'Enabled' : 'Disabled'} />
            </dl>
          </Panel>

          <Panel
            title="Limits"
            action={<PanelAction onClick={() => setShowAddLimitModal(true)}>Add limit</PanelAction>}
          >
            {account.limits.length === 0 ? (
              <EmptyRow>No limits have been configured.</EmptyRow>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {account.limits.map(limit => (
                  <li
                    key={limit.id}
                    className="rounded-2xl px-5 py-4"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                        {limitTypeLabels[limit.limitType]}
                      </p>
                      <Tag tone={limit.isEnabled ? 'positive' : 'neutral'}>
                        {limit.isEnabled ? 'Enabled' : 'Disabled'}
                      </Tag>
                    </div>
                    <dl className="mt-3 space-y-1.5">
                      <Row
                        label="Limit"
                        value={formatCurrency(limit.limitAmount, limit.currencyCode)}
                        amount
                      />
                      <Row
                        label="Used"
                        value={formatCurrency(limit.usedAmount, limit.currencyCode)}
                        amount
                      />
                      <Row
                        label="Available"
                        value={formatCurrency(limit.availableAmount, limit.currencyCode)}
                        amount
                      />
                      {limit.effectiveTo && (
                        <Row label="Effective until" value={formatDate(limit.effectiveTo)} />
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {account.notes && (
            <Panel title="Notes">
              <p
                className="mt-1 whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: 'var(--rm-text-secondary)' }}
              >
                {account.notes}
              </p>
            </Panel>
          )}
        </div>
      </div>

      {/* Freeze dialog */}
      {showFreezeModal && (
        <Dialog
          title="Freeze account"
          onClose={() => {
            if (actionLoading !== 'freeze') {
              setShowFreezeModal(false);
              setFreezeError(null);
            }
          }}
        >
          <label
            htmlFor="freeze-reason"
            className="block text-sm mb-1.5"
            style={{ color: 'var(--rm-text-secondary)' }}
          >
            Reason for freezing
            <span aria-hidden="true" className="text-red-600 dark:text-red-400">
              {' '}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </label>
          <textarea
            id="freeze-reason"
            value={freezeReason}
            onChange={e => {
              setFreezeReason(e.target.value);
              if (freezeError) setFreezeError(null);
            }}
            rows={3}
            required
            aria-required="true"
            aria-invalid={freezeError ? true : undefined}
            aria-describedby={freezeError ? 'freeze-reason-error' : 'freeze-reason-hint'}
            placeholder="Record why access is being restricted"
            className={INPUT_CLASS}
            style={errorInputStyle(!!freezeError)}
          />
          <p id="freeze-reason-hint" className="text-xs mt-1.5" style={{ color: 'var(--rm-text-muted)' }}>
            The account stays frozen until it is explicitly unfrozen.
          </p>
          {freezeError && (
            <p id="freeze-reason-error" role="alert" className="text-sm mt-3 text-red-700 dark:text-red-300">
              {freezeError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton
              onClick={() => {
                setShowFreezeModal(false);
                setFreezeError(null);
              }}
              disabled={actionLoading === 'freeze'}
            >
              Cancel
            </SecondaryButton>
            <button
              type="button"
              onClick={handleFreeze}
              disabled={actionLoading === 'freeze'}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--rm-accent)' }}
            >
              {actionLoading === 'freeze' ? 'Freezing…' : 'Freeze account'}
            </button>
          </div>
        </Dialog>
      )}

      {/* Close dialog */}
      {showCloseModal && (
        <Dialog
          title="Close account"
          onClose={() => {
            if (actionLoading !== 'close') setShowCloseModal(false);
          }}
        >
          <p className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            Closing <strong style={{ color: 'var(--rm-text)' }}>{account.accountName}</strong> stops
            all further activity on it. This cannot be easily undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton
              onClick={() => setShowCloseModal(false)}
              disabled={actionLoading === 'close'}
            >
              Keep account open
            </SecondaryButton>
            <button
              type="button"
              onClick={() => {
                setShowCloseModal(false);
                runAction('close', () => accountService.closeAccount(accountId), 'The account has been closed.');
              }}
              disabled={actionLoading !== null}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'rgba(220,38,38,1)' }}
            >
              {actionLoading === 'close' ? 'Closing…' : 'Close account'}
            </button>
          </div>
        </Dialog>
      )}

      {showAddPartyModal && (
        <AddPartyModal
          accountId={accountId}
          onClose={() => setShowAddPartyModal(false)}
          onSuccess={updated => {
            setAccount(updated);
            setShowAddPartyModal(false);
            setActionMessage({ tone: 'success', text: 'The holder was added to this account.' });
          }}
        />
      )}
      {showAddIdentifierModal && (
        <AddIdentifierModal
          accountId={accountId}
          onClose={() => setShowAddIdentifierModal(false)}
          onSuccess={updated => {
            setAccount(updated);
            setShowAddIdentifierModal(false);
            setActionMessage({ tone: 'success', text: 'The identifier was added.' });
          }}
        />
      )}
      {showAddLimitModal && (
        <AddLimitModal
          accountId={accountId}
          currencyCode={account.currency}
          onClose={() => setShowAddLimitModal(false)}
          onSuccess={updated => {
            setAccount(updated);
            setShowAddLimitModal(false);
            setActionMessage({ tone: 'success', text: 'The limit was added.' });
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Shared presentational helpers
// ============================================================================

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
      style={{ backgroundColor: TONE_BG[tone], color: 'var(--rm-text)' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: TONE_DOT[tone] }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: TONE_BG[tone], color: 'var(--rm-text-secondary)' }}
    >
      {children}
    </span>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
      style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
    >
      {children}
    </button>
  );
}

function Fact({ label, value, amount }: { label: string; value: string; amount?: boolean }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd
        className={`mt-1 font-medium ${amount ? 'text-base tabular-nums' : 'text-base'}`}
        style={{ color: 'var(--rm-text)' }}
      >
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value, amount }: { label: string; value: string; amount?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd
        className={`text-sm font-medium ${amount ? 'tabular-nums' : ''}`}
        style={{ color: 'var(--rm-text)' }}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
      {children}
    </p>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = `dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.55)' }}
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-3xl p-7"
        style={{ backgroundColor: 'var(--rm-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id={titleId}
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded-full p-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function FieldLabel({ id, children, required }: { id: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
      {children}
      {required && (
        <>
          <span aria-hidden="true" className="text-red-600 dark:text-red-400">
            {' '}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
  );
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl px-5 py-4 text-sm"
      style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
    >
      {message}
    </p>
  );
}

// ============================================================================
// Sub-dialogs — errors are scoped here so typed input is never lost
// ============================================================================

function AddPartyModal({
  accountId,
  onClose,
  onSuccess,
}: {
  accountId: string;
  onClose: () => void;
  onSuccess: (a: AccountResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountPartyRoleRequest>({
    partyId: '',
    partyType: 'INDIVIDUAL',
    role: 'PRIMARY_HOLDER',
    isPrimary: false,
    canTransact: true,
    canView: true,
    canManage: false,
    startDate: new Date().toISOString().split('T')[0],
    endDate: undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onSuccess(await accountService.addPartyRole(accountId, formData));
    } catch (err) {
      console.error('Failed to add party role:', err);
      setError('We could not add this holder. Your details have been kept — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title="Add a holder" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel id="party-id" required>
            Customer or party ID
          </FieldLabel>
          <input
            id="party-id"
            type="text"
            value={formData.partyId}
            onChange={e => setFormData({ ...formData, partyId: e.target.value })}
            required
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'add-party-error' : undefined}
            className={INPUT_CLASS}
            style={errorInputStyle(!!error)}
          />
        </div>
        <div>
          <FieldLabel id="party-type">Party type</FieldLabel>
          <select
            id="party-type"
            value={formData.partyType}
            onChange={e => setFormData({ ...formData, partyType: e.target.value })}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          >
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUSINESS">Business</option>
            <option value="CORPORATE">Corporate</option>
          </select>
        </div>
        <div>
          <FieldLabel id="party-role">Role</FieldLabel>
          <select
            id="party-role"
            value={formData.role}
            onChange={e =>
              setFormData({ ...formData, role: e.target.value as AccountPartyRoleType })
            }
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          >
            {(Object.keys(partyRoleTypeLabels) as AccountPartyRoleType[]).map(role => (
              <option key={role} value={role}>
                {partyRoleTypeLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel id="party-ownership">Ownership percentage</FieldLabel>
          <input
            id="party-ownership"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.ownershipPercentage ?? ''}
            onChange={e =>
              setFormData({
                ...formData,
                ownershipPercentage: e.target.value === '' ? undefined : parseFloat(e.target.value),
              })
            }
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            Permissions
          </legend>
          <div className="space-y-2.5">
            {(
              [
                { key: 'isPrimary', label: 'Primary holder' },
                { key: 'canTransact', label: 'Can transact' },
                { key: 'canView', label: 'Can view' },
                { key: 'canManage', label: 'Can manage' },
              ] as const
            ).map(item => (
              <label key={item.key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  id={`party-${item.key}`}
                  type="checkbox"
                  checked={formData[item.key]}
                  onChange={e => setFormData({ ...formData, [item.key]: e.target.checked })}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: 'var(--rm-accent)' }}
                />
                <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div id="add-party-error">
          <FormAlert message={error} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <SecondaryButton onClick={onClose} disabled={loading}>
            Cancel
          </SecondaryButton>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {loading ? 'Adding…' : 'Add holder'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AddIdentifierModal({
  accountId,
  onClose,
  onSuccess,
}: {
  accountId: string;
  onClose: () => void;
  onSuccess: (a: AccountResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountIdentifierRequest>({
    identifierType: 'IBAN',
    identifierValue: '',
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onSuccess(await accountService.addIdentifier(accountId, formData));
    } catch (err) {
      console.error('Failed to add identifier:', err);
      setError('We could not add this identifier. Your details have been kept — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title="Add an identifier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel id="identifier-type">Identifier type</FieldLabel>
          <select
            id="identifier-type"
            value={formData.identifierType}
            onChange={e =>
              setFormData({
                ...formData,
                identifierType: e.target.value as AccountIdentifierType,
              })
            }
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          >
            {(Object.keys(identifierTypeLabels) as AccountIdentifierType[]).map(type => (
              <option key={type} value={type}>
                {identifierTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel id="identifier-value" required>
            Value
          </FieldLabel>
          <input
            id="identifier-value"
            type="text"
            value={formData.identifierValue}
            onChange={e => setFormData({ ...formData, identifierValue: e.target.value })}
            required
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'add-identifier-error' : undefined}
            placeholder={formData.identifierType === 'IBAN' ? 'IE64IRCE92050112345678' : undefined}
            className={INPUT_CLASS}
            style={errorInputStyle(!!error)}
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            id="identifier-isPrimary"
            type="checkbox"
            checked={formData.isPrimary}
            onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
            className="h-4 w-4 rounded"
            style={{ accentColor: 'var(--rm-accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            Primary identifier
          </span>
        </label>

        <div id="add-identifier-error">
          <FormAlert message={error} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <SecondaryButton onClick={onClose} disabled={loading}>
            Cancel
          </SecondaryButton>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {loading ? 'Adding…' : 'Add identifier'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AddLimitModal({
  accountId,
  currencyCode,
  onClose,
  onSuccess,
}: {
  accountId: string;
  currencyCode: string;
  onClose: () => void;
  onSuccess: (a: AccountResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountLimitRequest>({
    limitType: 'DAILY_DEBIT',
    limitAmount: 0,
    currencyCode,
    usedAmount: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: undefined,
    isEnabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onSuccess(await accountService.addLimit(accountId, formData));
    } catch (err) {
      console.error('Failed to add limit:', err);
      setError('We could not add this limit. Your details have been kept — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title="Add a limit" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel id="limit-type">Limit type</FieldLabel>
          <select
            id="limit-type"
            value={formData.limitType}
            onChange={e => setFormData({ ...formData, limitType: e.target.value as LimitType })}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          >
            {(Object.keys(limitTypeLabels) as LimitType[]).map(type => (
              <option key={type} value={type}>
                {limitTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel id="limit-amount" required>
            Limit amount ({currencyCode})
          </FieldLabel>
          <input
            id="limit-amount"
            type="number"
            value={formData.limitAmount}
            onChange={e => setFormData({ ...formData, limitAmount: parseFloat(e.target.value) || 0 })}
            required
            aria-required="true"
            min="0"
            step="0.01"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'add-limit-error' : undefined}
            className={`${INPUT_CLASS} tabular-nums`}
            style={errorInputStyle(!!error)}
          />
        </div>
        <div>
          <FieldLabel id="limit-effective-to">Effective until</FieldLabel>
          <input
            id="limit-effective-to"
            type="date"
            value={formData.effectiveTo || ''}
            onChange={e =>
              setFormData({ ...formData, effectiveTo: e.target.value || undefined })
            }
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            id="limit-isEnabled"
            type="checkbox"
            checked={formData.isEnabled}
            onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })}
            className="h-4 w-4 rounded"
            style={{ accentColor: 'var(--rm-accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            Enabled
          </span>
        </label>

        <div id="add-limit-error">
          <FormAlert message={error} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <SecondaryButton onClick={onClose} disabled={loading}>
            Cancel
          </SecondaryButton>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--rm-accent)' }}
          >
            {loading ? 'Adding…' : 'Add limit'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
