'use client';

import { useState } from 'react';
import Link from 'next/link';

/* Public page — intentionally light themed; it renders outside the dashboard shell. */

interface EnquiryForm {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  companySize: string;
  interest: string;
  message: string;
}

const COMPANY_SIZES = [
  '1–50 employees',
  '51–200 employees',
  '201–1,000 employees',
  '1,001–5,000 employees',
  '5,000+ employees',
];

const INTERESTS = [
  'Loan origination',
  'Risk analytics and underwriting',
  'KYC / AML compliance',
  'Product management',
  'Account management',
  'Full platform demo',
  'API and integration',
  'Something else',
];

const EMPTY_FORM: EnquiryForm = {
  fullName: '',
  email: '',
  phone: '',
  companyName: '',
  jobTitle: '',
  companySize: '',
  interest: '',
  message: '',
};

const BRAND_LOGO_PATH = 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400';

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

const HIGHLIGHTS = [
  {
    title: 'Guided walkthrough',
    body: 'Tailored to your institution’s processes and priorities.',
    path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'No commitment',
    body: 'Explore the platform with no obligation to proceed.',
    path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Product specialists',
    body: 'Speak directly with the people who build the platform.',
    path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

export default function EnquiryPage() {
  const [form, setForm] = useState<EnquiryForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof EnquiryForm, value: string) => {
    if (error) setError(null);
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const missing = [
      !form.fullName.trim() && 'full name',
      !form.email.trim() && 'work email',
      !form.companyName.trim() && 'company or institution',
    ].filter(Boolean) as string[];

    if (missing.length > 0) {
      setError(`Add your ${missing.join(' and ')} so we know how to reach you.`);
      return;
    }

    try {
      setSubmitting(true);
      /* TODO: POST to the enquiry endpoint once it exists. This demo portal has no
         submission backend yet, so the confirmation below says exactly that. */
      await new Promise(resolve => setTimeout(resolve, 600));
      setSubmitted(true);
    } catch {
      setError('The enquiry could not be captured. Check your details and try again.');
    } finally {
      setSubmitting(false);
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

  const siteHeader = (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700" aria-hidden="true">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">Rayva</span>
          <span className="sr-only">— home</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-primary-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
          >
            Create an account
          </Link>
        </div>
      </nav>
    </header>
  );

  const siteFooter = (
    <footer className="bg-[#0a1e3d] text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-12 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10" aria-hidden="true">
            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
            </svg>
          </span>
          <span className="text-sm font-semibold">Rayva</span>
        </div>
        <p className="text-sm text-slate-300">
          &copy; {new Date().getFullYear()} Rajat Maheshwari. All rights reserved.
        </p>
      </div>
    </footer>
  );

  /* Branch 1 — confirmation. Renders instead of the form, so only one <h1> exists at a time. */
  if (submitted) {
    const firstName = form.fullName.trim().split(' ')[0];
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <a
          href="#enquiry-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900"
        >
          Skip to main content
        </a>
        {siteHeader}
        <main id="enquiry-main" className="flex flex-1 items-center justify-center px-4 pt-24 pb-16">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <span
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
              aria-hidden="true"
            >
              <svg className="h-8 w-8 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Thanks{firstName ? `, ${firstName}` : ''} — your details are captured
            </h1>
            <p className="mt-3 text-base text-slate-600">
              This demo portal records enquiries in the browser only; the submission endpoint is not
              connected yet, so nothing has been sent to the Rayva team.
            </p>
            <dl className="mt-6 space-y-2 rounded-2xl bg-slate-50 px-5 py-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Company</dt>
                <dd className="text-right font-medium text-slate-900">{form.companyName || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-right font-medium text-slate-900">{form.email || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Interest</dt>
                <dd className="text-right font-medium text-slate-900">{form.interest || '—'}</dd>
              </div>
            </dl>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setForm(EMPTY_FORM);
                }}
                className="rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
              >
                Submit another enquiry
              </button>
              <Link
                href="/"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Back to the Rayva overview
              </Link>
            </div>
          </div>
        </main>
        {siteFooter}
      </div>
    );
  }

  /* Branch 2 — the enquiry form. */
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a
        href="#enquiry-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900"
      >
        Skip to main content
      </a>
      {siteHeader}

      <main id="enquiry-main" className="flex-1 pt-16">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
            {/* ──── Context ──── */}
            <div className="lg:col-span-2">
              <Link
                href="/"
                className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-600 transition-colors hover:text-slate-900"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to the Rayva overview
              </Link>
              <h1 className="mb-4 text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
                Schedule a demo
              </h1>
              <p className="mb-10 text-lg leading-relaxed text-slate-600">
                See how Rayva handles loan origination, underwriting and portfolio management. Tell
                us what you need and we&apos;ll prepare a walkthrough around it.
              </p>

              <ul className="space-y-6">
                {HIGHLIGHTS.map(highlight => (
                  <li key={highlight.title} className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700" aria-hidden="true">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={highlight.path} />
                      </svg>
                    </span>
                    <div>
                      <p className="text-base font-semibold text-slate-900">{highlight.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{highlight.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ──── Form ──── */}
            <div className="lg:col-span-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'enquiry-error' : undefined}>
                  {error && (
                    <div
                      id="enquiry-error"
                      role="alert"
                      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fullName" className={labelClass}>
                        Full name{requiredMark}
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        aria-required="true"
                        autoComplete="name"
                        value={form.fullName}
                        onChange={event => updateField('fullName', event.target.value)}
                        className={inputClass}
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className={labelClass}>
                        Work email{requiredMark}
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        aria-required="true"
                        autoComplete="email"
                        value={form.email}
                        onChange={event => updateField('email', event.target.value)}
                        className={inputClass}
                        placeholder="jane@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="phone" className={labelClass}>
                        Phone number <span className="font-normal text-slate-500">(optional)</span>
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={event => updateField('phone', event.target.value)}
                        className={inputClass}
                        placeholder="+353 1 234 5678"
                      />
                    </div>
                    <div>
                      <label htmlFor="jobTitle" className={labelClass}>
                        Job title <span className="font-normal text-slate-500">(optional)</span>
                      </label>
                      <input
                        id="jobTitle"
                        name="jobTitle"
                        type="text"
                        autoComplete="organization-title"
                        value={form.jobTitle}
                        onChange={event => updateField('jobTitle', event.target.value)}
                        className={inputClass}
                        placeholder="Head of credit"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="companyName" className={labelClass}>
                        Company or institution{requiredMark}
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        required
                        aria-required="true"
                        autoComplete="organization"
                        value={form.companyName}
                        onChange={event => updateField('companyName', event.target.value)}
                        className={inputClass}
                        placeholder="Acme Bank"
                      />
                    </div>
                    <div>
                      <label htmlFor="companySize" className={labelClass}>
                        Company size <span className="font-normal text-slate-500">(optional)</span>
                      </label>
                      <select
                        id="companySize"
                        name="companySize"
                        value={form.companySize}
                        onChange={event => updateField('companySize', event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select company size</option>
                        {COMPANY_SIZES.map(size => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="interest" className={labelClass}>
                      Area of interest <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <select
                      id="interest"
                      name="interest"
                      value={form.interest}
                      onChange={event => updateField('interest', event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select an area of interest</option>
                      {INTERESTS.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className={labelClass}>
                      What would you like to see? <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={form.message}
                      onChange={event => updateField('message', event.target.value)}
                      rows={4}
                      className={`${inputClass} resize-y`}
                      placeholder="Tell us about your processes or the features you want to see."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-primary-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden="true"
                        />
                        Capturing your enquiry…
                      </span>
                    ) : (
                      'Request a demo'
                    )}
                  </button>

                  <p className="text-center text-sm text-slate-500">
                    Required fields are marked with an asterisk.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      {siteFooter}
    </div>
  );
}
