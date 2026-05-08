export function Features() {
  const features = [
    {
      icon: '🚀',
      title: 'Lightning Fast',
      description:
        'Process loan applications in minutes, not days. Our automated workflows reduce turnaround time by 80%.',
    },
    {
      icon: '🔒',
      title: 'Bank-Grade Security',
      description:
        'Enterprise security with SOC 2 Type II compliance, encryption at rest and in transit, and multi-tenant isolation.',
    },
    {
      icon: '📊',
      title: 'Real-Time Analytics',
      description:
        'Make data-driven decisions with live dashboards, portfolio insights, and predictive risk scoring.',
    },
    {
      icon: '🤖',
      title: 'AI-Powered Underwriting',
      description:
        'Automated credit decisioning with machine learning models that improve over time.',
    },
    {
      icon: '🔗',
      title: 'Seamless Integration',
      description:
        'Connect with core banking systems, credit bureaus, and third-party services via REST & GraphQL APIs.',
    },
    {
      icon: '📱',
      title: 'Mobile-First Design',
      description:
        'Responsive PWA that works flawlessly on any device, with offline capability and push notifications.',
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container-custom">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to manage credit
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From loan origination to portfolio management, our platform provides all the tools
            modern banks need to succeed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card card-hover"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
