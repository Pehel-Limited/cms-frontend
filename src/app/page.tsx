import Link from 'next/link';

const FEATURES = [
  {
    title: 'Loan Origination',
    desc: 'End-to-end application processing with automated workflows, reducing turnaround by 80%.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    title: 'Risk Analytics',
    desc: 'Real-time portfolio dashboards with predictive scoring and early-warning indicators.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    title: 'KYC / AML Compliance',
    desc: 'EU-compliant screening, document verification, and continuous monitoring built-in.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    title: 'Product Management',
    desc: 'Configure loan products, interest rates, terms, and eligibility rules without code.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    title: 'Account Management',
    desc: 'Multi-type account lifecycle management with real-time status tracking and controls.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
  {
    title: 'API-First Platform',
    desc: 'REST & GraphQL APIs for seamless integration with core banking and third-party services.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
];

const STATS = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<200ms', label: 'Avg Response' },
  { value: 'SOC 2', label: 'Certified' },
  { value: 'EU / IE', label: 'Compliant' },
];

export default function HomePage() {
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

      {/* ──── Hero ──── */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f2847] via-[#1a3a7a] to-[#2563eb]" />
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-sky-400/5 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-rule='evenodd'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        {/* Wave bottom */}
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-50"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,80 L0,40 Q360,0 720,40 Q1080,80 1440,40 L1440,80 Z" />
        </svg>

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32 lg:pt-32 lg:pb-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-sm text-blue-200 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Built for New-World Banking
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
              Credit Management,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-blue-200">
                Elevated.
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-200/80 leading-relaxed mb-10 max-w-2xl">
              Rayva is a modern, multi-tenant platform for loan origination, underwriting, and
              portfolio management. Designed for compliance, built for speed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white text-blue-700 rounded-xl font-semibold text-base hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
              >
                Start Free Trial
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl font-semibold text-base text-white hover:bg-white/20 transition-colors"
              >
                Explore Features
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-16 flex flex-wrap gap-3 sm:gap-5">
            {STATS.map(s => (
              <div
                key={s.label}
                className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
              >
                <span className="text-xl font-bold text-white">{s.value}</span>
                <span className="text-xs text-blue-300 uppercase tracking-wider font-medium">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── Features ──── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
            Platform Capabilities
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">
            Everything modern banks need
          </h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">
            From origination to compliance, Rayva provides the tools to manage the full credit
            lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f2847] via-[#1a3a7a] to-[#2563eb]" />
        <div className="absolute -top-20 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <svg
          className="absolute top-0 left-0 right-0 text-slate-50 rotate-180"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
        </svg>
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 lg:py-24 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to transform your credit management?
          </h2>
          <p className="text-lg text-blue-200/80 mb-10 max-w-xl mx-auto">
            Join banks across Ireland & the EU using Rayva to streamline operations and stay
            compliant.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
            >
              Start Free Trial
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Schedule Demo
            </Link>
          </div>
          <p className="mt-8 text-sm text-blue-300/60">
            No credit card required &middot; 14-day free trial &middot; Cancel anytime
          </p>
        </div>
      </section>

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
