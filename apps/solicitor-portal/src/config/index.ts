const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8089',
    identityServiceUrl: process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:8082',
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Solicitor Portal',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
  },
  auth: {
    tokenKey: 'sol_auth_token',
    refreshTokenKey: 'sol_refresh_token',
    userKey: 'sol_user',
  },
};

export default config;
