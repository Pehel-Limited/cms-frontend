import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Features } from '@/components/marketing/Features';
import { CTA } from '@/components/marketing/CTA';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-2xl font-bold text-primary-600">
                CMS Banking
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-700 hover:text-primary-600 transition">
                Sign In
              </Link>
              <Link href="/register" className="btn btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-16">
        {/* <Hero />
        <Features />
        <CTA /> */}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container-custom">
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2025 Rajat Maheshwari. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
