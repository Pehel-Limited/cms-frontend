const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081', // BFF-Admin
    identityServiceUrl: process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:8082', // Identity Service (direct)
    graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8081/graphql',
    timeout: 30000,
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'CMS Banking Platform',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token',
    userKey: 'user_data',
  },
  features: {
    pwa: process.env.NEXT_PUBLIC_ENABLE_PWA === 'true',
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
  bank: {
    defaultBankId:
      process.env.NEXT_PUBLIC_DEFAULT_BANK_ID || '123e4567-e89b-12d3-a456-426614174000',
    defaultBankCode: process.env.NEXT_PUBLIC_DEFAULT_BANK_CODE || 'DEMO001',
  },
};

export default config;
