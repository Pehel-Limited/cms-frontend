import config from '@/config';

// ─── Types matching BFF-Customer / Identity Service responses ──────

export interface LoginUserInfo {
  userId: string;
  bankId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  customerNumber?: string;
  currency?: string;
  locale?: string;
  roles: string[];
  permissions: string[];
  requiresTwoFactor: boolean;
  forcePasswordChange: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: LoginUserInfo;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RegisterResponse {
  userId: string;
  bankId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userType: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  bankId?: string;
  bankCode?: string;
}

export interface ApiError {
  status: number;
  message: string;
}

// ─── Auth Service ──────────────────────────────────────────────────

const BFF_BASE = config.api.baseUrl; // http://localhost:8087

export const authService = {
  /**
   * Customer login via BFF-Customer.
   * POST /api/customer/auth/login
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${BFF_BASE}/api/customer/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        bankCode: config.bank.defaultBankCode,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw { status: res.status, message: err.message || 'Login failed' } as ApiError;
    }

    const data: LoginResponse = await res.json();

    // Persist tokens + user id
    localStorage.setItem(config.auth.tokenKey, data.accessToken);
    localStorage.setItem(config.auth.refreshTokenKey, data.refreshToken);
    localStorage.setItem('user_id', data.user.userId);
    localStorage.setItem(config.auth.userKey, JSON.stringify(data.user));

    return data;
  },

  /**
   * Customer self-registration via BFF-Customer.
   * POST /api/customer/auth/register
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const body = {
      ...data,
      bankCode: data.bankCode || config.bank.defaultBankCode,
    };

    const res = await fetch(`${BFF_BASE}/api/customer/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw { status: res.status, message: err.message || 'Registration failed' } as ApiError;
    }

    return res.json();
  },

  /**
   * Refresh access token via BFF-Customer.
   * POST /api/customer/auth/refresh
   */
  async refresh(): Promise<TokenResponse | null> {
    const refreshToken = localStorage.getItem(config.auth.refreshTokenKey);
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${BFF_BASE}/api/customer/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data: TokenResponse = await res.json();
      localStorage.setItem(config.auth.tokenKey, data.accessToken);
      localStorage.setItem(config.auth.refreshTokenKey, data.refreshToken);
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Logout via BFF-Customer then clear local storage.
   * POST /api/customer/auth/logout
   */
  async logout(): Promise<void> {
    const token = localStorage.getItem(config.auth.tokenKey);
    if (token) {
      try {
        await fetch(`${BFF_BASE}/api/customer/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Best-effort — clear local state regardless
      }
    }
    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.refreshTokenKey);
    localStorage.removeItem('user_id');
    localStorage.removeItem(config.auth.userKey);
  },

  /**
   * Get current user profile.
   * GET /api/customer/auth/me
   */
  async me(): Promise<RegisterResponse | null> {
    const token = localStorage.getItem(config.auth.tokenKey);
    if (!token) return null;

    try {
      const res = await fetch(`${BFF_BASE}/api/customer/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  /** Check if tokens exist client-side */
  isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(config.auth.tokenKey);
  },

  /** Get stored user info (synchronous — from localStorage) */
  getStoredUser(): LoginUserInfo | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(config.auth.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
