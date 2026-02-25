'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  'Select company size',
  '1–50 employees',
  '51–200 employees',
  '201–1,000 employees',
  '1,001–5,000 employees',
  '5,000+ employees',
];

const INTERESTS = [
  'Select area of interest',
  'Loan Origination',
  'Risk Analytics & Underwriting',
  'KYC / AML Compliance',
  'Product Management',
  'Account Management',
  'Full Platform Demo',
  'API & Integration',
  'Other',
];

export default function EnquiryPage() {
  const [form, setForm] = useState<EnquiryForm>({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    jobTitle: '',
    companySize: '',
    interest: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof EnquiryForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName || !form.email || !form.companyName) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      // TODO: Wire to backend API when available
      await new Promise(resolve => setTimeout(resolve, 1200));
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Thank you, {form.fullName.split(' ')[0]}!
          </h1>
          <p className="text-slate-600 mb-8">
            We&apos;ve received your enquiry and our team will get back to you within 1 business day
            to schedule your demo.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ──── Nav ──── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a3a7a] to-[#3b82f6] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
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
            <span className="text-lg font-bold text-slate-900 tracking-tight">Rayva</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white bg-gradient-to-r from-[#1a3a7a] to-[#2563eb] px-5 py-2 rounded-xl hover:from-[#15306a] hover:to-[#1d4ed8] transition-all shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-16">
        <div className="max-w-5xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            {/* ──── Left: Info ──── */}
            <div className="lg:col-span-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-8"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Home
              </Link>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
                Schedule a Demo
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-10">
                See how Rayva can streamline your credit management operations. Our team will walk
                you through a personalised demo.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">30-Minute Walkthrough</p>
                    <p className="text-sm text-slate-500">
                      Tailored to your institution&apos;s needs and priorities.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">No Commitment</p>
                    <p className="text-sm text-slate-500">
                      Explore the platform with zero obligations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Expert Team</p>
                    <p className="text-sm text-slate-500">
                      Speak directly with our product specialists.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ──── Right: Form ──── */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.fullName}
                        onChange={e => updateField('fullName', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="John Smith"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Work Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => updateField('email', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="john@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => updateField('phone', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="+353 1 234 5678"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={form.jobTitle}
                        onChange={e => updateField('jobTitle', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Head of Credit"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Company / Institution <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.companyName}
                        onChange={e => updateField('companyName', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Acme Bank"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Company Size
                      </label>
                      <select
                        value={form.companySize}
                        onChange={e => updateField('companySize', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-700"
                      >
                        {COMPANY_SIZES.map((size, i) => (
                          <option key={size} value={i === 0 ? '' : size} disabled={i === 0}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Area of Interest
                    </label>
                    <select
                      value={form.interest}
                      onChange={e => updateField('interest', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-700"
                    >
                      {INTERESTS.map((item, i) => (
                        <option key={item} value={i === 0 ? '' : item} disabled={i === 0}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Message
                    </label>
                    <textarea
                      value={form.message}
                      onChange={e => updateField('message', e.target.value)}
                      rows={4}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                      placeholder="Tell us about your requirements or any specific features you'd like to see..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-6 bg-gradient-to-r from-[#1a3a7a] to-[#2563eb] text-white font-semibold rounded-xl hover:from-[#15306a] hover:to-[#1d4ed8] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Submitting…
                      </span>
                    ) : (
                      'Request Demo'
                    )}
                  </button>

                  <p className="text-xs text-center text-slate-400">
                    We&apos;ll respond within 1 business day. No spam, ever.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──── Footer ──── */}
      <footer className="bg-[#0a1e3d] text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-white"
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
              <span className="text-sm font-semibold">Rayva</span>
            </div>
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Rajat Maheshwari. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
