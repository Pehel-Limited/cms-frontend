'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { authService } from '@/services/auth.service';
import config from '@/config';

/* Public page — intentionally light themed; it renders outside the dashboard shell. */

const CAPABILITIES = [
  'Account opening',
  'Application tracking',
  'Document upload',
  'Secure sign-in',
];

const BRAND_LOGO_PATH =
  'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* Values stay in state so a failed registration never loses typed input. */
  const [formData, setFormData] = useState({
    bankId: config.bank.defaultBankId,
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });

  const update = (field: keyof typeof formData, value: string) => {
    if (formError) setFormError(null);
    if (field === 'confirmPassword' || field === 'password') setConfirmError(null);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (formData.password !== formData.confirmPassword) {
      setConfirmError('Passwords do not match.');
      return;
    }
    setConfirmError(null);

    setIsLoading(true);
    try {
      /* confirmPassword is a client-side check only — it is never sent. */
      await authService.registerCustomer({
        bankId: formData.bankId,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || undefined,
      });
      toast.success('Registration submitted. Sign in to continue.');
      router.push('/login');
    } catch (error) {
      /* Server messages only — credentials are never echoed back. */
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      setFormError(
        err?.response?.data?.message || err?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const requiredMark = (
    <>
      <span className="text-red-500" aria-hidden="true">
        {' '}
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* ──── Brand panel ──── */}
      <div className="relative hidden overflow-hidden bg-[#0f2847] lg:flex lg:w-[45%]">
        <div
          className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl"
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
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15" aria-hidden="true">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
              </svg>
            </span>
            <span className="text-xl font-semibold tracking-tight text-white">Rayva</span>
          </div>

          <div className="space-y-6">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-white">
              Start your banking journey
            </p>
            <p className="max-w-sm text-lg leading-relaxed text-blue-200/80">
              Create an account to open facilities, track applications and manage documents in one
              place.
            </p>
            <ul className="flex flex-wrap gap-2 pt-2">
              {CAPABILITIES.map(capability => (
                <li
                  key={capability}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-blue-100"
                >
                  {capability}
                </li>
              ))}
            </ul>
          </div>

          <p className="border-t border-white/10 pt-6 text-sm text-blue-200/70">
            Registrations are reviewed by the bank before portal access is granted.
          </p>
        </div>
      </div>

      {/* ──── Registration form ──── */}
      <main className="force-light flex flex-1 items-center justify-center bg-slate-50 p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a3a7a]" aria-hidden="true">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
              </svg>
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-900">Rayva</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Fields marked with an asterisk are required.
          </p>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-blue-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-blue-900">
              Already registered?{' '}
              <Link
                href="/login"
                className="font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-950"
              >
                Sign in to your existing account
              </Link>
              .
            </p>
          </div>

          {formError && (
            <div
              id="register-error"
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
                {formError}
                <span className="mt-0.5 block text-red-600/80">
                  Your details were kept — correct anything highlighted and submit again.
                </span>
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
            aria-describedby={formError ? 'register-error' : undefined}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-slate-700">
                  First name{requiredMark}
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="given-name"
                  placeholder="Jane"
                  value={formData.firstName}
                  onChange={event => update('firstName', event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Last name{requiredMark}
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="family-name"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={event => update('lastName', event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Username{requiredMark}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                aria-required="true"
                autoComplete="username"
                placeholder="Choose a username"
                value={formData.username}
                onChange={event => update('username', event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email{requiredMark}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                aria-required="true"
                autoComplete="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={event => update('email', event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="mb-1.5 block text-sm font-medium text-slate-700">
                Phone number <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                placeholder="+353 1 234 5678"
                value={formData.phoneNumber}
                onChange={event => update('phoneNumber', event.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password{requiredMark}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    aria-required="true"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={event => update('password', event.target.value)}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(visible => !visible)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition-colors hover:text-slate-800"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={
                          showPassword
                            ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18'
                            : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                        }
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirm password{requiredMark}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    aria-required="true"
                    autoComplete="new-password"
                    aria-invalid={confirmError ? true : undefined}
                    aria-describedby={confirmError ? 'confirmPassword-error' : undefined}
                    placeholder="Repeat your password"
                    value={formData.confirmPassword}
                    onChange={event => update('confirmPassword', event.target.value)}
                    className={`${inputClass} pr-12 ${
                      confirmError ? 'border-red-400' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(visible => !visible)}
                    aria-pressed={showConfirm}
                    aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition-colors hover:text-slate-800"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={
                          showConfirm
                            ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18'
                            : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                        }
                      />
                    </svg>
                  </button>
                </div>
                {confirmError && (
                  <p id="confirmPassword-error" role="alert" className="mt-1.5 text-sm text-red-600">
                    {confirmError}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#1a3a7a] py-3 text-base font-semibold text-white transition-colors hover:bg-[#15306a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Your registration is reviewed by the bank before portal access is granted.
          </p>
        </div>
      </main>
    </div>
  );
}
