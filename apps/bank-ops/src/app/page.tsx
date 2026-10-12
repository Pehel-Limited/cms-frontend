import Link from 'next/link';

/* Public marketing page — intentionally light themed and server rendered. */

const BRAND_LOGO_PATH = 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';

const FEATURES = [
  {
    title: 'Loan origination',
    desc: 'End-to-end application processing with automated workflow stages and a full audit trail.',
    path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'Risk analytics',
    desc: 'Portfolio dashboards with pipeline ageing, SLA tracking and early-warning indicators.',
    path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'KYC and AML compliance',
    desc: 'Screening, document verification and case tracking built into the lending journey.',
    path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Product management',
    desc: 'Configure loan products, interest rates, terms and eligibility rules without code.',
    path: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    title: 'Account management',
    desc: 'Multi-type account lifecycle management with status tracking and limit controls.',
    path: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    title: 'API-first platform',
    desc: 'REST and GraphQL APIs for integration with core banking and third-party services.',
    path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#site-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900"
      >
        Skip to main content
      </a>

      {/* ──── Header ──── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Rayva home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700" aria-hidden="true">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
              </svg>
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">Rayva</span>
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

      <main id="site-main">
        {/* ──── Hero ──── */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-[#0a1628] pt-16">
          <div
            className="absolute -right-32 -top-32 h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-3xl motion-safe:animate-float"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl motion-safe:animate-float-delayed"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-rule='evenodd'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
            }}
            aria-hidden="true"
          />
          <svg
            className="absolute bottom-0 left-0 right-0 text-slate-50"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path fill="currentColor" d="M0,80 L0,40 Q360,0 720,40 Q1080,80 1440,40 L1440,80 Z" />
          </svg>

          <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-24 lg:pb-40 lg:pt-32">
            <div className="max-w-3xl">
              <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm text-blue-200 motion-safe:animate-fade-in">
                <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
                Future-ready banking, secure by design
              </p>
              <h1
                id="hero-heading"
                className="mb-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white motion-safe:animate-slide-up sm:text-5xl lg:text-6xl"
              >
                Credit management, <span className="text-gradient-blue">elevated.</span>
              </h1>
              <p className="mb-10 max-w-2xl text-lg leading-relaxed text-blue-200/80 sm:text-xl">
                Rayva is a multi-tenant platform for loan origination, underwriting and portfolio
                management — designed for compliance teams and built for the people who move the
                pipeline.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/enquiry"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffffff] px-7 py-3 text-base font-semibold text-[#1e40af] transition-colors hover:bg-[#eff6ff] motion-safe:hover:-translate-y-0.5"
                >
                  Schedule a demo
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Explore the platform features
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ──── Features ──── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 lg:py-28"
        >
          <div className="mb-14 max-w-2xl">
            <p className="mb-2 text-sm font-semibold text-blue-700">Platform capabilities</p>
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
              Everything a lending team needs in one workspace
            </h2>
            <p className="mt-3 text-base text-slate-600">
              From origination to compliance, Rayva covers the full credit lifecycle so relationship
              managers, credit and operations work from the same record.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(feature => (
              <li
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-transform motion-safe:hover:-translate-y-1"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700" aria-hidden="true">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.path} />
                  </svg>
                </span>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{feature.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ──── Call to action ──── */}
        <section aria-labelledby="cta-heading" className="relative overflow-hidden bg-[#0f2847]">
          <div
            className="absolute -top-20 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"
            aria-hidden="true"
          />
          <svg
            className="absolute left-0 right-0 top-0 rotate-180 text-slate-50"
            viewBox="0 0 1440 48"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
          </svg>
          <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center lg:py-24">
            <h2 id="cta-heading" className="mb-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              Ready to see it against your own lending process?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-lg text-blue-200/80">
              Book a walkthrough and we&apos;ll map origination, underwriting and portfolio
              management to the way your teams already work.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/enquiry"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffffff] px-7 py-3 text-base font-semibold text-[#1e40af] transition-colors hover:bg-[#eff6ff]"
              >
                Schedule a demo
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-white/20"
              >
                Create an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ──── Footer ──── */}
      <footer className="bg-[#0a1e3d] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-12 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10" aria-hidden="true">
              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={BRAND_LOGO_PATH} />
              </svg>
            </span>
            <span className="text-sm font-semibold">Rayva</span>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              <li>
                <Link href="/enquiry" className="text-slate-300 transition-colors hover:text-white">
                  Schedule a demo
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-slate-300 transition-colors hover:text-white">
                  Sign in to the portal
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-slate-300 transition-colors hover:text-white">
                  Create an account
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Rajat Maheshwari. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
