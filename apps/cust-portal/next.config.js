/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@cms/ui', '@cms/config', '@cms/types'],
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8087',
    NEXT_PUBLIC_IDENTITY_URL: process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:8082',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Rayva',
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:8087/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
