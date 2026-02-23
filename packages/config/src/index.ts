// @cms/config - Shared configuration across apps
// Each app can override via its own .env / .env.local

export interface AppConfig {
  api: {
    baseUrl: string;
    identityServiceUrl: string;
    graphqlUrl: string;
    timeout: number;
  };
  app: {
    name: string;
    url: string;
  };
  auth: {
    tokenKey: string;
    refreshTokenKey: string;
    userKey: string;
  };
  features: {
    pwa: boolean;
    analytics: boolean;
  };
  bank: {
    defaultBankId: string;
    defaultBankCode: string;
    defaultCurrency: string;
    defaultLocale: string;
  };
}

/** Deep partial utility — makes all nested properties optional */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Build config from environment variables.
 * Works for both bank-ops and cust-portal — each supplies its own env vars.
 */
export function createConfig(overrides?: DeepPartial<AppConfig>): AppConfig {
  return {
    api: {
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
      identityServiceUrl: process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:8082',
      graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8081/graphql',
      timeout: 30000,
      ...overrides?.api,
    },
    app: {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'Rayva',
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ...overrides?.app,
    },
    auth: {
      tokenKey: 'auth_token',
      refreshTokenKey: 'refresh_token',
      userKey: 'user_data',
      ...overrides?.auth,
    },
    features: {
      pwa: process.env.NEXT_PUBLIC_ENABLE_PWA === 'true',
      analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
      ...overrides?.features,
    },
    bank: {
      defaultBankId:
        process.env.NEXT_PUBLIC_DEFAULT_BANK_ID || '123e4567-e89b-12d3-a456-426614174000',
      defaultBankCode: process.env.NEXT_PUBLIC_DEFAULT_BANK_CODE || 'DEMO001',
      defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'EUR',
      defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en-IE',
      ...overrides?.bank,
    },
  };
}

// ─── Shared Tailwind Preset ────────────────────────────────────────────────

/** Shared Tailwind color palette used by both apps */
export const sharedColors = {
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  secondary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
} as const;

/** Base Tailwind preset for extending in each app's tailwind.config */
export const tailwindPreset = {
  theme: {
    extend: {
      colors: sharedColors,
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        soft: '0 2px 15px 0 rgba(0, 0, 0, 0.05)',
        medium: '0 4px 20px 0 rgba(0, 0, 0, 0.08)',
        strong: '0 8px 30px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
} as const;

export default createConfig;
