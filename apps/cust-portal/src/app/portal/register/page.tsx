'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/api/auth-service';
import type { RegisterRequest } from '@/services/api/auth-service';

export default function PortalRegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setPasswordMismatch(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (formData.password !== confirmPassword) {
      setPasswordMismatch(true);
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await authService.register(formData);
      router.push('/portal/login?registered=true');
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || 'Registration failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ──── Left panel: Branding ──── */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-gradient-to-br from-[#2d0e2b] via-[#4a1747] to-[#7f2b7b]">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-pink-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-fuchsia-400/5 rounded-full blur-2xl" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md"
              aria-hidden="true"
            >
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Rayva</span>
          </div>

          <div className="space-y-6">
            <h1 className="serif text-4xl font-medium leading-tight text-white xl:text-[44px]">
              Start your{' '}
              <span className="bg-gradient-to-r from-pink-300 to-purple-200 bg-clip-text text-transparent">
                banking journey.
              </span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-purple-200/80">
              Create an account in minutes. No branch visits, no paperwork.
            </p>

            {/* Benefits */}
            <div className="space-y-3 pt-2">
              {[
                'Apply for personal and business loans',
                'Track applications in real time',
                'Upload documents securely',
                'E-sign from any device',
              ].map(b => (
                <div key={b} className="flex items-center gap-3">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/20"
                    aria-hidden="true"
                  >
                    <svg
                      className="h-3.5 w-3.5 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-purple-100">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-sm text-purple-200/60">
              Applications, documents and messages in one secure place.
            </p>
          </div>
        </div>
      </div>

      {/* ──── Right panel: Register form ──── */}
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: 'var(--tile-active)' }}
              aria-hidden="true"
            >
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <span className="serif text-2xl font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Rayva</span>
          </div>

          <div className="mb-6">
            <h2 className="serif text-[28px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>Create an account</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Start your banking journey with Rayva</p>
          </div>

          {errorMsg && (
            <div
              id="register-error"
              role="alert"
              aria-live="assertive"
              className="alert alert-error mb-5 !rounded-2xl"
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="field-label"
                >
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input !rounded-2xl py-3"
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="field-label"
                >
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input !rounded-2xl py-3"
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="field-label">
                Username
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  className="input !rounded-2xl py-3 pl-10"
                  placeholder="choose a username"
                  autoComplete="username"
                  required
                  minLength={3}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input !rounded-2xl py-3 pl-10"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="phoneNumber"
                className="field-label"
              >
                Phone number <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="input !rounded-2xl py-3"
                placeholder="+353 1 234 5678"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="field-label"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className="input !rounded-2xl py-3 pr-11"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    aria-describedby="password-hint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 muted transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
                  >
                    <EyeIcon revealed={showPassword} />
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="field-label"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={handleChange}
                    className={`input !rounded-2xl py-3 pr-11 ${
                      passwordMismatch ? 'input-error' : ''
                    }`}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    aria-describedby={
                      passwordMismatch ? 'confirm-password-error' : undefined
                    }
                    aria-invalid={passwordMismatch ? true : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    aria-pressed={showConfirmPassword}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 muted transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
                  >
                    <EyeIcon revealed={showConfirmPassword} />
                  </button>
                </div>
                {passwordMismatch && (
                  <p id="confirm-password-error" className="mt-1.5 text-sm text-red-600">
                    The two passwords do not match.
                  </p>
                )}
              </div>
            </div>
            <p id="password-hint" className="-mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              At least 8 characters, including an uppercase letter, a lowercase letter, a number and
              a special character.
            </p>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              aria-describedby={errorMsg ? 'register-error' : undefined}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4a1747] to-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-700/20 transition-all hover:from-[#3d1040] hover:to-[#6b2568] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link
              href="/portal/login"
              className="font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* Show/hide password glyph — decorative, the button carries the label. */
function EyeIcon({ revealed }: { revealed: boolean }) {
  return revealed ? (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88"
      />
    </svg>
  ) : (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
