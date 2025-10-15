'use client';

import Link from 'next/link';

const loanProducts = [
  {
    id: 1,
    name: 'Personal Loan',
    description: 'Quick personal loans for immediate financial needs',
    interestRate: '10.5% - 14.5%',
    minAmount: '₹50,000',
    maxAmount: '₹25,00,000',
    tenure: '12 - 60 months',
    processingFee: '2% + GST',
    features: [
      'Minimal documentation',
      'Quick approval',
      'Flexible tenure',
      'No collateral required',
    ],
    eligibility: [
      'Age: 21-60 years',
      'Minimum income: ₹25,000/month',
      'Employment: Salaried/Self-employed',
    ],
    icon: '💰',
    color: 'blue',
  },
  {
    id: 2,
    name: 'Home Loan',
    description: 'Finance your dream home with competitive rates',
    interestRate: '8.5% - 9.5%',
    minAmount: '₹5,00,000',
    maxAmount: '₹5,00,00,000',
    tenure: '60 - 360 months',
    processingFee: '0.5% + GST',
    features: [
      'Tax benefits',
      'Balance transfer facility',
      'Top-up loan available',
      'Doorstep service',
    ],
    eligibility: [
      'Age: 21-65 years',
      'Minimum income: ₹40,000/month',
      'Property documentation required',
    ],
    icon: '🏡',
    color: 'green',
  },
  {
    id: 3,
    name: 'Business Loan',
    description: 'Fuel your business growth and expansion',
    interestRate: '12% - 16%',
    minAmount: '₹1,00,000',
    maxAmount: '₹1,00,00,000',
    tenure: '12 - 84 months',
    processingFee: '1.5% + GST',
    features: [
      'Working capital support',
      'Equipment financing',
      'Business expansion',
      'Flexible repayment',
    ],
    eligibility: [
      'Business vintage: 2+ years',
      'Annual turnover: ₹10 lakhs+',
      'GST registration required',
    ],
    icon: '📈',
    color: 'purple',
  },
  {
    id: 4,
    name: 'Car Loan',
    description: 'Drive your dream car with easy financing',
    interestRate: '9% - 12%',
    minAmount: '₹1,00,000',
    maxAmount: '₹50,00,000',
    tenure: '12 - 84 months',
    processingFee: '1% + GST',
    features: [
      'Up to 90% financing',
      'New & used cars',
      'Quick disbursal',
      'Minimal documentation',
    ],
    eligibility: ['Age: 21-60 years', 'Minimum income: ₹30,000/month', 'Valid driving license'],
    icon: '🚗',
    color: 'indigo',
  },
  {
    id: 5,
    name: 'Education Loan',
    description: 'Invest in education, shape the future',
    interestRate: '8% - 11%',
    minAmount: '₹50,000',
    maxAmount: '₹1,50,00,000',
    tenure: '60 - 180 months',
    processingFee: 'Nil',
    features: [
      'Covers tuition & living costs',
      'Tax benefits',
      'Moratorium period',
      'Parent/guardian co-borrower',
    ],
    eligibility: [
      'Admission to recognized institution',
      'Age: 16-35 years',
      'Co-borrower required',
    ],
    icon: '🎓',
    color: 'yellow',
  },
  {
    id: 6,
    name: 'Gold Loan',
    description: 'Instant loan against your gold ornaments',
    interestRate: '7.5% - 10.5%',
    minAmount: '₹10,000',
    maxAmount: '₹1,00,00,000',
    tenure: '3 - 36 months',
    processingFee: 'Nil',
    features: [
      'Instant approval',
      'Minimal documentation',
      'Safe gold storage',
      'Part payment facility',
    ],
    eligibility: ['Age: 18+ years', 'Gold purity: 18-22 carats', 'Valid ID proof'],
    icon: '✨',
    color: 'amber',
  },
];

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Loan Products</h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Browse and recommend products to customers
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-primary-600 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Products Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loanProducts.map(product => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div
                className={`bg-${product.color}-50 px-6 py-4 border-b border-${product.color}-100`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{product.icon}</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
                      <p className="text-sm text-gray-600">{product.description}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Key Details */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Interest Rate</p>
                    <p className="text-sm font-semibold text-gray-900">{product.interestRate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {product.minAmount} - {product.maxAmount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tenure</p>
                    <p className="text-sm font-semibold text-gray-900">{product.tenure}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Processing Fee</p>
                    <p className="text-sm font-semibold text-gray-900">{product.processingFee}</p>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">Key Features</p>
                  <ul className="space-y-1">
                    {product.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-xs text-gray-600">
                        <svg
                          className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Eligibility */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">Eligibility Criteria</p>
                  <ul className="space-y-1">
                    {product.eligibility.map((criteria, idx) => (
                      <li key={idx} className="flex items-start text-xs text-gray-600">
                        <svg
                          className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {criteria}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <Link
                    href={`/dashboard/applications/new?product=${product.name}`}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium text-center"
                  >
                    Create Application
                  </Link>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
