'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
// Theme-aware colour maps (hex → works in light & dark)
// ============================================================================

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#10b981',
  PENDING: '#f59e0b',
  DORMANT: '#f59e0b',
  FROZEN: '#3b82f6',
  CLOSED: '#ef4444',
  BLOCKED: '#ef4444',
};

const CATEGORY_COLOR: Record<string, string> = {
  DEPOSIT: '#10b981',
  CREDIT: '#8b5cf6',
  OPERATIONAL: '#0ea5e9',
};

const INPUT_STYLE = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
} as const;

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showAddIdentifierModal, setShowAddIdentifierModal] = useState(false);
  const [showAddLimitModal, setShowAddLimitModal] = useState(false);

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountService.getAccountById(accountId);
      setAccount(data);
    } catch (err) {
      console.error('Failed to load account:', err);
      setError('Failed to load account details.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) loadAccount();
  }, [accountId, loadAccount]);

  const handleActivate = async () => {
    try {
      setActionLoading(true);
      const updated = await accountService.activateAccount(accountId);
      setAccount(updated);
    } catch (err) {
      console.error('Failed to activate account:', err);
      setError('Failed to activate account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreeze = async () => {
    if (!freezeReason) return;
    try {
      setActionLoading(true);
      const updated = await accountService.freezeAccount(accountId, freezeReason);
      setAccount(updated);
      setShowFreezeModal(false);
      setFreezeReason('');
    } catch (err) {
      console.error('Failed to freeze account:', err);
      setError('Failed to freeze account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async () => {
    try {
      setActionLoading(true);
      const updated = await accountService.unfreezeAccount(accountId);
      setAccount(updated);
    } catch (err) {
      console.error('Failed to unfreeze account:', err);
      setError('Failed to unfreeze account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    try {
      setActionLoading(true);
      const updated = await accountService.closeAccount(accountId);
      setAccount(updated);
      setShowCloseModal(false);
    } catch (err) {
      console.error('Failed to close account:', err);
      setError('Failed to close account.');
    } finally {
      setActionLoading(false);
    }
  };

  // ------------------------------------------------------------------ loading
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-5">
          <div className="h-32 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
              ))}
            </div>
            <div className="space-y-5">
              {[1, 2].map(i => (
                <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--rm-card-hover)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- error
  if (error || !account) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>Error Loading Account</h3>
            <p className="mt-1" style={{ color: 'var(--rm-text-muted)' }}>{error || 'Account not found'}</p>
            <Link href="/dashboard/accounts" className="mt-4 inline-block text-sm font-medium" style={{ color: 'var(--rm-accent)' }}>
              ← Back to Accounts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[account.status] || '#64748b';
  const categoryColor = CATEGORY_COLOR[account.accountCategory] || '#64748b';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--rm-bg)' }}>
      <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-5">
        {/* Back link */}
        <Link href="/dashboard/accounts" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
          Back to Accounts
        </Link>

        {/* Header */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--rm-text)' }}>{account.accountName}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                    {accountStatusLabels[account.status]}
                  </span>
                </div>
                <p className="mt-1 font-mono text-sm" style={{ color: 'var(--rm-text-muted)' }}>{account.accountNumber}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/accounts/${accountId}/edit`}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors"
                style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-card)' }}
              >
                Edit
              </Link>
              {account.status === 'PENDING' && (
                <button onClick={handleActivate} disabled={actionLoading} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: 'var(--rm-accent)' }}>
                  Activate
                </button>
              )}
              {account.status === 'ACTIVE' && (
                <HeaderButton onClick={() => setShowFreezeModal(true)} disabled={actionLoading}>Freeze</HeaderButton>
              )}
              {account.status === 'FROZEN' && (
                <button onClick={handleUnfreeze} disabled={actionLoading} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: 'var(--rm-accent)' }}>
                  Unfreeze
                </button>
              )}
              {['ACTIVE', 'DORMANT'].includes(account.status) && (
                <button onClick={() => setShowCloseModal(true)} disabled={actionLoading} className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
                  Close
                </button>
              )}
            </div>
          </div>

          {/* Info row */}
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4" style={{ borderColor: 'var(--rm-border)' }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>Category</p>
              <span className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${categoryColor}22`, color: categoryColor }}>
                {accountCategoryLabels[account.accountCategory]}
              </span>
            </div>
            <InfoItem label="Type" value={accountTypeLabels[account.accountType]} />
            <InfoItem label="Currency" value={account.currency} />
            <InfoItem label="Interest Rate" value={account.interestRate != null ? `${account.interestRate}%` : '—'} />
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
            {error}
            <button onClick={() => setError(null)} className="text-xs font-semibold">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Balance */}
            {account.balance && (
              <Panel>
                <PanelHeader icon={<CoinsIcon />} title="Balance" />
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <BalanceTile label="Available Balance" value={formatCurrency(account.balance.availableBalance ?? 0, account.currency)} accent="#10b981" />
                  <BalanceTile label="Current Balance" value={formatCurrency(account.balance.currentBalance ?? 0, account.currency)} />
                  <BalanceTile label="Hold Balance" value={formatCurrency(account.balance.holdsAmount ?? 0, account.currency)} />
                  <BalanceTile label="Accrued Interest" value={formatCurrency(account.balance.accruedInterest ?? 0, account.currency)} />
                </div>
              </Panel>
            )}

            {/* Party Roles */}
            <Panel>
              <div className="flex items-center justify-between">
                <PanelHeader title="Account Holders & Roles" />
                <button onClick={() => setShowAddPartyModal(true)} className="text-xs font-semibold" style={{ color: 'var(--rm-accent)' }}>+ Add Party</button>
              </div>
              {account.partyRoles.length === 0 ? (
                <EmptyRow>No party roles assigned.</EmptyRow>
              ) : (
                <div className="mt-3 space-y-2">
                  {account.partyRoles.map(role => (
                    <div key={role.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>{role.partyName || role.partyId}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          {partyRoleTypeLabels[role.role]}
                          {role.isPrimary && <Badge color="var(--rm-accent)">Primary</Badge>}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {role.canTransact && <Badge color="#10b981">Transact</Badge>}
                        {role.canView && <Badge color="#3b82f6">View</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Identifiers */}
            <Panel>
              <div className="flex items-center justify-between">
                <PanelHeader title="Account Identifiers" />
                <button onClick={() => setShowAddIdentifierModal(true)} className="text-xs font-semibold" style={{ color: 'var(--rm-accent)' }}>+ Add Identifier</button>
              </div>
              {account.identifiers.length === 0 ? (
                <EmptyRow>No identifiers assigned.</EmptyRow>
              ) : (
                <div className="mt-3 space-y-2">
                  {account.identifiers.map(identifier => (
                    <div key={identifier.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{identifierTypeLabels[identifier.identifierType]}</p>
                        <p className="font-mono text-sm font-medium" style={{ color: 'var(--rm-text)' }}>{identifier.identifierValue}</p>
                      </div>
                      {identifier.isPrimary && <Badge color="var(--rm-accent)">Primary</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Key Dates */}
            <Panel>
              <PanelHeader title="Key Dates" />
              <div className="mt-3 space-y-3">
                <SidebarStat label="Opened Date" value={account.openedAt ? new Date(account.openedAt).toLocaleDateString() : 'Not opened'} />
                {account.maturityDate && <SidebarStat label="Maturity Date" value={new Date(account.maturityDate).toLocaleDateString()} />}
                {account.closedAt && <SidebarStat label="Closed Date" value={new Date(account.closedAt).toLocaleDateString()} />}
                {account.termMonths && <SidebarStat label="Term" value={`${account.termMonths} months`} />}
                <SidebarStat label="Auto Renew" value={account.autoRenew ? 'Yes' : 'No'} />
              </div>
            </Panel>

            {/* Limits */}
            <Panel>
              <div className="flex items-center justify-between">
                <PanelHeader title="Limits" />
                <button onClick={() => setShowAddLimitModal(true)} className="text-xs font-semibold" style={{ color: 'var(--rm-accent)' }}>+ Add Limit</button>
              </div>
              {account.limits.length === 0 ? (
                <EmptyRow>No limits configured.</EmptyRow>
              ) : (
                <div className="mt-3 space-y-3">
                  {account.limits.map(limit => (
                    <div key={limit.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>{limitTypeLabels[limit.limitType]}</p>
                        <Badge color={limit.isEnabled ? '#10b981' : '#64748b'}>{limit.isEnabled ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <LimitRow label="Limit" value={formatCurrency(limit.limitAmount, limit.currencyCode)} />
                      <LimitRow label="Used" value={formatCurrency(limit.usedAmount, limit.currencyCode)} />
                      <LimitRow label="Available" value={formatCurrency(limit.availableAmount, limit.currencyCode)} accent="#10b981" />
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Notes */}
            {account.notes && (
              <Panel>
                <PanelHeader title="Notes" />
                <p className="mt-3 whitespace-pre-wrap text-sm" style={{ color: 'var(--rm-text-secondary)' }}>{account.notes}</p>
              </Panel>
            )}
          </div>
        </div>
      </div>

      {/* Freeze Modal */}
      {showFreezeModal && (
        <Modal title="Freeze Account" onClose={() => { setShowFreezeModal(false); setFreezeReason(''); }}>
          <p className="mb-4 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>Please provide a reason for freezing this account.</p>
          <textarea
            value={freezeReason}
            onChange={e => setFreezeReason(e.target.value)}
            rows={3}
            placeholder="Reason for freezing…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={INPUT_STYLE}
          />
          <div className="mt-6 flex justify-end gap-3">
            <HeaderButton onClick={() => { setShowFreezeModal(false); setFreezeReason(''); }}>Cancel</HeaderButton>
            <button onClick={handleFreeze} disabled={!freezeReason || actionLoading} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--rm-accent)' }}>
              {actionLoading ? 'Freezing…' : 'Freeze Account'}
            </button>
          </div>
        </Modal>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <Modal title="Close Account" onClose={() => setShowCloseModal(false)}>
          <p className="mb-6 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
            Are you sure you want to close this account? This action cannot be easily undone.
          </p>
          <div className="flex justify-end gap-3">
            <HeaderButton onClick={() => setShowCloseModal(false)}>Cancel</HeaderButton>
            <button onClick={handleClose} disabled={actionLoading} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#ef4444' }}>
              {actionLoading ? 'Closing…' : 'Close Account'}
            </button>
          </div>
        </Modal>
      )}

      {showAddPartyModal && (
        <AddPartyModal accountId={accountId} onClose={() => setShowAddPartyModal(false)} onSuccess={updated => { setAccount(updated); setShowAddPartyModal(false); }} />
      )}
      {showAddIdentifierModal && (
        <AddIdentifierModal accountId={accountId} onClose={() => setShowAddIdentifierModal(false)} onSuccess={updated => { setAccount(updated); setShowAddIdentifierModal(false); }} />
      )}
      {showAddLimitModal && (
        <AddLimitModal accountId={accountId} currencyCode={account.currency} onClose={() => setShowAddLimitModal(false)} onSuccess={updated => { setAccount(updated); setShowAddLimitModal(false); }} />
      )}
    </div>
  );
}

// ============================================================================
// Shared presentational helpers
// ============================================================================

function HeaderButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50" style={{ color: 'var(--rm-text-secondary)', border: '1px solid var(--rm-border)', backgroundColor: 'var(--rm-card)' }}>
      {children}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>{children}</div>;
}

function PanelHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}>{icon}</span>}
      <h3 className="text-base font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</h3>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="mt-1 text-sm font-medium" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function BalanceTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--rm-card-hover)', border: '1px solid var(--rm-border)' }}>
      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${accent ? 'text-xl' : 'text-lg'}`} style={{ color: accent || 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>{value}</p>
    </div>
  );
}

function LimitRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: 'var(--rm-text-muted)' }}>{label}:</span>
      <span className="font-medium tabular-nums" style={{ color: accent || 'var(--rm-text)' }}>{value}</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const isVar = color.startsWith('var(');
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: isVar ? 'var(--rm-accent-muted)' : `${color}22`, color }}>
      {children}
    </span>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>{children}</p>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }} onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--rm-text)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>{children}</label>;
}

function CoinsIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" /></svg>);
}

// ============================================================================
// Sub-Modals
// ============================================================================

function AddPartyModal({ accountId, onClose, onSuccess }: { accountId: string; onClose: () => void; onSuccess: (a: AccountResponse) => void }) {
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    try {
      const updated = await accountService.addPartyRole(accountId, formData);
      onSuccess(updated);
    } catch (err) {
      console.error('Failed to add party role:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Party Role" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel>Party ID</FieldLabel>
          <input type="text" value={formData.partyId} onChange={e => setFormData({ ...formData, partyId: e.target.value })} required className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
        </div>
        <div>
          <FieldLabel>Party Type</FieldLabel>
          <select value={formData.partyType} onChange={e => setFormData({ ...formData, partyType: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUSINESS">Business</option>
            <option value="CORPORATE">Corporate</option>
          </select>
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as AccountPartyRoleType })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE}>
            {(Object.keys(partyRoleTypeLabels) as AccountPartyRoleType[]).map(role => (
              <option key={role} value={role}>{partyRoleTypeLabels[role]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {[
            { key: 'isPrimary', label: 'Primary' },
            { key: 'canTransact', label: 'Can Transact' },
            { key: 'canView', label: 'Can View' },
            { key: 'canManage', label: 'Can Manage' },
          ].map(item => (
            <label key={item.key} className="flex items-center">
              <input type="checkbox" checked={(formData as unknown as Record<string, unknown>)[item.key] as boolean} onChange={e => setFormData({ ...formData, [item.key]: e.target.checked })} className="h-4 w-4 rounded" style={{ accentColor: 'var(--rm-accent)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>{item.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <HeaderButton onClick={onClose}>Cancel</HeaderButton>
          <button type="submit" disabled={loading} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--rm-accent)' }}>
            {loading ? 'Adding…' : 'Add Party'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddIdentifierModal({ accountId, onClose, onSuccess }: { accountId: string; onClose: () => void; onSuccess: (a: AccountResponse) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AccountIdentifierRequest>({
    identifierType: 'IBAN',
    identifierValue: '',
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await accountService.addIdentifier(accountId, formData);
      onSuccess(updated);
    } catch (err) {
      console.error('Failed to add identifier:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Identifier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel>Identifier Type</FieldLabel>
          <select value={formData.identifierType} onChange={e => setFormData({ ...formData, identifierType: e.target.value as AccountIdentifierType })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE}>
            {(Object.keys(identifierTypeLabels) as AccountIdentifierType[]).map(type => (
              <option key={type} value={type}>{identifierTypeLabels[type]}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Value</FieldLabel>
          <input type="text" value={formData.identifierValue} onChange={e => setFormData({ ...formData, identifierValue: e.target.value })} required placeholder={formData.identifierType === 'IBAN' ? 'IE64IRCE92050112345678' : ''} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
        </div>
        <label className="flex items-center">
          <input type="checkbox" checked={formData.isPrimary} onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })} className="h-4 w-4 rounded" style={{ accentColor: 'var(--rm-accent)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>Primary Identifier</span>
        </label>
        <div className="flex justify-end gap-3 pt-4">
          <HeaderButton onClick={onClose}>Cancel</HeaderButton>
          <button type="submit" disabled={loading} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--rm-accent)' }}>
            {loading ? 'Adding…' : 'Add Identifier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddLimitModal({ accountId, currencyCode, onClose, onSuccess }: { accountId: string; currencyCode: string; onClose: () => void; onSuccess: (a: AccountResponse) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AccountLimitRequest>({
    limitType: 'DAILY_DEBIT',
    limitAmount: 0,
    currencyCode: currencyCode,
    usedAmount: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: undefined,
    isEnabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await accountService.addLimit(accountId, formData);
      onSuccess(updated);
    } catch (err) {
      console.error('Failed to add limit:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Limit" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel>Limit Type</FieldLabel>
          <select value={formData.limitType} onChange={e => setFormData({ ...formData, limitType: e.target.value as LimitType })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE}>
            {(Object.keys(limitTypeLabels) as LimitType[]).map(type => (
              <option key={type} value={type}>{limitTypeLabels[type]}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Limit Amount ({currencyCode})</FieldLabel>
          <input type="number" value={formData.limitAmount} onChange={e => setFormData({ ...formData, limitAmount: parseFloat(e.target.value) || 0 })} required min="0" step="0.01" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={INPUT_STYLE} />
        </div>
        <label className="flex items-center">
          <input type="checkbox" checked={formData.isEnabled} onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })} className="h-4 w-4 rounded" style={{ accentColor: 'var(--rm-accent)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>Enabled</span>
        </label>
        <div className="flex justify-end gap-3 pt-4">
          <HeaderButton onClick={onClose}>Cancel</HeaderButton>
          <button type="submit" disabled={loading} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--rm-accent)' }}>
            {loading ? 'Adding…' : 'Add Limit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
