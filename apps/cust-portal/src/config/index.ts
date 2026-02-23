import { createConfig } from '@cms/config';

const config = createConfig({
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8087',
    identityServiceUrl: process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:8082',
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Rayva',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  },
});

export default config;
