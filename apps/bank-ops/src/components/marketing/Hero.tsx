'use client';

import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50 pt-32 pb-20">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Modern Credit Management for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">
                Digital Banks
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Streamline loan origination, underwriting, and portfolio management with our
              next-generation banking platform. Built for scale, designed for speed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/enquiry" className="btn btn-primary px-8 py-3 text-lg">
                Schedule Demo
              </Link>
              <Link href="#features" className="btn btn-outline px-8 py-3 text-lg">
                Learn More
              </Link>
            </div>
          </div>
          <div className="relative animate-slide-up">
            <div className="relative z-10">
              <img
                src="/dashboard-preview.png"
                alt="CMS Dashboard"
                className="rounded-2xl shadow-strong"
                onError={e => {
                  e.currentTarget.src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23f3f4f6" width="800" height="600"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="32"%3EDashboard Preview%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
            <div
              className="absolute -bottom-8 -left-8 w-72 h-72 bg-secondary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"
              style={{ animationDelay: '1s' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
