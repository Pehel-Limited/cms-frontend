'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '@/store';
import {
  userService,
  type BankUserStatusAction,
  type RoleOption,
  type User,
} from '@/services/api/userService';

/*
 * Bank Users — the admin register of everyone who can sign in to this bank.
 *
 * The list is the identity service's BANK_USER population; roles are the real
 * role table rows, and the permissions shown are the role's boolean grants (the
 * role_permission junction is empty in this deployment). Creating a user and
 * changing access both go through identity-service, with an explicit guard that
 * an administrator cannot remove their own admin role or the last one in the bank.
 */

type StatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'PENDING_ACTIVATION'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'LOCKED'
  | 'PASSWORD_RESET_REQUIRED';

type Notice = { tone: 'success' | 'warn'; message: string };

interface CreateForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  temporaryPassword: string;
}

const EMPTY_FORM: CreateForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  phoneNumber: '',
  temporaryPassword: '',
};

const PAGE_SIZE = 200;
const ADMIN_ROLES = new Set(['SYSTEM_ADMIN', 'BANK_ADMIN']);

const STATUS_META: Record<string, { label: string; tone: string; description: string }> = {
  ACTIVE: { label: 'Active', tone: 'var(--rm-up)', description: 'Can sign in now.' },
  PENDING_ACTIVATION: {
    label: 'Pending activation',
    tone: 'var(--rm-warn)',
    description: 'Invited but cannot sign in until the account is activated.',
  },
  PASSWORD_RESET_REQUIRED: {
    label: 'Password reset required',
    tone: 'var(--rm-warn)',
    description: 'Must reset their password before signing in.',
  },
  SUSPENDED: {
    label: 'Suspended',
    tone: 'var(--rm-down)',
    description: 'Access is paused. Reactivate to restore it.',
  },
  INACTIVE: {
    label: 'Inactive',
    tone: 'var(--rm-text-muted)',
    description: 'Access has ended. Reactivate to restore it.',
  },
  LOCKED: {
    label: 'Locked',
    tone: 'var(--rm-down)',
    description: 'Locked after failed sign-ins. Activate to clear the lock.',
  },
};

const STATUS_ORDER: StatusFilter[] = [
  'ACTIVE',
  'PENDING_ACTIVATION',
  'PASSWORD_RESET_REQUIRED',
  'SUSPENDED',
  'INACTIVE',
  'LOCKED',
];

const ROLE_RANK: Record<string, number> = {
  SYSTEM_ADMIN: 0,
  BANK_ADMIN: 1,
  RELATIONSHIP_MANAGER: 2,
  CREDIT_ANALYST: 3,
  CREDIT_OFFICER: 4,
  RISK_MANAGER: 5,
  COMPLIANCE_OFFICER: 6,
  OPERATIONS_MANAGER: 7,
};

const GLYPH = {
  users:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  userPlus:
    'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  refresh:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  close: 'M6 18L18 6M6 6l12 12',
  check: 'M4.5 12.75l6 6 9-13.5',
  chevron: 'M9 5l7 7-7 7',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  phone:
    'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  shield:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
};

function Glyph({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function humanise(value?: string): string {
  if (!value) return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

function fullName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'Unnamed user';
}

function initialsOf(user: User): string {
  const parts = [user.firstName, user.lastName].filter(Boolean) as string[];
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (user.username || user.email || '?').charAt(0).toUpperCase();
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lastSeen(value?: string): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const days = Math.floor((Date.now() - date.getTime()) / 86400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

function apiError(error: unknown): string {
  const e = error as { message?: string };
  return e?.message || 'Something went wrong. Please try again.';
}

function roleRank(type: string): number {
  return ROLE_RANK[type.toUpperCase()] ?? 100;
}

function generatePassword(): string {
  const sets = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%&*',
  ];
  const all = sets.join('');
  const random = (max: number) => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  };
  const chars = sets.map(set => set[random(set.length)]);
  while (chars.length < 16) chars.push(all[random(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function statusMeta(status?: string) {
  const key = (status ?? '').toUpperCase();
  return STATUS_META[key] ?? {
    label: humanise(status),
    tone: 'var(--rm-text-muted)',
    description: '',
  };
}

function StatusPill({ status }: { status?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`,
        color: meta.tone,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.tone }} />
      {meta.label}
    </span>
  );
}

function Bar({ pct, color = 'var(--rm-brand)' }: { pct: number; color?: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--rm-hairline-strong)' }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function RoleChips({
  types,
  labelFor,
  compact = false,
}: {
  types: string[];
  labelFor: (type: string) => string;
  compact?: boolean;
}) {
  if (!types.length) {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--rm-warn) 12%, transparent)',
          color: 'var(--rm-warn)',
        }}
      >
        No role
      </span>
    );
  }
  const shown = compact ? types.slice(0, 2) : types;
  const rest = types.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5" title={types.map(labelFor).join(', ')}>
      {shown.map(type => (
        <span
          key={type}
          className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: 'var(--rm-brand-soft)', color: 'var(--rm-brand-on-soft)' }}
        >
          {labelFor(type)}
        </span>
      ))}
      {rest > 0 && (
        <span
          className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-muted)' }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

function PermissionList({
  permissions,
  empty = 'These roles do not record any permissions.',
}: {
  permissions: string[];
  empty?: string;
}) {
  if (!permissions.length) {
    return (
      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {permissions.map(permission => (
        <li key={permission} className="flex items-start gap-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: 'var(--rm-brand)' }} />
          {permission}
        </li>
      ))}
    </ul>
  );
}

function RolePicker({
  options,
  selected,
  onToggle,
  disabled,
  emptyNote,
}: {
  options: RoleOption[];
  selected: Set<string>;
  onToggle: (type: string) => void;
  disabled?: boolean;
  emptyNote: string;
}) {
  if (!options.length) {
    return (
      <p className="rounded-xl px-3 py-2.5 text-sm" style={{ backgroundColor: 'var(--rm-warn-soft)', color: 'var(--rm-warn)' }}>
        {emptyNote}
      </p>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map(role => {
        const checked = selected.has(role.roleType.toUpperCase());
        return (
          <button
            key={role.roleType}
            type="button"
            onClick={() => onToggle(role.roleType.toUpperCase())}
            disabled={disabled}
            aria-pressed={checked}
            className="rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: checked ? 'var(--rm-brand)' : 'var(--rm-hairline-strong)',
              backgroundColor: checked ? 'var(--rm-brand-soft)' : 'transparent',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  {role.roleName}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  {role.description || humanise(role.roleType)}
                </p>
              </div>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: checked ? 'var(--rm-brand)' : 'var(--rm-input)',
                  color: checked ? '#fff' : 'var(--rm-text-muted)',
                }}
                aria-hidden="true"
              >
                {checked ? <Glyph path={GLYPH.check} className="h-3 w-3" /> : null}
              </span>
            </div>
            <p className="num mt-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              {role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--rm-down)' }}> *</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  borderRadius: 12,
  border: '1px solid var(--rm-hairline-strong)',
  backgroundColor: 'var(--rm-input)',
  color: 'var(--rm-text)',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
};

function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="bank-user-drawer-title">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--rm-bg)', borderLeft: '1px solid var(--rm-hairline)' }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b p-6"
          style={{ borderColor: 'var(--rm-hairline)' }}
        >
          <div className="min-w-0">
            <h2 id="bank-user-drawer-title" className="serif text-2xl font-medium" style={{ color: 'var(--rm-text)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
            aria-label="Close panel"
          >
            <Glyph path={GLYPH.close} className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="border-t p-6" style={{ borderColor: 'var(--rm-hairline)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ index, title, note }: { index: string; title: string; note: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <span className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
          {index}
        </span>
        <h2 className="serif text-2xl font-medium" style={{ color: 'var(--rm-text)' }}>
          {title}
        </h2>
        <span
          className="mb-1.5 hidden flex-1 border-t sm:block"
          style={{ borderColor: 'var(--rm-hairline)' }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {note}
      </p>
    </div>
  );
}

export default function BankUsersPage() {
  const { user: currentUser } = useAppSelector(state => state.auth);

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const [notice, setNotice] = useState<Notice | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingAccess, setEditingAccess] = useState(false);
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailNotice, setDetailNotice] = useState<Notice | null>(null);
  const [actionBusy, setActionBusy] = useState<BankUserStatusAction | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [createRoles, setCreateRoles] = useState<Set<string>>(new Set());
  const [activateNow, setActivateNow] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadUsers = useCallback(async (): Promise<User[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await userService.getUsers({
        userType: 'BANK_USER',
        page: 0,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      });
      const content = Array.isArray(response.content) ? response.content : [];
      setUsers(content);
      setTotal(typeof response.totalElements === 'number' ? response.totalElements : content.length);
      setLastUpdated(new Date());
      return content;
    } catch (err) {
      setError(apiError(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const catalogue = await userService.getRoleCatalog();
      setRoles(Array.isArray(catalogue) ? catalogue : []);
      setRolesError(null);
    } catch (err) {
      setRoles([]);
      setRolesError(apiError(err));
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  const refresh = useCallback(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  const roleByType = useMemo(() => {
    const map = new Map<string, RoleOption>();
    roles.forEach(role => map.set(role.roleType.toUpperCase(), role));
    return map;
  }, [roles]);

  const roleLabel = useCallback(
    (type: string) => roleByType.get(type.toUpperCase())?.roleName ?? humanise(type),
    [roleByType]
  );

  const permissionsFor = useCallback(
    (types: string[]) => {
      const set = new Set<string>();
      types.forEach(type => {
        roleByType.get(type.toUpperCase())?.permissions.forEach(permission => set.add(permission));
      });
      return [...set].sort((a, b) => a.localeCompare(b));
    },
    [roleByType]
  );

  const roleOptions = useMemo(
    () =>
      [...roles].sort((a, b) => {
        const rank = roleRank(a.roleType) - roleRank(b.roleType);
        return rank !== 0 ? rank : a.roleName.localeCompare(b.roleName);
      }),
    [roles]
  );

  const selected = useMemo(
    () => users.find(user => user.userId === selectedId) ?? null,
    [users, selectedId]
  );

  const isSelf = useCallback(
    (target: User) =>
      !!currentUser?.username &&
      target.username.toLowerCase() === currentUser.username.toLowerCase(),
    [currentUser?.username]
  );

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    users.forEach(user => {
      const status = (user.status ?? 'UNKNOWN').toUpperCase();
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    });
    return {
      active: byStatus.get('ACTIVE') ?? 0,
      pending: byStatus.get('PENDING_ACTIVATION') ?? 0,
      suspended: byStatus.get('SUSPENDED') ?? 0,
      neverSignedIn: users.filter(user => !user.lastLoginAt).length,
      admins: users.filter(user =>
        (user.roles ?? []).some(role => ADMIN_ROLES.has(role.toUpperCase()))
      ).length,
      byStatus,
    };
  }, [users]);

  const roleAssignments = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach(user => {
      (user.roles ?? []).forEach(role => {
        const type = role.toUpperCase();
        map.set(type, (map.get(type) ?? 0) + 1);
      });
    });
    return [...map.entries()].sort(
      (a, b) => b[1] - a[1] || roleRank(a[0]) - roleRank(b[0])
    );
  }, [users]);

  const topRoleAssignments = roleAssignments.slice(0, 5);
  const roleAssignmentsTotal = roleAssignments.reduce((sum, [, count]) => sum + count, 0);
  const otherRoleAssignments = roleAssignments.slice(5).reduce((sum, [, count]) => sum + count, 0);
  const maxRoleCount = Math.max(1, ...topRoleAssignments.map(([, count]) => count));

  const statusTabs = useMemo(() => {
    const tabs: { value: StatusFilter; label: string; count: number }[] = [
      { value: 'ALL', label: 'All', count: users.length },
    ];
    STATUS_ORDER.forEach(status => {
      const count = counts.byStatus.get(status) ?? 0;
      if (status === 'PASSWORD_RESET_REQUIRED' && count === 0) return;
      const meta = STATUS_META[status];
      tabs.push({
        value: status,
        label: meta?.label ?? humanise(status),
        count,
      });
    });
    return tabs;
  }, [users.length, counts.byStatus]);

  const roleFilterOptions = useMemo(() => {
    const types = new Set<string>();
    users.forEach(user => (user.roles ?? []).forEach(role => types.add(role.toUpperCase())));
    roles.forEach(role => types.add(role.roleType.toUpperCase()));
    return [...types].sort(
      (a, b) => roleRank(a) - roleRank(b) || roleLabel(a).localeCompare(roleLabel(b))
    );
  }, [users, roles, roleLabel]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter(user => {
        const userRoles = (user.roles ?? []).map(role => role.toUpperCase());
        const haystack = [
          fullName(user),
          user.username,
          user.email,
          ...userRoles.map(roleLabel),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesSearch = !term || haystack.includes(term);
        const matchesStatus =
          statusFilter === 'ALL' || (user.status ?? '').toUpperCase() === statusFilter;
        const matchesRole = roleFilter === 'ALL' || userRoles.includes(roleFilter);
        return matchesSearch && matchesStatus && matchesRole;
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users, search, statusFilter, roleFilter, roleLabel]);

  const isFiltered = !!search.trim() || statusFilter !== 'ALL' || roleFilter !== 'ALL';

  const openCreate = () => {
    setSelectedId(null);
    setEditingAccess(false);
    setCreateOpen(true);
    setCreateError(null);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    setCreateRoles(new Set());
    setActivateNow(true);
    setCreateError(null);
  };

  const toggleCreateRole = (type: string) => {
    setCreateRoles(previous => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreateError(null);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim()) {
      setCreateError('First name, last name, username and email are required.');
      return;
    }
    if (form.temporaryPassword.length < 8) {
      setCreateError('The temporary password must be at least 8 characters.');
      return;
    }
    if (createRoles.size === 0) {
      setCreateError('Choose at least one role.');
      return;
    }

    setCreating(true);
    try {
      const created = await userService.createBankUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || undefined,
        temporaryPassword: form.temporaryPassword,
        roleNames: [...createRoles],
        forcePasswordChangeOnFirstLogin: true,
      });

      let activationError: string | null = null;
      let activated = false;
      if (activateNow) {
        try {
          await userService.setUserStatus(created.userId, 'activate');
          activated = true;
        } catch (err) {
          activationError = apiError(err);
        }
      }

      const activationText = activationError
        ? ` Activation failed: ${activationError}. The account is pending.`
        : activated
          ? ' They can sign in now.'
          : ' The account is pending activation.';

      setNotice({
        tone: activationError ? 'warn' : 'success',
        message: `${fullName(created)} was created.${activationText} They must change the temporary password at first sign-in.`,
      });

      closeCreate();
      await loadUsers();
    } catch (err) {
      setCreateError(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const openUser = (userId: string) => {
    setCreateOpen(false);
    setSelectedId(userId);
    setEditingAccess(false);
    setDraftRoles(new Set());
    setDetailError(null);
    setDetailNotice(null);
  };

  const closeUser = () => {
    setSelectedId(null);
    setEditingAccess(false);
    setDraftRoles(new Set());
    setDetailError(null);
    setDetailNotice(null);
  };

  const startEditingAccess = () => {
    if (!selected) return;
    setDraftRoles(new Set((selected.roles ?? []).map(role => role.toUpperCase())));
    setEditingAccess(true);
    setDetailError(null);
    setDetailNotice(null);
  };

  const toggleDraftRole = (type: string) => {
    setDraftRoles(previous => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const saveRoles = async () => {
    if (!selected || savingRoles) return;
    if (draftRoles.size === 0) {
      setDetailError('A user must keep at least one role.');
      return;
    }
    setSavingRoles(true);
    setDetailError(null);
    setDetailNotice(null);
    try {
      const updated = await userService.replaceUserRoles(selected.userId, [...draftRoles]);
      setUsers(previous => previous.map(user => (user.userId === updated.userId ? updated : user)));
      setEditingAccess(false);
      setDetailNotice({
        tone: 'success',
        message: `${fullName(updated)}'s access was updated.`,
      });
    } catch (err) {
      setDetailError(apiError(err));
    } finally {
      setSavingRoles(false);
    }
  };

  const runStatus = async (action: BankUserStatusAction) => {
    if (!selected || actionBusy || isSelf(selected)) return;
    const name = fullName(selected);
    const confirmation =
      action === 'suspend'
        ? `Suspend ${name}? They will be signed out and cannot sign in until reactivated.`
        : action === 'deactivate'
          ? `Deactivate ${name}? This ends their access; you can reactivate them later.`
          : null;
    if (confirmation && !window.confirm(confirmation)) return;

    setActionBusy(action);
    setDetailError(null);
    setDetailNotice(null);
    try {
      await userService.setUserStatus(selected.userId, action);
      const refreshed = await loadUsers();
      const next = refreshed.find(user => user.userId === selected.userId);
      const label = statusMeta(next?.status).label.toLowerCase();
      setDetailNotice({ tone: 'success', message: `${name} is now ${label}.` });
    } catch (err) {
      setDetailError(apiError(err));
    } finally {
      setActionBusy(null);
    }
  };

  const selfSelected = selected ? isSelf(selected) : false;
  const canActivate = selected ? (selected.status ?? '').toUpperCase() !== 'ACTIVE' : false;
  const canSuspend = selected ? (selected.status ?? '').toUpperCase() === 'ACTIVE' : false;
  const canDeactivate = selected ? (selected.status ?? '').toUpperCase() !== 'INACTIVE' : false;
  const selectedPermissions = selected ? permissionsFor(selected.roles ?? []) : [];
  const draftPermissions = permissionsFor([...draftRoles]);
  const createPermissions = permissionsFor([...createRoles]);
  const selectingSource = editingAccess ? draftRoles : new Set((selected?.roles ?? []).map(role => role.toUpperCase()));
  const busy = loading || rolesLoading;

  return (
    <div className="space-y-9 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Toolbar ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Access management
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="rounded-full p-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-muted)' }}
          title="Refresh users and roles"
          aria-label="Refresh users and roles"
        >
          <Glyph path={GLYPH.refresh} className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ══ Cover ══ */}
      <section
        className="rm-panel relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, color-mix(in srgb, var(--rm-brand) 12%, transparent), transparent 58%)',
        }}
        aria-label="Bank user position"
      >
        <div className="grid gap-10 p-7 sm:p-9 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0">
            <h1
              className="serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
              style={{ color: 'var(--rm-text)' }}
            >
              Bank users
            </h1>
            <p className="num mt-6 text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
              {total === null ? '—' : total.toLocaleString()}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              people with access to this bank ·{' '}
              <span className="num" style={{ color: 'var(--rm-text-secondary)' }}>
                {counts.active}
              </span>{' '}
              active
              {counts.admins > 0 && (
                <>
                  {' '}
                  · <span className="num">{counts.admins}</span>{' '}
                  {counts.admins === 1 ? 'administrator' : 'administrators'}
                </>
              )}
            </p>

            <button type="button" onClick={openCreate} className="rm-btn rm-btn-solid mt-6">
              <Glyph path={GLYPH.userPlus} className="h-4 w-4" />
              New bank user
            </button>
          </div>

          <div className="min-w-0 xl:border-l xl:pl-8" style={{ borderColor: 'var(--rm-hairline)' }}>
            <p className="serif text-lg font-medium" style={{ color: 'var(--rm-text)' }}>
              Access by role
            </p>
            {topRoleAssignments.length > 0 ? (
              <div className="mt-2">
                {topRoleAssignments.map(([type, count]) => (
                  <div key={type} className="border-t py-2.5" style={{ borderColor: 'var(--rm-hairline)' }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                        {roleLabel(type)}
                      </p>
                      <p className="num shrink-0 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                        {count}
                      </p>
                    </div>
                    <div className="mt-1.5">
                      <Bar pct={(count / maxRoleCount) * 100} />
                    </div>
                  </div>
                ))}
                {otherRoleAssignments > 0 && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    <span className="num">{otherRoleAssignments}</span> more assignments in smaller roles.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {loading ? 'Reading the register…' : 'No role assignments yet.'}
              </p>
            )}
            <p className="mt-3 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              <span className="num">{roleAssignmentsTotal}</span> role assignments across{' '}
              <span className="num">{users.length}</span> people. People can hold more than one role.
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div
          className="rm-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
          role="status"
          style={{
            color: notice.tone === 'success' ? 'var(--rm-up)' : 'var(--rm-warn)',
          }}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rm-btn rm-btn-quiet"
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
      )}

      {rolesError && (
        <div
          className="rm-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
          role="alert"
          style={{ color: 'var(--rm-warn)' }}
        >
          <span>
            Access editing is unavailable: the role catalogue could not be loaded.
            {rolesError ? ` ${rolesError}` : ''}
          </span>
          <button type="button" onClick={loadRoles} className="rm-btn rm-btn-quiet">
            Retry
          </button>
        </div>
      )}

      {/* ══ Status strip ══ */}
      <section className="rm-panel" aria-label="Bank user status">
        <div className="rm-strip">
          <button
            type="button"
            onClick={() => setStatusFilter(current => (current === 'ACTIVE' ? 'ALL' : 'ACTIVE'))}
            aria-pressed={statusFilter === 'ACTIVE'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                statusFilter === 'ACTIVE'
                  ? 'color-mix(in srgb, var(--rm-up) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Active</p>
              <p className="rm-strip-note">Can sign in now</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-up)' }}>
              {counts.active}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(current => (current === 'PENDING_ACTIVATION' ? 'ALL' : 'PENDING_ACTIVATION'))}
            aria-pressed={statusFilter === 'PENDING_ACTIVATION'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                statusFilter === 'PENDING_ACTIVATION'
                  ? 'color-mix(in srgb, var(--rm-warn) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Pending activation</p>
              <p className="rm-strip-note">Invited, not yet admitted</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-warn)' }}>
              {counts.pending}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(current => (current === 'SUSPENDED' ? 'ALL' : 'SUSPENDED'))}
            aria-pressed={statusFilter === 'SUSPENDED'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                statusFilter === 'SUSPENDED'
                  ? 'color-mix(in srgb, var(--rm-down) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Suspended</p>
              <p className="rm-strip-note">Access paused</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-down)' }}>
              {counts.suspended}
            </p>
          </button>

          <div className="rm-strip-cell">
            <div className="min-w-0">
              <p className="rm-strip-label">Never signed in</p>
              <p className="rm-strip-note">No sign-in recorded</p>
            </div>
            <p className="rm-strip-value num">{counts.neverSignedIn}</p>
          </div>
        </div>
      </section>

      {/* ══ Register ══ */}
      <section>
        <SectionLabel
          index="01"
          title="People"
          note="Search, filter and open a person to change their roles or status."
        />

        <section className="rm-panel">
          <div className="rm-panel-head flex-wrap">
            <div className="min-w-0">
              <h2 className="rm-title">Everyone with access</h2>
              <p className="rm-sub">
                <span className="num">{users.length}</span> people ·{' '}
                <span className="num">{counts.pending}</span> awaiting activation
                {total !== null && total > users.length ? (
                  <>
                    {' '}
                    · showing the first {users.length} of {total}
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--rm-text-muted)' }}
                  aria-hidden="true"
                >
                  <Glyph path={GLYPH.search} className="h-4 w-4" />
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search name, email, role"
                  aria-label="Search bank users"
                  style={{ ...inputStyle, marginTop: 0, paddingLeft: 36, width: 240 }}
                />
              </div>
              <select
                value={roleFilter}
                onChange={event => setRoleFilter(event.target.value)}
                aria-label="Filter by role"
                style={{ ...inputStyle, marginTop: 0, width: 'auto', minWidth: 160 }}
              >
                <option value="ALL">All roles</option>
                {roleFilterOptions.map(type => (
                  <option key={type} value={type}>
                    {roleLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rm-body">
            {error && users.length > 0 && (
              <p
                className="mb-3 rounded-xl px-3 py-2.5 text-sm"
                role="alert"
                style={{ backgroundColor: 'var(--rm-warn-soft)', color: 'var(--rm-warn)' }}
              >
                The list could not be refreshed. {error}
              </p>
            )}
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  aria-pressed={statusFilter === tab.value}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={
                    statusFilter === tab.value
                      ? { backgroundColor: 'var(--rm-brand)', color: '#fff' }
                      : { backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }
                  }
                >
                  {tab.label}
                  <span className="num ml-1.5 opacity-70">{tab.count}</span>
                </button>
              ))}
            </div>

            {loading && users.length === 0 ? (
              <div className="space-y-3" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-2xl"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                ))}
              </div>
            ) : error && users.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 py-6">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                    The user register could not be loaded.
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {error}
                  </p>
                </div>
                <button type="button" onClick={refresh} className="rm-btn rm-btn-solid">
                  Try again
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                  No bank users match these filters.
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                      setRoleFilter('ALL');
                    }}
                    className="mt-2 text-sm font-medium hover:underline"
                    style={{ color: 'var(--rm-accent)' }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <p className="mb-2 text-[13px] sm:hidden" style={{ color: 'var(--rm-text-muted)' }}>
                  Swipe the table for access, last sign-in and added date.
                </p>
                <table className="rm-table w-full min-w-[880px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                        User
                      </th>
                      <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                        Status
                      </th>
                      <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                        Access
                      </th>
                      <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                        Last sign-in
                      </th>
                      <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--rm-text-muted)' }}>
                        Added
                      </th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr
                        key={user.userId}
                        tabIndex={0}
                        onClick={() => openUser(user.userId)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openUser(user.userId);
                          }
                        }}
                        className="cursor-pointer"
                        title="Open this person's access and status"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: 'var(--rm-brand-soft)',
                                color: 'var(--rm-brand-on-soft)',
                              }}
                              aria-hidden="true"
                            >
                              {initialsOf(user)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                                {fullName(user)}
                                {isSelf(user) && (
                                  <span
                                    className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{
                                      backgroundColor: 'var(--rm-input)',
                                      color: 'var(--rm-text-muted)',
                                    }}
                                  >
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                                {user.email} · <span className="num">@{user.username}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={user.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <RoleChips
                            types={(user.roles ?? []).map(role => role.toUpperCase())}
                            labelFor={roleLabel}
                            compact
                          />
                        </td>
                        <td
                          className="px-4 py-3.5 text-sm"
                          style={{
                            color: user.lastLoginAt
                              ? 'var(--rm-text-secondary)'
                              : 'var(--rm-text-muted)',
                          }}
                        >
                          {lastSeen(user.lastLoginAt)}
                        </td>
                        <td className="num px-4 py-3.5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right" style={{ color: 'var(--rm-text-muted)' }}>
                          <Glyph path={GLYPH.chevron} className="ml-auto h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rm-foot flex flex-wrap items-center justify-between gap-3">
            <span>
              Showing <span className="num">{filteredUsers.length}</span> of{' '}
              <span className="num">{users.length}</span> bank users
              {total !== null && total > users.length ? ` (${total} on file)` : ''}.
            </span>
            {rolesLoading && <span>Loading the role catalogue…</span>}
          </div>
        </section>
      </section>

      <p className="pb-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        New users must change their temporary password at first sign-in. Role changes take effect
        immediately.
        {lastUpdated && (
          <>
            {' '}
            · Last refreshed at{' '}
            <span className="num">
              {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </p>

      {/* ══ Create drawer ══ */}
      {createOpen && (
        <Drawer
          title="New bank user"
          subtitle="Create a staff login, choose what they can do, then share the temporary password."
          onClose={closeCreate}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={activateNow}
                    onChange={event => setActivateNow(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Activate immediately
                </label>
                <p className="mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  They must change this password at first sign-in.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeCreate} className="rm-btn rm-btn-quiet">
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-bank-user-form"
                  disabled={creating || roles.length === 0 || createRoles.size === 0}
                  className="rm-btn rm-btn-solid"
                >
                  {creating ? 'Creating…' : 'Create user'}
                </button>
              </div>
            </div>
          }
        >
          <form id="create-bank-user-form" onSubmit={submitCreate} className="space-y-5">
            {rolesError && (
              <p
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--rm-warn-soft)', color: 'var(--rm-warn)' }}
              >
                Roles are unavailable, so a user cannot be created right now. {rolesError}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  style={inputStyle}
                  value={form.firstName}
                  onChange={event => setForm(value => ({ ...value, firstName: event.target.value }))}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name" required>
                <input
                  style={inputStyle}
                  value={form.lastName}
                  onChange={event => setForm(value => ({ ...value, lastName: event.target.value }))}
                  autoComplete="family-name"
                />
              </Field>
              <Field label="Username" required>
                <input
                  style={inputStyle}
                  value={form.username}
                  onChange={event => setForm(value => ({ ...value, username: event.target.value }))}
                  autoComplete="username"
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  style={inputStyle}
                  value={form.email}
                  onChange={event => setForm(value => ({ ...value, email: event.target.value }))}
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone" hint="Optional">
                <input
                  style={inputStyle}
                  value={form.phoneNumber}
                  onChange={event => setForm(value => ({ ...value, phoneNumber: event.target.value }))}
                  autoComplete="tel"
                />
              </Field>
              <Field label="Temporary password" required hint="At least 8 characters">
                <div className="flex gap-2">
                  <input
                    style={{ ...inputStyle, minWidth: 0, flex: 1 }}
                    value={form.temporaryPassword}
                    onChange={event =>
                      setForm(value => ({ ...value, temporaryPassword: event.target.value }))
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(value => ({ ...value, temporaryPassword: generatePassword() }))}
                    className="rm-btn rm-btn-quiet shrink-0"
                  >
                    Generate
                  </button>
                </div>
              </Field>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium" style={{ color: 'var(--rm-text-secondary)' }}>
                  Roles <span style={{ color: 'var(--rm-down)' }}>*</span>
                </p>
                <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  {createRoles.size} selected
                </p>
              </div>
              <div className="mt-2">
                <RolePicker
                  options={roleOptions}
                  selected={createRoles}
                  onToggle={toggleCreateRole}
                  disabled={creating || rolesLoading}
                  emptyNote={
                    rolesLoading
                      ? 'Loading roles…'
                      : 'No roles are available. The identity service role catalogue could not be read.'
                  }
                />
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--rm-hairline)', backgroundColor: 'var(--rm-input)' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Permissions granted
                </p>
                <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  {createPermissions.length}
                </p>
              </div>
              <div className="mt-2">
                <PermissionList
                  permissions={createPermissions}
                  empty={
                    createRoles.size === 0
                      ? 'Select roles to see what they grant.'
                      : 'These roles do not record any permissions.'
                  }
                />
              </div>
            </div>

            {createError && (
              <p
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--rm-danger-soft)', color: 'var(--rm-down)' }}
                role="alert"
              >
                {createError}
              </p>
            )}
          </form>
        </Drawer>
      )}

      {/* ══ Person drawer ══ */}
      {selected && (
        <Drawer
          title={fullName(selected)}
          subtitle={
            <span>
              <span className="num">@{selected.username}</span> · {selected.email}
            </span>
          }
          onClose={closeUser}
        >
          <div className="space-y-7">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={selected.status} />
              <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {statusMeta(selected.status).description}
              </span>
            </div>

            {selfSelected && (
              <p
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--rm-warn-soft)', color: 'var(--rm-warn)' }}
              >
                This is your own account. Another administrator must change your access or status.
              </p>
            )}

            {detailError && (
              <p
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--rm-danger-soft)', color: 'var(--rm-down)' }}
                role="alert"
              >
                {detailError}
              </p>
            )}

            {detailNotice && (
              <p
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{
                  backgroundColor:
                    detailNotice.tone === 'success'
                      ? 'color-mix(in srgb, var(--rm-up) 12%, transparent)'
                      : 'var(--rm-warn-soft)',
                  color: detailNotice.tone === 'success' ? 'var(--rm-up)' : 'var(--rm-warn)',
                }}
                role="status"
              >
                {detailNotice.message}
              </p>
            )}

            <section>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Profile
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    Email
                  </dt>
                  <dd className="mt-0.5 truncate text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {selected.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    Phone
                  </dt>
                  <dd className="num mt-0.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {selected.phoneNumber || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    Added
                  </dt>
                  <dd className="num mt-0.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {formatDate(selected.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    Last sign-in
                  </dt>
                  <dd className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {lastSeen(selected.lastLoginAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    Two-factor
                  </dt>
                  <dd className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {selected.twoFactorEnabled ? 'Enabled' : 'Not enabled'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    Password
                  </dt>
                  <dd className="mt-0.5 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    {selected.forcePasswordChange ? 'Must change at next sign-in' : 'Current'}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  Access
                </p>
                {!editingAccess && !selfSelected && (
                  <button
                    type="button"
                    onClick={startEditingAccess}
                    disabled={roles.length === 0}
                    className="rm-btn rm-btn-quiet"
                    title={roles.length === 0 ? 'The role catalogue is unavailable' : 'Change roles'}
                  >
                    Edit access
                  </button>
                )}
              </div>

              {!editingAccess ? (
                <div className="mt-3 space-y-4">
                  <RoleChips
                    types={(selected.roles ?? []).map(role => role.toUpperCase())}
                    labelFor={roleLabel}
                  />
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        Effective permissions
                      </p>
                      <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {selectedPermissions.length}
                      </p>
                    </div>
                    <div className="mt-2">
                      <PermissionList
                        permissions={selectedPermissions}
                        empty="These roles do not record any permissions."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  <RolePicker
                    options={roleOptions}
                    selected={selectingSource}
                    onToggle={toggleDraftRole}
                    disabled={savingRoles || rolesLoading}
                    emptyNote="No roles are available to assign."
                  />
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        Permissions with this selection
                      </p>
                      <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {draftPermissions.length}
                      </p>
                    </div>
                    <div className="mt-2">
                      <PermissionList
                        permissions={draftPermissions}
                        empty={
                          draftRoles.size === 0
                            ? 'Select roles to see what they grant.'
                            : 'These roles do not record any permissions.'
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={saveRoles}
                      disabled={savingRoles}
                      className="rm-btn rm-btn-solid"
                    >
                      {savingRoles ? 'Saving…' : 'Save access'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccess(false);
                        setDetailError(null);
                      }}
                      disabled={savingRoles}
                      className="rm-btn rm-btn-quiet"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {rolesError && !editingAccess && (
                <p className="mt-3 text-sm" style={{ color: 'var(--rm-warn)' }}>
                  The role catalogue is unavailable, so access cannot be edited right now.
                </p>
              )}
            </section>

            <section>
              <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                Account status
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {statusMeta(selected.status).description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {canActivate && (
                  <button
                    type="button"
                    onClick={() => runStatus('activate')}
                    disabled={selfSelected || actionBusy !== null}
                    className="rm-btn rm-btn-solid"
                  >
                    {actionBusy === 'activate'
                      ? 'Activating…'
                      : (selected.status ?? '').toUpperCase() === 'PENDING_ACTIVATION'
                        ? 'Activate account'
                        : 'Reactivate account'}
                  </button>
                )}
                {canSuspend && (
                  <button
                    type="button"
                    onClick={() => runStatus('suspend')}
                    disabled={selfSelected || actionBusy !== null}
                    className="rm-btn rm-btn-quiet"
                  >
                    {actionBusy === 'suspend' ? 'Suspending…' : 'Suspend'}
                  </button>
                )}
                {canDeactivate && (
                  <button
                    type="button"
                    onClick={() => runStatus('deactivate')}
                    disabled={selfSelected || actionBusy !== null}
                    className="rm-btn rm-btn-danger"
                  >
                    {actionBusy === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
                  </button>
                )}
              </div>

              {selfSelected && (
                <p className="mt-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  You cannot change your own account status.
                </p>
              )}
            </section>
          </div>
        </Drawer>
      )}
    </div>
  );
}
