import Link from 'next/link';

export function CTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600">
      <div className="container-custom">
        <div className="text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Ready to transform your credit management?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join leading banks and financial institutions using CMS Banking Platform to streamline
            their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-primary-600 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Start Free Trial
            </Link>
            <Link
              href="#contact"
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200"
            >
              Schedule Demo
            </Link>
          </div>
          <p className="mt-6 text-sm opacity-75">
            ✨ No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
