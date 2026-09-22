'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store';
import apiClient from '@/lib/api-client';
import config from '@/config';

/*
 * Support/diagnostic view. Everything shown is read from Redux auth state, the
 * runtime config or a live API call — and the access token value itself is never
 * rendered, only whether one is present and when it expires.
 */

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface TokenInfo {
  present: boolean;
  expiresAt: Date | null;
}

function readTokenExpiry(token: string | null): Date | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === 'number') return new Date(payload.exp * 1000);
  } catch {
    /* Not a decodable JWT — fall back to presence only. */
  }
  return null;
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4"
      style={{ borderBottom: '1px solid var(--rm-border)' }}
    >
      <dt className="text-base" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right text-base" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="overflow-hidden rounded-3xl" style={{ backgroundColor: 'var(--rm-card)' }}>
        <dl className="m-0">{children}</dl>
      </div>
    </section>
  );
}

export default function DiagnosticPage() {
  const { user, isAuthenticated } = useAppSelector(state => state.auth);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string>('Not run yet.');
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(config.auth.tokenKey);
    setTokenInfo({ present: Boolean(token), expiresAt: readTokenExpiry(token) });
  }, []);

  const runApiTest = useCallback(async () => {
    setTestStatus('loading');
    setTestMessage('Calling the admin pending-users endpoint…');
    try {
      const response = await apiClient.get<{ totalElements?: number }>(
        '/api/v1/admin/users/pending',
        { params: { page: 0, size: 10 } }
      );
      const total = response.data?.totalElements;
      setTestStatus('success');
      setTestMessage(
        `Request succeeded (HTTP ${response.status}). ${
          typeof total === 'number' ? `${total} pending activation${total === 1 ? '' : 's'} returned.` : 'No count returned.'
        }`
      );
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      const detail = e?.response?.data?.message || e?.message || 'No detail returned';
      setTestStatus('error');
      setTestMessage(`Request failed${status ? ` (HTTP ${status})` : ''}: ${detail}`);
      console.error('Diagnostic API test failed:', err);
    } finally {
      setLastRunAt(new Date());
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) runApiTest();
  }, [isAuthenticated, runApiTest]);

  const roleNames = (user?.roles ?? [])
    .map(role => (typeof role === 'string' ? role : role?.roleName))
    .filter((role): role is string => Boolean(role));

  return (
    <div className="space-y-8" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Header ══ */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Diagnostic information</h1>
          <p className="mt-1.5 text-base" style={{ color: 'var(--rm-text-secondary)' }}>
            Session, configuration and connectivity details for support. Credentials are never
            displayed here.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--rm-accent)' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to dashboard
        </Link>
      </header>

      {/* ══ Session ══ */}
      <Section id="diagnostic-session" title="Session" description="Read from the current auth state.">
        <Row label="Signed in" value={isAuthenticated ? 'Yes' : 'No'} />
        <Row label="Username" value={user?.username || 'Not signed in'} />
        <Row label="User type" value={user?.userType || '—'} />
        <Row label="Bank ID" value={user?.bankId ? <span className="tabular-nums">{user.bankId}</span> : '—'} />
        <Row
          label="Roles"
          value={
            roleNames.length > 0 ? (
              roleNames.join(', ')
            ) : (
              <span style={{ color: 'var(--rm-text-muted)' }}>None returned</span>
            )
          }
        />
      </Section>

      {/* ══ Configuration ══ */}
      <Section
        id="diagnostic-config"
        title="API configuration"
        description="Runtime configuration this build is using."
      >
        <Row label="Base URL" value={<span className="break-all">{config.api.baseUrl}</span>} />
        <Row
          label="Access token"
          value={
            tokenInfo === null ? (
              <span style={{ color: 'var(--rm-text-muted)' }}>Checking…</span>
            ) : tokenInfo.present ? (
              `Stored${tokenInfo.expiresAt ? ` · expires ${formatDateTime(tokenInfo.expiresAt)}` : ''}`
            ) : (
              'Not stored'
            )
          }
        />
        <Row
          label="Request timeout"
          value={<span className="tabular-nums">{Math.round(config.api.timeout / 1000)}s</span>}
        />
      </Section>

      {/* ══ Connectivity ══ */}
      <section aria-labelledby="diagnostic-api" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="diagnostic-api"
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Connectivity test
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Calls the admin pending-users endpoint with your current session.
            </p>
          </div>
          <button
            type="button"
            onClick={runApiTest}
            disabled={testStatus === 'loading'}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--rm-input)',
              color: 'var(--rm-text)',
              border: '1px solid var(--rm-border)',
            }}
          >
            {testStatus === 'loading' ? 'Running…' : 'Run test again'}
          </button>
        </div>

        <div className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
          {testStatus === 'loading' ? (
            <div className="flex items-center gap-3" role="status">
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2"
                style={{ borderColor: 'var(--rm-border)', borderTopColor: 'var(--rm-accent)' }}
                aria-hidden="true"
              />
              <p className="text-base" style={{ color: 'var(--rm-text-secondary)' }}>
                {testMessage}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-3">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    testStatus === 'success'
                      ? '#10b981'
                      : testStatus === 'error'
                        ? '#ef4444'
                        : '#94a3b8',
                }}
                aria-hidden="true"
              />
              <p
                className="min-w-0 flex-1 text-base"
                style={{ color: testStatus === 'error' ? '#dc2626' : 'var(--rm-text)' }}
                {...(testStatus === 'error' ? { role: 'alert' } : { role: 'status' })}
              >
                {testMessage}
              </p>
            </div>
          )}
          {lastRunAt && (
            <p className="mt-3 text-sm tabular-nums" style={{ color: 'var(--rm-text-muted)' }}>
              Last run {formatDateTime(lastRunAt)}
            </p>
          )}
          {!isAuthenticated && (
            <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Sign in to run the connectivity test with an authenticated session.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
