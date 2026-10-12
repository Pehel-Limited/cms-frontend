'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, loginUser } from '@/store/slices/authSlice';
import config from '@/config';

/* Public page — intentionally light themed; it renders outside the dashboard shell. */

const CAPABILITIES = ['Loan origination', 'Risk analytics', 'KYC / AML', 'Portfolio management'];

const BRAND_LOGO_PATH = 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector(state => state.auth);

  /* Credentials stay in state so a failed sign-in never loses what was typed. */
  const [credentials, setCredentials] = useState({
    bankCode: config.bank.defaultBankCode,
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const update = (field: 'username' | 'password', value: string) => {
    if (error) dispatch(clearError());
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await dispatch(loginUser(credentials)).unwrap();
      router.push('/dashboard');
    } catch {
      /* The rejection is stored in auth state and announced by the alert below.
         No credential values are echoed back. */
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ──── Brand panel (decorative, light-on-dark) ──── */}
      <div className="relative hidden overflow-hidden bg-[#0a1628] lg:flex lg:w-[45%]">
        <div
          className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl motion-safe:animate-float"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl motion-safe:animate-float-delayed"
          aria-hidden="true"
        />
        <div
          className="absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-2xl motion-safe:animate-float"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"
              aria-hidden="true"
            >
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
              </svg>
            </span>
            <span className="text-xl font-semibold tracking-tight text-white">Rayva</span>
          </div>

          <div className="space-y-6">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
              Banking intelligence, <span className="text-sky-300">reimagined.</span>
            </p>
            <p className="max-w-md text-lg leading-relaxed text-blue-200/80">
              Loan origination, underwriting and portfolio management in one workspace for modern
              banks.
            </p>
            <ul className="flex flex-wrap gap-3 pt-2">
              {CAPABILITIES.map(capability => (
                <li
                  key={capability}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm text-blue-100"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
                  {capability}
                </li>
              ))}
            </ul>
          </div>

          <p className="border-t border-white/10 pt-6 text-sm text-blue-200/70">
            Staff portal — sign in with the credentials issued by your bank.
          </p>
        </div>
      </div>

      {/* ──── Sign-in form ──── */}
      <main className="force-light flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-700"
              aria-hidden="true"
            >
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
              </svg>
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-900">Rayva</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-2 text-base text-slate-600">
            Use your portal credentials to reach your dashboard.
          </p>

          {error && (
            <div
              id="login-error"
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
            >
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm text-red-700">
                {error}
                <span className="mt-0.5 block text-red-600/80">
                  Check your username and password, then try again.
                </span>
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
            aria-describedby={error ? 'login-error' : undefined}
          >
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Username
                <span className="text-red-500" aria-hidden="true">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={event => update('username', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
                <span className="text-red-500" aria-hidden="true">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  aria-required="true"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={event => update('password', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-12 text-base text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(visible => !visible)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition-colors hover:text-slate-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    {showPassword ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Need access to the portal?{' '}
            <Link href="/register" className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
              Register for an account
            </Link>
          </p>
          <p className="mt-4 text-center text-sm text-slate-500">
            Forgotten your password? Contact your bank&apos;s portal administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
