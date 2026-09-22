'use client';

import Link from 'next/link';
import { useAppSelector } from '@/store';
import { useTheme } from '@/app/providers';
import config from '@/config';

function roleLabel(role: unknown): string {
  if (typeof role === 'string') return role;
  if (role && typeof role === 'object' && 'roleName' in role) {
    return String((role as { roleName: unknown }).roleName);
  }
  return 'Unknown role';
}

function sentenceCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProfilePage() {
  const { user } = useAppSelector(state => state.auth);
  const { theme, toggle } = useTheme();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const lastLogin = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-8 p-1 sm:p-2" style={{ color: 'var(--rm-text)' }}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          My profile
        </h1>
        <p className="mt-2 text-base" style={{ color: 'var(--rm-text-muted)' }}>
          How the bank identifies you, and the preferences applied to your workspace.
        </p>
      </header>

      {!user ? (
        <div className="rounded-3xl p-8 text-center" style={{ backgroundColor: 'var(--rm-card)' }}>
          <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
            Your session could not be loaded
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            Try signing in again to see your profile details.
          </p>
          <Link href="/login" className="btn btn-primary mt-5 inline-flex">
            Go to sign in
          </Link>
        </div>
      ) : (
        <>
          {/* Identity */}
          <section
            className="rounded-3xl p-6 sm:p-7"
            style={{ backgroundColor: 'var(--rm-card)' }}
            aria-labelledby="identity-heading"
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h2 id="identity-heading" className="text-2xl font-semibold tracking-tight">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  @{user.username} · {user.email}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                { label: 'Role', value: sentenceCase(user.userType) },
                { label: 'Account status', value: sentenceCase(user.status) },
                {
                  label: 'Two-factor authentication',
                  value: user.twoFactorEnabled ? 'Enabled' : 'Not enabled',
                },
                { label: 'Last sign-in', value: lastLogin ?? 'Not recorded' },
                { label: 'Currency', value: user.currency ?? config.bank.defaultCurrency },
                { label: 'Locale', value: user.locale ?? config.bank.defaultLocale },
              ].map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    {row.label}
                  </dt>
                  <dd className="text-base font-medium text-right" style={{ color: 'var(--rm-text)' }}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {!user.twoFactorEnabled && (
              <p
                className="mt-6 rounded-2xl px-4 py-3 text-sm"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#b45309' }}
              >
                Two-factor authentication is not enabled on this account. Ask your bank
                administrator to turn it on for extra security.
              </p>
            )}
          </section>

          {/* Access + preferences */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section
              className="rounded-3xl p-6 sm:p-7"
              style={{ backgroundColor: 'var(--rm-card)' }}
              aria-labelledby="access-heading"
            >
              <h2 id="access-heading" className="text-xl font-semibold tracking-tight">
                Your access
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Roles granted to you by your bank administrator.
              </p>
              {user.roles.length === 0 ? (
                <p className="mt-5 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No roles have been assigned yet.
                </p>
              ) : (
                <ul role="list" className="mt-5 space-y-2">
                  {user.roles.map((role, i) => (
                    <li
                      key={`${roleLabel(role)}-${i}`}
                      className="rounded-2xl px-4 py-3 text-base font-medium"
                      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text)' }}
                    >
                      {roleLabel(role)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="rounded-3xl p-6 sm:p-7"
              style={{ backgroundColor: 'var(--rm-card)' }}
              aria-labelledby="prefs-heading"
            >
              <h2 id="prefs-heading" className="text-xl font-semibold tracking-tight">
                Preferences
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Applied to this device and stored in your browser.
              </p>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    Appearance
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    Currently {theme === 'dark' ? 'dark' : 'light'} mode.
                  </p>
                </div>
                <button
                  onClick={toggle}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--rm-accent)' }}
                  aria-pressed={theme === 'dark'}
                >
                  Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                </button>
              </div>
            </section>
          </div>

          <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            <Link
              href="/dashboard"
              className="font-medium hover:underline"
              style={{ color: 'var(--rm-accent)' }}
            >
              Back to your dashboard
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
